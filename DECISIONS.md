# Architecture Decision Records — Coach Connect

Coach Connect is a two-sided fitness coaching app: clients track nutrition, workouts and daily metrics with an AI coach, and trainers manage a client CRM, schedule sessions and get paid. It ships as one Expo / React Native app (iOS, Android, web) backed by Firebase and a Node/Express API on Google Cloud Run.

These records were reconstructed from the code, config and docs in this repo (`firestore.rules`, `storage.rules`, `server/`, `functions/`, `docs/`). Numbers under **Measurement** come from the code or from `scripts/loadTestReport.md`. Where nothing has been measured yet, the section says so and names the metric to track.

---

# ADR-001: Firebase (Firestore) as the primary database

## Context
The app needs per-user documents (profile, daily logs, food logs, workout plans, AI chat history), trainer↔client relationships, chat that updates live, and offline-tolerant mobile reads. It was built by a solo developer, so it needed one backend that handles auth, data, files, push and security without running servers.

## Alternatives Considered
- **Postgres (self-managed or RDS)**: Strong relational modelling for trainer↔client joins, but it needs a separate auth system, a real-time layer (websockets or LISTEN/NOTIFY), connection pooling for mobile clients, and an API in front of every read. That's too much infrastructure for one developer.
- **Supabase**: Postgres plus auth plus realtime plus row-level security, so it was the closest competitor. It lost because Firebase's React Native SDK, offline cache and Apple/Google sign-in were more mature, and the Expo push and Firebase Storage pieces were already in the same project (`anatrox-auth`).
- **MongoDB Atlas + Realm**: A document model like Firestore, but its mobile sync story was weaker and it doesn't come with an auth and storage suite.

## Decision
Use **Cloud Firestore** as the system of record. The data is user-centric: `users/{uid}` plus subcollections (`dailyLogs`, `aiChats/{id}/messages`, `workoutPlans`, `progressPhotos`, `macroTargets`). The trainer CRM lives in `trainer_clients/{trainerId}/clients/{clientId}`. Canonical paths are documented in `docs/FIRESTORE_PATHS.md`.

## Rationale
- **Maintainability:** clients read and write directly through the SDK under security rules, so most CRUD needs no API code.
- **Real-time for free:** `onSnapshot` powers chat, the trainer roster and the home dashboard (see ADR-007).
- **Offline:** the Firestore client cache lets the app open with no signal.
- **Cost at small scale:** the free tier and pay-per-operation pricing cost nearly nothing before launch.

## Tradeoffs
- **Gained:** fast shipping, one SDK for auth, data and storage, and rules-based security tested with `@firebase/rules-unit-testing`.
- **Cost:** no joins, so data is denormalized (`clients/{uid}` registry mirrored from `users`, `trainer_client_links` index, `unreadCount` badge doc). The schema drifted over time: legacy paths (`clients/{id}`, `daily_tracking`) still need read fallbacks. Some security rules call `get()`/`exists()` on other documents, and each of those calls is a billed read.

## What I'd Change
Lock the collection layout down before writing features. The legacy `clients/{id}` → `trainer_clients/...` migration and the `daily_tracking` → `dailyLogs` mirror both exist because paths changed mid-project. I'd also put a typed repository layer (one module per collection) in place from day one instead of retrofitting `dailyMetricsService` as the single writer.

## Measurement
- From `scripts/loadTestReport.md` (100 synthetic users, 1,280 ops): 100% success after a fix (it was 50% before). Average op time was 612 ms and the median 556 ms. User doc reads averaged 664 ms, daily-log writes 759 ms and client-list reads 252 ms.
- Firestore TTL policies (`docs/FIRESTORE_TTL.md`) keep growth bounded: `_rateLimits` expire after 1 h, `dailyReminders` after 30 d, and `dailyLogs`/`nutritionLogs` after 90 d.
- **Not yet tracked:** monthly reads/writes per active user. Pull this from the GCP billing export before pricing tiers.

---

# ADR-002: One Expo / React Native app with role-based shells

## Context
Clients and trainers need very different UIs, but they share auth, messaging, notifications and design. A single developer can't maintain two native codebases.

## Alternatives Considered
- **Two separate apps (client app + trainer app)**: Cleaner separation, but twice the App Store reviews, builds and shared-code packaging.
- **Native Swift/Kotlin**: Best performance, but it means two codebases and no web target.
- **Flutter**: Comparable cross-platform reach, but the team (me) already knew React, and the Firebase JS SDK and Stripe RN SDK fit naturally.

