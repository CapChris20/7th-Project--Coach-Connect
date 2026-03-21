# 🔍 Error Tracking Summary

## Answer to Your Questions

### Does Git Track Errors?
**Short answer: No, git doesn't automatically track runtime errors.**

Git tracks:
- ✅ Code changes (what you commit)
- ✅ File history
- ✅ Who changed what and when

Git does NOT track:
- ❌ Runtime errors (errors when app runs)
- ❌ Console errors
- ❌ Firebase permission errors
- ❌ API failures

**To see errors, you need to:**
1. Look at your terminal/console when running the app
2. Check browser dev tools (if web)
3. Use error tracking tools (Sentry, etc.)
4. Run the `check_errors.sh` script I created

## 🔴 Main Firebase Error (From Your Terminal)

### Firestore Permission Errors
**Error**: `Missing or insufficient permissions`
**You see**: `Failed to load food logs` and `Failed to load goals`

**Why**: Firestore security rules are missing for `nutrition_logs` and `nutrition_goals` collections

**Fix** (5 minutes):
1. Go to https://console.firebase.google.com/
2. Select `coachconnect-auth` project
3. Firestore Database → Rules
4. Copy rules from `docs/FIRESTORE_RULES_WITH_NUTRITION.md` (lines 61-78)
5. Paste and click "Publish"

## 📋 How to Track All Errors

### Option 1: Use the Firebase Error Tracker (BEST FOR FIREBASE)
```bash
# Scan code for Firebase error patterns
./track_firebase_errors.sh

# Or analyze your terminal log
./track_firebase_errors.sh your_terminal_log.txt
```

### Option 2: Use the General Error Scanner
```bash
./check_errors.sh
```
This scans your code for common error patterns.

### Option 2: Check Terminal Output
Look for these patterns in your terminal:
- `ERROR` - Critical errors
- `WARN` - Warnings
- `Failed to` - Operation failures
- `FirebaseError` - Firebase issues
- `permission-denied` - Security issues

### Option 3: Git Commands
```bash
# See recent changes
git log --oneline -10

# See what changed
git diff HEAD~1

# See all files that changed
git status
```

### Option 4: Manual Search
```bash
# Find all console.error calls
grep -r "console.error" src/

# Find Firebase errors
grep -r "FirebaseError\|permission-denied" src/
```

## ✅ What I Just Fixed

1. **Created Plus Button Menu** - Shows "Add to Photo Gallery" and "Add to Files" options
2. **Created PhotoGalleryScreen** - View and manage photos
3. **Created FilesScreen** - View and manage files
4. **Installed expo-document-picker** - For file selection
5. **Created error tracking docs** - `ERRORS_TRACKING.md` and `ERRORS_SUMMARY.md`
6. **Created check_errors.sh script** - Scans code for error patterns

## 🎯 Next Steps to Fix Firebase Errors

1. **Update Firestore Rules** (Most Important)
   - Go to Firebase Console
   - Add rules from `docs/FIRESTORE_RULES_WITH_NUTRITION.md`
   - This will fix the "Missing or insufficient permissions" errors

2. **Test the Plus Button**
   - Click the plus button in bottom nav
   - Should see menu with "Add to Photo Gallery" and "Add to Files"
   - Each option opens its respective screen

3. **Monitor Terminal**
   - Keep terminal open while running app
   - Look for new error patterns
   - Add them to `ERRORS_TRACKING.md`

## 📝 Files Created/Modified

**New Files:**
- `src/components/common/PlusButtonMenu.js`
- `src/screens/gallery/PhotoGalleryScreen.js`
- `src/screens/files/FilesScreen.js`
- `ERRORS_TRACKING.md`
- `ERRORS_SUMMARY.md`
- `check_errors.sh`

**Modified Files:**
- `App.js` - Added plus menu and new screens
- `package.json` - Added expo-document-picker
- `src/services/nutrition/nutritionService.js` - Better error handling

