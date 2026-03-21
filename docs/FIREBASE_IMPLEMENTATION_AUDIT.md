# Firebase Implementation Audit — CoachConnect AI

**Date:** February 24, 2026  
**Scope:** Complete audit of Firebase (Firestore, Auth) implementation. No code changes.

---

## 1. Firestore Collections & Documents

### 1.1 Collections — Read/Write Matrix

| Collection/Path | Read By | Write By | Data Structure | Inconsistencies |
|-----------------|---------|----------|----------------|-----------------|
| `users/{userId}` | AuthGate, AuthScreen, ClientApp, ProfileScreen, DashboardScreen, ConversationsListScreen, TrainerMessagingScreen, TrainerSearchScreen, MessagesView, NutritionView, ProgressView, DailyQuoteCard, WorkoutPlanGeneratorScreen, MealPlanHomeScreen, clientCRMService, OnboardingScreen | AuthGate, AuthScreen, OnboardingScreen, clientCRMService (updateDoc on users), ClientApp (updateDoc) | uid, email, name, role, trainerId, onboardingCompleted, weight, height, age, etc. | ClientApp writes trainerId via updateDoc — rules allow only userId write; ClientApp reconciliation updates client's doc (client is auth?) |
| `users/{userId}/dailyLogs/{dateKey}` | ClientApp | — | waterIntake, sleepHours | **NO RULES** — Firestore rules define `daily_tracking` not `dailyLogs`. Read will fail with permission-denied. |
| `users/{userId}/daily_tracking/{dateId}` | — | — | (rules only) | Code uses `dailyLogs`; rules use `daily_tracking`. **Path mismatch.** |
| `users/{userId}/foodLogs/{logId}` | enhancedFoodSearchService | — | (rules only) | nutritionService uses `nutrition_logs` (flat), not this subcollection. Two different food log locations. |
| `conversations/{conversationId}` | conversationService, trainerMessaging, trainerPendingRequestsService, ClientApp | trainerMessaging (getOrCreateConversation) | participants, clientId, trainerId, type, lastMessage, lastMessageTime | — |
| `messages/{messageId}` (top-level) | trainerMessaging, conversationService (subscribeToUnreadCount) | trainerMessaging (sendMessage) | conversationId, senderId, text, timestamp, read | **Dual messaging system** — see Section 6. |
| `messages/{combinedUid}/messages/{messageId}` | MessagesView, TrainerMarketplaceModal, trainerPendingRequestsService, ClientApp | TrainerSearchScreen, ClientOnboardingScreen, TrainerMarketplaceModal | senderUid, text, timestamp, status, clientName, clientGoals, etc. | Same logical "messages" stored in two different structures. |
| `trainer_client_links/{linkId}` | clientCRMService (getTrainerClients) | TrainerMarketplaceModal, clientCRMService (createOrUpdateClient) | trainerId, clientId, name, goals, status, joinedAt | — |
| `trainer_clients/{trainerUid}/clients/{clientUid}` | clientCRMService, ClientApp, TrainerMarketplaceModal, ClientApp (reconciliation) | TrainerMarketplaceModal, clientCRMService | name, goals, status, joinedAt, etc. | — |
| `trainer_clients/{trainerUid}/clients/{clientUid}/progress/{progressId}` | clientCRMService, ProgressView | clientCRMService | weight, bodyFat, chest, arms, waist, photos, note | clientCRMService also uses legacy `clients/{clientId}/progress`. |
| `clients/{clientId}` (legacy) | clientCRMService (getTrainerClients, getClient, addProgress, getProgressHistory, createTask, getTasks, updateTask, deleteTask, createNote, getNotes, updateNote) | clientCRMService (createOrUpdateClient, removeClient, updateClient, addProgress, etc.) | trainerId, name, etc. | Dual system with trainer_clients. |
| `clients/{clientId}/progress` | clientCRMService | clientCRMService | — | Legacy path; trainer_clients has progress subcollection. |
| `clients/{clientId}/tasks` | clientCRMService | clientCRMService | — | Same dual structure. |
| `clients/{clientId}/notes` | clientCRMService | clientCRMService | — | Same dual structure. |
| `nutrition_logs/{logId}` | nutritionService | nutritionService | user_id, date, food_name, calories, protein, carbs, fat | Rules use `user_id`; code uses `user_id`. ✓ |
| `nutrition_goals/{goalId}` | nutritionService | nutritionService | user_id, calorie_target, protein_target, etc. | goalId is userId. ✓ |
| `workoutTemplates/{templateId}` | workoutService, ClientApp | workoutService | userId, name, goal, exercises | — |
| `activeWorkouts/{activeWorkoutId}` | workoutService | workoutService | userId, workoutName, exercises, duration | — |
| `completedWorkouts/{completedWorkoutId}` | workoutService | workoutService | userId, completedAt, etc. | — |
| `workouts/{workoutId}` (legacy) | — | — | userId | Rules exist; workoutService uses activeWorkouts/completedWorkouts. |
| `events` (auto-ID) | — | TrainerMarketplaceModal, ClientOnboardingScreen | type, trainerUid, clientUid, timestamp | — |
| `foods/{foodId}` | enhancedFoodSearchService | enhancedFoodSearchService (addDoc, updateDoc) | — | Rules: `allow create, update, delete: if false` — **writes will fail**. |
| `dailyQuote/{quoteId}` | DailyQuoteCard | — | — | Read only in code. |
| `app_errors` | — | (autoLogError does not write to Firestore) | — | autoLogErrorSync only console.logs; no Firestore write. |
| `trainers/{trainerId}` | migrateTrainers.js | migrateTrainers.js | — | **NO RULES** for `trainers` collection. |

