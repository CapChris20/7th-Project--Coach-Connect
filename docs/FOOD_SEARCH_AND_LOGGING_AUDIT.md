# Food Search & Food Logging — Full Audit & Fixes

## Your concerns (what was wrong)

1. **ReferenceError: Property 'C' doesn't exist** — App crashed or threw when using food search / nutrition.
2. **Network request failed** — Search for "Chicken Breast", "Pizza", etc. returned 0 results and errors in the log.
3. **“Unified search returned 0 results”** — Every search failed (no results and no clear path to fix).
4. **Food search and logging flow unclear** — What’s broken, what you need to fix, and what you have to do (server, env, Firebase).

Below is what was fixed in code and what you still need to do on your side.

---

## 1. ReferenceError: Property 'C' doesn't exist

**Cause:**  
`C` was used in places that can run before it’s defined or in a bad order:
- **FoodSearchScreen.js:** `StyleSheet.create()` and default props (`colors = C`) referenced `C`. In some load orders (e.g. Hermes) that caused “Property 'C' doesn't exist”.
- **NutritionScreen.jsx:** `MealSection` used `C.hotPink` and `C.orange` for the Search/plan gradient. If `C` wasn’t in scope there, same error.

**Fixes:**
- **FoodSearchScreen:** Removed `C` entirely. Use a static `DARK` object for StyleSheets and `ACCENT` for meal colors. `FoodResultRow` and `EmptyState` use `colors || DARK` so no `C` is ever read.
- **NutritionScreen:** In `MealSection`, the Search and progress bar gradients now use `colors.hotPink`, `colors.purple`, `colors.orange` from the `colors` prop (from theme) instead of `C`.

---

## 2. Network request failed (TypeError)

**Cause:**  
The app calls your Node server at `POST /api/food/search`. The request fails when:
- The server isn’t running.
- On a **physical device**, the app uses `http://localhost:4000` (on the device, localhost is the phone, not your Mac).
- Firewall/network blocks the request.

**Fixes (in code):**
- `foodSearchProvider` always treats the search response as an array and handles errors without throwing; on network errors it logs a short reminder to run the server and set `EXPO_PUBLIC_API_BASE_URL` on device.

**Fix applied:** When the server is unreachable (e.g. on device without `EXPO_PUBLIC_API_BASE_URL`), the app now **calls Open Food Facts directly** from the client as a fallback. So search works even when the server isn’t running or the device can’t reach it — you get OFF results and can log food. When the server *is* reachable, you still get USDA → OFF → Serper in that order.

**What you need to do (optional for best experience):**
- **To use USDA + Serper:** Start the server (`npm run server`) and, on a physical device, set in `.env`: `EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:4000`, then restart Expo. Then search uses server (USDA → OFF → Serper).
- **Without server:** Search still works via Open Food Facts only (and barcode uses OFF directly).

---

## 3. “Recently Logged” empty or “query requires an index”

**Cause:**
- **Index:** `getRecentFoods` used `orderBy('created_at', 'desc')`, which requires a composite index on `nutrition_logs` (e.g. `user_id` + `created_at`). Without it, the query could fail.
- **Empty list:** “Recently Logged” was built only from **cached** foods (AsyncStorage). When you add a food from search we didn’t always cache it, so new logs didn’t show up there.

**Fixes:**
- **No index required:** `getRecentFoods` no longer uses `orderBy`. It fetches up to 50 logs with `where('user_id', '==', userId)`, then sorts by `created_at` in memory. So you don’t need to create a composite index for this.
- **Recently Logged from logs:** “Recently Logged” is now built from **nutrition_logs** (deduplicated by food name + calories + meal). It no longer depends on the cache, so newly added foods show up even if they were never cached.

---

## 4. Flow and data shape (verified)

- **Server** (`/api/food/search`): Returns an array of `{ id, name, brand, calories, protein, carbs, fat, servingSize, servingUnit, servingGrams, source }`. USDA and Open Food Facts are normalized to that shape.
- **Client** `normalizeFood()`: Maps that (and legacy fields) to the shape used by the rest of the app (`name`, `food_name`, `calories`, etc.).
- **addFoodLog:** Expects `{ food, mealType }`. It writes `user_id`, `date`, `meal_type`, `food_name`, `calories`, macros, `metadata`, etc. to `nutrition_logs`. Firestore rules allow create when `user_id == request.auth.uid`.
- **splitLogsByMeal:** Reads `meal_type` from each log and groups into breakfast/lunch/dinner/snacks. Nutrition screen gets meals and totals from this.

No extra changes were required here; the flow is consistent.

---

## What you need to do (checklist)

