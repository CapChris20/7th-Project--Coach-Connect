# CoachConnect k6 Load Tests

Load tests for the CoachConnect Express API. All scripts use fake Firebase tokens and mocked workout generation so **no DeepSeek, Serper, or Claude API credits are spent**.

## Prerequisites

- [k6](https://k6.io/) installed (`brew install k6`)
- Server running locally or a Cloud Run URL to target

Local dev server defaults to port **4000** (`npm run server`). Cloud Run uses port **8080**. Pass the correct base URL via `BASE_URL` or the `run-all.sh` argument.

Production API (from `src/shared/api/baseUrl.js`):

`https://coachconnect-api-421005574501.us-central1.run.app`

## Run all 10 tests and save results

```bash
chmod +x load-tests/run-all.sh
./load-tests/run-all.sh http://localhost:8080
```

For local dev on port 4000:

```bash
./load-tests/run-all.sh http://localhost:4000
```

## Run against production (read warnings first)

```bash
./load-tests/run-all.sh https://coachconnect-api-421005574501.us-central1.run.app
```

## Run a single test

```bash
k6 run --env BASE_URL=http://localhost:8080 load-tests/aiCoach.js
```

## Cost warnings

- All 10 tests in `run-all.sh` use **fake tokens** and **mocks** — zero API credits spent.
- **DO NOT** run with real Firebase tokens unless you want real DeepSeek/Serper calls to fire.
- Workout generation always uses the `X-Load-Test: 1` mock (non-production only) regardless of token — safe in any environment.

## How tests avoid API costs

| Endpoint | Protection |
|----------|------------|
| `POST /api/ai-coach` | Fake Bearer token → Firebase Auth rejects with **401** before DeepSeek is called |
| `GET /api/food/search` | `verifyFirebaseBearerToken` middleware → **401** before Serper/USDA |
| `POST /api/workout/generate` | `X-Load-Test: 1` header returns mock plan in non-production (before Claude) |

## What each test covers

1. **aiCoach** — 100 users, auth and rate limiting (`aiLimiter`: 20 req/min)
2. **foodSearch** — 500 users, 65 real restaurant queries (`foodSearchLimiter`: 30 req/min)
3. **workoutGeneration** — 50 users, mocked Claude via `X-Load-Test`
4. **authSpike** — 1000 users hitting `/api/health` (cold start stress)
5. **maliciousUser** — 1 user rapid-firing expensive endpoints (no sleep)
6. **botUsers** — 1000 random users over 4 minutes (mixed actions)
7. **barcodeSpike** — 200 users scanning real product barcodes
8. **trainerDashboard** — 50 trainers loading client rosters + metrics
9. **midnightRollover** — 300 users logging at UTC midnight
10. **longCoachSession** — 10 users × 50 messages each (5 min)
11. **coldStartRecovery** — manual only; scale Cloud Run to 0 instances first

## What passing looks like

- All thresholds green in k6 output
- No **500** status codes anywhere
- `PASSED` printed next to each test name in terminal
- Results file shows `Result: PASSED` for each test

## Where results are saved

```
load-tests/results/run_YYYY-MM-DD_HH-MM-SS.txt
```

One file per run containing all 10 test outputs. Each test section shows start time, full k6 output, finish time, and `PASSED` or `FAILED`.

## Cold start test (manual)

1. Scale Cloud Run to **0** instances
2. Run:

```bash
k6 run --env BASE_URL=https://your-cloud-run-url load-tests/coldStartRecovery.js
```

## Server rate limits (from `server/index.js`)

| Limiter | Window | Max |
|---------|--------|-----|
| `generalLimiter` | 15 min | 200 |
| `aiLimiter` | 1 min | 20 |
| `foodSearchLimiter` | 1 min | 30 |
