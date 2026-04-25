# Google Sign-In Setup Guide

If you're seeing "Google Sign-In is blocked" errors, follow these steps:

## Step 1: Enable Google Sign-In in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **coachconnect-auth**
3. Navigate to: **Authentication** > **Sign-in method**
4. Click on **Google** provider
5. Toggle **Enable** to ON
6. Enter your **Support email** (your email)
7. Click **Save**

## Step 2: Configure OAuth Consent Screen

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select project: **coachconnect-auth**
3. Navigate to: **APIs & Services** > **OAuth consent screen**
4. Choose **External** (unless you have Google Workspace)
5. Fill in required fields:
   - App name: **ANATROX**
   - User support email: Your email
   - Developer contact: Your email
6. Click **Save and Continue**
7. Add scopes (default is fine): Click **Save and Continue**
8. Add test users (if in Testing mode): Add your email
9. Click **Save and Continue**

## Step 3: Get Client IDs

1. In Google Cloud Console, go to: **APIs & Services** > **Credentials**
2. Find your **OAuth 2.0 Client IDs**
3. You need:
   - **Web client ID** (already in config.js)
   - **iOS client ID** (if building for iOS)
   - **Android client ID** (if building for Android)

## Step 4: Add Authorized Domains

1. In Firebase Console: **Authentication** > **Settings** > **Authorized domains**
2. Add your domains:
   - `localhost` (for development)
   - Your production domain
   - `coachconnect-auth.firebaseapp.com` (default)

## Step 5: Update Client IDs in Code

Update the client IDs in:
- `src/screens/auth/LoginScreen.js`
- `src/screens/auth/SignupScreen.js`

Replace the `webClientId`, `iosClientId`, and `androidClientId` with your actual client IDs from Google Cloud Console.

## Common Issues

### "Access blocked: This app's request is invalid"
- **Fix**: Complete the OAuth consent screen setup in Google Cloud Console
- Make sure you've added test users if in Testing mode

### "Error 400: redirect_uri_mismatch"
- **Fix**: Add your app's redirect URI to authorized redirect URIs in Google Cloud Console
- For Expo: Add `https://auth.expo.io/@your-username/your-app`

### "Operation not allowed"
- **Fix**: Enable Google Sign-In in Firebase Console > Authentication > Sign-in methods

### Still having issues?
- Check Firebase Console > Authentication > Users to see if users are being created
- Check browser console for detailed error messages
- Verify your Firebase config in `src/services/firebase/config.js` is correct

