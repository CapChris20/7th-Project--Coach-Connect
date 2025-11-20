# 🔧 FIX: Firestore Rules for Messaging

## The Problem
Messages can't be sent because Firestore security rules are blocking message creation.

## The Solution
Copy these **WORKING** rules to Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      // Users can read their own data
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Allow authenticated users to read trainer profiles
      allow read: if request.auth != null && resource.data.role == 'trainer';
      
      // Users can only write their own data
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Conversations - FIXED
    match /conversations/{conversationId} {
      // Read: user must be a participant
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      
      // Create: user must be in the participants array
      allow create: if request.auth != null && 
        request.auth.uid in request.resource.data.participants;
      
      // Update: user must be a participant (for updating lastMessage)
      allow update: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    // Messages - FIXED
    match /messages/{messageId} {
      // Read: any authenticated user (filtered by conversation in app)
      allow read: if request.auth != null;
      
      // Create: sender must be the authenticated user
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.senderId;
      
      // Update: allow for read receipts
      allow update: if request.auth != null;
    }
    
    // Workouts
    match /workouts/{workoutId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Meals
    match /meals/{mealId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
  }
}
```

## Steps to Fix

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `anatrox-auth`
3. **Navigate to**: Firestore Database → **Rules** tab
4. **Delete ALL existing rules**
5. **Paste the rules above**
6. **Click "Publish"**
7. **Wait 30 seconds** for rules to propagate

## Test After Updating

1. Try sending a message to a trainer
2. Check the console logs - you should see "✅ Message sent successfully"
3. If you still get errors, check the console for the exact error code

## Common Issues

- **"Missing or insufficient permissions"**: Rules not published yet, wait 30 seconds
- **"Permission denied"**: Make sure you're logged in
- **"Document not found"**: Conversation might not exist, try creating it first

## Debugging

If messages still don't send, check the console logs. The app now shows detailed error messages that will tell you exactly what's failing.