### 1.2 Orphan Paths

- **Written but never read:** `events` — written by TrainerMarketplaceModal and ClientOnboardingScreen; no reader found.
- **Read but never written:** `dailyQuote` — DailyQuoteCard reads; no writer in app (likely admin/script).
- **Path mismatch:** `users/{uid}/dailyLogs` used by code; rules define `users/{uid}/daily_tracking`.

---

## 2. Data Flow Per Screen

### 2.1 AuthGate
- **Firebase data:** `users/{uid}` via getDoc.
- **Source:** Direct getDoc on auth state change.
- **Auth:** Single `onAuthStateChanged` listener; passes `user` to TrainerApp or ClientApp.
- **User object:** Passed as prop to child apps.

### 2.2 TrainerApp
- **Firebase data:** Clients via `useTrainerClients` (getTrainerClients), pending requests via `useTrainerPendingRequests`.
- **Source:** Hooks fetch on mount; `refreshClients` callback for manual refresh.
- **Data passed down:** `clients`, `clientsLoading`, `onRefreshClients` to DashboardContent; `pendingRequestsCount` for badge.

### 2.3 ClientApp
- **Firebase data:** users, trainer_clients, messages, conversations, dailyLogs, nutrition_logs, completedWorkouts, activeWorkouts, workoutTemplates.
- **Source:** Direct getDoc/getDocs in useEffect; `getFoodLogsForDate`, `fetchWorkoutHistory`, `getActiveWorkout` from services; `subscribeToUnreadCount` for badge.
- **Data passed down:** `user`, `userData` from AuthGate; fetches `onboardingData`, `trainerData`, etc. internally.

### 2.4 ConversationsListScreen
- **Firebase data:** `conversations` (where participants array-contains userId), `users` for participant names.
- **Source:** `subscribeToConversations` (conversationService) — real-time.
- **Duplicate fetches:** Also fetches `users` and `getTrainerClients` for trainer role check.

### 2.5 TrainerMessagingScreen
- **Firebase data:** `conversations`, top-level `messages` (where conversationId), `users`.
- **Source:** `getOrCreateConversation`, `subscribeToMessages` (trainerMessaging), `getUserData`, `getTrainerClients`.
- **Data from parent:** `trainer`, `conversation` from ConversationsListScreen.

### 2.6 MessagesView (Trainer Dashboard)
- **Firebase data:** `messages/{trainerId}_{clientId}/messages` subcollection, `getTrainerClients`.
- **Source:** onSnapshot on messages subcollection; getTrainerClients for client list.
- **Independent of:** TrainerMessagingScreen — uses different message path.

