# Food Search & Nutrition Bug Hunt Report

**Date:** 2026-07-17  
**Scope:** CoachConnect food search, barcode, serving math, nutrition display  
**Method:** Code-path analysis + Node serving-math simulation + historical Serper accuracy corpus (`scripts/data/foodSearchAccuracyResults.md`, 2026-05-29) + Open Food Facts live probes  
**Limitation:** Live end-to-end `/api/food/search` and Serper could not be re-run in this environment (no `SERPER_API_KEY` / `USDA_API_KEY` / FatSecret credentials). Restaurant accuracy numbers below come from the checked-in May 2026 accuracy run unless noted as code-confirmed.

---

## Executive summary — report these first

| # | Bug | Severity | Confirmed how |
|---|-----|----------|---------------|
| 1 | Re-logging USDA/OFF foods doubles macros (`logged_total` vs `logged_totals`) | **Critical** | Code + Node sim |
| 2 | USDA search shows household serving label but treats macros as 100 g | **Critical** | Code |
| 3 | OFF text search mixes `*_serving` into a per-100g client path | **Critical** | Code + Node sim |
| 4 | Serper/FatSecret/consensus hardcode `servingGrams: 100` → tbsp/cup math wrong | **High** | Code + Node sim |
| 5 | Consensus cards rename food to user query while keeping scraped macros | **High** | Code |
| 6 | Restaurant corpus: Chipotle bowl / McNuggets meal / incomplete macros | **High** | Accuracy corpus |
| 7 | Universal cup = 240 g ignores rice/pasta density | **Medium** | Code |
| 8 | OFF can mix serving kcal with per-100g protein (or vice versa) | **Medium–High** | Code |
| 9 | Long names truncated; decimals rounded inconsistently | **Low–Medium** | Code |
| 10 | Crowdsourced barcodes can return wrong product (OFF data quality) | **High** (data) | Live OFF probe |

---

## Category 1: Search results mismatch

### Priority smoke searches

```
SEARCH: Pizza
EXPECTED: Pizza items with pizza-plausible macros (slice/whole)
ACTUAL (corpus + pipeline): Mix of restaurant slices, retail/frozen, and Serper titles; Domino's rows sometimes label "2 slices" while name says slice; Pizza Hut pepperoni returned 150 cal / 0g protein
BUG: Size/serving mismatch + incomplete macros; OFF path can surface retail pizza for menu queries unless filtered
NUTRITION: Often incomplete (protein=0) or multi-serving bundled into one card
```

```
SEARCH: Chicken
EXPECTED: Chicken cuts/products matching type (breast vs nuggets vs sandwich)
ACTUAL (corpus): Many chicken queries return wrong variant (e.g. Chick-fil-A Grilled Club → 130 cal; KFC mashed potatoes under chicken category queries historically ranked)
BUG: Name can look chicken-related while macros match a different item/portion
NUTRITION: Frequently incomplete (0 protein) or far below restaurant reference
```

```
SEARCH: Big Mac
EXPECTED: ~563–590 cal, ~25–28g protein, ~45–46g carbs, ~30–34g fat
ACTUAL (corpus top row): 580 cal, 25/45/34 — close
BUG: Relatively OK for calories; still depends on Serper/FatSecret scrape quality
NUTRITION: Within ~5% of expected for this corpus snapshot
```

### Restaurant searches

```
SEARCH: McDonald's Big Mac
EXPECTED: Big Mac
ACTUAL (corpus): Big Mac® row — 580 / 25 / 45 / 34
BUG: Minor vs official ~563/28/46/30; not a name≠nutrition mismatch
NUTRITION: Acceptable (~3% cal)
```

```
SEARCH: Chipotle chicken bowl
EXPECTED: Full bowl ~650 cal / ~40P / ~60C / ~20F (rice, beans, chicken, cheese, salsa)
ACTUAL (corpus): "Chipotle Chicken Bowl" — 180 cal, 32P, 0C, 0F
BUG: CRITICAL name≠nutrition — title is a bowl; macros look like chicken-only / incomplete scrape
NUTRITION: Wildly inaccurate (carbs/fat missing; calories ~3.5× low)
```

