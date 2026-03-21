# 🔧 FIREBASE WEBSOCKET PROXY - FILE PLACEMENT PLAN

## EXECUTIVE SUMMARY
**Problem**: React Native/Expo WebSocket cannot send custom headers (Authorization: Bearer), causing OpenAI Realtime API authentication failures.

**Solution**: Create a Firebase Cloud Functions proxy that handles WebSocket connections to OpenAI, keeping the API key secure server-side.

**Strategy**: 
- Create Firebase Functions directory structure
- Build WebSocket proxy function using Express + ws package
- Update Expo client to connect to Firebase proxy URL instead of OpenAI directly
- Keep all existing audio recording/playback logic (only change WebSocket URL)

---

## PART 1: FILES TO CREATE (NEW)

### 1. **`functions/package.json`**
**Location**: Root-level `functions/` directory (NEW)
**Purpose**: Firebase Functions dependencies
**Contents**:
- `firebase-functions` (v2)
- `firebase-admin`
- `express` (for WebSocket upgrade handling)
- `ws` (WebSocket library)
- `cors` (for CORS support)

### 2. **`functions/index.js`**
**Location**: `functions/index.js`
**Purpose**: Main Firebase Cloud Function that proxies WebSocket connections
**Functionality**:
- Creates Express app
- Handles WebSocket upgrade requests
- Connects to OpenAI Realtime API with Authorization header
- Relays messages bidirectionally (client ↔ OpenAI)
- Stores OpenAI API key in `functions.config().openai.key`
- Exports as `realtimeProxy` HTTPS function

### 3. **`firebase.json`**
**Location**: Root-level `firebase.json` (NEW)
**Purpose**: Firebase project configuration
**Contents**:
- Functions directory path
- Function deployment settings

### 4. **`.firebaserc`**
**Location**: Root-level `.firebaserc` (NEW)
**Purpose**: Firebase project alias configuration
**Contents**:
- Project ID (from `EXPO_PUBLIC_FIREBASE_PROJECT_ID` env var)

---

## PART 2: FILES TO MODIFY (EXISTING)

### 1. **`src/voice-ai/screens/VoiceCoachHomeScreen.js`**
**Lines to Change**: 
- **Line 22**: `const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';`
  - **Replace with**: Firebase Function WebSocket URL (constructed from Firebase project config)
  
- **Lines 1290-1311**: WebSocket connection creation
  - **Change**: Remove Authorization header attempt (no longer needed)
  - **Change**: Use Firebase proxy URL instead of OpenAI URL
  
- **Line 1302-1305**: Remove Authorization header from WebSocket options (not needed with proxy)

**What stays the same**:
- All audio recording logic (`continuousRecordingLoop`, `extractPCM16FromFile`, etc.)
- All audio playback logic (`playRealtimeAudioChunk`, `playNextAudioChunk`, etc.)
- All message handling (`handleRealtimeMessage`)
- All state management and UI code

**New code to add**:
- Function to construct Firebase proxy WebSocket URL from Firebase config
- Fallback logic if Firebase project ID is not available

---

## PART 3: DEPLOYMENT CONFIGURATION

### Firebase Functions Environment Variables:
```bash
# Set OpenAI API key (REQUIRED)
firebase functions:config:set openai.key="sk-..."
```

### Deployment Command:
```bash
firebase deploy --only functions:realtimeProxy
```

### Expected Function URL:
```
wss://us-central1-<project-id>.cloudfunctions.net/realtimeProxy
```
Or if using custom domain:
```
wss://<your-region>-<project-id>.cloudfunctions.net/realtimeProxy
```

---

## PART 4: ARCHITECTURE FLOW

### Current (Broken) Flow:
```
Expo Client → WebSocket (wss://api.openai.com) ❌ (Missing Auth Header)
```

### New (Fixed) Flow:
```
Expo Client → WebSocket (wss://firebase-proxy) → Firebase Function → WebSocket (wss://api.openai.com with Auth) ✅
```

### Data Flow:
1. **Expo Client** records audio chunks (250ms), extracts PCM16, sends base64 to Firebase proxy
2. **Firebase Function** receives base64 audio, forwards to OpenAI with `Authorization: Bearer <key>` header
3. **OpenAI** processes audio, sends responses (text + audio) back to Firebase Function
4. **Firebase Function** receives OpenAI responses, forwards to Expo Client
5. **Expo Client** receives responses, converts PCM16 to WAV, plays audio

---

## PART 5: IMPLEMENTATION NOTES

### Firebase Functions Limitations:
- Firebase Functions v2 doesn't natively support WebSocket upgrades
- **Solution**: Use Express app with `ws` package to handle WebSocket upgrade manually
- Function must be HTTPS (not HTTP) to support WebSocket (wss://)

### WebSocket Proxy Pattern:
```javascript
// Firebase Function receives upgrade request
// Creates WebSocket connection to OpenAI with headers
// Relays all messages bidirectionally
clientSocket.on('message', (data) => openaiSocket.send(data));
openaiSocket.on('message', (data) => clientSocket.send(data));
```

### Security:
- OpenAI API key stored in Firebase Functions config (server-side only)
- Client never sees API key
- Firebase Functions automatically handle CORS

### Error Handling:
- Proxy should handle OpenAI connection failures gracefully
- Proxy should handle client disconnections
- Proxy should log errors for debugging

---

## PART 6: FILE STRUCTURE SUMMARY

```
project-root/
├── functions/                    # NEW DIRECTORY
│   ├── package.json              # NEW - Functions dependencies
│   └── index.js                  # NEW - WebSocket proxy function
├── firebase.json                 # NEW - Firebase config
├── .firebaserc                   # NEW - Project alias
├── src/
│   └── voice-ai/
│       └── screens/
│           └── VoiceCoachHomeScreen.js  # MODIFY - Change WebSocket URL
└── [all other existing files]    # UNCHANGED
```

---

## PART 7: TESTING CHECKLIST

After implementation:
- [ ] Firebase Functions deploy successfully
- [ ] Firebase proxy URL is accessible (wss://...)
- [ ] Expo client connects to Firebase proxy (no auth errors)
- [ ] Audio chunks are sent from client → proxy → OpenAI
- [ ] Responses are received from OpenAI → proxy → client
- [ ] Audio playback works in Expo client
- [ ] Text transcripts display correctly
- [ ] Connection handles disconnects gracefully
- [ ] No API key exposure in client code/logs

---

## APPROVAL REQUIRED

**Please review this plan and approve before I begin implementation.**

Changes:
- ✅ Creates minimal new files (only necessary Firebase Functions setup)
- ✅ Modifies only 1 existing file (VoiceCoachHomeScreen.js - WebSocket URL only)
- ✅ Keeps all existing audio/recording/playback logic intact
- ✅ No new folders except `functions/` (required for Firebase Functions)
- ✅ Follows Firebase best practices
- ✅ Maintains code structure and naming conventions

**Ready to proceed?**