### 2.7 ClientRequestsScreen
- **Firebase data:** Pending requests from `trainerPendingRequestsService` (conversations + messages subcollection).
- **Source:** `useTrainerPendingRequests` hook — one-time getDocs.

### 2.8 TrainerSearchScreen
- **Firebase data:** `users` (where role=='trainer'), `messages/{tid}_{cid}/messages` (addDoc for request).
- **Source:** getDocs for trainers; addDoc for request; getOrCreateConversation for conversation.

### 2.9 DashboardScreen (Client)
- **Firebase data:** `users`, nutrition logs, workout history.
- **Source:** getDoc(users), getFoodLogsForDate, fetchWorkoutHistory.

### 2.10 Screens Fetching Same Data Independently
- **users/{uid}:** AuthGate, ClientApp, ProfileScreen, DashboardScreen, ConversationsListScreen, TrainerMessagingScreen, NutritionView, ProgressView, WorkoutPlanGeneratorScreen, MealPlanHomeScreen, DailyQuoteCard — each fetches separately.
- **getTrainerClients:** TrainerApp, ConversationsListScreen, MessagesView — each calls independently.

---

## 3. Authentication

### 3.1 User Object Flow
- **AuthGate:** `onAuthStateChanged` → `user` state → passed as prop to TrainerApp or ClientApp.
- **No React Context** for user; passed via props only.
- **Screens using auth.currentUser directly:** TrainerSearchScreen, ClientRequestsScreen, MessagesView, VoiceChatScreen, VoiceAIHomeScreen, WorkoutHistoryScreen, FoodSearchScreen, MacroTrackerScreen, MealPlanHomeScreen, NutritionSettingsScreen, DashboardScreen, TrainerMessagingScreen, ConversationsListScreen, ProgressView, ActiveWorkoutScreen, WorkoutPlanGeneratorScreen.

### 3.2 Auth Assumptions
- **Screens assuming logged-in:** Most screens use `auth.currentUser?.uid` without explicit check; parent (AuthGate) only renders TrainerApp/ClientApp when `user` exists, but child screens may mount before auth resolves.
- **AuthGate** does not render app until `onboardingChecked` and `keyLoaded`; auth state is required for TrainerApp/ClientApp.

### 3.3 Auth Listeners
- **AuthGate.js:** Single `onAuthStateChanged` listener; cleanup on unmount (`return () => unsubscribe()`).

---

## 4. Security Rules vs Code

### 4.1 Rules That Would Deny Code

| Location | Operation | Rule Issue |
|----------|-----------|------------|
| ClientApp.js:897 | getDoc(`users/{uid}/dailyLogs/{dateKey}`) | Rules define `daily_tracking`, not `dailyLogs`. **Permission denied.** |
| enhancedFoodSearchService.js | addDoc/updateDoc to `foods` | Rules: `allow create, update, delete: if false`. **All writes denied.** |
| migrateTrainers.js | getDocs/setDoc on `trainers` | No rules for `trainers` collection. **Permission denied.** |
| ClientApp.js:826, 846 | updateDoc on `users/{clientUid}` | User can only write own doc. When trainer reconciles, clientUid ≠ auth.uid (trainer is logged in). **Permission denied** — unless client is reconciling their own doc (reconcile runs in ClientApp as client). Actually ClientApp runs as client; clientUid = user.uid. So client updates own doc. ✓ |
| clientCRMService.js:128 | updateDoc on `users/{clientId}` | Trainer calling createOrUpdateClient; trainer updates client's doc. Rules: only userId can write. **Permission denied.** |

### 4.2 Collections With No Rules
- `trainers` — used by migrateTrainers.js.
- `users/{userId}/dailyLogs` — code uses it; rules have `daily_tracking` only.

### 4.3 Rules vs Actual Paths
- **messages:** Rules have both `match /messages/{messageId}` (top-level) and `match /messages/{combinedUid}/messages/{messageId}`. Top-level create requires `senderId`; trainerMessaging uses `senderId`. Subcollection uses `senderUid`. Different field names.

