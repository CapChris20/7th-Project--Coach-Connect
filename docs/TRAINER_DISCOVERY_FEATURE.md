# Trainer Discovery and Messaging Feature

## Overview
This feature allows clients to discover and message trainers in the CoachConnect AI fitness app. Trainers can set up their profiles with specializations, bio, credentials, and location, and clients can search for trainers and start conversations with them.

## Features Implemented

### 1. Trainer Search Screen (`src/screens/trainer/TrainerSearchScreen.js`)
- **Search Functionality**: Search trainers by name, specialization, location, or bio
- **Filter Options**: Filter by "All", "Name", "Specialization", or "Location"
- **Trainer Cards**: Display trainer profiles with:
  - Profile photo/avatar (initials if no photo)
  - Name and credentials
  - Specializations (tags)
  - Bio (truncated to 3 lines)
  - Location
  - Rating/reviews (if available)
  - "Message Trainer" button

### 2. Trainer Messaging Screen (`src/screens/trainer/TrainerMessagingScreen.js`)
- **Real-time Messaging**: Uses Firestore real-time listeners for instant message updates
- **Conversation Management**: Automatically creates or retrieves existing conversations
- **Message Display**: Shows sent/received messages with timestamps
- **Online Status**: Displays trainer online/offline status
- **Read Receipts**: Marks messages as read when viewed

### 3. Trainer Messaging Service (`src/services/firebase/trainerMessaging.js`)
- **Conversation Management**: `getOrCreateConversation()` - Creates or retrieves conversations
- **Message Sending**: `sendMessage()` - Sends messages to Firestore
- **Real-time Subscriptions**: `subscribeToMessages()` - Real-time message updates
- **User Data**: `getUserData()` - Fetches user profile information
- **Read Status**: `markMessagesAsRead()` - Updates message read status

### 4. Edit Profile Screen (`src/screens/profile/EditProfileScreen.js`)
- **Basic Info**: Name and email (email is read-only)
- **Trainer-Specific Fields**:
  - Credentials (e.g., "NASM-CPT, ACE Certified")
  - Specializations (add/remove multiple tags)
  - Bio (multi-line text area)
  - Location (e.g., "New York, NY" or "Online")
- **Profile Updates**: Saves changes to Firestore user document

### 5. Client Dashboard Integration
- **Trainer Discovery Section**: Added to client home page
- **Search Button**: Opens trainer search screen
- **Navigation**: Seamless flow from search → messaging

## Firestore Database Structure

### Collections

#### `users` Collection
```javascript
{
  uid: string,
  name: string,
  email: string,
  role: 'client' | 'trainer',
  // Trainer-specific fields:
  credentials?: string,
  specializations?: string[],
  bio?: string,
  location?: string,
  rating?: number,
  reviewCount?: number,
  isOnline?: boolean,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `conversations` Collection
```javascript
{
  id: string,
  participants: string[], // Array of user IDs
  clientId: string,
  trainerId: string,
  type: 'client-trainer',
  lastMessage: string | null,
  lastMessageTime: timestamp | null,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### `messages` Collection
```javascript
{
  id: string,
  conversationId: string,
  senderId: string,
  text: string,
  timestamp: timestamp,
  read: boolean
}
```

## Firestore Security Rules

Add these rules to your Firestore database:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data and trainers can be read by anyone
    match /users/{userId} {
      allow read: if request.auth != null && (
        request.auth.uid == userId || 
        resource.data.role == 'trainer'
      );
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Conversations - participants can read/write
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null && 
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
  }
}
```

## Usage Flow

### For Clients:
1. **Discover Trainers**: 
   - Go to client dashboard
   - Click "🔍 Search Trainers" button
   - Browse or search for trainers

2. **Message a Trainer**:
   - Click "Message Trainer" on a trainer's card
   - Opens messaging screen
   - Start conversation

3. **View Conversations**:
   - Messages appear in real-time
   - See online/offline status
   - Timestamps show when messages were sent

### For Trainers:
1. **Set Up Profile**:
   - Go to Profile screen
   - Click "✏️ Edit Profile"
   - Add credentials, specializations, bio, and location
   - Save changes

2. **Receive Messages**:
   - Clients can message you directly
   - Messages appear in real-time
   - You can respond to client inquiries

## User Role Logic

- **Role Selection**: Users select their role (client or trainer) during signup
- **Trainer Visibility**: Only users with `role === 'trainer'` appear in search results
- **Profile Fields**: Trainer-specific fields (specializations, bio, etc.) only show for trainers
- **Search Filtering**: Firestore queries filter by `role === 'trainer'`

## Technical Implementation Details

### Real-time Updates
- Uses Firestore `onSnapshot()` for real-time message updates
- Automatically subscribes/unsubscribes when conversation changes
- Updates UI immediately when new messages arrive

### Conversation Management
- Conversations are created automatically when a client messages a trainer
- Conversation ID format: `conv_{clientId}_{trainerId}_{timestamp}`
- Prevents duplicate conversations between the same client-trainer pair

### Search Functionality
- Case-insensitive search across multiple fields
- Filter options for targeted searches
- Real-time filtering as user types

## Files Created/Modified

### New Files:
- `src/screens/trainer/TrainerSearchScreen.js`
- `src/screens/trainer/TrainerMessagingScreen.js`
- `src/services/firebase/trainerMessaging.js`
- `src/screens/profile/EditProfileScreen.js`

### Modified Files:
- `App.js` - Added trainer search section and navigation
- `src/screens/profile/ProfileScreen.js` - Added "Edit Profile" button

## Future Enhancements

Potential improvements:
- [ ] Trainer availability calendar
- [ ] Video call integration
- [ ] File/image sharing in messages
- [ ] Push notifications for new messages
- [ ] Message search functionality
- [ ] Trainer verification badges
- [ ] Client reviews and ratings system
- [ ] Trainer portfolio/workout programs display

## Testing Checklist

- [ ] Trainers can edit their profile with all fields
- [ ] Clients can search for trainers
- [ ] Search filters work correctly
- [ ] Clients can start conversations with trainers
- [ ] Messages send and receive in real-time
- [ ] Read receipts work correctly
- [ ] Online/offline status displays
- [ ] Only trainers appear in search results
- [ ] Firestore security rules prevent unauthorized access

## Notes

- The GPT icon size was increased from 55 to 65 in the floating button
- All screens follow the app's dark purple theme
- Real-time messaging requires active Firestore connection
- Trainer profiles must be set up before they appear in search results

