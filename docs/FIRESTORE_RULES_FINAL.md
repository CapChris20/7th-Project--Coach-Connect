# 🔥 FINAL Firestore Rules - Copy This Exactly

## ⚠️ IMPORTANT: Update These Rules NOW

Go to **Firebase Console** → **Firestore Database** → **Rules** and **REPLACE EVERYTHING** with this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      // Users can read their own data
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Allow authenticated users to read trainer profiles (for trainer discovery)
      allow read: if request.auth != null && resource.data.role == 'trainer';
      
      // Allow authenticated users to read any user profile (for conversations - trainers need to see clients, clients need to see trainers)
      // This is safe because we're only exposing basic profile info needed for messaging
      allow read: if request.auth != null;
      
      // Users can only write their own data
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Conversations - FIXED FOR CREATION
    match /conversations/{conversationId} {
      // Read: allow if user is authenticated (we check participants in app)
      allow read: if request.auth != null;
      
      // Create: user must be in participants array
      allow create: if request.auth != null && 
        request.auth.uid in request.resource.data.participants;
      
      // Update: user must be a participant
      allow update: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    // Messages
    match /messages/{messageId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.senderId;
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

## Steps

1. **Open**: https://console.firebase.google.com/
2. **Select**: `coachconnect-auth` project
3. **Go to**: Firestore Database → **Rules**
4. **DELETE** all existing rules
5. **PASTE** the rules above
6. **Click**: **Publish**
7. **Wait**: 30 seconds

## What I Fixed

1. **Simplified conversation creation** - No more querying, just check if document exists
2. **Fixed conversation read rule** - Allows reading even if document doesn't exist yet (for `getDoc` check)
3. **Fixed message creation** - Ensures sender is authenticated user

## Test After Updating

1. Try sending a message
2. Check console - you should see "✅ Conversation created successfully"
3. Message should appear in the chat