## Decision
Ship one **Expo SDK 54 / React Native 0.81** app. `AuthGate` reads `users/{uid}`, normalizes the role, and routes to `ClientApp`, `TrainerApp` or onboarding. Builds go through EAS (`eas.json`), with a dev client for native modules (IAP, camera, speech).

## Rationale
One codebase covers iOS, Android and web. Expo's managed native modules (Apple sign-in, notifications, camera, IAP) removed most native setup work, and the role check keeps the two experiences from leaking into each other.

## Tradeoffs
- **Gained:** a single deploy pipeline and shared components (`src/look-and-feel`, `src/messaging`, `src/for-both`).
- **Cost:** the bundle carries both roles' code. Native edge cases still leak through: `patchReactNativeTurboModuleIos26.sh` exists to patch iOS 26 builds, and Node polyfills (`crypto-browserify`, `stream-browserify`) are needed for some libraries.

## What I'd Change
Use TypeScript from the start. Large codemods, like the folder renames done for readability, are risky in plain JS because broken imports and string replacements only fail at runtime. The `fix:imports` / `verify:imports` scripts exist to work around that.

## Measurement
Not measured yet. Track cold-start time to the first rendered shell, and JS bundle size per platform (`npx expo export --dump-sourcemap`).

---

# ADR-003: Hybrid backend: Cloud Run Express API + Firebase Cloud Functions

## Context
Some work can't run on the client: LLM calls with secret keys, Stripe, food-database scraping, push fan-out, cron jobs, and writes to fields that rules make server-only.

## Alternatives Considered
- **Cloud Functions only**: Simple, but cold starts, per-function deploys and request time limits make a large, chatty AI and nutrition API awkward.
- **Always-on VM / Heroku**: Predictable, but you pay for idle capacity and have to patch the OS yourself.
- **Vercel/Netlify functions**: These work well for the web, but sit far from Firestore and the Admin SDK project.

## Decision
- **Cloud Run** (`coachconnect-api`, `us-central1`, Node 20 Docker image, `server/deploy.sh`) hosts the Express API: AI coach, food search, Stripe, trainer and marketplace routes, and cron via `server/cron/scheduler.js`.
- **Firebase Cloud Functions** (`functions/`) hold Firebase-native jobs: callable functions (`deleteAccount`, `linkClientWithTrainerCode`), the scheduled `generateWeeklySummaries`, Firestore triggers, and the OpenAI Realtime WebSocket proxy (`maxInstances: 10`).

## Rationale
Cloud Run scales to zero and runs one container with shared in-memory caches (ADR-006), with no per-function cold start for every route. Functions remain the simplest home for triggers and callables, which need Firebase auth context automatically.

## Tradeoffs
- **Gained:** scale-to-zero cost, one Express codebase that's easy to test (`server/__tests__`), and full control over middleware.
- **Cost:** two deploy targets. Multiple Cloud Run replicas mean cron jobs and rate limits needed coordination, which is why there's a Firestore-backed `distributedLock` (`_locks`) and `rateLimitShared` (`_rateLimits`). The Docker image copies parts of `src/` into the server image, which couples client folder names to the server build.

## What I'd Change
Move shared client/server logic into a `packages/shared` workspace instead of copying `src/for-both`, `src/ai-coach` and `src/nutrition` into the Docker image. I'd also schedule cron with Cloud Scheduler hitting an endpoint, instead of in-process timers guarded by locks.

## Measurement
- Shared rate limits (`server/middleware/rateLimitShared.js`): `/api/ai-coach` allows 10/min and 100/hr, `/api/food/search` 30/min and 100/hr, and `/api/nutrition/search` 500/day per user.
- **Not yet tracked:** p95 latency per route and Cloud Run instance-hours per month.

---

# ADR-004: Authentication: Firebase Auth + ID-token verification on every API call

## Context
The app needs email, Google and Apple sign-in (Apple is required by App Store rules once any social login is offered), plus one identity that both Firestore rules and the Cloud Run API trust.

## Alternatives Considered
- **Auth0 / Clerk**: Polished, but it's another vendor and a per-MAU bill, and Firestore rules would need custom-token bridging.
- **Custom JWT auth on the API**: Full control, but it means building password storage, reset flows and Apple/Google OAuth myself. That's high risk for one person.
- **Supabase Auth**: Only makes sense together with Supabase as the database (see ADR-001).