| Item | Action |
|------|--------|
| **Server running** | Run `npm run server` (or `node server/index.js`) while testing food search. |
| **Device URL** | On a **physical device**, set in `.env`: `EXPO_PUBLIC_API_BASE_URL=http://YOUR_MAC_IP:4000`. Find IP: e.g. `ipconfig getifaddr en0` or System Settings → Network. |
| **Restart Expo** | After changing `.env`, run `npx expo start --clear`. |
| **Optional: USDA** | In `server/.env`, `USDA_API_KEY=...` from [fdc.nal.usda.gov](https://fdc.nal.usda.gov/api-guide.html) for better search. Open Food Facts works without a key. |
| **Optional: Serper** | `SERPER_API_KEY` in server env for Serper fallback (you may already have this). |

---

## Flow summary

| Step | Where | What |
|------|--------|------|
| User types in search | `FoodSearchScreen` | `searchFoods(query, 20)` → `nutritionService` → `foodSearchProvider` |
| Provider | `foodSearchProvider` | `fetch(EXPO_PUBLIC_API_BASE_URL or localhost:4000)/api/food/search` |
| Server | `server/index.js` | USDA → Open Food Facts → Serper; returns JSON array |
| Client | `FoodSearchScreen` | `normalizeFood()` on each item; on Add → `onFoodSelected(food, mealType)` |
| Container | `NutritionContainer.handleFoodAdded` | `addFoodLog(uid, { food, mealType })` → Firestore `nutrition_logs` |
| Recent list | `getRecentFoods` | Reads `nutrition_logs` for user, sorts by `created_at` in memory, returns last N unique foods (no index, no cache required). |

---

## Files changed in this audit

- **`src/nutrition/screens/FoodSearchScreen.js`** — Removed `C`; use `DARK` + `ACCENT` and safe fallbacks.
- **`src/nutrition/screens/NutritionScreen.jsx`** — MealSection gradients use `colors` (theme) instead of `C`.
- **`src/nutrition/services/foodSearchProvider.js`** — Response always treated as array; clearer network error log.
- **`src/nutrition/services/nutritionService.js`** — `getRecentFoods` no longer uses `orderBy` (no index needed) and builds “Recently Logged” from `nutrition_logs` instead of cache.
- **`docs/FOOD_SEARCH_AND_LOGGING_AUDIT.md`** — This audit.

If “Network request failed” persists, go through the checklist above (server, `EXPO_PUBLIC_API_BASE_URL`, restart Expo).

---

## Current status — what’s working well now

- **Unified food search (USDA → OFF → Serper)**  
  - Server `/api/food/search` is stable and returns a clean, normalized JSON shape for foods.  
  - Client gracefully falls back to **Open Food Facts** when the server can’t be reached (so search still works on device without extra setup).

- **Barcode scanning & normalization**  
  - Barcode scanner uses **Expo Camera** and the shared `nutritionNormalization` helper so:  
    - Drinks like **Pepsi ~500–600 ml** log roughly the correct calories for the *whole bottle*, not 42 kcal.  
    - Solid foods (cereal, snacks, etc.) use realistic serving weights (e.g. ~39 g cereal) based on OFF data when available.  
  - After a scan, there is an **“Adjust amount”** step so you can log *less* or *more* than the default amount before saving.

- **Manual logging & editing (Quick Add + edit amounts)**  
  - The **Quick Add** screen is a full-page, themed form where you can log foods by hand (name, quantity, calories, macros, etc.).  
  - After logging, each food row now supports:  
    - **Delete** (trash icon) to remove a log.  
    - **Edit amount** (pencil icon) to change the grams/ml and auto‑recalculate calories + macros using the original per‑unit values.  
  - Calories and serving grams are stored and shown as **whole numbers**, macros are rounded to **one decimal place**, matching how you want them to look.

- **Restaurant food via web search + LLM**  
  - For restaurant items (McNuggets, burgers, etc.), the server can:  
    - Detect “restaurant‑style” queries.  
    - Use **Serper** to find a nutrition page.  
    - Fetch the HTML and send it to **OpenAI** with a strict JSON schema.  
  - Result: a clean `{ calories, protein, carbs, fat, serving_description, source_url }` object that can be cached in Firestore and logged like any other food.

- **Nutrition dashboard UX (client + trainer personal mode)**  
  - Client **Nutrition** screen:  
    - Onboarding flow (goals + macros) → nutrition dashboard (rings, meals, weekly chart, water, Quick Add, barcode).  
    - “Nutrition Today” on the client home screen reflects the calorie goal set during onboarding.  
  - **Trainer app** now has a **personal nutrition mode**:  
    - Bottom‑nav “Nutrition” for trainers opens the same `NutritionContainer`, but under the trainer’s own UID.  
    - Trainers can use onboarding, logging, barcode, Quick Add, and water tracking **for themselves**, without touching client data.

- **Visual design & consistency**  
  - Barcode scanner, Quick Add, and main Nutrition screen use your **dark glass + gradient** system (hot pink, orange, purple, cyan) without looking neon or mismatched.  
  - Buttons, cards, and pills are consistent between client and trainer views (same gradient language, borders, card backgrounds).