---

## 5. Real-time vs One-time Reads

### 5.1 onSnapshot Listeners

| Location | Listener | Cleanup |
|----------|----------|---------|
| AuthGate.js | onAuthStateChanged | ✓ `return () => unsubscribe()` |
| conversationService.js | subscribeToConversations | ✓ Returns unsubscribe |
| conversationService.js | subscribeToUnreadCount | ✓ Returns cleanup |
| trainerMessaging.js | subscribeToMessages | ✓ Returns unsubscribe |
| trainerMessaging.js | subscribeToUnreadCount | ✓ Returns cleanup |
| MessagesView.jsx | messages subcollection | ✓ `return () => unsubscribe()` in useEffect |
| ClientOnboardingScreen.js | messages subcollection | ✓ `return () => unsubscribe()` |
| workoutService.js | subscribeToActiveWorkout | ✓ Returns unsubscribe |
| ClientApp.js | subscribeToUnreadCount | ✓ `return () => unsubscribe()` |
| ConversationsListScreen.js | subscribeToConversations | ✓ `return () => unsubscribe()` |
| TrainerMessagingScreen.js | subscribeToMessages | ❌ **No cleanup** — `initializeConversation` is async; its return value is not used by useEffect. useEffect return is empty. **Memory leak.** |

### 5.2 getDoc/getDocs That Could Be Real-time
- **ClientApp** home data (user, dailyLogs, nutrition, workouts) — one-time fetch; pull-to-refresh could help; real-time optional.
- **getTrainerClients** — one-time; refresh on Client Requests return. Could use onSnapshot on trainer_client_links.
- **trainerPendingRequestsService** — one-time; could use onSnapshot for live request count.

---

## 6. Data Model Inconsistencies

### 6.1 Field Name Variants
- **User ID:** `userId`, `user_id`, `uid`, `clientId`, `trainerId` — used inconsistently.
- **nutrition_logs:** `user_id` (rules and code).
- **nutrition_goals:** `user_id` in payload; document ID is userId.
- **Messages top-level:** `senderId` (trainerMessaging).
- **Messages subcollection:** `senderUid` (MessagesView, TrainerMarketplaceModal).

### 6.2 Date Formats
- **Firestore Timestamp:** serverTimestamp(), .toDate(), .toMillis() used.
- **ISO string:** todayKey = `toISOString().split('T')[0]` for date keys.
- **Unix/numbers:** Some places use raw numbers.

### 6.3 Dual Messaging Systems (Critical)
- **Path A (conversations + top-level messages):** Used by ConversationsListScreen, TrainerMessagingScreen, conversationService, trainerMessaging. Messages: `conversationId`, `senderId`, `text`, `read`.
- **Path B (messages/{tid}_{cid}/messages subcollection):** Used by MessagesView, TrainerSearchScreen, ClientOnboardingScreen, TrainerMarketplaceModal, trainerPendingRequestsService. Messages: `senderUid`, `text`, `timestamp`, `status`, `clientName`, etc.
- **Impact:** Client request ("Hi! I'd like to work with you") is written to Path B. TrainerMessagingScreen reads Path A. Trainer sees empty conversation in TrainerMessagingScreen. MessagesView (per-client) shows Path B — trainer sees request there. Two separate message streams.

### 6.4 Dual Client Storage
- **trainer_clients** subcollection + **trainer_client_links** + **clients** (legacy) + **users** (trainerId). getTrainerClients merges all four.

---

## 7. Error Handling

### 7.1 Try/Catch Coverage
- Most Firebase calls are in try/catch.
- **Gaps:** Some updateDoc/setDoc in batch operations; batch.commit() failure propagates.

### 7.2 Silent Failures
- **clientCRMService createOrUpdateClient:** updateDoc(userDocRef) for trainerId — wrapped in try/catch; logs warning, continues. If it fails (e.g. rules), client's user doc never gets trainerId.
- **autoLogErrorSync:** Only console.logs; no user feedback, no Firestore logging.
- **nutritionService getDailyGoals:** catch returns getDefaultGoals(); no user-visible error.
- **getTrainerClients:** catch returns []; no user feedback.