```
SEARCH: Panera salad
EXPECTED: Panera salad menu items
ACTUAL (OFF live probe): Fuji apple vinaigrette, salad dressings — not salads
BUG: Grocery/OFF path returns dressings for "Panera salad"; restaurant path may still miss salad entrees
NUTRITION: Dressing macros mislabeled as salad search results
```

```
SEARCH: Starbucks coffee
EXPECTED: Starbucks beverages (latte/cappuccino/brewed)
ACTUAL (OFF live): Bottled Starbucks RTD / Doubleshot Energy / Skinny Latte cartons — not café menu drinks
ACTUAL (corpus "starbucks pike grande"): Keurig Pike Place pod — 10 cal (wrong product class)
BUG: Packaged/RTD/K-Cup results drown out café menu items on grocery/OFF; Serper can latch onto Keurig
NUTRITION: Wrong product type even when brand matches
```

```
SEARCH: Pizza Hut large pizza
EXPECTED: Large Pizza Hut pizzas (whole or clear large-slice)
ACTUAL (OFF live): "Large, Slice" BBQ/Buffalo chicken rows at ~272–393 kcal/100g
BUG: "Large" often means large-slice density, not a whole large pizza; easy to log as whole pie
NUTRITION: Per-100g / slice density, not whole-pizza totals
```

### Additional corpus mismatches (name or macros wrong)

| Query / case | Corpus result | Issue |
|--------------|---------------|-------|
| McDonald's 10 nuggets | 1000 cal, 28/139/39 — "10 Piece Chicken McNuggets® Meal" | Meal macros attached to nuggets query |
| Chick-fil-A Grilled Club | 130 cal, 23/4/4 | Far below ~470 reference |
| Five Guys Cheeseburger | 920 cal, **0 protein** | Incomplete macros |
| Arby's Roast Beef | 360 cal, **0 protein** | Incomplete |
| Pizza Hut Pepperoni | 150 cal, **0 protein** | Incomplete |
| Taco Bell Soft Taco Beef | Returned "Crunchy Taco" | Wrong item type |
| Starbucks Caramel Macchiato | Skinny Grande 140 cal | Variant mismatch if user wanted standard |
| MOD Margherita | Mad Dog Pizza 980 cal | Wrong item |
| Panda Chow Mein | Kids Chow Mein | Wrong size/audience |
| Wendy's / In-N-Out / CFA biscuit / Denny's / Cheesecake Factory bread | *no rows* | Search miss |

---

## Category 2: Duplicate & confusing results

```
SEARCH: chicken breast
DUPLICATE COUNT: High (USDA foundation + branded + FatSecret + OFF + consensus rows merge)
DO THEY MATCH: No — cooked vs raw vs grilled vs branded deli; macros diverge widely
MOST RELIABLE: USDA Foundation/SR with explicit cooked/raw in title; avoid unnamed Serper estimates
```

```
SEARCH: rice
DUPLICATE COUNT: High (white/brown, cooked/raw, brands, restaurant sides)
DO THEY MATCH: No — cooked ~130 kcal/100g vs raw ~360; app often unclear which
MOST RELIABLE: USDA entry that says "cooked" or "raw" explicitly
```

```
SEARCH: pasta
DUPLICATE COUNT: High
DO THEY MATCH: No — dry vs cooked ~2–2.5× calorie density difference
MOST RELIABLE: Explicit cooked/unenriched spaghetti, cooked; watch FatSecret "Per …" labels
```

**Bug:** Dual pipelines (`GET /api/food/search` + `POST /api/nutrition/search`) merge into one list → same food appears as legacy + consensus + per-source rows with different macros. Ranking prefers query-shaped titles, which can hide that macros came from a different scrape.

---

## Category 3: Nutrition data accuracy (known foods)

