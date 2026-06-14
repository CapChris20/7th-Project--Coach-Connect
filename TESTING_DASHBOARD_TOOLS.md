# Dashboard Metrics Tools - Testing Suite

**Deployment Date:** July 4, 2026  
**Status:** Ready for QA Testing

---

## Setup

Before running tests:

1. **Terminal 1:** Start server
```bash
cd server && npm run dev
```

2. **Terminal 2:** Keep Expo running
```bash
npx expo start --tunnel
```

3. **Browser:** Open Firestore Console
```
https://console.firebase.google.com/project/anatrox-auth/firestore/data
```

4. **Device:** Have Coach Connect app open

---

## Test 1: Log Sleep ✅ PASS/FAIL

**Objective:** Verify sleep logging with real-time dashboard update

### Steps:
1. In app, ask AI Coach: **"I slept 9 hours last night"**
2. Confirm the tool modal
3. Watch Firestore Console - look for `sleep_logs/2026-05-19` document
4. Check dashboard - Sleep card should update to "9 hours"
5. Ask again: **"Actually, I got 8 hours"**
6. Confirm - document should UPDATE (not duplicate)
7. Try invalid: **"30 hours sleep"** - should reject with error

### Expected Results:
- ✅ Sleep card updates in real-time
- ✅ No duplicate entries for same date
- ✅ Invalid input rejected
- ✅ Firestore: `users/{uid}/dailyLogs/{date}` has `dashboard_sleep: 9`

**PASS / FAIL:** ___________

---

## Test 2: Log Water 💧 PASS/FAIL

**Objective:** Verify water tracking and dashboard integration

### Steps:
1. Ask: **"I drank 100 oz of water"**
2. Confirm tool
3. Watch Firestore - look for `water_logs/2026-05-19` entry
4. Dashboard should show water intake (if water card exists)
5. Ask: **"Actually 150 oz"**
6. Confirm - should update to 150 oz
7. Try: **"0 oz"** - should reject with error

### Expected Results:
- ✅ Water logged to `water_logs` collection
- ✅ Re-logging updates (merge: true)
- ✅ Invalid input caught and error shown

**PASS / FAIL:** ___________

---

## Test 3: Log Steps 🚶 PASS/FAIL

**Objective:** Verify step counting and dual collection write

### Steps:
1. Ask: **"I did 12,000 steps today"**
2. Confirm
3. Check Firestore:
   - `step_logs/2026-05-19` should exist
   - `dailyMetrics/2026-05-19` should have `step_count: 12000`
4. Dashboard updates
5. Ask: **"14,000 steps actually"**
6. Both collections should update (no duplicates)
7. Try: **"-1000 steps"** - should reject

### Expected Results:
- ✅ Both `step_logs` AND `dailyMetrics` written
- ✅ Re-logging updates both
- ✅ Invalid input rejected

**PASS / FAIL:** ___________

---

## Test 4: Rate Energy ⚡ PASS/FAIL

**Objective:** Verify energy rating with dashboard update

### Steps:
1. Ask: **"My energy is 8 out of 10"**
2. Confirm tool
3. Check Firestore:
   - `energy_logs/2026-05-19` has `rating: 8`
   - `dailyLogs/2026-05-19` has `dashboard_energy: 8`
   - `dailyMetrics/2026-05-19` has `energy_rating: 8`
4. Dashboard updates
5. Ask: **"Actually 6"**
6. All three documents update (merge: true)
7. Try: **"11/10"** - should reject
8. Try: **"0/10"** - should reject

### Expected Results:
- ✅ All three collections written
- ✅ All three update on re-logging
- ✅ 1-10 validation enforced

**PASS / FAIL:** ___________

---

## Test 5: Log Mood 😊 PASS/FAIL

**Objective:** Verify mood tracking with enum validation

### Steps:
1. Ask: **"My mood is happy"**
2. Confirm
3. Firestore check:
   - `mood_logs/2026-05-19` has `mood: "happy"`
   - `dailyMetrics/2026-05-19` has `mood: "happy"`
4. Try each mood: **happy, okay, stressed, tired, anxious**
   - All 5 should work
5. Try: **"My mood is sad"** - should reject with error
6. Try: **"My mood is ANXIOUS"** - should work (lowercase conversion)

### Expected Results:
- ✅ All 5 moods accepted
- ✅ Invalid moods rejected
- ✅ Case-insensitive handling
- ✅ Data written to both collections