### 7.3 Loading/Error States
- **useTrainerClients:** loading, error, clients.
- **ClientApp:** loading, setLoading in fetchData.
- **ConversationsListScreen:** loading.
- **TrainerMessagingScreen:** loading, sending.
- **MessagesView:** loading.
- **Gaps:** Some screens (e.g. NutritionView, ProgressView) may not set loading/error for every async op.

---

## 8. AsyncStorage vs Firestore

| Key/Usage | File | Should Be Firestore? | Sync Risk |
|-----------|------|----------------------|-----------|
| `OPENAI_API_KEY` | apiKeyService, ChatScreen, voiceService | No (sensitive) | N/A |
| `ANATROX_FOOD_CACHE` | foodSearchProvider | No (cache) | Can go stale |
| `ANATROX_CHATS`, `ANATROX_CURRENT_CHAT_ID` | chatStorageService | Maybe (chat history) | Out of sync with any server chats |
| `conversations_${userId}` | voiceService | No (voice-specific) | Local only |
| `voice_settings` | voiceService | Could be | Per-device |
| `WORKOUT_PLAN_KEY`, `ONBOARDING_ANSWERS_KEY` | WorkoutPlanScreen, WorkoutPlanGeneratorScreen, WorkoutOnboardingScreen | Yes — workout plans could sync | Stale if user switches devices |
| `onboarding_data_${userId}` | OnboardingScreen | Duplicate of Firestore users | Can go stale |
| `currentQuoteIndex`, `hasSeenFirstQuote`, `userCreatedAt` | DailyQuoteCard | No (UI state) | N/A |
| `THEME_STORAGE_KEY` | ThemeContext | No (preference) | N/A |
| `ACCESS_TOKEN_KEY`, etc. | fatSecretService | No (tokens) | N/A |

---

## 9. Top 10 Issues (Prioritized)

### P1 — Critical

1. **Dual messaging systems — trainer sees empty conversations**
   - **What:** Path A (top-level messages) vs Path B (messages subcollection). Client request goes to Path B; TrainerMessagingScreen reads Path A.
   - **Where:** TrainerSearchScreen writes to Path B; TrainerMessagingScreen reads Path A.
   - **Breaks:** Trainer opens conversation from list → empty chat. Request only visible in MessagesView (per-client) or Client Requests.

2. **dailyLogs path mismatch — permission denied**
   - **What:** ClientApp reads `users/{uid}/dailyLogs/{dateKey}`; rules define `users/{uid}/daily_tracking`.
   - **Where:** ClientApp.js:897.
   - **Breaks:** Water/sleep data never loads; possible crash or empty state.

3. **clientCRMService cannot set trainerId on client's user doc**
   - **What:** createOrUpdateClient calls updateDoc(users, clientId) with trainerId. Rules allow only userId to write.
   - **Where:** clientCRMService.js:128.
   - **Breaks:** Client's user doc never gets trainerId; users fallback in getTrainerClients won't find them; reconciliation logic may fail.

### P2 — High

4. **foods collection writes denied**
   - **What:** enhancedFoodSearchService adds/updates `foods` docs. Rules: create/update/delete = false.
   - **Where:** enhancedFoodSearchService.js.
   - **Breaks:** User-added/custom foods cannot be saved.

5. **TrainerMessagingScreen message listener never unsubscribed**
   - **What:** useEffect calls async initializeConversation(); cleanup from subscribeToMessages is never used.
   - **Where:** TrainerMessagingScreen.js:44–54, 138–153.
   - **Breaks:** Memory leak; listeners accumulate on navigation.

6. **trainers collection has no rules**
   - **What:** migrateTrainers.js reads/writes `trainers`. No matching rule.
   - **Where:** firestore.rules, migrateTrainers.js.
   - **Breaks:** Migration script fails with permission-denied.

### P3 — Medium