```
FOOD: McDonald's Big Mac
EXPECTED: 563 cal, 28g P, 46g C, 30g F
ACTUAL (corpus): 580 / 25 / 45 / 34
ACCURATE: Mostly (cal within ~5%; protein ~11% low)
BUG: Minor scrape variance
```

```
FOOD: Chipotle Chicken Bowl (rice, beans, chicken, cheese, salsa)
EXPECTED: ~650 / 40 / 60 / 20
ACTUAL (corpus): 180 / 32 / 0 / 0
ACCURATE: NO
BUG: Off by ~470 cal; carbs/fat zeroed — Critical
```

```
FOOD: Panera Broccoli Cheddar Soup (cup)
EXPECTED (user prompt): ~380 / 16 / 32 / 20
ACTUAL (corpus): 360 / 14 / 30 / 21 labeled as **Bowl**
ACCURATE: Ambiguous — macros near bowl; size label wrong for "cup" search
BUG: Cup vs bowl confusion (Panera cup is typically lower than bowl)
```

```
FOOD: Starbucks Grande Cappuccino (2% milk)
EXPECTED: ~150 / 11 / 12 / 5
ACTUAL: Not directly in corpus; OFF "Starbucks Cappuccino" showed 70 kcal/100g (RTD/bottle basis)
ACCURATE: Cannot confirm café grande from grocery DB
BUG: Café drinks poorly covered by OFF; Serper required
```

```
FOOD: Taco Bell Crunchwrap Supreme
EXPECTED: ~530 / 16 / 50 / 29
ACTUAL (corpus): 530 / 16 / 71 / 21
ACCURATE: Calories yes; carbs high (~42%), fat low (~28%)
BUG: Macro split wrong despite matching calories
```

### Incomplete-macro epidemic (corpus)

Many top rows have **protein=0** (or carbs=0) with non-zero calories — e.g. Five Guys Cheeseburger, Arby's, Culver's ButterBurger, Pizza Hut Pepperoni, Zaxby's tenders. Users see a confident calorie number with broken macros.

---

## Category 4: Barcode scanning issues

Barcode path (`POST /api/food/barcode`) is stronger than text search: parallel USDA + FatSecret + OFF merge, `dataBasis` tagging, verified Firestore cache. Remaining issues:

```
SCANNED: Special K Protein Bar (test UPC 038000138416)
BARCODE: 038000138416
APP RETURNED (OFF live): Pringles Original Potato Crisps
CORRECT: NO
NUTRITION: Pringles density (~536 kcal/100g), not a protein bar
SERVING SIZE: 28 g crisp serving
BUG: Crowdsourced OFF UPC collision / wrong product — scanner will trust OFF if it wins merge
```

```
SCANNED: Diet Coke can
BARCODE: 049000028911
APP RETURNED (OFF): Diet Coke Soft Drink, 0 kcal
CORRECT: Yes (this UPC is Diet Coke, not classic Coke)
NUTRITION: 0 kcal OK for diet
SERVING SIZE: 1 can (354.9 mL)
BUG: None for this UPC — but zero-cal validation must keep allowing diet drinks (already special-cased in validateBarcodeFood.js)
```

```
SCANNED: Common US UPCs (Doritos 028400097664, CLIF 722252100619, Monster 070847013472, Coke Classic 049000050455)
APP RETURNED (OFF world/us): NOT FOUND for several
CORRECT: N/A
BUG: Heavy dependence on FatSecret/USDA/Serper fallbacks when OFF misses; Serper barcode fallback can still surface GS1 tracker junk (partially filtered)
```

**Code strengths:** Variable-weight store barcodes (prefix `2`) hint to search by name; junk name regex blocks "barcode tracker" pages.

**Code risk:** If merge prefers a wrong OFF hit with plausible macros, user confirms bad product into `verifiedBarcodes` cache → poisons future scans.

---

## Category 5: Serving size issues

### Confirmed with Node simulation (2026-07-17)

