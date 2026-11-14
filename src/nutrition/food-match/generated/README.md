# Generated food-match data

Do not hand-edit these files.

Regenerate:

```bash
node scripts/buildTokenStats.mjs
```

Built from recorded Open Food Facts product payloads in
`tests/food-fixtures/recorded-off-products.json` (see `scripts/recordEvalCorpus.js`).

- `tokenStats.json` — document frequencies (top ~50k tokens), brand strings for
  fuzzy spelling credit only, and per-category kcal/100g percentile bands.
