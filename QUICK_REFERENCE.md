# Quick Reference - Testing Dashboard Tools

## 6 Tools Summary

```
Tool           | Phrase Example              | Collection              | Validation
---------------|-----------------------------|-----------------------|------------------
logSleep       | "I slept 9 hours"          | sleep_logs, dailyLogs | 0 < hours <= 24
logWater       | "I drank 100oz water"      | water_logs            | amount_oz > 0
logSteps       | "I did 10,000 steps"       | step_logs, dailyMetrics | steps >= 0
rateEnergy     | "My energy is 7/10"        | energy_logs, dailyLogs, dailyMetrics | 1-10
logMood        | "My mood is happy"         | mood_logs, dailyLogs, dailyMetrics | happy|okay|stressed|tired|anxious
rateWorkout    | "That workout was 9/10"    | workout_ratings       | 1-10
```

## What Each Tool Does

### logSleep
- User says: "I slept 9 hours"
- System writes to:
  - `sleep_logs/2026-05-19` ← metrics history
  - `dailyLogs/2026-05-19` (dashboard_sleep: 9) ← dashboard real-time
  - `daily_tracking/2026-05-19` (sleepHours: 9) ← compatibility
- Dashboard Sleep card updates immediately

### logWater
- User says: "I drank 100oz"
- System writes to:
  - `water_logs/2026-05-19` ← metrics history
- Logs water intake tracking

### logSteps  
- User says: "I did 12,000 steps"
- System writes to:
  - `step_logs/2026-05-19` ← metrics history
  - `dailyMetrics/2026-05-19` (step_count: 12000) ← aggregated
- Dashboard Steps card updates

### rateEnergy
- User says: "My energy is 7 out of 10"
- System writes to:
  - `energy_logs/2026-05-19` (rating: 7) ← metrics history
  - `dailyLogs/2026-05-19` (dashboard_energy: 7) ← dashboard real-time
  - `dailyMetrics/2026-05-19` (energy_rating: 7) ← aggregated
- Dashboard Energy card updates immediately

### logMood
- User says: "My mood is anxious"
- System writes to:
  - `mood_logs/2026-05-19` (mood: "anxious") ← metrics history
  - `dailyLogs/2026-05-19` (dashboard_mood: "anxious") ← dashboard real-time
  - `dailyMetrics/2026-05-19` (mood: "anxious") ← aggregated
- Supports: happy, okay, stressed, tired, anxious
- Dashboard Mood card updates immediately

### rateWorkout
- User says: "That was a 9 out of 10 workout"
- System writes to:
  - `workout_ratings/2026-05-19` (rating: 9) ← metrics history
- Workout rating persisted

## Test Sequence

**1. Start Services**
```bash
Terminal 1: cd server && npm run dev
Terminal 2: npx expo start --tunnel
Browser: https://console.firebase.google.com/project/anatrox-auth/firestore/data
```

**2. For Each Tool Test:**
1. Ask in app
2. Confirm tool
3. Check Firestore Console (watch collection update)
4. Check Dashboard (watch card update)
5. Re-log to verify overwrite behavior
6. Try invalid input to verify error

**3. All Tools Pass When:**
- ✅ Firestore entry created
- ✅ Dashboard updates
- ✅ Re-logging overwrites (merge: true)
- ✅ Invalid input rejected
- ✅ Error message shown to user

## Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| Dashboard not updating | Restart server (tools now write to 3 collections) |
| AI doesn't propose tool | Ask again with clearer phrase |
| Duplicate entries | Already fixed (merge: true in code) |
| Logger error | Already fixed (robust error handling) |
| Invalid input accepted | Already fixed (validation in server/client) |
| Offline fails | Already fixed (client fallback in code) |

## Success Indicators

✅ When you see this = TEST PASSED
- Firestore Console shows new entry
- Dashboard card updates within 1-2 seconds
- No error toast/message when valid input
- User-friendly error shown for invalid input
- No app freeze or crash

❌ When you see this = TEST FAILED
- No Firestore entry created
- Dashboard still shows old value
- Invalid input accepted without error
- Multiple entries for same date
- App crashes or freezes

## Documentation Files

- `READY_FOR_TESTING.md` ← You are here
- `TESTING_DASHBOARD_TOOLS.md` ← Full test suite (10 tests)
- `IMPLEMENTATION_CHECKLIST.md` ← Technical details