```
FOOD: Peanut butter (Serper/FatSecret search row)
SERVING SIZE: default servingGrams hardcoded 100; macros are label (~190 / 2 tbsp)
TEST: Change to 2 tbsp → 30 g
EXPECTED NUTRITION: ~190 cal
ACTUAL NUTRITION: 190 × 30/100 = 57 cal
CORRECT: NO
BUG: Label macros scaled as if they were for 100 g
```

```
FOOD: Milk (Serper)
SERVING SIZE: 100 g fake basis; macros ~149 / cup
TEST: 1 cup → 240 g
EXPECTED NUTRITION: ~149 cal
ACTUAL NUTRITION: 149 × 240/100 = 358 cal
CORRECT: NO
BUG: Same fake 100 g basis
```

```
FOOD: Chicken breast (Serper)
SERVING SIZE: 100 g fake; macros ~231 / breast
TEST: 6 oz → 170 g
EXPECTED NUTRITION: ~231 cal
ACTUAL NUTRITION: 231 × 170/100 ≈ 393 cal
CORRECT: NO
```

```
FOOD: Rice / pasta (Serper or USDA with cup unit)
SERVING SIZE: Confirm sheet cup = always 240 g
TEST: 1 cup cooked rice
EXPECTED NUTRITION: ~205 cal (~158 g)
ACTUAL NUTRITION: uses 240 g → ~+50% even with correct per-100g data
CORRECT: NO
BUG: Water-density cup conversion for solids
```

```
FOOD: Peanut butter (OFF search with energy-kcal_serving=190)
SERVING SIZE: Client treats as per 100 g
TEST: Log 32 g
EXPECTED: ~190
ACTUAL: 61
CORRECT: NO
```

```
FOOD: USDA branded PB with household "2 tbsp" / 32 g
SERVING SIZE: mapUsdaFoods drops grams; client defaults 100 g
TEST: Log 1 serving
EXPECTED: ~188 cal
ACTUAL: ~588 cal (full per-100g value)
CORRECT: NO
BUG: ~3× overcount
```

---

## Category 6: UI / display issues

```
ISSUE: Long food names truncated on result cards
EXPECTED: Full name readable or expandable
ACTUAL: FoodSearchScreen result title numberOfLines={2}; confirm sheet numberOfLines={3}
SCREENSHOT: N/A (code inspection)
BUG SEVERITY: Minor — can hide size/variant words ("Large", "No Mayo", "2 slices")
```

```
ISSUE: Decimal / calorie rounding inconsistency
EXPECTED: Consistent 1-decimal macros or consistent integers
ACTUAL: FoodSearchScreen normalizeFood Math.round (integers); sanitizeSearchResultRows rounds cal 0 / macros 1; addFoodLog clamps macros to 1 decimal; history perServing uses 1 decimal
BUG SEVERITY: Minor — same food can show 17 vs 17.5 across surfaces
```

```
ISSUE: Missing nutrition
EXPECTED: Clear empty / "not found" state
ACTUAL: Empty search clears results; server may return hint; 5 corpus cases returned no rows; Serper rows can show calories with 0 protein without blocking
BUG SEVERITY: Medium — silent incomplete macros worse than empty state
```

```
ISSUE: Special characters
EXPECTED: McDonald's / ® names display and search
ACTUAL: normalizeQueryText strips punctuation (covered by unit tests); cleanSerperFoodTitle / brand resolvers handle ®; display uses ellipsize
BUG SEVERITY: Low — search OK; truncation may clip ® / apostrophe tails
```

---

## Category 7: Data source mismatches

```
FOOD/PRODUCT: Generic "chicken" / "protein powder"
SOURCE 1: USDA generic — per 100g foundation
SOURCE 2: Brand / restaurant / Serper — label serving
MATCH: no
BUG: Mixed list without clear priority badges for grocery vs menu; dual pipeline duplicates
```

