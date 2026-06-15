# Coach Connect — Product Requirements Document (PRD)

| Field | Value |
|-------|--------|
| **Product** | Coach Connect |
| **Document version** | 1.0 |
| **Last updated** | May 19, 2026 |
| **Status** | Living document (reflects shipped + in-progress codebase) |
| **Owner** | Product / Founder (assign name) |
| **Platforms** | iOS (primary), Android (Expo target), mobile-first |
| **Backend** | Firebase (`anatrox-auth` project — production identity; display name “Coach Connect”) |

---

## 1. Executive summary

### 1.1 Product vision

Coach Connect is a **two-sided mobile coaching platform** that connects personal trainers with clients and gives both parties a single place to communicate, deliver programs, log progress, and stay accountable—without juggling texts, PDFs, and disconnected fitness apps.

### 1.2 Problem statement

- **Clients** struggle to find the right coach, stay consistent between sessions, and keep workout/nutrition/progress data in one place their coach can see.
- **Trainers** lose time on admin: scattered DMs, manual spreadsheets, unclear check-in status, and no unified client workspace.

### 1.3 Solution

A native mobile app (Expo / React Native) with:

- **Trainer marketplace** for discovery and connection requests
- **1:1 messaging** and shared **notes & files**
- **Workout planning**, exercise library, and active workout logging
- **Nutrition tracking** (macro-focused, not a full MFP replacement)
- **Daily check-ins** and **weekly summaries**
- **Session scheduling** with invites and reminders
- **Optional AI Coach** for client-side fitness/nutrition assistance (bounded scope, daily limits)

### 1.4 Success metrics (launch — adjust targets)

| Metric | Target (90 days post-launch) |
|--------|------------------------------|
| Trainer accounts with completed profile | TBD |
| Client → trainer connection rate (request → accept) | TBD |
| Weekly active clients (≥1 check-in or workout log / week) | TBD |
| Median trainer response time to new client message | TBD |
| App store rating | ≥ 4.2 |
| Crash-free sessions | ≥ 99% |

---

## 2. Goals and non-goals

### 2.1 Goals (v1)

1. Enable **clients** to find/connect with a trainer and log training + wellness data in-app.
2. Enable **trainers** to manage a roster, deliver plans, view progress, and communicate in one CRM-style workspace.
3. Ship a **credible MVP** competitive with Trainerize / TrueCoach / Everfit on core loop (not feature parity on payments or wearables).
4. Support **App Store / Play Store** submission with privacy policy, terms, and support contact.

### 2.2 Non-goals (v1 — explicit out of scope)

| Item | Notes |
|------|--------|
| Medical diagnosis / regulated healthcare | Fitness coaching only; disclaimers in-app and on marketing |
| Apple Health / Google Fit sync | Phase 2 |
| In-app payments (trainer platform fee + client pays coach) | “Coming soon” in onboarding; trainers set display rates only today |
| Trainer payroll / payouts | Arranged outside app |
| Group classes / team training at scale | Future |
| Custom per-trainer questionnaire builder | Fixed onboarding flows only today |
| Web app parity | Mobile-first |

---

## 3. Users and personas

### 3.1 Primary personas

**P1 — Client (“Athlete”)**  
- Wants a coach or already has one  
- Needs: marketplace browse, dashboard, messaging, workouts, nutrition, accountability  
- Success: stays consistent, sees progress, clear communication with coach  

**P2 — Trainer (“Coach”)**  
- Runs online/hybrid PT business, 5–50+ clients  
- Needs: client list, CRM detail, plans, calendar, files, progress visibility  
- Success: less admin, more coaching time, professional client experience  

### 3.2 Secondary

- **Prospective trainer** — onboarding, profile, marketplace listing  
- **Support / ops** — contact email, bug reports, account deletion  

### 3.3 Roles in product

| Role | Auth | App shell |
|------|------|-----------|
| `client` | Firebase Auth + Firestore `users.role` | `ClientApp.js` |
| `trainer` | Same | `TrainerApp.js` |

Role mismatch at login is blocked (client/trainer toggle must match stored role).

---

## 4. User journeys

### 4.1 Client — no trainer yet

1. Sign up / sign in as **Client**  
2. Complete onboarding questionnaire  
3. Land on **home** → see **Find Your Perfect Coach** marketplace hero (if no `trainerId`)  
4. Open **Find Trainers** → search, filter (specialty, experience, price, session type)  
5. View **trainer profile** → request / connect  
6. Trainer accepts → `trainerId` linked; marketplace hero hidden  

### 4.2 Client — with trainer

1. Home: greeting hero, **Your Complete Dashboard** card, stats, training agenda, nutrition, notes/files entry  
2. **My Dashboard**: wellness sliders, sleep/water, workouts, trainer card or browse CTA, weekly report, quick actions  
3. Message trainer, accept/decline **session invites**  
4. Log nutrition, complete workouts, optional **AI Coach** (not visible to trainer by default)  