7. **Message field mismatch (senderId vs senderUid)**
   - **What:** Top-level messages use `senderId`; subcollection uses `senderUid`. subscribeToUnreadCount uses `senderId`.
   - **Where:** trainerMessaging.js, MessagesView.jsx, conversationService.js.
   - **Breaks:** Unread count logic may be wrong if both paths are ever mixed.

8. **TrainerMarketplaceModal does not create conversation**
   - **What:** On accept, modal writes to trainer_clients and messages subcollection but does not call getOrCreateConversation.
   - **Where:** TrainerMarketplaceModal.js.
   - **Breaks:** ConversationsListScreen may not show new client; depends on ConversationsListScreen's auto-create (which runs for clients with trainerId — but trainerId isn't set by modal).

9. **Redundant fetches of users and getTrainerClients**
   - **What:** Multiple screens fetch users and getTrainerClients independently.
   - **Where:** AuthGate, ClientApp, ConversationsListScreen, MessagesView, etc.
   - **Breaks:** Extra reads, possible inconsistency if data changes mid-session.

### P4 — Low

10. **events collection written but never read**
    - **What:** TrainerMarketplaceModal and ClientOnboardingScreen write to `events`. No reader.
    - **Where:** TrainerMarketplaceModal.js, ClientOnboardingScreen.js.
    - **Breaks:** No functional break; analytics/audit trail unused.

---

## 10. Data Flow Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Firebase Auth                                      │
│                    onAuthStateChanged (AuthGate)                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
            ┌───────────────┐                       ┌───────────────┐
            │  TrainerApp   │                       │  ClientApp    │
            └───────┬───────┘                       └───────┬───────┘
                    │                                     │
    ┌───────────────┼───────────────┐         ┌───────────┼───────────┐
    ▼               ▼               ▼         ▼           ▼           ▼
useTrainerClients  useTrainerPending  DashboardContent  users     subscribeTo
    │               Requests              │               │        UnreadCount
    ▼               │                     │               │             │
getTrainerClients   │                     │               │             │
    │               ▼                     ▼               ▼             ▼
    │         trainerPending         TrainerApp       ClientApp     conversation
    │         RequestsService       Dashboard        Home Data     Service
    │               │                     │               │             │
    ▼               ▼                     ▼               ▼             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  trainer_client_links  trainer_clients  users  messages (sub)  conversations  │
│  clients (legacy)      users            dailyLogs*  messages (top)          │
└─────────────────────────────────────────────────────────────────────────────┘
    * dailyLogs: CODE READS HERE — RULES DEFINE daily_tracking (MISMATCH)

┌─ Trainer Flow ───────────────────────────────────────────────────────────────┐
│ ClientRequestsScreen ← trainerPendingRequests ← conversations +             │
│                       messages/{tid}_{cid}/messages (Path B)                 │
│                                                                              │
│ ConversationsListScreen ← subscribeToConversations ← conversations           │
│                                                                              │
│ TrainerMessagingScreen ← subscribeToMessages ← messages (top-level, Path A)  │
│                       ← getOrCreateConversation ← conversations              │
│  ⚠️ Path A is EMPTY for new requests; request is in Path B                   │
│                                                                              │
│ MessagesView (per client) ← onSnapshot ← messages/{tid}_{cid}/messages      │
│                          ← getTrainerClients                                 │
│  ✓ Shows Path B messages (including request)                                │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ Client Flow ───────────────────────────────────────────────────────────────┐
│ TrainerSearchScreen → getOrCreateConversation → conversations                │
│                   → addDoc → messages/{tid}_{cid}/messages (Path B)           │
│                                                                              │
│ ClientApp Home ← users, dailyLogs*, nutrition_logs, completedWorkouts,       │
│                  activeWorkouts, trainerData (trainer_clients)              │
│  * dailyLogs: permission denied (rules say daily_tracking)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

The app uses two messaging models (conversations + top-level messages vs. messages subcollections), which leads to empty trainer conversations. Path mismatches (`dailyLogs` vs `daily_tracking`) and rules (e.g. `foods`, `trainers`, client `users` updates) cause permission errors. Listener cleanup is missing in TrainerMessagingScreen. Consolidating messaging, aligning paths with rules, and fixing listener cleanup are the main follow-ups.