```
FOOD/PRODUCT: Same item via barcode vs text search
SOURCE 1: Barcode — normalizeOpenFoodFactsProduct / FatSecret with dataBasis
SOURCE 2: Text OFF/USDA/FatSecret search — often missing dataBasis / wrong grams
MATCH: no (same product can log different totals)
BUG: Barcode path is correct-ish; text search path under/over-scales
```

```
FOOD/PRODUCT: Consensus vs Serper legacy
SOURCE 1: nutrition_consensus — display name = user query; servingGrams=100
SOURCE 2: serper organic parse — web title; servingGrams=100
MATCH: titles may match query while macros disagree across rows
BUG: Intentional rename hides scraper title mismatches
```

**Dead / stale paths:**
- `POST /api/nutrition/restaurant` returns null (OpenAI extraction removed)
- Client comment still mentions Nutritionix (not called)

---

## Category 8: Edge cases & weird inputs

```
INPUT: "" (empty)
EXPECTED: No search / show recent
ACTUAL: Client returns early (no request); server would 400 "Query required"
BUG: None — handled
```

```
INPUT: "PIZZA" vs "pizza" vs "pizza "
EXPECTED: Same results
ACTUAL: normalizeQueryText lowercases/trims; debounce trims; cache key normalized
BUG: None expected for case/trailing space
```

```
INPUT: "pizza pizza"
EXPECTED: Pizza results (tokens may require both)
ACTUAL: significantQueryTokens keeps both; ranking may over-filter titles missing double token
BUG: Possible over-filtering (medium); needs live verify with API keys
```

```
INPUT: "pizza123"
EXPECTED: Soft fail or pizza-ish results
ACTUAL: Depends on upstream; OFF often empty/irrelevant
BUG: Low — acceptable empty
```

```
INPUT: "zzzzzzzzzzzzzzz"
EXPECTED: Empty state, no crash
ACTUAL: Client shows empty; no crash path in handleSearch
BUG: None for crash; timeout depends on upstream (Serper 12–18s)
```

---

## Critical bugs — full write-ups

### BUG-1: `logged_total` vs `logged_totals` double-scale on re-log

```
TITLE: Re-logging USDA/OFF foods roughly doubles calories
CATEGORY: Nutrition / Data
SEVERITY: Critical

STEPS TO REPRODUCE:
1. Search or scan a USDA or Open Food Facts food (e.g. peanut butter).
2. Confirm & log 200 g (sheet writes dataBasis: "logged_total").
3. From Recent/History, add the same food again at the same amount.

EXPECTED BEHAVIOR:
Second log matches first (e.g. 1176 kcal for 200 g of 588 kcal/100g PB).

ACTUAL BEHAVIOR:
normalizeFoodForLog only recognizes "logged_totals" (plural). Singular "logged_total"
is treated as per-100g for usda/openfoodfacts → 1176 × 200/100 = 2352 kcal.

DATA:
- Food name: Peanut Butter (USDA)
- Expected nutrition: 1176 cal / 200 g
- Actual nutrition on re-log: ~2352 cal / 200 g
- Source: ConfirmFoodSelectionSheet → history → normalizeFoodForLog

IMPACT:
Daily calorie totals inflate every time users re-log from Recent. Silent, systematic.

NOTES:
Writer: ConfirmFoodSelectionSheet.jsx (~383) dataBasis: 'logged_total'
Readers: normalizeFoodQuery.js (~144), logFoodToFirestore.js history (~106–110)
addFoodLog itself special-cases singular for the first write — only re-log breaks.
Node sim 2026-07-17: caloriesForGrams(confirmed, 200) => 2352
```

### BUG-2: USDA search strips grams; "1 serving" = 100 g of per-100g macros

```
TITLE: USDA search household serving label disagrees with logged amount
CATEGORY: Search / Serving
SEVERITY: Critical

STEPS TO REPRODUCE:
1. Search a branded USDA item with household serving (e.g. peanut butter "2 tbsp").
2. Open confirm sheet — label shows 2 tbsp; grams default 100.
3. Log 1 serving.

EXPECTED BEHAVIOR:
~188 kcal for 32 g (2 tbsp).

ACTUAL BEHAVIOR:
~588 kcal (per 100 g value) attached to a "2 tbsp" label.

DATA:
- mapUsdaFoods in server/routes/foodRoutes.js (~994–1015) omits servingGrams + dataBasis
- Barcode mapper mapUsdaBrandedSearchHitToBarcodeFood sets them correctly

IMPACT:
Any branded USDA grocery search can over-log by 2–3× when users trust "1 serving".
```

