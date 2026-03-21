# Trainer Marketplace, Card Fields & Onboarding Audit

## 1. What’s on each trainer card (Find Trainer / TrainerSearchScreen)

| Field on card | Source in code | Where data comes from |
|---------------|----------------|------------------------|
| **Name** | `trainer.displayName \|\| trainer.name` | Firestore `trainers` or `users` |
| **Specialty** | `trainer.specialty \|\| trainer.specializations?.[0]` | Onboarding: `specialties[]` (first used as specialty) |
| **Rating** | `trainer.rating` (star + number) | Onboarding sets `rating: 0`; no review input yet |
| **Review count** | `trainer.reviewCount` | Onboarding uses `reviews: 0` (not `reviewCount`) — **naming mismatch** |
| **Location** | `trainer.location` or “Remote” if `trainer.isRemote` | Onboarding: `location`; `isRemote` not set in onboarding |
| **Availability** | `trainer.available`, `trainer.availability` | Onboarding: `available: true`; no `availability` string (e.g. “Waitlist”) |
| **Price** | `trainer.price` (shown as “$/mo”) | Onboarding stores `pricing.perMonth` and `rate` (perSession), **not** top-level `price` |

**Summary:** Cards show name, specialty, rating, review count, location/remote, availability badge, and price. Several of these are not populated by current onboarding or use different field names.

---

## 2. What’s on the Trainer Profile screen (TrainerProfileScreen)

| Section | Fields used | Onboarding / Firestore |
|---------|-------------|-------------------------|
| Hero | `displayName`/`name`, `specialty`, availability badge, Remote badge | Name, specialty, available/availability, isRemote |
| Stats | `rating`, `reviewCount`, `yearsExperience`/`experienceRange`, `price` | rating/reviews set to 0; yearsExperience/experience written; price vs pricing mismatch |
| Location / Experience | `location`, `isRemote`, `experienceRange` | location yes; experienceRange not written (we have yearsExperience) |
| About | `bio`, `trainingPhilosophy` | Onboarding: `bio` from `trainingPhilosophy` |
| Specialties | `specialties` / `specializations` / `categories` | Onboarding: `specialties[]` |
| Certifications | `certifications` | Onboarding: `certifications[]` |
| Tags | `tags` | Not in onboarding |
| Credentials | `credentials` | Not in onboarding (different from certifications) |
| CTA | `price` for “Request Trainer — $X/mo” | Same `price` vs `pricing.perMonth` gap |

---

## 3. Trainer onboarding → Firestore (`trainers` collection)

**File:** `src/auth/OnboardingScreen.js` (trainer finish flow writes to `trainers/{userId}`)

| Written field | Value / note |
|---------------|----------------|
| `uid` | userId |
| `name` | updateData.name \|\| firstName \|\| displayName \|\| 'Trainer' |
| `location` | string |
| `specialties` | array |
| `bio` | trainingPhilosophy \|\| bio |
| `certifications` | array |
| `rate` | pricing.perSession (per-session only) |
| `pricing` | `{ perSession, perMonth, initialConsult }` |
| `yearsExperience` | string (e.g. '1_2', '3_5') |
| `experience` | numeric 0–10 from yearsExperience map |
| `available` | true |
| `rating` | 0 |
| `reviews` | 0 (UI uses `reviewCount` elsewhere) |
| `clients`, `sessions` | 0 |
| `availableDays` | [true×5, false×2] |
| `offerFreeConsultation`, `flexiblePricingAvailable` | from onboarding |
| `inviteCode` | from onboarding |
| `onboardingCompleted`, `createdAt`, `updatedAt` | set |

**Not written by onboarding (but used by cards/profile):**

