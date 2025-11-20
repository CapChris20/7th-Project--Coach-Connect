# How to Add Roles to Existing User Accounts

## Problem
Existing user accounts don't have the `role` field, so trainers don't show up in search results.

## Solution Options

### Option 1: Use Edit Profile Screen (Easiest)
1. Sign in to each account
2. Go to **Profile** → **Edit Profile**
3. Select **Client** or **Trainer** 
4. Click **Save Changes**

### Option 2: Manual Update in Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project → **Firestore Database**
3. Open the `users` collection
4. For each user document:
   - Click on the document
   - Click **Add field**
   - Field name: `role`
   - Field type: `string`
   - Value: `"client"` or `"trainer"` (with quotes)
   - Click **Update**

### Option 3: Use Migration Script (For Multiple Users)

I've created a migration utility you can use. Here's how:

#### Step 1: Add to a Development Screen

Create a temporary admin screen or add to your settings:

```javascript
import { migrateUserRoles, setTrainersByEmail } from '../utils/migrateUserRoles';

// In your component:
const handleMigrate = async () => {
  try {
    // Option A: Set all users without roles to 'client'
    const result = await migrateUserRoles('client');
    console.log('Migration result:', result);
    Alert.alert('Success', `Updated ${result.updated} users`);
    
    // Option B: Set specific emails as trainers
    const trainerEmails = [
      'trainer1@example.com',
      'trainer2@example.com',
    ];
    const trainerResult = await setTrainersByEmail(trainerEmails);
    console.log('Trainer assignment:', trainerResult);
  } catch (error) {
    console.error('Migration failed:', error);
    Alert.alert('Error', error.message);
  }
};
```

#### Step 2: Run the Migration

1. Add a button to trigger the migration (temporary, for development)
2. Run it once to update all users
3. Remove the button after migration

### Option 4: Quick Fix - Update Specific Trainers

If you know which accounts should be trainers, you can update them directly:

1. **Firebase Console Method:**
   - Go to Firestore → `users` collection
   - Find each trainer account
   - Add field: `role` = `"trainer"`

2. **Or use the migration script:**
   ```javascript
   await setTrainersByEmail([
     'trainer1@email.com',
     'trainer2@email.com',
   ]);
   ```

## Verify Roles Are Set

After updating, verify in Firebase Console:
1. Go to Firestore → `users` collection
2. Check that each document has a `role` field
3. Values should be either `"client"` or `"trainer"` (with quotes)

## After Migration

Once all users have roles:
- Trainers will appear in the trainer search
- Clients can discover and message trainers
- The Edit Profile screen will show the current role (and allow changing it)

## Notes

- The `role` field is case-sensitive: use `"trainer"` not `"Trainer"` or `"TRAINER"`
- Make sure Firestore security rules allow reading trainer profiles (see `FIRESTORE_RULES_UPDATE.md`)
- After adding roles, trainers should immediately appear in search results

