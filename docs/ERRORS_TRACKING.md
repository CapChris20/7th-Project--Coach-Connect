# Error Tracking Document

## How to Track Errors

### 1. Git Logs
Git doesn't automatically track runtime errors, but you can:
- Check commit history: `git log --oneline`
- See what changed: `git diff`
- Check for console errors in your terminal

### 2. Current Known Firebase Errors

Based on recent terminal output, here are the Firebase errors to fix:

#### 🔴 A. Firestore Permission Errors (CRITICAL - BLOCKING NUTRITION FEATURES)
**Error Message**: `Missing or insufficient permissions` / `FirebaseError: Missing or insufficient permissions`

**Where it happens**: 
- Nutrition page when loading food logs
- When trying to save nutrition goals
- Terminal shows: `Failed to load food logs` and `Failed to load goals, using default`

**Collections affected**:
- `nutrition_logs` - Food logs (user's food entries)
- `nutrition_goals` - Nutrition goals (user's calorie/macro targets)

**Root Cause**: Firestore security rules don't include rules for `nutrition_logs` and `nutrition_goals` collections

**Solution**: 
1. Go to https://console.firebase.google.com/
2. Select project: `coachconnect-auth`
3. Go to Firestore Database → Rules tab
4. Add the rules from `docs/FIRESTORE_RULES_WITH_NUTRITION.md` (lines 61-78)
5. Click "Publish"
6. Wait 30 seconds for rules to propagate

**Files to check**:
- `src/services/nutrition/nutritionService.js` - Has error handling but rules are missing
- `docs/FIRESTORE_RULES_WITH_NUTRITION.md` - Contains the exact rules to add

**Status**: ⚠️ **NEEDS FIXING** - This is blocking nutrition features from working

#### B. Potential Issues to Check

1. **Firebase Initialization**
   - Check if `db` is properly initialized
   - Verify Firebase config in `src/services/firebase/config.js`

2. **Missing Collections**
   - Ensure collections exist in Firestore
   - Check if indexes are needed for queries

3. **Authentication State**
   - Verify user is authenticated before Firestore queries
   - Check `auth.currentUser` is not null

## Quick Fix Commands

### Check for Firebase errors in code:
```bash
grep -r "FirebaseError\|permission-denied" src/
```

### Check console for runtime errors:
Look for patterns like:
- `Failed to load food logs`
- `Missing or insufficient permissions`
- `FirebaseError`

### View recent git changes:
```bash
git log --oneline -10
git diff HEAD~1
```

## Error Categories

### 🔴 Critical (Fix Immediately)
1. Firestore permission errors for nutrition collections
2. Any errors preventing app from loading

### 🟡 Warning (Fix Soon)
1. Console warnings about missing indexes
2. Deprecated API usage

### 🟢 Info (Monitor)
1. Development warnings
2. Non-blocking errors

## Next Steps

1. **Update Firestore Rules** - Go to Firebase Console and add rules from `docs/FIRESTORE_RULES_WITH_NUTRITION.md`
2. **Check Console Logs** - Run the app and check terminal for specific error messages
3. **Test Each Feature** - Go through each feature and note any errors
4. **Document New Errors** - Add to this file as you find them

## How to Add New Errors

When you find a new error:
1. Note the exact error message
2. Note which screen/feature it happens on
3. Note any steps to reproduce
4. Add to the appropriate section above

