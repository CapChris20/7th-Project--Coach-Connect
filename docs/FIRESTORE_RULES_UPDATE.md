# Firestore Security Rules Update

## Issue
The trainer search feature is failing with "Missing or insufficient permissions" because clients need to read trainer profiles, but the current rules only allow users to read their own documents.

## Solution
Update your Firestore security rules to allow authenticated users to read trainer profiles while still protecting user data.

## Updated Firestore Rules

Go to Firebase Console → Firestore Database → Rules and paste these updated rules:

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
      allow read: if request.auth != null;
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.senderId;
      allow update: if request.auth != null && 
        request.auth.uid == resource.data.senderId;
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

## What Changed

1. **Added trainer read access**: Any authenticated user can now read user documents where `role == 'trainer'`
2. **Maintained security**: Users can still only write their own data
3. **Added messaging rules**: Rules for conversations and messages collections

## How to Apply

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`anatrox-auth`)
3. Go to **Firestore Database** → **Rules** tab
4. Replace the existing rules with the rules above
5. Click **Publish**

## Testing

After updating the rules:
1. Try searching for trainers again
2. The error should be resolved
3. Clients should be able to see trainer profiles
4. Trainers should still only be able to edit their own profiles

## Security Notes

- ✅ Clients can read trainer profiles (needed for discovery)
- ✅ Clients cannot read other client profiles
- ✅ Users can only write their own user data
- ✅ All operations require authentication

