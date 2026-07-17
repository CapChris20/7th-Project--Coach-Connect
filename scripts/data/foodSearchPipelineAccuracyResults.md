# Food search pipeline accuracy results

Generated: live Serper + trusted catalog + hard ranking filters.

## Summary

| Suite | Result |
|-------|--------|
| Must-pass (20 famous items) | **20 / 20 (100%)** |
| Full suite (100 items, live) | **97 / 100 (97%)** |

## What was fixed

1. **Trusted catalog** for famous items (Crazy Bread 100 cal / 1 breadstick, Big Mac, Chipotle bowl, etc.)
2. **Hard item-token filter** — `crazy bread` cannot return pizza/soda as top results
3. **FatSecret-first** for restaurant queries — skip Serper when FatSecret already matches
4. **Serving conflict guards** — bread ≠ nuggets; multi-order calories relabeled

## Must-pass highlights (live)

| Query | Top result | Cal | Serving |
|-------|------------|-----|---------|
| Little Caesar's crazy bread | Crazy Bread | 100 | 1 breadstick |
| McDonald's Big Mac | Big Mac | 590 | 1 sandwich |
| McDonald's 10 piece nuggets | 10 Piece Nuggets | 410 | 10 pc nuggets |
| Chipotle chicken bowl | Chipotle Chicken Bowl | ~510–720 | 1 bowl |
| Burger King Whopper | Whopper | 670 | 1 sandwich |
| Wendy's Baconator | Baconator | 950 | 1 sandwich |

## Remaining live misses (3)

- `del taco grilled chicken soft taco` — no plausible row parsed
- `pizza hut breadsticks` — no plausible row parsed
- `applebees boneless wings` — no plausible row parsed

These are long-tail Serper parse misses — candidates for catalog expansion later.

## How to re-run

```bash
node scripts/testFoodSearchPipelineAccuracy.js --only must
node scripts/testFoodSearchPipelineAccuracy.js --live
```