### 4.3 Trainer

1. Sign up as **Trainer** → multi-step onboarding (bio, specialties, availability, rates deferred for IAP)  
2. **Dashboard**: clients, messages, sessions, check-in signals  
3. **Client detail** tabs: Progress, Nutrition, Calendar, Notes & Files  
4. Create/edit **sessions**, share **documents**, review **weekly snapshot**  
5. Accept **client requests** from marketplace  

---

## 5. Functional requirements

Requirements use: **Must** (P0), **Should** (P1), **Could** (P2).

### 5.1 Authentication and onboarding

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AUTH-01 | Email/password and Apple Sign-In | Must | Shipped |
| AUTH-02 | Role selection (client vs trainer) enforced against Firestore | Must | Shipped |
| AUTH-03 | Multi-step onboarding for both roles | Must | Shipped |
| AUTH-04 | Account deletion from Settings | Must | Shipped |
| AUTH-05 | Password reset / session persistence via Firebase | Must | Shipped |

### 5.2 Trainer marketplace

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| MKT-01 | Browse/search trainer list | Must | Shipped |
| MKT-02 | Filters: sort, specialty, experience, availability, max price, session type (remote/in-person/both) | Must | Shipped |
| MKT-03 | Trainer profile: bio, specialties, certs, pricing display, reviews UI | Must | Shipped |
| MKT-04 | Client request → trainer pending → accept/decline | Must | Shipped |
| MKT-05 | Link client `trainerId` on accept; reconcile via conversations / `trainer_client_links` | Must | Shipped |
| MKT-06 | Marketplace hero on **home only** when client has no trainer | Must | Shipped |
| MKT-07 | Featured / promoted listings | Could | Not shipped |

### 5.3 Messaging

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| MSG-01 | 1:1 conversations client ↔ trainer | Must | Shipped |
| MSG-02 | Real-time messages (Firestore) | Must | Shipped |
| MSG-03 | Unread badges (home, dashboard, trainer list) | Must | Shipped |
| MSG-04 | Push notifications for new messages | Should | Partial (infra + API) |
| MSG-05 | Image attachments in chat | Should | Verify per build |

### 5.4 Workouts and exercise library

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| WKT-01 | Workout plan builder / generator | Must | Shipped |
| WKT-02 | Exercise library with searchable videos (online stream) | Must | Shipped |
| WKT-03 | Active workout logging | Must | Shipped |
| WKT-04 | Plan PDF export / viewer | Should | Shipped |
| WKT-05 | Monthly limit on full plan regenerations (banner + reset) | Should | Shipped |
| WKT-06 | Trainer assigns/manages plans per client | Must | Shipped |
| WKT-07 | AI-generated workout plans | Should | Shipped (experimental) |

### 5.5 Nutrition

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| NUT-01 | Food logging and macro totals | Must | Shipped |
| NUT-02 | Barcode scan (camera permission) | Should | Shipped |
| NUT-03 | Home nutrition card reflects logged data | Must | Shipped |
| NUT-04 | Trainer read-only nutrition view per client | Must | Shipped |
| NUT-05 | Full restaurant database / meal planning product | Won’t (v1) | — |

### 5.6 Daily check-ins and dashboard

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| DSH-01 | Client home + **My Dashboard** hub | Must | Shipped |
| DSH-02 | Log sleep, water, energy, soreness, stress, weight, mood | Must | Shipped |
| DSH-03 | Data stored in `users/{uid}/dailyLogs/{dateKey}` | Must | Shipped |
| DSH-04 | Training agenda (today’s workout summary) | Must | Shipped |
| DSH-05 | Trainer sees progress tab + “check-in today” signal | Must | Shipped |
| DSH-06 | Explicit adherence % / streak UI | Should | Partial |
| DSH-07 | Apple Health / Google Fit import | Could | Not shipped |

### 5.7 Weekly reports

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| RPT-01 | `weeklySummaries` per client | Must | Shipped |
| RPT-02 | Narrative summary, trends, pros/cons, focus | Must | Shipped |
| RPT-03 | Client “Week in Review” entry from dashboard | Must | Shipped |
| RPT-04 | Trainer weekly report screen | Must | Shipped |
| RPT-05 | Long-term charting (multi-week graphs) | Could | Limited |

### 5.8 Notes and files

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FIL-01 | Shared `notes_and_files` per client | Must | Shipped |
| FIL-02 | PDF viewer; spreadsheet viewer/editor | Must | Shipped |
| FIL-03 | Real-time sync trainer upload → client sees | Must | Shipped |
| FIL-04 | Client can add notes/files | Must | Shipped |

