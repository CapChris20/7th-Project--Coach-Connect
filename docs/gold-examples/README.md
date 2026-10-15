# Gold example files (syntax first)

Agents and humans should **match these three files** before rewriting other `src/` files. They are **not** scheduling-specific — they cover three archetypes in Coach Connect.

The bar is the **syntax**, not a comment on every function. Name the decision, use `if` / early return, one job per function. A comment is only for a reason the name cannot say. Do not change exported names, Firestore paths, or API paths.

| Archetype | File | What to copy |
|-----------|------|----------------|
| **Frontend only** | [`src/for-both/weekly-report/WeeklyReportBody.jsx`](../src/for-both/weekly-report/WeeklyReportBody.jsx) | Props in, UI out. No Firestore. `WeeklyReportScrollLayout` = what the user sees; export = light state only. Block comment per subcomponent. |
| **Full stack** | [`src/for-both/weekly-report/WeeklyReportScreen.jsx`](../src/for-both/weekly-report/WeeklyReportScreen.jsx) | `WeeklyReportScreenLayout` first (loading / empty / body); default export last (Firestore load, PDF export). Same pattern as `BookSessionScreen.jsx` (`ScreenLayout` + export). |
| **Backend only** | [`src/nutrition/food-search/searchFoods.js`](../src/nutrition/food-search/searchFoods.js) | Plain file header + **Step 1–6** on `searchFoods`. Helpers under **PLUMBING**. Default export keys frozen. |

Also useful (coach parsing, already story-at-top):

- [`src/ai-coach/coach-actions/readActionsFromReply.js`](../src/ai-coach/coach-actions/readActionsFromReply.js)

Verification after any gold edit: `node scripts/classifyReadable.mjs <path>`, `node scripts/stripBatchGate.mjs` (must be **CODE-MOVED**).