## Decision
Use **Firebase Auth** with email/password, Google (`GoogleAuthProvider`) and Apple (`OAuthProvider('apple.com')`, `expo-apple-authentication`). The client sends `Authorization: Bearer <idToken>`. `server/middleware/auth.js` → `verifyFirebaseBearerToken` calls `admin.auth().verifyIdToken(token, true)`, with revocation checking on, and handlers check that `uid` matches the `userId` in the request body.

## Rationale
Firestore rules and the API share one identity (`request.auth.uid` == `req.firebaseAuth.uid`), with no token translation. Checking for revocation means account deletion or a password reset invalidates sessions straight away. Apple token revocation for account deletion (`storeAppleAuthForRevoke`, `deleteAccount`) satisfies App Store guideline 5.1.1(v).

## Tradeoffs
- **Gained:** no auth server to run, and sign-in buttons that match each platform.
- **Cost:** `verifyIdToken(..., true)` adds a network check on each request. Firebase App Check is **not enforced yet** (`docs/SECURITY_APP_CHECK.md`), so a stolen ID token can still call the API from outside the app until it expires.

## What I'd Change
Enforce App Check (DeviceCheck / Play Integrity) on Firestore, Storage and the API before launch. I'd also move role (`client` vs `trainer`) into a custom claim, so rules and middleware don't need a Firestore read to know the role.

## Measurement
Not measured yet. Track the auth failure rate (401s per 1k requests) and sign-in method mix.

---

# ADR-005: Data isolation through Firestore rules + server-only billing fields

## Context
Clients' health data is sensitive. Trainers must see only *their* clients, and nobody may edit their own role, subscription, Stripe status or earnings from the client.

## Alternatives Considered
- **All reads/writes through the API**: Easy to reason about, but it gives up real-time listeners and offline cache, and puts every screen behind Cloud Run latency.
- **Custom claims listing a trainer's client IDs**: Fast rule checks, but claims are limited to 1,000 bytes and only refresh when a new token is issued.
- **Separate projects/tenants per trainer**: Far too heavy for a marketplace.

## Decision
Encode access in `firestore.rules` and `storage.rules`:
- `users/{uid}` and its subcollections are **owner-only by default**.
- A trainer gets access when the CRM link exists: `isLinkedTrainer(userId)` checks `trainer_clients/{trainerId}/clients/{clientId}`. The reverse link lets the client read their trainer's profile.
- Conversations are visible only to participants (`conv_{a}_{b}` ids, `participants` array). Storage attachments enforce the same id pattern.
- **Server-only fields:** `role`, `trainerId`, `subscription`, `subscriptionTier`, all `stripe*` fields, `paymentStatus` and `earnings*`. Rules reject client writes that touch them (`affectedKeys().hasAny([...])`), so only the Admin SDK can set them.
- `payments/*` and `stripe_webhook_events/*` are `allow write: if false`. Clients can only read their own payments.

## Rationale
The database enforces isolation even if a client is modified. The CRM link doc is the single source of truth for "who can see whom", and only the server creates it when a client request is accepted (`acceptClientRequest`).

## Tradeoffs
- **Gained:** defense in depth without giving up direct SDK access, plus a rules test suite (`server/__tests__/firestore.rules.test.js`).
- **Cost:** each `exists()`/`get()` in a rule is a billed read and adds latency. The rules file is 895 lines and easy to get wrong. `allow list: if request.auth != null` on `users` (needed for trainer search) is broader than ideal.

## What I'd Change
Replace the open `users` list query with a public `trainers/{id}` projection only, which mostly exists already. I'd also make rules tests part of CI on every PR, instead of an opt-in script (`npm run test:firestore-rules`).

## Measurement
- `firestore.rules`: 895 lines, ~66 `match` blocks. `storage.rules`: 5 protected path families.
- **Not yet tracked:** permission-denied errors per day in production (Cloud Logging).

---

# ADR-006: Layered storage: Firestore + Cloud Storage + device cache + server caches

## Context
Different data has different shapes and lifetimes. There are structured records, large binary files (progress photos, PDFs, trainer certifications), a need for instant app start, and expensive third-party nutrition lookups.

