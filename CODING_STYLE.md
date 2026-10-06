# CoachConnect Coding Style Guide

## Goal

Write code like a junior developer would write it.

- No patterns. No tricks. No cleverness.
- Every line obvious. Every variable explicit. Every function does one job.
- Professional and polished, but straightforward.
- Same behavior. Different presentation.

A junior should be able to open any file in `src/` and understand it in about two minutes.

## File shape

Every real file uses the same sections, in this order:

```javascript
// What this file does.
// Flow: step A → step B → step C.
// Used by: the screen or helper that calls it.

import { ... } from '...';

// ===== NAMED CONSTANTS =====

const REQUEST_STATUS_PENDING = 'pending';
const CLIENT_NAME_DEFAULT = 'Client';

// ===== HELPER FUNCTIONS =====

/**
 * Find the client id in a two-person conversation.
 * The client is whoever is not the trainer.
 * @param {string[]} conversationParticipants
 * @param {string} trainerUid
 * @returns {string|null}
 */
function findClientUidInConversation(conversationParticipants, trainerUid) {
  // ...
}

// ===== MAIN FUNCTION =====

/**
 * Fetch all pending client requests for a trainer.
 * Flow: 1. find conversations  2. pending messages  3. newest per client  4. return the list
 * @param {string} trainerUid
 * @returns {Promise<Array>}
 */
export async function getTrainerPendingRequests(trainerUid) {
  // ...
}
```

React screens keep every hook inside the main component, in the same order they already run. Helpers above the component do not call hooks.

## Rules

### 1. Named constants

Magic numbers and strings that mean a rule go at the top in `UPPER_SNAKE_CASE`.

```javascript
const PAYMENT_TIMEOUT_MS = 20000;
const MAX_RETRY_ATTEMPTS = 3;
```

Layout numbers inside `StyleSheet.create` (`padding: 16`, `borderRadius: 12`) stay inline. Naming those makes the file harder to scan.

Firestore field names, collection names, API paths, and storage keys may be wrapped in constants. The **letters of the value never change**.

### 2. Section headers

```javascript
// ===== NAMED CONSTANTS =====
// ===== HELPER FUNCTIONS =====
// ===== MAIN FUNCTION =====
```

### 3. Explicit names

No abbreviations except: `id`, `url`, `api`, `db`, `req`, `res`, `msg`, `uid`, `doc`.

```javascript
const currentUser = user;
const messageTimestamp = timestamp;
const conversationData = conversation;
```

### 4. Booleans

Start with `is`, `has`, `can`, `should`, or `does`.

```javascript
const isUserActive = true;
const isLoadingData = false;
```

### 5. Function names

Name what the function does.

```javascript
function validateUserPayment() {}
function fetchTrainerClients() {}
```

### 6. Function size

Max 30 lines. If it is longer, break it into helpers above the main function.

The main React component may be longer than 30 lines because hooks must stay inside it, in their original order. Everything else around it stays under 30 lines.

### 7. Nesting

Max 2 levels deep. Pull a complicated condition into a named function.

```javascript
function isUserEligibleForPayment(user) {
  return user.email && user.verified && user.stripeId;
}

if (isUserEligibleForPayment(user) && isTrainerActiveAndExists(trainer)) {
  // ...
}
```

### 8. JSDoc

Every exported function gets JSDoc: what it does, what it takes, what it returns.

### 9. Comments

Explain why, not what. Also tag unfamiliar APIs with `// vocab:` the first time they appear, and tag tweakable numbers with `// Manipulate here:`.

### 10. Freeze list (do not change behavior)

- Do not move or rename files.
- Do not change import paths.
- Do not rename exported functions or components. Other files call those names.
- Do not reorder hooks.
- Do not change `onSnapshot` cleanup.
- Do not change the letters inside Firestore, API, or storage strings.
- Do not change object keys that other files read.
- Do not add or remove branches.

## Example

Before: one function fetches, filters, sorts, and shapes the result, with names like `conv`, `tA`, and `msgSnapshot`.

After: constants at the top, one helper per job (`findClientUidInConversation`, `fetchPendingMessagesFromClient`, `sortMessagesByTimestampNewest`, `processConversationForRequest`), and a main function that reads as a short list of steps. The gold-standard shape is the `getTrainerPendingRequests` outline in the "File shape" section above. The live file is `src/trainer-app/new-requests/loadPendingTraineeRequests.js`.

## How to use this

When asking for new code or a refactor, say: **Follow CODING_STYLE.md.**
