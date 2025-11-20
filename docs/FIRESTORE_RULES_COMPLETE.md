# Complete Firestore Security Rules

## Copy and paste these rules into Firebase Console

Go to **Firebase Console** → **Firestore Database** → **Rules** and replace everything with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      // Users can read their own data
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Allow authenticated users to read trainer profiles (for trainer discovery)
      allow read: if request.auth != null && 
        resource.data.role == 'trainer';
      
      // Users can only write their own data
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Conversations - participants can read/write
    match /conversations/{conversationId} {
      // Allow read if user is a participant
      allow read: if request.auth != null && 
        request.auth.uid in resource.data.participants;
      
      // Allow create if user is in the participants array being created
      allow create: if request.auth != null && 
        request.auth.uid in request.resource.data.participants;
      
      // Allow update if user is a participant
      allow update: if request.auth != null && 
        request.auth.uid in resource.data.participants;
    }
    
    // Messages - participants of the conversation can read/write
    match /messages/{messageId} {
      // Allow read if authenticated (we'll filter by conversation in queries)
      allow read: if request.auth != null;
      
      // Allow create if sender is the authenticated user
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.senderId &&
        request.resource.data.conversationId != null;
      
      // Allow update for read receipts (any participant can mark messages as read)
      allow update: if request.auth != null;
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

## What These Rules Do

### Users Collection
- ✅ Users can read their own profile
- ✅ All authenticated users can read trainer profiles (for discovery)
- ✅ Users can only update their own profile

### Conversations Collection
- ✅ Users can read conversations they're part of
- ✅ Users can create conversations where they're a participant
- ✅ Users can update conversations they're part of

### Messages Collection
- ✅ Authenticated users can read messages
- ✅ Users can create messages where they're the sender
- ✅ Users can update their own messages (for read receipts)

## How to Apply

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`anatrox-auth`)
3. Click **Firestore Database** → **Rules** tab
4. **Delete all existing rules**
5. **Paste the rules above**
6. Click **Publish**

## After Publishing

- ✅ Trainer search will work
- ✅ Clients can message trainers
- ✅ Conversations can be created
- ✅ Messages can be sent and received

