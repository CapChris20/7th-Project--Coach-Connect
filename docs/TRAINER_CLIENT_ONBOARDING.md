# CoachConnect Trainer-Client Onboarding System

A production-ready, fully tested workflow for trainer-client onboarding via marketplace messaging with real-time updates and comprehensive security.

## 📋 Overview

This system enables clients to connect with trainers through the CoachConnect marketplace, send initial messages, and complete the onboarding process with real-time status updates and proper data flow management.

## 🏗️ Architecture

### Components
- **TrainerMarketplaceModal.js** - Trainer UI for accepting/rejecting client requests
- **ClientOnboardingScreen.js** - Client UI for sending requests and viewing status
- **useTrainerClients.js** - Real-time hooks for data synchronization
- **onFirstMessageTrigger.js** - Firebase Cloud Functions for automation
- **firestore.rules** - Comprehensive security rules

### Data Flow
1. Client sends first message → Triggers automation
2. Trainer receives notification → Sees modal with client details
3. Trainer accepts/rejects → Real-time updates to client
4. Collections initialize → Workout plans, messaging, etc.

## 🚀 Quick Start

### 1. Setup Environment
```bash
# Install dependencies
npm install

# Install Firebase CLI
npm install -g firebase-tools

# Install Firebase Admin SDK
npm install firebase-admin
```

### 2. Start Emulators
```bash
# Start Firebase emulators
firebase emulators:start --only firestore

# In another terminal, seed test data
node scripts/seedTestData.js
```

### 3. Run App
```bash
# Launch iOS Simulator
npx react-native run-ios --simulator="iPhone 15"

# Or use the automated setup script
./test-setup.sh
```

## 🧪 Testing

### Test Cases

#### Case 1: Client sends first message → Trainer sees modal
1. Login as client (david@coachconnect.test)
2. Navigate to trainer marketplace
3. Find Chris Shina (trainer1)
4. Send initial message
5. **Expected**: Trainer sees modal with client details

#### Case 2: Trainer adds client → Collections initialize
1. Login as trainer (chris@coachconnect.test)
2. Accept client request
3. **Expected**: 
   - `trainer_clients/trainer1/clients/client3` created
   - `messages/trainer1_client3/messages` initialized
   - Welcome message sent
   - Client dashboard ready

#### Case 3: Real-time updates
1. Trainer assigns workout to client
2. **Expected**: Client sees workout instantly
3. Client replies to trainer
4. **Expected**: Trainer sees message instantly

#### Case 4: Trainer rejects client
1. Login as trainer
2. Reject client request
3. **Expected**: Client sees rejection message

## 🔧 Debugging Tools

### Flipper
```bash
# Monitor Firestore queries
npx react-native flipper
```

### Safari Web Inspector
- Open Safari → Develop → Simulator → Inspect
- Debug UI components and React state

### Xcode Console
- Open Xcode → Window → Devices and Simulators
- View console logs for native errors

### Firebase Emulator UI
- Navigate to: http://localhost:4000
- View Firestore data, functions logs

## 📊 Data Structure

### Users Collection
```javascript
{
  uid: "trainer1",
  firstName: "Chris",
  lastName: "Shina",
  role: "trainer", // or "client"
  email: "chris@coachconnect.test",
  // ... other profile fields
}
```

### Trainer-Clients Collection
```javascript
trainer_clients/{trainerUid}/clients/{clientUid} = {
  name: "Client Name",
  joinedAt: timestamp,
  status: "active",
  goals: "Client goals",
  experience: "Beginner",
  equipment: "Equipment available",
  limitations: "Physical limitations"
}
```

### Messages Collection
```javascript
messages/{trainerUid}_{clientUid}/messages/{messageId} = {
  text: "Message content",
  senderUid: "sender_uid",
  timestamp: timestamp,
  status: "pending|accepted|rejected|delivered",
  systemMessage: boolean
}
```

### Workouts Collection
```javascript
workouts/{trainerUid}/clients/{clientUid}/workouts/{workoutId} = {
  name: "Workout Name",
  exercises: ["Exercise 1", "Exercise 2"],
  sets: "3x10-12",
  duration: 45,
  difficulty: "Beginner|Intermediate|Advanced",
  date: timestamp,
  completed: boolean
}
```