**PASS / FAIL:** ___________

---

## Test 6: Rate Workout 💪 PASS/FAIL

**Objective:** Verify workout rating persistence

### Steps:
1. Ask: **"That workout was a 9 out of 10"**
2. Confirm
3. Firestore: `workout_ratings/2026-05-19` has `rating: 9`
4. Ask: **"Actually it was 10/10"**
5. Document updates (merge: true)
6. Try: **"15/10"** - should reject
7. Try: **"0/10"** - should reject

### Expected Results:
- ✅ Rating logged to `workout_ratings`
- ✅ Re-logging updates (no duplicates)
- ✅ 1-10 validation enforced

**PASS / FAIL:** ___________

---

## Test 7: Multi-Tool Sequence 🎯 PASS/FAIL

**Objective:** Verify multiple tools work in sequence

### Steps:
1. Ask all 6 in rapid succession:
   - "I slept 8 hours"
   - "I drank 100 oz water"
   - "I did 10,000 steps"
   - "My energy is 7"
   - "My mood is stressed"
   - "That workout was 8/10"
2. Confirm each tool
3. Check Firestore Console - all 6 collections should have entries
4. Dashboard should show all metrics
5. No errors in app console

### Expected Results:
- ✅ All 6 tools execute without interference
- ✅ All data writes succeed
- ✅ No app crashes or error states
- ✅ Dashboard displays all metrics

**PASS / FAIL:** ___________

---

## Test 8: Overwrite (Not Duplicate) 📝 PASS/FAIL

**Objective:** Verify same-date re-logging overwrites

### Steps:
1. Log: "I slept 9 hours"
2. Firestore: `sleep_logs/2026-05-19` → `{ hours: 9 }`
3. Log again: "I slept 7 hours"
4. Firestore: `sleep_logs/2026-05-19` → `{ hours: 7 }`
5. Verify: Only 1 document exists (not 2)
6. Document ID should be date (YYYY-MM-DD), not random UUID
7. Repeat for all tools

### Expected Results:
- ✅ Re-logging overwrites, never duplicates
- ✅ Document ID is date-based
- ✅ No duplicate entries in collection

**PASS / FAIL:** ___________

---

## Test 9: Client Fallback (Offline Mode) 📡 PASS/FAIL

**Objective:** Verify tools work if server unreachable

### Steps:
1. **Turn off WiFi/cellular on device**
2. Ask: "I drank 80 oz of water"
3. Confirm
4. Should execute offline (no crash, no error shown)
5. **Turn WiFi back on**
6. Data should sync to Firestore
7. Try multiple tools offline - all should queue

### Expected Results:
- ✅ No error toast when offline
- ✅ No app crash
- ✅ Data syncs when reconnected
- ✅ Multiple offline tools can queue

**PASS / FAIL:** ___________

---

## Test 10: Error Handling 🚨 PASS/FAIL

**Objective:** Verify errors don't crash app

### Steps:
1. Try boundary tests:
   - `rateEnergy(rating: -5)` - should error
   - `rateEnergy(rating: 11)` - should error
   - `logMood(mood: "xyz")` - should error
   - `logWater(amount_oz: 0)` - should error
   - `logSteps(step_count: -100)` - should error
2. Each should show user-friendly error message
3. App should NOT crash
4. App should NOT freeze
5. User can continue using app

### Expected Results:
- ✅ All validation errors caught
- ✅ User-friendly error messages
- ✅ No app crashes
- ✅ App remains responsive

**PASS / FAIL:** ___________

---

## Summary Checklist

- [ ] Test 1 PASSED: Log Sleep
- [ ] Test 2 PASSED: Log Water
- [ ] Test 3 PASSED: Log Steps
- [ ] Test 4 PASSED: Rate Energy
- [ ] Test 5 PASSED: Log Mood
- [ ] Test 6 PASSED: Rate Workout
- [ ] Test 7 PASSED: Multi-Tool Sequence
- [ ] Test 8 PASSED: Overwrite Behavior
- [ ] Test 9 PASSED: Client Fallback (Offline)
- [ ] Test 10 PASSED: Error Handling

---

## Launch Readiness

**✅ READY FOR PRODUCTION if:** All 10 tests PASS

**❌ NEEDS FIXES if:** Any test FAILS

### Notes/Issues Found:
```
[Add any issues found during testing here]
```

---

**Tester Name:** ________________  
**Date:** ________________  
**Time Spent:** ________________  
**Signature:** ________________