### 5.9 Scheduling and sessions

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SES-01 | Trainer creates sessions (`trainer_clients/{trainerId}/sessions`) | Must | Shipped |
| SES-02 | Client accept/decline invites | Must | Shipped |
| SES-03 | Session reminder cards on client dashboard | Must | Shipped |
| SES-04 | Push on session create/response | Should | Partial |
| SES-05 | External calendar sync (Google/Apple Calendar) | Could | Not shipped |

### 5.10 AI Coach

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| AI-01 | In-app AI chat (fitness/nutrition scope only) | Should | Shipped |
| AI-02 | Daily message limits | Must | Shipped |
| AI-03 | Voice input (speech recognition permission) | Should | Shipped |
| AI-04 | AI chats **not** auto-shared with human trainer | Must | Shipped |
| AI-05 | Medical/off-topic refusal behavior | Must | Shipped |
| AI-06 | Server-side API (Claude/DeepSeek) via `EXPO_PUBLIC_API_BASE_URL` | Must | Shipped |

### 5.11 Notifications and settings

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| SET-01 | Theme (light/dark) | Must | Shipped |
| SET-02 | Notification preferences + workout reminders | Should | Shipped |
| SET-03 | Privacy Policy, Terms, Help FAQ, Contact Support, Bug Report | Must | Shipped |
| SET-04 | Support email displayed (default `coachconnect0@gmail.com`) | Must | Shipped |
| SET-05 | Expo push token registration | Should | Shipped |

### 5.12 Monetization (planned)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| MON-01 | Trainers set display price on profile (per month style) | Must | Shipped (display only) |
| MON-02 | Coach Connect does not process client payments | Must | Shipped |
| MON-03 | Trainer platform subscription (Apple/Google IAP) | Must | **Not shipped** — “coming soon” in onboarding |
| MON-04 | Client pays coach in-app | Could | Not shipped |

**Pricing policy (document until IAP live):**

- App download: free  
- Client pays coach: **trainer-defined**, outside app today  
- Trainer platform fee: **TBD** (suggested tiers in marketing draft: $0 early access → $29–79/mo Pro)  

---

## 6. Non-functional requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Home and dashboard load &lt; 3s on mid-tier device with warm cache; list scroll 60fps target |
| **Availability** | Firebase + API dependency; graceful offline messaging for cached reads where implemented |
| **Security** | Firestore rules enforce client/trainer data boundaries; no secrets in client bundle except public Firebase keys |
| **Privacy** | Privacy Policy published; account deletion; minimal data collection documented |
| **Accessibility** | Touch targets ≥ 44pt on primary CTAs; support Dynamic Type where feasible (ongoing) |
| **Localization** | English only v1 |
| **Compliance** | Not a medical device; FAQ and policy state no medical advice |

---

## 7. Technical architecture (summary)

| Layer | Technology |
|-------|------------|
| Mobile | Expo SDK, React Native, React Navigation patterns in app shells |
| Auth / DB / Storage | Firebase Auth, Firestore, Storage, Cloud Functions (as deployed) |
| API | Node server (`EXPO_PUBLIC_API_BASE_URL`) — AI, food search, push notify, support email |
| AI | Claude / Anthropic, DeepSeek (env-configured) |
| Push | Expo Notifications |
| UI system | Dark-first premium UI; pink→orange primary CTAs; Space Grotesk + Inter fonts |

**Critical constraint:** Production Firebase project ID remains **`anatrox-auth`** — do not rename in config/env for branding alone.

---

## 8. Information architecture (top-level)

### Client app (`ClientApp.js`)

- Home (scroll): Aurora hero → Dashboard hero → Marketplace hero (if no trainer) → stats → agenda → wellness → nutrition → files/notes → weekly report entry  
- Find Trainers (`TrainerSearchScreen` / marketplace)  
- My Dashboard (`MyDashboardScreen`)  
- Messages, Nutrition, Workouts, AI Coach, Profile, Settings (+ legal screens)  

### Trainer app (`TrainerApp.js`)

- Dashboard / client roster  
- Client detail (Progress, Nutrition, Calendar, Notes & Files)  
- Messaging, workout plans, session form, client requests, profile, settings  

---

## 9. Design and UX principles

1. **Mobile-first, portrait** — tablet supported on iOS but not optimized separately.  
2. **Dark-first** with light mode support via theme context.  
3. **Primary CTAs:** pink → orange gradient (not rainbow borders on cards).  
4. **Coach–client symmetry:** clients see “my coach”; trainers see “my clients.”  
5. **No developer-facing copy** in user UI (e.g. env var names in Privacy Policy).  
6. **Safe areas:** filter modals, bottom nav, and fixed footers respect home indicator.  

---

## 10. Dependencies and integrations

