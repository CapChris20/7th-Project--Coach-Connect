# Thread gap-fix manual QA checklist

Run automated checks first:

```bash
npm run test:thread-gap-fixes
# or full suite:
./scripts/runThreadGapFixSuite.sh
```

Deploy before device QA if you changed server or rules:

```bash
firebase deploy --only firestore:rules
./server/deploy.sh
npx expo start --clear
```

---

## 1. Spreadsheet share → Notes & Files (Firestore rules)

**Requires:** rules deployed (`firebase deploy --only firestore:rules`)

- [ ] Trainer opens a client spreadsheet and taps Share
- [ ] Client opens Notes & Files and sees the shared item
- [ ] Trainer can update or remove a stub they created (`addedBy: trainer`)
- [ ] Client-owned items still only editable by the client

---

## 2. Workout plan generation + tab badge

- [ ] Client starts AI plan generation on Workout tab
- [ ] Switch to another tab (or background app) while generating
- [ ] When done: local notification (if enabled) and pink dot on Workout tab
- [ ] Tap banner or Workout tab → plan opens (not stuck on spinner)
- [ ] If you stay on Workout tab during generation, no badge when complete

---

## 3. AI Coach photo / vision (server deployed)

- [ ] Attach a clear JPEG progress photo in AI Coach chat
- [ ] Reply starts with **"What I can see:"** and lists observable details
- [ ] Coach does **not** invent gym equipment or exercises not in the photo
- [ ] Corrupt or wrong-format image → clear message to resend as JPEG/PNG (not a generic crash)
- [ ] Large photo completes within ~2 minutes (120s client timeout)

Optional live API smoke:

```bash
node scripts/testCoachVisionGapFixes.js --live
```

---

## 4. Quick Add nutrition UI

- [ ] Open Quick Add from nutrition flow
- [ ] Top gradient accent bar visible
- [ ] No sparkle / decorative dot animations

---

## 5. Trainer location (lazy expo-location)

- [ ] App launches without crash when ExpoLocation native module is missing (dev build)
- [ ] Trainer profile location flow shows rebuild message only when user tries location (not at startup)

---

## 6. Workout generation usage (serverTs fix)

- [ ] Generate a workout plan successfully (no 500 after Claude finishes)
- [ ] Usage counter increments (e.g. "1 of 3 this month")

Automated:

```bash
node scripts/testWorkoutGenerationServerTs.js
```

---

## 7. Plan viewer (June UI — not a gap fix, thread context)

- [ ] Open assigned plan from client app
- [ ] Gradient header / June 7 design (not flat May layout)

---

## Not in this thread (deferred)

- Password reset web page + branded server email
- Trainer live JSON "Client has not logged in yet" copy
