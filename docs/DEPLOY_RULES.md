# Deploy Firestore Rules - Quick Guide

## Option 1: Firebase Console (EASIEST - 2 minutes)

1. Go to: https://console.firebase.google.com
2. Select your project
3. Click **Firestore Database** in the left sidebar
4. Click the **Rules** tab at the top
5. **Copy the entire contents** of `firestore.rules` file
6. **Paste** into the rules editor
7. Click **Publish** button
8. Done! ✅

## Option 2: Firebase CLI

If you have your project ID, run:
```bash
firebase use <your-project-id>
firebase deploy --only firestore:rules
```

## What Was Fixed

The rules now allow:
- ✅ Trainers to create/update clients in `trainer_clients/{trainerUid}/clients/{clientUid}`
- ✅ Trainers to create/update in legacy `clients` collection
- ✅ Simplified rules (removed complex `get()` calls that were failing)

The code now uses the `trainer_clients` system which has proper security rules.


