# k6 load tests

Run a single script:

```bash
k6 run load-tests/aiCoach.js
```

Run the full suite:

```bash
BASE_URL=http://localhost:8080 FAKE_TOKEN=fake.firebase.token ./load-tests/run-all.sh
```

Notes:
- AI/food tests intentionally allow `401/403/429` in checks for zero-cost auth-path stress.
- Workout generation supports `X-Load-Test: 1` mock mode in non-production.
- Results are written to `load-tests/results/`.