## 🔒 Security Rules

### Key Security Features
- **Role Validation**: Only trainers can create client relationships
- **Ownership Checks**: Users can only access their own data
- **No Duplicate Relationships**: Prevents existing client re-onboarding
- **Message Privacy**: Only trainer/client can read their messages
- **Workout Control**: Only trainers can modify workouts

### Security Rule Examples
```javascript
// Trainer can create client relationship
allow create: if (
  request.auth.uid == trainerUid &&
  get(/databases/$(database)/documents/users/$(trainerUid)).data.role == 'trainer' &&
  get(/databases/$(database)/documents/users/$(clientUid)).data.role == 'client' &&
  !exists(/databases/$(database)/documents/trainer_clients/$(trainerUid)/clients/$(clientUid))
);

// Only participants can read messages
allow read: if (
  request.auth.uid == getTrainerUid() ||
  request.auth.uid == getClientUid()
);
```

## 📱 Real-Time Hooks

### useTrainerClients
```javascript
const { clients, loading, error, addClient, removeClient } = useTrainerClients(trainerUid);
```

### useClientWorkouts
```javascript
const { workouts, loading, error, addWorkout, updateWorkout } = useClientWorkouts(trainerUid, clientUid);
```

### useMessages
```javascript
const { messages, loading, error, sendMessage, markMessageAsRead } = useMessages(trainerUid, clientUid);
```

### useTrainerNotifications
```javascript
const { notifications, unreadCount, loading, markNotificationAsRead } = useTrainerNotifications(trainerUid);
```

## 🔥 Cloud Functions

### onFirstMessageTrigger
- Detects first message between trainer-client pair
- Validates user roles and existing relationships
- Creates trainer notification
- Logs onboarding events

### onMessageStatusUpdate
- Handles trainer responses (accept/reject)
- Updates client notifications
- Manages unread request counts

## 🎯 Edge Cases & Error Handling

### Network Errors
```javascript
try {
  await batch.commit();
} catch (error) {
  Alert.alert(
    'Error',
    'Failed to process request. Check your connection.',
    [{ text: 'Retry', onPress: () => handleRetry() }]
  );
}
```

### Duplicate Requests
- Silent ignore with console logging
- Prevents multiple modal popups

### Missing Data
- Shows "Profile incomplete" in modal
- Graceful fallbacks for missing fields

### Validation Errors
- Pre-execution role validation
- Relationship existence checks
- Proper error logging to Firestore

## 📈 Performance Optimizations

### Real-Time Listeners
- Automatic cleanup on component unmount
- Efficient query patterns with proper indexing
- Batch writes for multiple operations

### Caching Strategy
- Local state management with real-time sync
- Optimistic updates for better UX
- Error boundaries for graceful failures

## 🔍 Monitoring & Analytics

### Events Logged
- `first_message_sent`
- `first_message_trigger`
- `client_onboarded`
- `client_request_accepted`
- `client_request_rejected`

### Error Tracking
- Automatic error logging to Firestore
- Debug information for troubleshooting
- Performance metrics collection

## 🚀 Deployment

### Production Setup
1. Deploy security rules: `firebase deploy --only firestore:rules`
2. Deploy functions: `firebase deploy --only functions`
3. Update environment variables
4. Test with production data

### Environment Variables
```javascript
FIREBASE_CONFIG=your_firebase_config
ENVIRONMENT=production
DEBUG=false
```

## 📞 Support

### Common Issues
- **Emulator connection**: Check Firebase CLI version
- **Security rules**: Validate syntax with Firebase console
- **Real-time updates**: Verify network connectivity
- **Function triggers**: Check Firebase Functions logs

### Debug Commands
```bash
# Check Firebase CLI version
firebase --version

# Test security rules
firebase deploy --only firestore:rules --debug

# View function logs
firebase functions:log

# Reset emulator data
firebase emulators:start --clear
```

## 📚 Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Native Firebase](https://rnfirebase.io/)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Cloud Functions](https://firebase.google.com/docs/functions)

---

**Version**: 1.0.0  
**Last Updated**: 2024-03-05  
**Status**: Production Ready ✅
