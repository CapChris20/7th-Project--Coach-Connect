# 🔥 Firebase Error Tracking

## How I'm Tracking Your Firebase Errors

### Method 1: Terminal Output Analysis
When you run the app, I look for these patterns in your terminal:
- `FirebaseError` - Any Firebase-related error
- `Missing or insufficient permissions` - Firestore permission issues
- `Failed to load` - Data loading failures
- `permission-denied` - Security rule issues

### Method 2: Code Scanning
I created a script (`check_errors.sh`) that scans your code for:
- Firebase error handling patterns
- Permission checks
- Database initialization issues

### Method 3: Documentation
I document errors in these files:
- `FIREBASE_ERRORS.md` (this file) - Firebase-specific errors
- `ERRORS_TRACKING.md` - All errors
- `ERRORS_SUMMARY.md` - Quick reference

## 🔴 Current Firebase Errors (From Your Terminal)

### 1. Firestore Permission Errors - CRITICAL
**Error**: `Missing or insufficient permissions`
**Collections**: `nutrition_logs`, `nutrition_goals`
**Status**: ⚠️ **NEEDS FIXING**

**What I see in your terminal**:
```
Failed to load food logs: [FirebaseError: Missing or insufficient permissions.]
Failed to load goals, using default: Missing or insufficient permissions.
Fallback query also failed: [FirebaseError: Missing or insufficient permissions.]
```

**Fix**: Add Firestore rules (see `docs/FIRESTORE_RULES_WITH_NUTRITION.md`)

## 📊 How to See All Your Firebase Errors

### Quick Command to List All Firebase Errors:
```bash
# Run this to see all Firebase errors in your terminal output
grep -i "firebase\|permission\|failed to load" <your_terminal_log.txt
```

### Or Check Your Terminal While App Runs:
Look for lines containing:
- `FirebaseError`
- `permission-denied`
- `Failed to load`
- `Missing or insufficient`

### Run the Error Scanner:
```bash
./check_errors.sh
```

## 🎯 Firebase Errors I've Identified

| Error | Collection | Status | Fix Location |
|-------|-----------|--------|--------------|
| Missing permissions | `nutrition_logs` | 🔴 Critical | Firebase Console → Rules |
| Missing permissions | `nutrition_goals` | 🔴 Critical | Firebase Console → Rules |

## 📝 How to Add New Firebase Errors

When you see a new Firebase error in your terminal:

1. **Copy the exact error message**
2. **Note which feature/screen it happens on**
3. **Run**: `./check_errors.sh` to scan code
4. **Add to this file** under "Current Firebase Errors"

## 🔧 Quick Fixes

### Fix Permission Errors:
1. Open https://console.firebase.google.com/
2. Select `coachconnect-auth`
3. Go to Firestore Database → Rules
4. Copy from `docs/FIRESTORE_RULES_WITH_NUTRITION.md`
5. Paste and Publish

### Check if Firebase is Initialized:
Look in terminal for:
- `Firebase initialized successfully` ✅
- `Firebase initialization error` ❌

### Check Authentication:
Look for:
- `User signed in` ✅
- `No user ID available` ❌

## 💡 Pro Tips

1. **Keep terminal open** - Errors show in real-time
2. **Look for ERROR/WARN** - These are the important ones
3. **Check Firebase Console** - See if collections exist
4. **Test after fixes** - Run app and check terminal again

## 📋 Error Log Template

When you find a new error, add it like this:

```markdown
### X. [Error Name]
**Error**: `[exact error message]`
**Where**: [which screen/feature]
**Collections**: [if Firestore related]
**Status**: 🔴 Critical / 🟡 Warning / 🟢 Info
**Fix**: [what needs to be done]
```

