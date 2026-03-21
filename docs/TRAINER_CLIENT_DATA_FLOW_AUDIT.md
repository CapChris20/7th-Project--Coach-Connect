# Trainer-Client Data Flow Audit

**Generated:** February 2025  
**Purpose:** Audit the trainer-client data flow and identify issues.

---

## 1. DATA FLOW OVERVIEW

### Connection Paths (Two Flows)

| Flow | Entry Point | Data Written | Result |
|------|-------------|--------------|--------|
| **Find Trainer** | TrainerSearchScreen (client) | conversation, message (pending), users/{clientId}.trainerId | Trainer sees in Client Requests |
| **Trainer Code** | OnboardingScreen step 7 (client) | trainerId in onboardingData | createOrUpdateClient on finish |

### Collections Used

| Collection | Purpose |
|------------|---------|
| `conversations/{conv_clientId_trainerId}` | Links client-trainer pairs for trainerPendingRequestsService |
| `messages/{trainerUid}_{clientUid}/messages` | Nested messages (Find Trainer flow, MessagesView) |
| `trainer_clients/{trainerUid}/clients/{clientUid}` | CRM – trainer’s client list |
| `users/{userId}` | User profile; `trainerId` links client to trainer |

---

## 2. ISSUES FOUND

### P0 – Critical (FIXED)

#### 1. clientCRMService missing `setDoc` import ✅ FIXED
- **File:** `src/trainer/services/clientCRMService.js`
- **Issue:** Uses `setDoc` at lines 136, 139, 155, 221 but it is not imported from `firebase/firestore`.
- **Impact:** `createOrUpdateClient`, `syncClientDataFromUsers`, and trainer-code onboarding will throw at runtime.
- **Fix:** Add `setDoc` to the Firestore imports.

#### 2. MessagesView uses different `combinedUid` convention ✅ FIXED
- **File:** `src/trainer/components/MessagesView.jsx` (lines 57, 97)
- **Issue:** Uses `[trainerId, selectedClient].sort().join('_')` (alphabetical).
- **Rest of app:** Uses `trainerUid_clientUid` (trainer first).
- **Impact:** When `clientId < trainerId` alphabetically, MessagesView reads `clientId_trainerId` while messages are written to `trainerUid_clientUid` → wrong path, no messages.
- **Fix:** Use `${trainerId}_${selectedClient}` (trainer first) instead of sort.

### P1 – High (FIXED)

#### 3. Client assigns trainerId before trainer accepts ✅ FIXED
- **File:** `src/ai/screens/TrainerSearchScreen.js` (lines 137–148)
- **Issue:** Client writes `trainerId` to `users/{clientId}` as soon as they send a request.
- **Impact:** If trainer rejects, client still has `trainerId` and may see the rejected trainer in ClientApp.
- **Fix:** Only set `trainerId` when trainer accepts (e.g. in TrainerMarketplaceModal). Or clear it when status becomes `rejected`.

#### 4. TrainerMarketplaceModal does not update `users/{clientId}.trainerId`
- **File:** `src/trainer/components/TrainerMarketplaceModal.js`
- **Note:** TrainerSearchScreen already sets `trainerId` when the client sends the request, so this is redundant for Find Trainer. For trainer-code flow, `createOrUpdateClient` updates the user doc. No change needed if P0 #1 is fixed.

#### 5. TrainerMarketplaceModal writes minimal client data ✅ FIXED
- **File:** `src/trainer/components/TrainerMarketplaceModal.js` (lines 50–58)
- **Issue:** Writes only `name`, `goals`, `experience`, `equipment`, `limitations` to `trainer_clients`.
- **Note:** `createOrUpdateClient` syncs full user data. TrainerMarketplaceModal does not call it; it uses a batch with minimal fields. Client may appear with incomplete profile until a sync runs. Consider calling `createOrUpdateClient` or `syncClientDataFromUsers` after accept.

### P2 – Medium (FIXED)

#### 6. ClientOnboardingScreen Firestore query
- **File:** `src/client/screens/ClientOnboardingScreen.js` (lines 18–24)
- **Query:** `where('status', 'in', ['pending', 'accepted', 'rejected'])`, `orderBy('timestamp', 'desc')`
- **Note:** May require a composite index. Confirm in Firebase Console; add index if needed.

#### 7. Dual systems: `clients` vs `trainer_clients` ✅ PARTIALLY FIXED
- **Issue:** `clientCRMService` uses both `trainer_clients` (primary) and legacy `clients` (fallback).
- **Impact:** `getClient` reads from `clients`; `getTrainerClients` reads from `trainer_clients`. Mixed usage can cause confusion.
- **Note:** Documented in TRAINER_CLIENT_MIGRATION.md. Migration is a larger refactor.

#### 8. `events` collection rules
- **File:** `firestore.rules` (line 388+)
- **Status:** Rules exist – authenticated users can create events. TrainerMarketplaceModal write is allowed.

---

## 3. DATA FLOW DIAGRAMS

### Find Trainer Flow (Client → Trainer)

```
Client (TrainerSearchScreen)
  → getOrCreateConversation(clientId, trainerId)
  → conversations/conv_{clientId}_{trainerId} created
  → addDoc(messages/{trainerId}_{clientId}/messages) with status: 'pending'
  → updateDoc(users/{clientId}) { trainerId, trainerName }  ← Too early

Trainer (ClientRequestsScreen)
  → getTrainerPendingRequests: conversations where participants contains trainerUid
  → For each conv: query messages/{trainerUid}_{clientUid}/messages where status=='pending'
  → TrainerMarketplaceModal: Accept → trainer_clients, welcome message, update status
```

### Trainer Code Flow (Onboarding)

```
Client (OnboardingScreen)
  → validateTrainerCode: query users where inviteCode == code
  → onboardingData.trainerId = trainerDoc.id
  → On finish: createOrUpdateClient(userId, trainerId, clientPayload)
  → trainer_clients/{trainerId}/clients/{userId} created
  → users/{userId}.trainerId updated by createOrUpdateClient
```

---

## 4. RECOMMENDED FIXES (PRIORITY)

| Priority | Fix | Status |
|----------|-----|--------|
| P0 | Add `setDoc` to clientCRMService imports | ✅ Done |
| P0 | Change MessagesView to use `trainerId_clientId` (no sort) | ✅ Done |
| P1 | Move trainerId assignment to trainer accept, or clear on reject | ✅ Done |
| P1 | After TrainerMarketplaceModal accept, call syncClientDataFromUsers for full profile | ✅ Done |
| P2 | Verify Firestore index for ClientOnboardingScreen query | ✅ Index exists |
| P2 | Update getClient to prefer trainer_clients when trainerId provided | ✅ Done |

---

## 5. FILES INVOLVED

| File | Role |
|------|------|
| `trainerPendingRequestsService.js` | Loads pending requests from conversations + messages |
| `TrainerMarketplaceModal.js` | Accept/reject; writes trainer_clients, messages |
| `clientCRMService.js` | getTrainerClients, createOrUpdateClient, syncClientDataFromUsers |
| `TrainerSearchScreen.js` | Client sends request; creates conversation, message |
| `MessagesView.jsx` | Trainer messages clients; uses messages subcollection |
| `OnboardingScreen.js` | Trainer code validation; createOrUpdateClient on finish |
| `ClientApp.js` | Uses userData.trainerId to load trainer |

---

*End of audit.*