### BUG-3: OFF text search prefers `*_serving` but client assumes per 100 g

```
TITLE: Open Food Facts search calories/serving basis mismatch
CATEGORY: Search / Nutrition
SEVERITY: Critical

STEPS TO REPRODUCE:
1. Trigger OFF text search for a grocery item with energy-kcal_serving set.
2. Adjust amount to grams matching the label serving (e.g. 32 g).

EXPECTED BEHAVIOR:
Macros match label serving at that gram weight.

ACTUAL BEHAVIOR:
App treats serving kcal as per-100g → 32 g logs ~1/3 of true calories.
Also: independent || fallbacks can mix serving kcal with per-100g protein.

DATA:
- foodRoutes.js loadOpenFoodFacts (~1261–1264)
- Client PER_100G_SOURCES includes openfoodfacts

IMPACT:
Grocery search logging by grams/tbsp systematically wrong; barcode OFF path is OK.
```

### BUG-4: Serper / FatSecret search / consensus fake 100 g serving

```
TITLE: Tbsp/cup conversion destroys Serper and FatSecret search macros
CATEGORY: Serving
SEVERITY: High

STEPS TO REPRODUCE:
1. Search "peanut butter" (menu/branded path → Serper or FatSecret).
2. On confirm sheet, switch unit to Tbsp, enter 2.

EXPECTED BEHAVIOR:
~190 cal.

ACTUAL BEHAVIOR:
57 cal (190 × 30/100).

ROOT CAUSE:
- foodRoutes.js toSerperRow servingGrams: 100
- fatSecretClient mapFatSecretSearchHitToRow: servingGrams null unless label is "100 g"
- mergeFoodNutritionSources consensus/source rows: servingGrams: 100
- Confirm sheet scales label macros by grams/100 when isLabelServingBasis

IMPACT:
Any user who "corrects" serving to household units gets large errors. "1 serving" looks fine.
```

### BUG-5: Consensus display name = query (hides wrong scrape)

```
TITLE: Consensus cards can show the user's query as the food name with another item's macros
CATEGORY: Search / Data
SEVERITY: High

STEPS TO REPRODUCE:
1. Search a restaurant item that scrapers disagree on.
2. Inspect top nutrition_consensus row title vs source_subtitle / underlying sourceResults.

EXPECTED BEHAVIOR:
Title matches the item the macros were measured for.

ACTUAL BEHAVIOR:
buildDisplayName prefers formatUserQueryAsFoodName(user query); macros from consensus/scrapers;
servingGrams forced to 100.

IMPACT:
Classic name≠nutrition bug class — card looks correct, numbers may be for a different variant.
```

### BUG-6: Chipotle chicken bowl corpus failure

```
TITLE: Chipotle Chicken Bowl returns ~180 cal with 0 carbs/fat
CATEGORY: Nutrition
SEVERITY: Critical (data quality)

STEPS TO REPRODUCE:
1. Search "Chipotle chicken bowl" (Serper pipeline; corpus 2026-05-29).
2. Inspect top ranked macros.

EXPECTED BEHAVIOR:
~650 / 40 / 60 / 20 style bowl totals (or clear chicken-only label).

ACTUAL BEHAVIOR:
180 / 32 / 0 / 0 under name "Chipotle Chicken Bowl".

IMPACT:
Users logging bowls undercount by hundreds of calories; carbs disappear.
```

### BUG-7: McNuggets query returns meal macros