## Alternatives Considered
- **Everything in Firestore**: Firestore can't hold binaries (1 MiB doc limit), and repeated nutrition lookups would re-hit paid APIs.
- **Redis/Memorystore for caching**: Shared across replicas, but it's a monthly bill and one more piece of infrastructure.
- **S3/Cloudinary for files**: Fine products, but they'd sit outside Firebase rules and auth.

## Decision
Use four layers:
1. **Firestore**: system of record (ADR-001).
2. **Firebase Cloud Storage**: photos, attachments, workout-plan PDFs and trainer verification docs, protected by `storage.rules`, which reuse the CRM link check through `firestore.exists()`.
3. **AsyncStorage on device** (used in ~34 files): onboarding/profile cache so `AuthGate` can route when Firestore is slow or offline, plus UI preferences.
4. **Server caches:** an in-memory nutrition search cache (24 h TTL, max 500 entries, keyed `v3::food::restaurant`), and a shared Firestore catalog of user-verified barcodes (`verifiedBarcodes`, GTIN-14 keys), checked before USDA, FatSecret or Open Food Facts.

## Rationale
Each layer matches the data's lifetime and access pattern. Files get CDN delivery and rules-based security. The device cache removes a blank screen at launch. The server caches cut paid API calls and latency for repeated foods.

## Tradeoffs
- **Gained:** a fast app start, lower nutrition API spend, and files covered by the same security model as the data.
- **Cost:** the in-memory cache is per-replica and is lost on scale-to-zero, so the hit rate drops with traffic spikes. Cache invalidation lives in several places, and stale AsyncStorage profile data has to be reconciled with Firestore.

## What I'd Change
Move the nutrition search cache into Firestore (like `verifiedBarcodes`) so it survives cold starts and is shared across replicas. I'd also log cache hit and miss counters.

## Measurement
- Nutrition cache: 24 h TTL, 500-entry cap (`nutritionSearchCache.js`).
- **Not yet tracked:** cache hit rate, and Storage GB plus egress per month.

---

# ADR-007: Real-time via Firestore listeners (and a WebSocket proxy for voice)

## Context
Chat between trainer and client, the trainer's roster, unread badges and the home dashboard should update without pull-to-refresh. The AI voice coach needs low-latency bidirectional audio.

## Alternatives Considered
- **Socket.io / custom WebSocket server for chat**: Gives full control, but needs sticky sessions, presence and persistence written by hand.
- **Polling**: Simple, but wasteful on battery and reads, and it feels slow.
- **Stream / Sendbird chat SDK**: Feature-rich, but a per-MAU cost and a second data store.

## Decision
- Use **Firestore `onSnapshot` listeners** for chat, roster (`useTrainerClients` → `trainer_clients/{trainerId}/clients`), dashboard and unread badge (`users/{uid}/unreadCount/index`).
- For voice, a **Cloud Function WebSocket proxy** (`realtimeProxy`, max 10 instances) forwards to the OpenAI Realtime API, so the OpenAI key never reaches the device.

## Rationale
Listeners reuse the same rules, offline cache and SDK as everything else. A denormalized unread-count doc avoids running a count query on every message.

## Tradeoffs
- **Gained:** live UI with zero extra infrastructure for chat.
- **Cost:** every open listener bills a read for each changed doc, and listeners left open across screens are easy to leak. The load test measured roughly 3 s for listener delivery, the slowest operation.

## What I'd Change
Centralize listeners in a few context providers with automatic unsubscribe, and add a dev-mode counter of active listeners. Investigate the ~3 s listener time, which may be a missing index or a measurement artifact.

## Measurement
- **37 `onSnapshot(` calls across 23 files** in `src/` (heaviest: trainer home, trainee detail, client home, 5 each).
- Load test: real-time listener average **3,003 ms**, flagged as slow.
- **Not yet tracked:** the peak number of listeners open at once per session.

---

# ADR-008: Trainer payouts with Stripe Connect (Express) + direct charges and a 10% platform fee

## Context
Clients pay their trainer for coaching, and the platform takes a cut. Trainers need payouts, and the platform must not take on KYC or money-transmitter obligations itself.

## Alternatives Considered
- **Plain Stripe account, pay trainers manually**: Puts the platform in the flow of funds, means manual payouts, and creates tax and compliance exposure.
- **Stripe Connect Standard**: Trainers would need full Stripe dashboards, and onboarding has more friction.
- **Stripe Connect Custom**: Full control, but the platform owns KYC UI and liability.
- **PayPal / Venmo links**: No platform fee and no in-app status.

