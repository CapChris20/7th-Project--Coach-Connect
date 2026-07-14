/**
 * Human-readable descriptions for every comprehensive test assertion.
 * Used by generateReport.js so TEST_RESULTS.md explains what was actually done.
 */
const CATALOG = {
  auth: {
    title: 'Authentication & role routing',
    summary: 'Session transition logic (offline) + live Firebase Auth Admin signup/login/token flows.',
    tests: {
      'Auth uid transition clears session on switch': {
        what: 'Switching Firebase UID clears local session data (prevents stale client state).',
        how: 'Calls `handleAuthUidTransition(prevUid, nextUser)` from `src/auth/authSessionTransition.js` with mock deps.',
        expects: '`clearAllUserData()` invoked when uid changes from u1 → u2.',
      },
      'Auth logout clears local user data': {
        what: 'Signing out (null uid) wipes cached user data.',
        how: 'Calls `handleAuthUidTransition("u1", null, deps)`.',
        expects: '`clearAllUserData()` called on logout.',
      },
      'Live signup trainer + Firestore role': {
        what: 'Trainer can be created in Firebase Auth with matching Firestore profile.',
        how: 'Firebase Admin `auth().createUser()` + `users/{uid}.set({ role: "trainer" })`.',
        expects: 'Firestore `users/{uid}` exists with `role === "trainer"`.',
      },
      'Live login trainer + role correct': {
        what: 'Custom token exchange + role doc still correct after login.',
        how: '`createCustomToken(uid)` → Identity Toolkit `signInWithCustomToken` → read `users/{uid}`.',
        expects: 'ID token returned; Firestore role remains `trainer`.',
      },
      'Live create second user (client)': {
        what: 'A separate client account can be created (multi-user support).',
        how: 'Second `createUser()` with `role: "client"`.',
        expects: 'Client uid ≠ trainer uid.',
      },
      'Forgot password email link generated': {
        what: 'Password reset flow can generate a valid reset link.',
        how: 'Firebase Admin `auth().generatePasswordResetLink(email)`.',
        expects: 'URL contains `oobCode` query param.',
      },
      'Token refresh works': {
        what: 'ID tokens can be minted/refreshed for an authenticated user.',
        how: 'Two consecutive `getIdTokenForUid(uid)` calls via custom token exchange.',
        expects: 'Both calls return non-empty JWT strings.',
      },
    },
  },
  'trainer-client-linking': {
    title: 'Trainer–client linking (3 surfaces)',
    summary: 'Verifies `users.trainerId`, `trainer_clients/{tid}/clients/{cid}`, and `trainer_client_links/{tid}_{cid}` stay in sync.',
    tests: {
      'Client connection request message created': {
        what: 'Client can send a pending connection request message.',
        how: 'Firestore `messages.add({ requestType: "connection", status: "pending" })`.',
        expects: 'Message doc exists with `requestType === "connection"`.',
      },
      'All 3 collections written on accept': {
        what: 'Accepting a client writes all three linking surfaces atomically.',
        how: 'Batch: `trainer_client_links`, `trainer_clients/.../clients`, `users.trainerId`.',
        expects: 'All three docs exist after batch commit.',
      },
      'All 3 collections cleared on remove': {
        what: 'Removing a trainer clears all three linking surfaces.',
        how: 'Batch delete link + CRM doc + `FieldValue.delete()` on `users.trainerId`.',
        expects: 'No trainerId on user; link and CRM docs gone.',
      },
    },
  },
  messaging: {
    title: 'Messaging & unread badges',
    summary: 'Top-level `messages` collection + denormalized `users/{uid}/unreadCount/index`.',
    tests: {
      'Unread index schema (total + conversations)': {
        what: 'Unread badge uses `{ total, conversations }` shape (not legacy `count`).',
        how: 'Schema contract check on documented index structure.',
        expects: '`total` number + `conversations` object.',
      },
      'Message write completes': {
        what: 'A message can be written to Firestore quickly.',
        how: '`messages.add({ conversationId, senderId, text, read: false })`.',
        expects: 'Write completes in < 2s.',
      },
      'Unread index increment': {
        what: 'Unread index can be updated for a conversation.',
        how: '`users/{uid}/unreadCount/index.set({ total: 1, conversations: { [convId]: 1 } })`.',
        expects: '`total > 0` after increment.',
      },
      'Mark as read clears badge': {
        what: 'Setting unread total to 0 clears the badge.',
        how: 'Update unread index `{ total: 0, conversations: { [convId]: 0 } }`.',
        expects: '`total === 0`.',
      },
      '100 messages batch write': {
        what: 'Chat can handle a burst of 100 messages without error.',
        how: 'Single Firestore batch with 100 `messages` docs, then query by `conversationId`.',
        expects: 'Query returns ≥ 100 messages.',
      },
    },
  },
  'food-search': {
    title: 'Food search (production API)',
    summary: 'Live calls to Cloud Run: branded search, generic food, nutrition consensus, barcode.',
    tests: {
      "Search McDonald's brand": {
        what: 'Branded restaurant search returns results.',
        how: 'GET `/api/food/search?query=McDonald\'s` with Bearer token.',
        expects: 'HTTP 200 + `results.length > 0`.',
      },
      'Search generic food chicken': {
        what: 'Generic food query returns results.',
        how: 'GET `/api/food/search?query=chicken`.',
        expects: 'HTTP 200 + non-empty results array.',
      },
      'Gibberish search completes fast': {
        what: 'Nonsense query does not hang the API.',
        how: 'GET `/api/food/search?query=qwertyasdfgh`.',
        expects: 'Response within 15s (no timeout).',
      },
      'Big Mac nutrition search returns data': {
        what: 'Multi-source nutrition consensus finds Big Mac.',
        how: 'POST `/api/nutrition/search` body `{ foodName: "Big Mac" }`.',
        expects: 'HTTP 200 + food object with name containing "big mac".',
      },
      'Barcode scan POST /api/food/barcode': {
        what: 'Barcode lookup returns a food item.',
        how: 'POST `/api/food/barcode` body `{ barcode: "012000007962" }` (Coca-Cola UPC).',
        expects: 'HTTP 200 + item with `name`.',
      },
      "Typo matching Mcdonalds → McDonald's": {
        what: 'Typo-tolerant search still finds McDonald\'s brand.',
        how: 'GET `/api/food/search?query=Mcdonalds`.',
        expects: 'Result brand/name contains "mcdonald".',
      },
    },
  },
  'ai-coach': {
    title: 'AI Coach (production API)',
    summary: 'Health check, DeepSeek chat, web search, workout generation limits.',
    tests: {
      'Health endpoint reachable': {
        what: 'Production API is up and AI keys configured.',
        how: 'GET `/api/health` (no auth).',
        expects: '`ok: true` or `aiCoachReady: true`.',
      },
      'AI Coach response received': {
        what: 'Coach returns a reply to a simple nutrition question.',
        how: 'POST `/api/ai-coach` with `{ userId, messages: [{ role: "user", content: "..." }] }`.',
        expects: 'HTTP 200 + non-empty `reply` within 90s.',
      },
      'Web search returns sources': {
        what: 'Coach web-search mode returns a reply (optionally with sources).',
        how: 'POST `/api/ai-coach` with `options: { web: "on" }`.',
        expects: 'HTTP 200 + `reply`; sources if Perplexity/Serper attached.',
      },
      'Workout generation limit enforced': {
        what: 'Monthly workout generation cap is enforced server-side.',
        how: 'POST `/api/workout/generate` for user at monthly limit.',
        expects: 'HTTP 429 or `error: monthly_limit_reached`.',
      },
    },
  },
  'firestore-listeners': {
    title: 'Firestore listener wiring (code audit)',
    summary: 'Verifies key files contain correct listener/subscribe patterns (not runtime UI test).',
    tests: {
      'Unread index single listener (subscribeToUnreadIndex)': {
        what: 'One listener on `users/{uid}/unreadCount/index` instead of N per conversation.',
        how: 'Source scan: `src/messaging/unreadCountIndex.js`.',
        expects: 'Exports `subscribeToUnreadIndex` using `onSnapshot`.',
      },
      'Trainer unread hook (useUnreadNotificationCount)': {
        what: 'Trainer badge uses shared unread hook.',
        how: 'Source scan: `src/notifications/useUnreadNotificationCount.js`.',
        expects: 'Uses `subscribeToUnreadCount` + `useEffect` cleanup.',
      },
      'SessionsContext dedupes training sessions listener': {
        what: 'Trainer sessions use one shared listener via context.',
        how: 'Source scan: `useMyTrainingSessions.js`.',
        expects: 'Contains `onSnapshot` + `trainer_clients` path.',
      },
      'Mark all messages read pagination (READ_PAGE_SIZE 50)': {
        what: 'Mark-read does not load unlimited messages at once.',
        how: 'Source scan: `markAllMessagesRead.js`.',
        expects: '`READ_PAGE_SIZE = 50` + paginated `writeBatch`.',
      },
      'Client home daily date key bootstrap': {
        what: 'Home dashboard uses stable local date keys.',
        how: 'Unit test file `clientHomeBootstrap.test.js` exists with `getLocalDateKey` tests.',
        expects: 'Date key format YYYY-MM-DD.',
      },
    },
  },
  'workout-generation': {
    title: 'Workout plan generation',
    summary: 'Claude-powered workout plan API.',
    tests: {
      'Workout plan prompt module present': {
        what: 'Server has workout prompt builder module.',
        how: 'File exists: `server/lib/workoutPlanPrompt.js` or related test.',
        expects: 'Module importable.',
      },
      'POST /api/workout/generate returns plan': {
        what: 'Authenticated user can generate a workout plan.',
        how: 'POST `/api/workout/generate` with profile payload.',
        expects: 'HTTP 200 + `text` or `plan` field.',
      },
      'Workout generation rate limit active': {
        what: 'Rate limit returns 429 when monthly cap hit.',
        how: 'POST `/api/workout/generate` for capped user.',
        expects: 'HTTP 429 when limit reached.',
      },
    },
  },
  'ai-tools': {
    title: 'AI Coach tool execution',
    summary: 'Server-side `executeTool` validates and runs coach tools.',
    tests: {
      'executeTool module exports function': {
        what: 'Tool executor is wired on the server.',
        how: 'Require `server/lib/coachTools/executeTool.js`.',
        expects: '`typeof executeTool === "function"`.',
      },
      'Unknown tool returns error object': {
        what: 'Invalid tool names fail safely.',
        how: '`executeTool(uid, { name: "__nonexistent_tool__" })`.',
        expects: '`success: false` or error message.',
      },
      'Tool: logSleep validates input': {
        what: 'logSleep rejects invalid hours.',
        how: '`executeTool(uid, { name: "logSleep", params: { hours: 99 } })`.',
        expects: '`success: false` for out-of-range hours.',
      },
    },
  },
  'account-deletion': {
    title: 'Account deletion purge',
    summary: 'Paginated Firestore purge for GDPR-style account removal.',
    tests: {
      'Purge PAGE_SIZE is 100': {
        what: 'Purge deletes in pages of 100 (no 500-doc batch limit crash).',
        how: 'Read `PAGE_SIZE` from `functions/lib/purgeUserFirestore.js`.',
        expects: '`PAGE_SIZE === 100`.',
      },
      'purgeUserFirestore recursive-deletes user doc': {
        what: 'User subtree is recursively deleted.',
        how: 'Mock Firestore DB + call `purgeUserFirestore(db, uid)`.',
        expects: '`recursiveDelete(users/{uid})` called.',
      },
      'Live auth user delete': {
        what: 'Firebase Auth user can be deleted via Admin SDK.',
        how: '`auth().createUser()` then `auth().deleteUser(uid)`.',
        expects: 'User no longer exists in Auth.',
      },
    },
  },
  'trainer-dashboard': {
    title: 'Trainer dashboard',
    summary: 'Error boundaries, pending requests loader, CRM roster.',
    tests: {
      'TrainerApp wrapped in ErrorBoundary': {
        what: 'Trainer app crashes are caught by error boundary.',
        how: 'Source scan: `src/app-start/TrainerApp.js`.',
        expects: 'Contains `<ErrorBoundary>`.',
      },
      'loadPendingTraineeRequests module exists': {
        what: 'Pending client request loader is present.',
        how: 'File exists: `loadPendingTraineeRequests.js`.',
        expects: 'Module on disk.',
      },
      'Trainer CRM client roster write/read': {
        what: 'Trainer can store active clients under CRM path.',
        how: 'Firestore `trainer_clients/{trainerId}/clients/{clientId}.set(...)`.',
        expects: 'Doc exists with `status: "active"`.',
      },
    },
  },
  'client-dashboard': {
    title: 'Client dashboard',
    summary: 'Error boundaries, role routing, daily logs.',
    tests: {
      'ClientApp wrapped in ErrorBoundary': {
        what: 'Client app crashes are caught.',
        how: 'Source scan: `src/app-start/ClientApp.js`.',
        expects: 'Contains `<ErrorBoundary>`.',
      },
      'AuthGate routes by user role': {
        what: 'AuthGate sends trainers vs clients to correct app shell.',
        how: 'Source scan: `src/app-start/AuthGate.js`.',
        expects: 'Role-based routing logic present.',
      },
      'Client daily log write/read': {
        what: 'Client can write daily nutrition metrics.',
        how: 'Firestore `users/{uid}/dailyLogs/{YYYY-MM-DD}.set({ calories: 500 })`.',
        expects: 'Doc readable with `calories === 500`.',
      },
    },
  },
  notifications: {
    title: 'Notifications & push tokens',
    summary: 'Unread hook + push token storage.',
    tests: {
      'useUnreadNotificationCount uses unread index listener': {
        what: 'Notification badge uses denormalized unread index.',
        how: 'Source scan: `useUnreadNotificationCount.js`.',
        expects: 'Uses `subscribeToUnreadCount`.',
      },
      'sendTrainerNotification module exists': {
        what: 'Trainer push notification sender exists.',
        how: 'File: `sendTrainerNotification.js`.',
        expects: 'Module on disk.',
      },
      'Push token doc write/read': {
        what: 'Device push tokens can be stored per user.',
        how: 'Firestore `users/{uid}/pushTokens/{deviceId}.set({ token })`.',
        expects: 'Token doc readable.',
      },
    },
  },
  'progress-photos': {
    title: 'Progress photos',
    summary: 'Photo metadata storage under user subcollection.',
    tests: {
      'Progress photo UI modules present': {
        what: 'Progress photo UI code exists in src.',
        how: 'Directory scan for progress photo components.',
        expects: '≥ 1 matching module file.',
      },
      'Progress photo metadata Firestore write': {
        what: 'Photo metadata can be saved to Firestore.',
        how: '`users/{uid}/progressPhotos/{id}.set({ url, takenAt })`.',
        expects: 'Doc exists after write.',
      },
    },
  },
  'weekly-summaries': {
    title: 'Weekly summaries',
    summary: 'Weekly rollup docs under user subcollection.',
    tests: {
      'Weekly summaries collection contract testable': {
        what: 'Weekly summary path is `users/{uid}/weeklySummaries`.',
        how: 'Module scan + Firestore contract.',
        expects: 'Subcollection writable.',
      },
      'Weekly summary Firestore write/read': {
        what: 'Weekly stats can be stored and read back.',
        how: '`weeklySummaries/{weekId}.set({ workoutsCompleted: 3 })`.',
        expects: '`workoutsCompleted === 3`.',
      },
    },
  },
  'session-scheduling': {
    title: 'Session scheduling',
    summary: 'Training sessions under `trainer_clients/{tid}/sessions`.',
    tests: {
      'useMyTrainingSessions listens on trainer_clients sessions': {
        what: 'Sessions hook listens on correct Firestore path.',
        how: 'Source scan: `useMyTrainingSessions.js`.',
        expects: 'References `trainer_clients` + `onSnapshot`.',
      },
      'SessionsContext provider exists': {
        what: 'Shared context avoids duplicate session listeners.',
        how: 'File: `SessionsContext.jsx`.',
        expects: '`SessionsProvider` exported.',
      },
      'Training session Firestore write/read': {
        what: 'A scheduled session can be created and read.',
        how: '`trainer_clients/{tid}/sessions/{id}.set({ status: "scheduled" })`.',
        expects: 'Doc exists with `status === "scheduled"`.',
      },
    },
  },
  'apple-iap': {
    title: 'Apple IAP (no real charges)',
    summary: 'Verify endpoint wiring; Stripe excluded from suite.',
    tests: {
      'IAP dev test script exists': {
        what: 'Manual IAP test script available.',
        how: 'File: `scripts/testIapDevBuild.js`.',
        expects: 'Script on disk.',
      },
      'subscriptionRoutes module exists': {
        what: 'Apple subscription routes registered.',
        how: 'File: `server/routes/subscriptionRoutes.js`.',
        expects: 'Module on disk.',
      },
      'Apple IAP verify rejects unauthenticated/invalid receipt': {
        what: 'Verify endpoint requires auth.',
        how: 'POST `/api/subscription/apple/verify` without Bearer token.',
        expects: 'HTTP 401/403/400.',
      },
      'Stripe/payment webhooks excluded from comprehensive suite': {
        what: 'Stripe billing not tested in this suite (per spec).',
        how: 'Documented exclusion.',
        expects: 'N/A — informational pass.',
      },
    },
  },
  'scale-tests': {
    title: 'Load / scale smoke',
    summary: 'Lightweight concurrency checks (not full 500-user load test).',
    tests: {
      '20 concurrent health checks': {
        what: 'API handles 20 parallel health requests.',
        how: 'Promise.all 20× GET `/api/health`.',
        expects: '≥ 90% return HTTP 200.',
      },
      'Batch 50 Firestore writes': {
        what: 'Firestore accepts a 50-doc batch write quickly.',
        how: 'Admin batch to `_cc_scale_test` collection, then cleanup.',
        expects: 'Batch commit < 10s.',
      },
    },
  },
};

function lookupTestMeta(category, testName) {
  const cat = CATALOG[category];
  const entry = cat?.tests?.[testName];
  if (!entry) return {};
  return {
    categoryTitle: cat.title,
    categorySummary: cat.summary,
    what: entry.what,
    how: entry.how,
    expects: entry.expects,
  };
}

function getCategoryInfo(category) {
  const cat = CATALOG[category];
  if (!cat) return { title: category, summary: '' };
  return { title: cat.title, summary: cat.summary };
}

module.exports = { CATALOG, lookupTestMeta, getCategoryInfo };