```
TITLE: "10 Piece Chicken McNuggets" search returns meal calories
CATEGORY: Search
SEVERITY: High

STEPS TO REPRODUCE:
1. Search McDonald's 10 nuggets (corpus id mcd-10-nuggets).
2. View top result.

EXPECTED BEHAVIOR:
~420–470 cal nuggets-only.

ACTUAL BEHAVIOR:
1000 cal / 139g carbs — "10 Piece Chicken McNuggets® Meal".

IMPACT:
Name suggests nuggets; nutrition is a combo meal.
```

---

## Testing checklist status

| Check | Status |
|-------|--------|
| 10+ food searches (name≠nutrition) | Done via corpus + code (Chipotle, McNuggets, CFA club, MOD, etc.) |
| 5+ restaurant searches | Done (McD, Chipotle, Panera, Starbucks, Pizza Hut, Taco Bell) |
| 5+ barcode scans | Partial — OFF live probes; full merge needs FatSecret/USDA keys |
| 5 known-accurate foods | Done (Big Mac OK-ish; Chipotle fail; Crunchwrap macros off; Panera size; Starbucks café gap) |
| Serving size changes (3+ foods) | Done — Node sim PB/milk/chicken/rice |
| UI edge cases | Code inspection (truncation, rounding) |
| Data source consistency | Code — barcode vs search asymmetry confirmed |
| Weird inputs | Client empty/case/space handled; live gibberish needs keys |
| Decimal accuracy | Code — inconsistent rounders |
| Missing data handling | Incomplete macros allowed; some no_rows |

---

## Recommended fix order

1. Normalize `logged_total` / `logged_totals` everywhere; treat both as portion totals in `isLabelServingBasis` + `normalizeFoodForLog` + history.
2. Fix `mapUsdaFoods` to emit `servingGrams` + `dataBasis: 'per_100g'` (mirror barcode USDA mapper).
3. Fix OFF search mapping to always emit per-100g (reuse `normalizeOpenFoodFactsProduct`) — never mix `*_serving` into per-100g clients.
4. Stop hardcoding `servingGrams: 100` for Serper/consensus/FatSecret search; parse grams from serving label or disable density units when unknown.
5. Keep consensus titles tied to scraper item identity (or show scraper title + query subtitle).
6. Reject or badge rows with calories > 0 and all macros 0; prefer complete macro sets in ranking.
7. Density-aware cup weights for rice/pasta (or hide Cups without known density).
8. Re-run `npm run test:food-search` + `nutrition:benchmark:quick` with production keys after fixes.

---

## Key code references

| Area | Path |
|------|------|
| OFF search mix-up | `server/routes/foodRoutes.js` (~1254–1267) |
| USDA search map | `server/routes/foodRoutes.js` `mapUsdaFoods` (~994–1015) |
| Serper 100 g | `server/routes/foodRoutes.js` `toSerperRow` (~136) |
| FatSecret search grams | `server/lib/fatSecretClient.js` `mapFatSecretSearchHitToRow` (~127–160) |
| Consensus rename + 100 g | `src/nutrition/food-search/mergeFoodNutritionSources.js` (~87–188) |
| Confirm basis writer | `src/nutrition/food-search/ConfirmFoodSelectionSheet.jsx` (~383) |
| Basis readers | `src/nutrition/food-search/normalizeFoodQuery.js` (~144–154) |
| Log scaling | `src/nutrition/daily-log/logFoodToFirestore.js` `addFoodLog` (~323–349) |
| Serving math | `src/nutrition/food-details/calculateServingSize.js` |
| Cup/tbsp factors | `ConfirmFoodSelectionSheet.jsx` `unitToGrams` (~75–95) |
| Accuracy corpus | `scripts/data/foodSearchAccuracyResults.md` |

---

## Appendix: Node simulation output (2026-07-17)

```
logged_total USDA 200g re-log path: caloriesForGrams => 2352 (expected 1176)
Serper PB 2 tbsp (30g): 57 (expected ~190)
Serper Milk 1 cup (240g): 358 (expected ~149)
OFF serving-as-per100g 32g: 61 (expected ~190)
```