- `displayName` — only `name` is set (cards support both).
- `price` — only `pricing.perMonth` and `rate` are set; marketplace uses `trainer.price`.
- `reviewCount` — onboarding writes `reviews: 0`; UI and migrate script use `reviewCount`.
- `availability` — only `available: true`; no “Available”/“Waitlist” string.
- `isRemote` / `sessionType` — not collected or written.
- `experienceRange` — not written (we have `yearsExperience` and numeric `experience`).
- `specialty` — not written (we have `specialties[]`; UI uses first as specialty).
- `tags`, `credentials` — not in onboarding.

---

## 4. Do you need a review input system?

**Current state:**

- **Display:** Cards and profile show `rating` and `reviewCount` (or “reviews”).
- **Data:** Onboarding sets `rating: 0` and `reviews: 0`. No client-facing flow writes reviews or updates rating.
- **Naming:** Onboarding uses `reviews`; some code uses `reviewCount`. Recommend one field (e.g. `reviewCount`) and optionally a `reviews` subcollection or array for individual reviews.

**If you want real ratings/reviews you need:**

1. **Review input**
   - Who: e.g. clients who have been assigned to that trainer (or anyone, depending on product).
   - Where: e.g. after a session, or from the trainer profile (e.g. “Leave a review”).
   - Data: at least rating (1–5) and optional text; store per review (e.g. `trainers/{id}/reviews` or a `reviews` collection with `trainerId`).

2. **Aggregation**
   - When a review is submitted, update trainer’s `rating` (e.g. average) and `reviewCount` (e.g. count of reviews) in `trainers/{id}` (via client logic or Cloud Function for consistency).

3. **Optional**
   - Moderation, “verified client” badge, reply from trainer.

**Recommendation:** Add a review input system (submit rating + optional text, then update trainer’s `rating` and `reviewCount`) and standardize on `reviewCount` (and one aggregate `rating`) in Firestore and UI.

---

## 5. Other trainer onboarding gaps (for marketplace)

| Gap | Suggestion |
|-----|------------|
| **Price on card** | Use `trainer.price ?? trainer.pricing?.perMonth ?? trainer.rate` in TrainerSearchScreen and TrainerProfileScreen (or write `price` from `pricing.perMonth` when saving trainer in onboarding). |
| **reviewCount vs reviews** | Use a single field, e.g. `reviewCount`, in onboarding and UI; migrate existing `reviews` to `reviewCount` if needed. |
| **Remote / session type** | Add “Remote / In-person / Both” (or similar) to trainer onboarding and write `isRemote` and/or `sessionType` to `trainers`. |
| **Availability label** | Add optional “Availability” (e.g. “Available” / “Waitlist”) in onboarding and write to `availability` so cards/profile can show it. |
| **experienceRange** | Either derive from `yearsExperience` in the UI (e.g. “1–2 years”) or add/write `experienceRange` in onboarding. |
| **displayName** | Onboarding already writes `name`; keep supporting both `name` and `displayName` in UI for backwards compatibility. |
| **specialty (singular)** | Either write first of `specialties` to `specialty` when saving, or keep using `specialties[0]` in UI (already done). |

---

## 6. Quick reference: field mapping

| UI / filter | Prefer in Firestore | Onboarding today |
|-------------|---------------------|-------------------|
| Card name | `name` or `displayName` | `name` ✓ |
| Card specialty | `specialty` or `specialties[0]` | `specialties[]` ✓ |
| Card rating | `rating` | 0 (no input) |
| Card review count | `reviewCount` | `reviews: 0` (rename) |
| Card location | `location`, `isRemote` | `location` ✓; `isRemote` ✗ |
| Card availability | `available`, `availability` | `available` ✓; `availability` ✗ |
| Card price | `price` or `pricing.perMonth` | `pricing.perMonth` (use in UI or copy to `price`) |
| Profile experience | `yearsExperience` or `experienceRange` | `yearsExperience` ✓; `experienceRange` ✗ |
| Session type filter | `isRemote` / `sessionType` | Not set |

This audit should be enough to align onboarding with the marketplace and to add a review input system if you want real ratings.