## Decision
Use **Stripe Connect Express** (`type: 'express'`, card_payments and transfers capabilities) with Stripe-hosted onboarding (`accountLinks`). Charges are **direct charges on the trainer's connected account** (`stripeAccount: acct_…`), with `application_fee_amount = round(amount × 0.10)`. Limits run from a $1 minimum to a $10,000 maximum. Payments go through only if the client is linked to the trainer and the trainer's `stripeStatus === 'active'`. Writes are atomic: a Firestore batch updates `payments/{chargeId}`, the client's `paymentStatus`, the CRM row and the trainer's `earnings*Cents` counters. A webhook (`account.updated`, `charge.succeeded|failed|refunded`) reconciles state idempotently through `stripe_webhook_events/{eventId}`. Charges accept an `idempotencyKey`.

## Rationale
With Express, Stripe hosts onboarding and identity checks, but the platform keeps branding and control of the fee. With direct charges the trainer is merchant of record, so the platform isn't the seller for coaching services. Fee math in integer cents avoids float drift.

## Tradeoffs
- **Gained:** compliant payouts with little code, an automatic platform cut, and payment state reconciled from webhooks.
- **Cost:** the legacy **Charges API with card tokens** (`charges.create({ source: token })`) doesn't support SCA/3-D Secure flows the way PaymentIntents does. On direct charges, Stripe processing fees come out of the trainer's balance, which trainers need to understand. Connect also adds a per-active-account fee.

## What I'd Change
Migrate to **PaymentIntents + PaymentSheet** (`@stripe/stripe-react-native` is already installed). That adds SCA, Apple Pay and saved cards. I'd also support recurring coaching subscriptions on the connected account instead of one-off charges.

## Measurement
- Platform fee: **10%** (`PLATFORM_FEE_RATE = 0.1`). On a $100 session: $10 application fee, $90 to the trainer. Stripe's processing fee (US standard ~2.9% + $0.30 ≈ $3.20) is taken from the trainer side on direct charges.
- Earnings tracked in cents on the trainer doc: `earningsGrossCents`, `earningsPlatformFeesCents`, `earningsNetCents`.
- Money-flow test suites: `stripeMoneyFlow.explained.test.js`, `stripeConnect.test.js`, `stripePayment.test.js`.

---

# ADR-009: Trainer Pro subscription through Apple In-App Purchase (StoreKit 2), not Stripe

## Context
Trainers pay the platform a monthly or annual subscription for Pro features. App Store rules (guideline 3.1.1) require that digital features unlocked inside an iOS app use In-App Purchase.

## Alternatives Considered
- **Stripe Billing subscriptions**: Fees are lower, but Apple would reject an iOS app selling digital features through it.
- **RevenueCat**: Handles receipts across platforms, but it's another vendor and a revenue share above the free tier.

## Decision
Use **StoreKit 2 via `expo-iap`** with products `com.coachconnect.month` and `com.coachconnect.year`. The server (`appleSubscriptionVerify.js`, `subscriptionRoutes.js`) decodes the JWS transaction, checks the bundle and product IDs, and writes `subscription` / `subscriptionTier`, which are server-only fields under the rules.

## Rationale
It's the only App Store-compliant path. Checking on the server and writing a rules-protected field means the client can't grant itself Pro.

## Tradeoffs
- **Gained:** App Review compliance and Apple-managed billing and refunds.
- **Cost:** Apple's 15–30% commission. The JWS signature is **not fully cryptographically verified** (the code checks structure and length only, with a TODO for production). Android needs a separate Play Billing path.

## What I'd Change
Verify JWS signatures against Apple's certificate chain (or use the App Store Server API), and subscribe to App Store Server Notifications v2 for renewals and refunds. I'd evaluate RevenueCat if Android launches.

## Measurement
- Apple commission: 15% (Small Business Program, <$1M/yr) or 30%.
- **Not yet tracked:** trial→paid conversion and monthly churn.

---

# ADR-010: Multi-provider AI coach with propose-then-confirm tool calls and hard budgets

## Context
The AI coach answers questions, logs food, updates macros and generates workouts. LLM costs can spiral, and models sometimes "do" things the user didn't ask for.

