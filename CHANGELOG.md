# Changelog - Dashboard Metrics Tools

**Date:** May 19, 2026 12:06 AM  
**Version:** 1.0.0 - Ready for Testing  
**Target Launch:** July 4, 2026

---

## What's New

### 6 New AI Coach Tools
1. **logWater** - Track water intake in ounces
2. **logSteps** - Track daily step count  
3. **rateEnergy** - Rate energy level 1-10
4. **logMood** - Log mood (happy/okay/stressed/tired/anxious)
5. **rateWorkout** - Rate workout experience 1-10
6. **logSleep** - Enhanced with dashboard integration

### Features
- ✅ Natural language support ("I drank 100oz", "My mood is happy", etc.)
- ✅ Real-time dashboard updates
- ✅ Server-side and client-side validation
- ✅ Offline support (client fallback)
- ✅ No duplicate entries (merge: true)
- ✅ User-friendly error messages

---

## Files Changed

### New Files (4)
- `TESTING_DASHBOARD_TOOLS.md` - Complete test suite
- `IMPLEMENTATION_CHECKLIST.md` - Technical implementation details
- `READY_FOR_TESTING.md` - Quick start guide
- `QUICK_REFERENCE.md` - Quick reference card

### Modified Files (5)
- `server/index.js` - System prompts + 5 tool handlers
- `src/ai/toolExecutor.js` - 5 client fallbacks
- `server/lib/inferCoachToolCall.js` - Tool inference patterns
- `firestore.rules` - 7 new collection rules
- `src/ai/deepseekService.js` - Error handling robustness

---

## Bug Fixes

### Critical Fixes
1. **Dashboard not updating**
   - Tools now write to both new collections AND dailyLogs
   - Dashboard reads from dailyLogs for real-time updates

2. **AI not proposing tools**
   - Added explicit tool routing in system prompts
   - Clear examples for each tool

3. **AI not inferring tools**
   - Added regex pattern matching in inferCoachToolCall.js
   - Fallback when AI forgets to output tool JSON

4. **Logger serialization error**
   - Added try-catch in deepseekService error handling
   - Prevents app crashes from error objects

---

## Data Structure

### New Collections
- `users/{uid}/water_logs/{date}` → { amount_oz, date, logged_at }
- `users/{uid}/step_logs/{date}` → { step_count, date, logged_at }
- `users/{uid}/energy_logs/{date}` → { rating, notes, date, logged_at }
- `users/{uid}/mood_logs/{date}` → { mood, notes, date, logged_at }
- `users/{uid}/workout_ratings/{date}` → { rating, notes, date, logged_at }
- `users/{uid}/dailyMetrics/{date}` → { step_count, energy_rating, mood, updatedAt }

### Updated Collections
- `users/{uid}/sleep_logs/{date}` → { hours, date, logged_at }
- `users/{uid}/dailyLogs/{date}` → { dashboard_sleep, dashboard_energy, dashboard_mood, updatedAt }

---

## Validation Rules

| Tool | Rule | Error Message |
|------|------|---------------|
| logWater | amount_oz > 0 | "Water amount must be greater than 0 ounces" |
| logSteps | step_count >= 0 && < 100000 | "Step count must be 0 or greater" |
| rateEnergy | 1 <= rating <= 10 | "Energy rating must be between 1 and 10" |
| logMood | mood in [happy, okay, stressed, tired, anxious] | "Mood must be one of: happy, okay, stressed, tired, anxious" |
| rateWorkout | 1 <= rating <= 10 | "Workout rating must be between 1 and 10" |
| logSleep | 0 < hours <= 24 | "Invalid sleep hours (use 0.5–24)" |

---

## Testing

**See:** `TESTING_DASHBOARD_TOOLS.md` for complete 10-test suite

**Quick Start:**
```bash
# Terminal 1
cd server && npm run dev

# Terminal 2  
npx expo start --tunnel

# Browser
https://console.firebase.google.com/project/anatrox-auth/firestore/data
```

Then in app, try:
- "I slept 9 hours"
- "I drank 100oz of water"
- "I did 10,000 steps"
- "My energy is 7/10"
- "My mood is happy"
- "That workout was 9/10"

---

## Known Issues (All Fixed)

✅ Dashboard not updating → FIXED (write to 3 collections)  
✅ AI not proposing tools → FIXED (added routing rules)  
✅ AI not inferring tools → FIXED (pattern matching added)  
✅ Logger errors → FIXED (robust error handling)  

---

## Ready for Production

- ✅ Code complete
- ✅ Validation implemented
- ✅ Error handling added
- ✅ Offline support included
- ✅ Documentation complete
- ⏳ Awaiting QA testing

---

## Next Steps

1. Run full test suite (`TESTING_DASHBOARD_TOOLS.md`)
2. Verify all 10 tests PASS
3. Deploy to production
4. Monitor for any issues
5. Launch July 4, 2026

---

## Contact

For issues or questions, refer to:
- Technical details: `IMPLEMENTATION_CHECKLIST.md`
- Test procedures: `TESTING_DASHBOARD_TOOLS.md`
- Quick reference: `QUICK_REFERENCE.md`
