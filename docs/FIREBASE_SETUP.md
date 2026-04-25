# Firebase Setup Guide for CoachConnect AI

## 🚀 Quick Setup Steps

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `coachconnect-auth`
4. Enable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication
1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable the following providers:
   - **Email/Password** (required)
   - **Google** (optional, for web)
   - **Anonymous** (optional)

### 3. Set up Firestore Database
1. Go to "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select a location (choose closest to your users)
5. Click "Done"

### 4. Set up Firebase Storage
1. Go to "Storage" in the left sidebar
2. Click "Get started"
3. Choose "Start in test mode" (for development)
4. Select the same location as Firestore
5. Click "Done"

### 5. Get Firebase Configuration
1. Go to "Project settings" (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" and select the web icon (`</>`)
4. Enter app nickname: `CoachConnect Web App`
5. Check "Also set up Firebase Hosting" (optional)
6. Click "Register app"
7. Copy the Firebase configuration object

### 6. Configure Environment Variables
1. Copy `env.example` to `.env` in your project root
2. Fill in your Firebase configuration values:

```bash
# Copy these values from Firebase Console > Project Settings > General > Your apps
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=coachconnect-auth.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=coachconnect-auth
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=coachconnect-auth.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id_here
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id_here
```

### 7. Test Firebase Connection
Run your app and check the console logs. You should see:
```
Firebase initialized successfully for project: coachconnect-auth
```

## 🔧 Firebase Services Configured

### Authentication (`src/services/firebase/auth.js`)
- ✅ Email/Password sign up and sign in
- ✅ Password reset
- ✅ Google sign in (web)
- ✅ Email verification
- ✅ Profile updates
- ✅ Password updates
- ✅ User reauthentication

### Firestore Database (`src/services/firebase/firestore.js`)
- ✅ Create documents
- ✅ Read documents
- ✅ Update documents
- ✅ Delete documents
- ✅ Query with filters
- ✅ Ordering and limits

### Firebase Storage (`src/services/firebase/storage.js`)
- ✅ File uploads
- ✅ File downloads
- ✅ File deletion
- ✅ Directory listing
- ✅ Profile image uploads
- ✅ Progress photo uploads
- ✅ Food image uploads

## 📱 Usage Examples

### Authentication
```javascript
import { signUp, signIn, signOutUser } from '../services/firebase/auth';

// Sign up a new user
const result = await signUp('user@example.com', 'password123', 'John Doe');

// Sign in existing user
const loginResult = await signIn('user@example.com', 'password123');

// Sign out
await signOutUser();
```

### Firestore
```javascript
import { createDoc, getDocById, queryCollection } from '../services/firebase/firestore';

// Create a new workout
const workout = await createDoc('workouts', {
  userId: 'user123',
  name: 'Push Day',
  exercises: ['bench-press', 'shoulder-press']
});

// Get user profile
const profile = await getDocById('users', 'user123');

// Query user's workouts
const workouts = await queryCollection('workouts', [
  { field: 'userId', operator: '==', value: 'user123' }
], 'createdAt', 'desc', 10);
```

### Storage
```javascript
import { uploadProfileImage, uploadProgressPhoto } from '../services/firebase/storage';

// Upload profile image
const imageResult = await uploadProfileImage('user123', imageFile);

// Upload progress photo
const photoResult = await uploadProgressPhoto('user123', photoFile, 'workout456');
```

## 🔒 Security Rules (Production)

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Workouts belong to users
    match /workouts/{workoutId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Meals belong to users
    match /meals/{mealId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

### Storage Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can only access their own files
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 🚨 Troubleshooting

### Common Issues

1. **"Firebase not configured" error**
   - Check that all environment variables are set
   - Verify the `.env` file is in the project root
   - Restart your development server

2. **Authentication errors**
   - Ensure Email/Password is enabled in Firebase Console
   - Check that the domain is added to authorized domains

3. **Storage upload errors**
   - Verify Firebase Storage is enabled
   - Check file size limits (5GB max per file)
   - Ensure proper file permissions

4. **Firestore permission errors**
   - Check Firestore security rules
   - Verify user is authenticated
   - Ensure user has proper permissions

### Debug Mode
Add this to your app to see detailed Firebase logs:
```javascript
// In your main App.js or index.js
import { initializeApp } from 'firebase/app';
console.log('Firebase Debug Mode Enabled');
```

## 📞 Support

If you encounter any issues:
1. Check the Firebase Console for error logs
2. Verify your environment variables
3. Test with Firebase's web console
4. Check the React Native Firebase documentation

---

**Next Steps:**
1. Set up your Firebase project following the steps above
2. Add your credentials to the `.env` file
3. Test authentication in your app
4. Set up Firestore collections for your data
5. Configure security rules for production
