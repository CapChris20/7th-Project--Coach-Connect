# CoachConnect Coding Style Guide

## North star (maintainability)

This app should be a **maintainable product codebase** — one you or **any engineer** can open, read, debug, and change without decoding terse names or “clever” AI output.

- **Syntax as simple as humanly possible** — plain English, shallow nesting, obvious control flow.
- **Same behavior** — screens, data shapes, exports, Firestore/API key **letters**, hook order, Firebase project id `anatrox-auth` ([freeze list](#freeze-list-do-not-change-behavior)).
- **Not a presentation pass** — headers plus one numbered main while 800 lines stay old-style does **not** count.

When asking for new code or a rewrite, say: **Follow CODING_STYLE.md (Variation 3).**

## Goal

Write a **plain-English recipe**. Same behavior. Different telling.

- No patterns. No tricks. No cleverness.
- Every line obvious. Every variable explicit. Every function does one job.
- The **main function is a numbered checklist** someone can narrate without decoding letters.
- Same screens. Same Firestore, API, and food-card keys.

A person should open any file in `src/` and follow what the app is doing top to bottom.

This style is **Variation 3**.

## Full rewrite vs presentation pass

Use this when redoing existing files (the ~433-file pass). Mechanical checker PASS is a **floor**, not proof of done.

| Rule | Presentation pass (fail) | Full rewrite (pass) |
|------|--------------------------|---------------------|
| Intent | Looks updated | **Maintainable** — behavior traceable from names |
| Scope | Main + a few renames | **Entire file** — every line a human might read must be layman-clear. PLUMBING may stay long, but names stay plain (`t` / `gp` fail) |
| Names | Fix checker hits only | Spoken names everywhere; no `t`, `gp`, `bg`, `conv`, … |
| Nesting | Main shallow enough | **Every function** max depth 2 |
| Recipe | Main only | Main + screen handlers that orchestrate work (`// 1.`–`// 6.`) |
| JSX | Left dense | Named locals above JSX; small in-file subcomponents when needed |
| Strip vs git HEAD | Ignored | Comment-stripped body must **differ** from HEAD — **SAME-CODE = not done** |
| Human read | Skipped | Full file: “Could Chris change behavior from names/comments alone?” |

Run `node scripts/stripBatchGate.mjs scripts/full-rewrite/batch1a.txt scripts/full-rewrite/batch1b.txt` (or any batch list) before treating a batch as done.

**Agent anti-patterns (do not ship):**

- Header-only or section-banner-only edits.
- One numbered main at the bottom while helpers stay cryptic.
- Rename three locals and call it a day.
- Extract one helper to pass nesting checker but leave the rest of the file untouched.
- Prefer **boring and long** over short and clever when clarity wins.

**Exceptions:** React error boundaries may stay `class` (`CrashCatcher.jsx`). Generated registries: plain file-top summary + constants only — do not invent keys.

## Layman-friendly syntax (primary bar)

Same behavior. The **syntax** has to say what is happening. A comment that only explains a dense line means that line still needs a rewrite.

| Avoid | Prefer |
|-------|--------|
| `extract` / `initialize` / `process` when a shorter everyday name works | `findPossibleInstructions`, `tryParseJson`, `removeDuplicateInstructions` |
| `raw`, `parsedObject`, `sanitizedInput` with no context | `reply`, `movieData`, `cleanedMovieName` |
| Nested `? :` inside JSX, one-letter locals, tricks to save lines | Name the decision first (`cardBackgroundColor`, `noWeeksSaved`), then `if` / early return |
| 300 lines of helpers before the point | **Story first:** file header → mains with Step 1 / 2 / 3 → exports → **PLUMBING** |

1. Name the decision before you use it.
2. Use `if` and an early `return` instead of a nested ternary in JSX.
3. One function, one job. If the description needs "and," split it.
4. The main reads as a short list of those names. Hard leftovers go under `// PLUMBING — skip unless debugging`.

Comments are only for a reason the name cannot carry (a Firestore path whose letters must stay, a timeout you can tweak). Do not comment every function to hide syntax.

Gold files to copy (not scheduling-only):

- Frontend: `src/for-both/weekly-report/WeeklyReportBody.jsx`
- Full stack: `src/for-both/weekly-report/WeeklyReportScreen.jsx`
- Backend: `src/nutrition/food-search/searchFoods.js` (main is a short list of named calls; Open Food Facts helpers stay in PLUMBING)
- Index: `docs/gold-examples/README.md`

Full-stack screens: a pure layout function near the top (no hooks), the exported component at the bottom doing Firestore / state, ending in `return <ScreenLayout ... />`. You cannot put `return` before the hooks it uses. See `BookSessionScreen.jsx` and `WeeklyReportScreen.jsx`.

**Batch 1 was an older pass** (headers + a numbered main). Redo `scripts/full-rewrite/batch1a.txt` and `batch1b.txt` to this bar. Do not `git restore` those files. Do not wipe `WeeklyReportBody.jsx`, `WeeklyReportScreen.jsx`, or `BookSessionScreen.jsx`.

### Tone reference (copy the After voice)

Exported names in this repo stay frozen. The examples below rename freely because they are not Coach Connect files. Match the **voice** inside a file.

**Movie prerequisites — after:**

```javascript
function getRequiredMovies(movieName) {
  const cleanedMovieName = cleanMovieName(movieName);
  const apiUrl = `http://api.example.com/movies?title=${encodeURIComponent(cleanedMovieName)}`;

  return fetchMovieData(apiUrl)
    .then(movieData => {
      if (!movieData || !movieData.prerequisites || !Array.isArray(movieData.prerequisites)) {
        throw new Error('Movie data is not in the expected format');
      }
      const requiredMovies = movieData.prerequisites.map(prereq => ({
        id: prereq.id,
        name: prereq.title,
        summary: prereq.description,
      }));
      return requiredMovies;
    })
    .catch(error => {
      console.error(`Could not get required movies for "${movieName}":`, error);
      return [];
    });
}
```

**Daily calories — after:**

```javascript
function calculateDailyCalories(weightKg, heightCm, ageYears, gender) {
  const genderConstant = gender === 'male' ? 5 : -161;
  const dailyCalories = 88.362 + (13.397 * weightKg) + (4.799 * heightCm) - (5.677 * ageYears) + genderConstant;
  return dailyCalories;
}
```

**WebSocket reconnect — after:**

```javascript
function connectToServerWithRetry(serverUrl) {
  let connection = new WebSocket(serverUrl);
  connection.onclose = () => {
    console.log('Lost connection to server. Trying to reconnect in 5 seconds...');
    setTimeout(() => {
      connection = connectToServerWithRetry(serverUrl);
    }, 5000);
  };
  return connection;
}
```

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
  // numbered recipe here
}
```

Replace any old `@file-header` boilerplate with the plain `//` summary.

React screens: hooks stay inside the component, in the original order. Helpers above the component do not call hooks. Variation 3 applies to **handlers** (`handleSearch`, `handleConfirm`) **and** to JSX: pull non-trivial expressions into spoken locals above the return; split huge JSX into small named subcomponents **in the same file** when it helps readability. Numbered `// 1.`–`// 6.` stay on handlers/mains only, not on every JSX line.

## The main function is a recipe

- Failures first, happy path last. Missing user / not signed in / empty search return immediately with a plain reason.
- `// 1.` through `// 6.` only in the main function (or in a screen handler). Not a comment on every line.
- No `class`. No `this`. If a file was `export default new Something()`, become a plain object that still has the **same method names**.
- No `Promise.all`, no `.map` / `.reduce` / `?.` chains in the recipe. Those live in a helper with a boring name (`askServerForBothLists`).
- Nesting max 2 (`if` / `for` / `try`). `else if` chains count as nested — use a map, early returns, or a helper.
- One return shape per file when we are free to choose (`{ ok: true }` / `{ ok: false, reason: '...' }`). If today’s export already returns `[]` or `null`, **keep that door**. Clarity is inside.

## Names

- A function name is the sentence: `addFoodToToday`, `generateMyWorkoutPlan`, `acceptThisClient`. Not `handle`, `process`, `run`, `getData`.
- A local is the thing, with units: `typedText`, `howManyServings`, `waterOunces`, `sleepHours`, `weightPounds`, `calories`. Not `q`, `p`, `n`, `t`, `s`, `d`, `bg`, `conv`, `tmp`.
- A yes/no is a sentence: `numbersArePerHundredGrams`, `isUserSignedIn`, `hasServerUrl`. Starts with `is` / `has` / `can` / `should` / `does`.
- A constant is the rule: `REQUEST_STATUS_PENDING`, `MIN_CHARS_AUTO_SEARCH`, `MAX_INCHES`.
- Repeat the user’s words: Confirm, Breakfast, Big Mac, pending request. No `payload`, `entity`, `hydrate` unless that is already the exported name.
- Allowed short names only: `id`, `url`, `api`, `db`, `req`, `res`, `msg`, `uid`, `doc`, and loop/event `i`, `j`, `k`, `x`, `y`, `e`.

## Named constants

Magic numbers and strings that mean a rule go at the top in `UPPER_SNAKE_CASE`.

```javascript
const PAYMENT_TIMEOUT_MS = 20000;
const MAX_RETRY_ATTEMPTS = 3;
```

Bind these if they appear inline: `24`, `60`, `7`, `400`–`599`, or `>= 1000`. Then use the name. Layout numbers inside `StyleSheet.create` and JSX attributes stay inline.

Firestore field names, collection names, API paths, and storage keys may be wrapped in constants. The **letters of the value never change**. Firebase project id stays `anatrox-auth`.

## Function size

The 30-line cap is **not** the gate. Chase “can I narrate the main function out loud.” If a function is long **and** nested, extract helpers. On a **full rewrite**, helpers over ~40 lines or with nesting ≥2 should be split or flattened — not “only if the checker complains.”

The main React component may be long because hooks must stay inside it, in their original order.

## JSDoc

Every exported function gets JSDoc: what it does, what it takes, what it returns.

## Comments (teach, do not narrate the obvious)

- `// vocab:` the first time a weird API shows up (`getDocs`, `array-contains`, `??` vs `||`).
- `// Manipulate here:` on tweakable numbers, copy, flags.
- No baby comments (`// add one`, `// return the list`).
- Pass test: Chris can change the rule from the comments and names without asking what a line means.

See `docs/INLINE_COMMENT_STYLE.md` for comment depth.

## Freeze list (do not change behavior)

- Do not move or rename files.
- Do not change import paths.
- Do not rename exported functions or components. Other files call those names.
- Do not reorder hooks.
- Do not change `onSnapshot` cleanup.
- Do not change the letters inside Firestore, API, or storage strings.
- Do not change object keys that other files read (`name`, `food_name`, `brand`, `clientName`).
- Do not add or remove branches. Moving a branch into a named helper is OK.
- Do not switch `??` to `||` (0 calories / 0 lbs must survive).
- CommonJS stays CommonJS (`require` / `module.exports`).
- Firebase project id stays `anatrox-auth`.

## Gold look

```javascript
async function addFoodToToday(userId, foodLog) {
  if (!userId) return { ok: false, reason: 'Need a signed-in user' };

  const foodName = foodLog.food.name;
  const mealName = foodLog.mealType;
  const howManyServings = foodLog.servingSize || 1;
  const numbersArePerHundredGrams =
    foodLog.food.source === 'usda' || foodLog.food.source === 'openfoodfacts';

  // 1. Turn the card into the calories/protein we will actually store.
  let calories = foodLog.food.calories;
  let protein = foodLog.food.protein;
  if (numbersArePerHundredGrams) {
    calories = foodLog.food.calories * howManyServings;
    protein = foodLog.food.protein * howManyServings;
  }

  // 2. Today’s date as the app already stores it: "2026-10-09"
  const dayKey = todayDateString();

  // 3. Write one row on that day’s meal. Field names stay name / calories / protein.
  await saveFoodRowOnThatDay(userId, dayKey, mealName, {
    name: foodName,
    calories,
    protein,
  });

  return { ok: true };
}
```

Other recipes to match:

- Search: typed text → cache → trusted foods → server or offline → cards
- Coach confirm: read action name → refuse trainer writes → log food / water / book
- Generate plan: signed in → post each API base → monthly cap
- Accept client: need three ids → POST until one base takes it
- Finish setup: save on phone first → Firestore → server → report a half-fail honestly

Live gold files (syntax-first bar):

- Frontend: `src/for-both/weekly-report/WeeklyReportBody.jsx`
- Full stack: `src/for-both/weekly-report/WeeklyReportScreen.jsx` and `src/trainer-app/scheduling/BookSessionScreen.jsx`
- Backend main: `src/nutrition/food-search/searchFoods.js` (`searchFoods` is the recipe; helpers under PLUMBING are not the template)
- Story-at-top parsing: `src/ai-coach/coach-actions/readActionsFromReply.js` (top only, until Chris signs off)

**Not gold:** batch 1 files rewritten before this bar (see `scripts/full-rewrite/batch1a.txt` and `batch1b.txt`), including `homeScreenPieces.jsx`. Redo those. Do not copy them.

## How to use this

When asking for new code or a refactor, say: **Follow CODING_STYLE.md (Variation 3).**
