# Phase 6 — Remaining PARTIAL Queue

After Phases 0–4 of the Full Restoration Build, these clusters remain **PARTIAL** in [REQUEST_STATUS_AUDIT.md](./REQUEST_STATUS_AUDIT.md). Work in priority order; mark rows `verified` after screenshot check.

## High priority clusters

| Cluster | MASTER examples | Notes |
|---------|-----------------|-------|
| Onboarding UI polish | #12–17, #55, #117 | Scroll/keyboard on onboarding steps |
| Session scheduling | #46–51, #136–137 | Calendar + booking flows |
| Exercise library | #55–57 | Library search + AI workout reads real JSON |
| Marketplace light mode | #136 | Contrast on marketplace cards |
| Forgot-password web | #102, #104, #147–148 | Web auth page styling |
| Workout generation leave page | #110 | Warn before leaving generator |
| Payment UX | #5 | Billing on trainer card (partially done) |
| Navigation file location | #118–119 | ClientMainScreen organization |
| Recovery meta | #275–298 | Documentation only |

## Verified in this restoration pass

| Item | Evidence | Status |
|------|----------|--------|
| #121 Energy/stress % | `clientHomeComponents.jsx` formatScore | verified |
| #234/#288 Firestore crash | `saveCoachMessagesToFirestore.js` | verified |
| #105/#192 Spreadsheet save | `spreadsheetRows.js` | verified |
| #129–149 Food/barcode | FatSecret + `barcodeMerge.js` | verified (deployed) |
| #254–255 Daily limits | `server/index.js` enforceDailyMessageLimit | verified |
| #165–166 Citations | `parseCoachToolCalls.js` | verified |
| #93 Client notes | `NotesFromTrainerSection.jsx` theme | verified |
| #84–211 AI Coach home | gradient CAN HELP, Log/Web/My Data/Photo | verified (device check) |
| #185–187 Chat bubbles | glass user bubble, icon-only copy | verified |
| #200 Food chips | removed Nutrition + FoodSearch chips | verified |
| #205–207 Chat history | lighter sidebar, 2-line titles | verified |
| #30–33 Home borders | calendar/agenda/nutrition hairline | verified |
| #89 Weekly report empty | icon + copy in `WeeklyReportPremium` | verified |
| #7 Google Sign-In | dev-client start, bundle id, app.config extra | partial — needs device test |
| Workout generate 404 | Cloud Run deploy rev 00100 | verified (401 without auth) |
| #227–228 Tests | 140 Jest tests pass | verified |

## Deferred (Phase 5)

Apple Sign-In (#91), Next.js landing (#109), Intention Flag colors (#130), trainer hero (#194), full src reorg (#247–249), Stripe live keys.

## How to pick next item

1. Open audit row with status `PARTIAL` and phase `P6`
2. Find screenshot in [SCREENSHOT_VISUAL_CATALOG.md](./SCREENSHOT_VISUAL_CATALOG.md)
3. Minimal code fix + `npm test`
4. Update audit row to `verified` or `regressed`