## Alternatives Considered
- **Single provider (OpenAI only)**: Simpler, but one outage takes the coach down and you can't tune cost per task.
- **Let the model write to Firestore directly through function calling**: Fast, but a mis-parsed intent corrupts user data.
- **On-device models**: Private, but too weak for coaching quality on mid-range phones.

## Decision
- **Provider routing** (`server/lib/llm/coachLlmProviders.js`): DeepSeek is primary for workouts and general requests, Claude handles AI coach quality, Perplexity is the fallback, and Serper provides web search. OpenAI Realtime powers voice.
- **Propose → confirm → execute**: the LLM returns a tool proposal. `coachToolProposalGuards` validates it, the user confirms in the UI, then `POST /api/ai-coach/execute-tool` writes through `dailyMetricsService`.
- **Budgets:** daily message caps by tier (free 30, plus 50, pro 100), enforced on Cloud Run in production. Workout generation is limited to **3 per month**. There are per-provider monthly budgets in `server/config/apiCosts.js`.

## Rationale
Mixing providers lets cheap models handle volume and stronger ones handle quality-sensitive replies. Requiring confirmation stops a hallucinated tool call from silently changing data, and hard caps put a ceiling on cost.

## Tradeoffs
- **Gained:** controlled cost, resilience to one provider going down, and a safe write path.
- **Cost:** prompts and output parsing are maintained per provider, there are more API keys to rotate, and the confirm step adds a tap.

## What I'd Change
Use each provider's native structured tool-calling instead of parsing JSON out of text (`parseCoachToolCalls`, `inferCoachToolCall`). I'd also log tokens and cost for every request to Firestore or BigQuery so the budgets come from real numbers.

## Measurement
- Monthly API budgets (`server/config/apiCosts.js`): Claude **$150**, DeepSeek **$100**, Serper **$20**, Perplexity **$20**. USDA and Open Food Facts are free.
- Caps: 30/50/100 AI messages per day by tier, 3 workout plans per month, 500 nutrition searches per day per user.

---

# ADR-011: Multi-source nutrition search (FatSecret-first, with a verified catalog)

## Context
No single food database is complete or accurate, especially for restaurant items and barcodes. Bad macros make the whole app untrustworthy.

## Alternatives Considered
- **USDA FoodData Central only**: Free and authoritative for generic foods, but poor coverage of restaurant and branded items.
- **Nutritionix / paid single API**: Good coverage, but costs money per call and locks you to one vendor.
- **Crowd-sourced only (Open Food Facts)**: Free, but quality varies.

## Decision
Search **FatSecret first**, then merge USDA, Open Food Facts, Serper-driven restaurant menus and other scrapers (`nutritionMultiSourceSearch/`). A consensus step (`getFoodNutritionConsensus`, `validateScrapedMacros`) picks the result. Barcodes are resolved against the user-verified `verifiedBarcodes` catalog first.

## Rationale
Combining sources raises coverage, and consensus and validation reject outliers. The verified catalog gets better with use and avoids paid lookups.

## Tradeoffs
- **Gained:** much better coverage of restaurant foods and barcodes.
- **Cost:** scrapers break when sites change, and sites' terms of service vary. Latency is higher than a single API, which is why caching exists (ADR-006).

## What I'd Change
Drop scrapers whose terms forbid automated access, in favour of licensed APIs. I'd also store accuracy benchmarks over time (`npm run nutrition:benchmark`) to justify the source ordering.

## Measurement
- Benchmark harness: `scripts/benchmarkNutritionSources.mjs`, `scripts/testFoodSearchAccuracy.js`.
- 24 h result cache, 500 searches per user per day.

---

# Known issue: find-and-replace damage from the latest rename commit

**Found while writing these ADRs.** The commit *"Rename src to plain-English folders and files for recruiter readability"* (`ff5c7d0`) did a global text replace that also changed code. Examples:
- `config` → `cloudConnection`: `server/index.js:59` requires `./cloudConnection/apiCosts`, but the file is `server/config/apiCosts.js`. **The API will crash at startup.**
- `tokens` → `reportColors` (for example, Perplexity's `max_tokens` became `max_reportColors`).
- `format` → `cellFormatting` (for example, "information" became "incellFormattingion").

Grepping for those three strings in `server/` and `src/` matches about **256 files**. Fix this before the next deploy, and do future renames with an AST-aware codemod or TypeScript's rename refactoring rather than plain text replacement.