| Integration | Purpose | Required for launch? |
|-------------|---------|----------------------|
| Firebase | Auth, data, files | Yes |
| Expo EAS / build | Distribution | Yes |
| Apple Sign-In | iOS auth | Yes (iOS) |
| Resend/SMTP (server) | Support email | Should |
| YouTube / exercise video APIs | Exercise library | Should |
| Food search API | Nutrition | Should |
| Anthropic/DeepSeek | AI Coach / plans | Should (with fallbacks/messaging if down) |

---

## 11. Release criteria (MVP / v1.0)

### 11.1 Must pass before store submission

- [ ] Client and trainer flows complete without crash on cold start  
- [ ] Marketplace → request → accept → linked trainer path verified  
- [ ] Messaging send/receive + unread counts  
- [ ] Daily log write/read on dashboard  
- [ ] Privacy Policy + Terms + support email live in app  
- [ ] `eas build` / release binaries produced  
- [ ] App Store / Play metadata, screenshots, age rating  
- [ ] `npm run lint:ci` in CI (per `PRODUCTION_CHECKLIST.md`)  

### 11.2 Known acceptable gaps at v1.0

- No in-app billing  
- No HealthKit / Fit  
- Adherence analytics basic  
- AI daily caps may frustrate power users — document in FAQ  

---

## 12. Roadmap (recommended phases)

### Phase 1 — Launch polish (0–6 weeks)

- Marketplace + filter UX QA  
- Adherence indicators (check-in streak / %)  
- Notification flows (session + no check-in nudge)  
- Trainer IAP pricing finalized and implemented OR marketing says “free during beta”  
- Landing page + store listings  

### Phase 2 — Growth (6–12 weeks)

- In-app client payments to trainers (Stripe Connect or IAP)  
- Deeper analytics charts (weight, adherence over time)  
- Improved review/rating moderation  
- Referral / invite codes for trainers  

### Phase 3 — Platform (3–6 months)

- Apple Health / Google Fit read (steps, sleep optional)  
- Trainer questionnaire builder  
- Group programs / small team accounts  
- Web coach portal (read-only or light admin)  

---

## 13. Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firebase project naming (`anatrox` vs Coach Connect) confuses ops | Misconfiguration | Document in PRD + `.cursor/rules`; never bulk-rename project IDs |
| AI API cost overruns | Margin / outage | Daily limits, server cost config (`apiCosts.js`), monitoring |
| “Not a medical app” liability | Legal | Policies, FAQ, scoped AI system prompts |
| Trainer churn without payments in-app | Revenue | Clear trainer value prop; ship IAP or external billing guide |
| Empty marketplace at launch | Poor client UX | Seed trainers; geo/specialty filters; “no trainer” home hero |

---

## 14. Open questions (decisions needed)

| # | Question | Owner | Due |
|---|----------|-------|-----|
| 1 | Trainer platform price at launch ($0 vs $29/mo vs tiered)? | Founder | Pre-launch |
| 2 | Does Coach Connect take % of coach client fees when IAP ships? | Founder | Pre-monetization |
| 3 | Android launch same day as iOS or phased? | Founder | Pre-build |
| 4 | Are AI Coach chats ever shareable to trainer (opt-in)? | Product | Phase 2 |
| 5 | Minimum iOS version and device support matrix? | Eng | Pre-submission |
| 6 | Moderation policy for marketplace reviews? | Product/Legal | Pre-scale |

---

## 15. Appendix

### 15.1 Glossary

| Term | Definition |
|------|------------|
| **Check-in** | Daily log entry (wellness, sleep, water, etc.) for a calendar day |
| **Marketplace** | Find Trainers browse/search experience |
| **CRM** | Trainer’s per-client detail workspace |
| **AI Coach** | Automated assistant; not the human trainer |

### 15.2 Key Firestore paths (reference)

- `users/{uid}` — profile, role, `trainerId`  
- `users/{uid}/dailyLogs/{dateKey}` — daily metrics  
- `users/{uid}/weeklySummaries/{weekId}` — weekly reports  
- `users/{uid}/notes_and_files/{id}` — shared docs  
- `trainer_clients/{trainerId}/clients/{clientId}` — link  
- `trainer_clients/{trainerId}/sessions/{sessionId}` — sessions  
- `messages`, `conversations` — messaging  

### 15.3 Related documents

- `docs/TRAINER_APP_COMPETITOR_AUDIT.md` — feature parity snapshot  
- `PRODUCTION_CHECKLIST.md` — launch checklist  
- `docs/SECURITY_APP_CHECK.md` — security notes  
- Landing page copy (chat draft, May 2026)  

### 15.4 Document history

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-05-19 | — | Initial PRD from codebase audit |

---

*This PRD describes the product as implemented and planned in the Coach Connect mobile repository. Update version and §14 open questions when pricing, IAP, or launch scope are finalized.*
