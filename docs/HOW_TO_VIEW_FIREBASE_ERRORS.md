# 🔍 How to View Errors in Firebase Console

## Why "Add Client" Failed

The error "Failed to add client: FirebaseError: Missing or insufficient permissions" means your Firestore security rules don't allow writing to the `clients` collection.

## Quick Fix

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `coachconnect-auth`
3. **Go to**: Firestore Database → **Rules**
4. **Copy the rules from**: `docs/FIRESTORE_RULES_WITH_NUTRITION.md`
5. **Paste and Publish**

The rules now include the `clients` collection that was missing!

---

## How to View Errors in Firebase Console

### Method 1: Firestore Console (Real-time Errors)

1. **Go to**: Firebase Console → Firestore Database
2. **Click**: `app_errors` collection
3. **View**: All errors logged by your app in real-time
4. **Filter**: Click on any error document to see full details

### Method 2: Firebase Console Logs (Runtime Errors)

1. **Go to**: Firebase Console → Project Settings
2. **Click**: "Logs" tab (or use Google Cloud Console)
3. **View**: All runtime errors and warnings
4. **Filter**: By service (Firestore, Auth, etc.)

### Method 3: Google Cloud Console (Most Detailed)

1. **Go to**: https://console.cloud.google.com/
2. **Select**: Your Firebase project
3. **Go to**: Logging → Logs Explorer
4. **Filter by**:
   - Service: `firestore.googleapis.com`
   - Severity: `ERROR` or `WARNING`
5. **View**: Detailed error logs with stack traces

### Method 4: Browser Console (For Web)

1. **Open**: Browser DevTools (F12)
2. **Go to**: Console tab
3. **Filter**: Type "Error" or "Firebase" in filter box
4. **View**: All client-side errors in real-time

### Method 5: React Native Debugger (For Mobile)

1. **Shake device** or press `Cmd+D` (iOS) / `Cmd+M` (Android)
2. **Select**: "Debug"
3. **Open**: Chrome DevTools
4. **Go to**: Console tab
5. **View**: All app errors

---

## Why ERRORS.md Might Not Be Working

### Common Issues:

1. **Script not running**: 
   - Run: `node scripts/generateErrorList.js`
   - Check: Server is running and Firestore rules allow reading `app_errors`

2. **Firestore rules blocking**:
   - Make sure `app_errors` collection has read permissions
   - Check: `docs/FIRESTORE_RULES_WITH_NUTRITION.md` has the rules

3. **Errors not being logged**:
   - Check: `utils/logError.js` is being called
   - Check: `autoLogErrorSync` is working
   - Check: Firestore rules allow creating in `app_errors`

4. **File not updating**:
   - Make sure you're running the script from project root
   - Check: File permissions allow writing to `ERRORS.md`

---

## Quick Debug Commands

```bash
# Check if errors are being logged to Firestore
# Go to Firebase Console → Firestore → app_errors collection

# Generate ERRORS.md from Firestore
node scripts/generateErrorList.js

# Check Firestore rules
# Go to Firebase Console → Firestore → Rules

# View real-time errors in console
# Open your app and check browser/React Native console
```

---

## Best Practice: Use Firebase Console

**For production debugging, use Firebase Console directly:**
- Real-time error viewing
- Better filtering and search
- No need to run scripts
- Access from anywhere

**ERRORS.md is useful for:**
- Local development
- Version control
- Sharing errors with team
- Offline viewing

