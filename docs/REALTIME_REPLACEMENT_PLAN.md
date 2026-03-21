# 🔧 REALTIME VOICE API - COMPLETE REPLACEMENT ARCHITECTURE PLAN

## EXECUTIVE SUMMARY
**File to Modify**: `src/voice-ai/screens/VoiceCoachHomeScreen.js`
**Strategy**: Complete replacement of broken realtime pipeline (lines ~1050-1757) with new, Expo-compatible implementation
**Goal**: Stable, working voice AI loop using ONLY Expo APIs - no native modules, no WebRTC

---

## PART 1: FUNCTIONS TO REMOVE

### **COMPLETE REMOVAL** (delete entirely):
1. **`readAudioFileAsPCM16()`** (lines ~783-817)
   - **Why**: Sends entire file with headers, wrong approach
   - **Replacement**: New `extractPCM16FromFile()` that strips headers

2. **`chunkedRecordingLoop()`** (lines ~1302-1460)
   - **Why**: Recursive, broken, 1-second chunks too slow
   - **Replacement**: New `continuousRecordingLoop()` with while-loop

3. **`recordAndSendChunk()`** (inner function in chunkedRecordingLoop)
   - **Why**: Part of broken recursive approach
   - **Replacement**: Integrated into new loop

### **KEEP BUT REWRITE** (maintain signatures, replace internals):
1. **`connectRealtime()`** (lines ~1050-1242)
   - **Keep**: Function signature, UI state updates
   - **Replace**: WebSocket URL (auth in query param), session config timing, event handlers

2. **`disconnectRealtime()`** (lines ~1244-1300)
   - **Keep**: Function signature
   - **Replace**: Cleanup logic to properly await recording stop

3. **`startRealtimeAudioInput()`** (lines ~1462-1514)
   - **Keep**: Function signature
   - **Replace**: Start new continuous loop instead of chunked

4. **`stopRealtimeAudioInput()`** (lines ~1516-1567)
   - **Keep**: Function signature
   - **Replace**: Stop loop properly, wait for recording completion

5. **`handleRealtimeMessage()`** (lines ~1569-1648)
   - **Keep**: Function signature, message type switches
   - **Replace**: Add missing event handlers, fix audio playback

6. **`playRealtimeAudioChunk()`** (lines ~1650-1675)
   - **Keep**: Function signature
   - **Replace**: Convert PCM16 to WAV before playing

7. **`playNextAudioChunk()`** (lines ~1677-1757)
   - **Keep**: Function signature
   - **Replace**: WAV conversion, proper audio mode handling

---

## PART 2: NEW FUNCTIONS TO ADD

### **1. `extractPCM16FromFile(fileUri)` → `Promise<string>` (base64 PCM16)**
**Location**: After line ~780 (replace old `readAudioFileAsPCM16`)
**Purpose**: Extract raw PCM16 bytes from CAF/WAV container, strip headers
**Logic**:
- Read file as base64 string via FileSystem
- Detect format (iOS = CAF, Android = WAV or raw PCM)
- Parse headers to find PCM data offset:
  - **CAF**: Skip 64-byte header, extract chunk data
  - **WAV**: Skip 44-byte header, extract data chunk
  - **Raw PCM**: Return as-is
- Return base64 string of raw PCM16 samples only
- Handle FileSystem unavailability gracefully (return null)

### **2. `createWAVFromPCM16(base64PCM, sampleRate=24000)` → `string` (base64 WAV)**
**Location**: After `extractPCM16FromFile`
**Purpose**: Convert raw PCM16 base64 to playable WAV format for Expo Audio
**Logic**:
- Decode base64 PCM to Uint8Array
- Create WAV header (44 bytes):
  - RIFF chunk descriptor
  - fmt subchunk (16-bit PCM, mono, 24000 Hz)
  - data subchunk with size
- Prepend header to PCM data
- Encode back to base64
- Return `data:audio/wav;base64,{base64WAV}` URI

### **3. `continuousRecordingLoop()` → `Promise<void>`**
**Location**: Replace `chunkedRecordingLoop` (~line 1302)
**Purpose**: Continuous audio recording and streaming using while-loop (not recursion)
**Logic**:
- **While-loop structure** (NOT recursive):
  ```javascript
  while (isStreamingActiveRef.current && isMountedRef.current) {
    // Record 250ms chunk
    // Extract PCM16
    // Send to WebSocket
    // Small delay to prevent tight loop
  }
  ```
- Record 250ms chunks (faster than 1s, reduces gaps)
- Use LINEAR PCM on iOS, PCM_16BIT on Android (proper extensions)
- Extract PCM16 using `extractPCM16FromFile()`
- Validate audio data size (should be ~12000 bytes for 250ms @ 24kHz)
- Send `input_audio_buffer.append` with base64 PCM16
- Send `input_audio_buffer.speech_started` on first chunk only
- Small delay (~50ms) between chunks to prevent tight loop
- Proper error handling with retry limit (max 5 failures → stop)

### **4. `sendSpeechEnded()` → `void`**
**Location**: New helper function
**Purpose**: Send speech_ended event to OpenAI
**Logic**:
- Check WebSocket is open
- Send `{ type: 'input_audio_buffer.speech_ended' }`
- Called when user stops recording

### **5. `setupWebSocketKeepalive()` → `NodeJS.Timeout`**
**Location**: In `connectRealtime()` after socket creation
**Purpose**: Send ping every 25 seconds to prevent timeout
**Logic**:
- `setInterval` every 25 seconds
- Send `{ type: 'ping' }` if socket is open
- Return interval ID for cleanup
- Clear on disconnect

### **6. `validatePCM16Audio(base64Audio, expectedDurationMs)` → `boolean`**
**Location**: Before sending audio chunks
**Purpose**: Validate audio data before sending to API
**Logic**:
- Decode base64 to get byte length
- Calculate expected size: `(sampleRate * channels * 2 * durationMs) / 1000`
- For 250ms @ 24kHz mono: `(24000 * 1 * 2 * 250) / 1000 = 12000 bytes`
- Check actual size is within 10% of expected
- Return true if valid, false if invalid

---

## PART 3: CODE REPLACEMENT DETAILS

### **SECTION A: WebSocket Connection & Authentication** (lines ~1090-1100)

**REMOVE**:
```javascript
const wsUrl = `${OPENAI_REALTIME_URL}`;
const socket = new WebSocket(wsUrl, [], {
  headers: {
    'Authorization': `Bearer ${openaiKeyRef.current}`,
  },
});
```

**REPLACE WITH**:
```javascript
// Put API key in URL query param (React Native WebSocket doesn't support headers reliably)
const wsUrl = `${OPENAI_REALTIME_URL}&authorization=Bearer ${encodeURIComponent(openaiKeyRef.current)}`;
const socket = new WebSocket(wsUrl);
```

**OR** (if query param doesn't work):
```javascript
// Alternative: Use subprotocol for auth (if supported)
const wsUrl = OPENAI_REALTIME_URL;
const socket = new WebSocket(wsUrl, ['authorization.bearer.' + openaiKeyRef.current]);
```

---

### **SECTION B: Session Configuration** (lines ~1110-1184)

**REMOVE**: Entire session config send in `socket.onopen`
**REPLACE WITH**: Wait for `session.created` event, then send config

**NEW FLOW**:
1. `socket.onopen` → Just log connection, DON'T send config yet
2. `handleRealtimeMessage()` on `session.created` → Send `session.update`
3. `handleRealtimeMessage()` on `session.updated` → Start audio input

**SESSION CONFIG FIXES**:
- Remove `transport: 'websocket'` from session object (already using WebSocket)
- Fix format structure: `audio.input.format = { type: 'audio/pcm', rate: 24000 }` (NOT string)
- Ensure `vad.enabled: false`
- Add `turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 500 }` (explicit turn detection config)

---

### **SECTION C: Recording Configuration** (lines ~1348-1366)

**REMOVE**:
```javascript
android: {
  extension: '.m4a',
  outputFormat: Audio.AndroidOutputFormat.PCM_16BIT,
  ...
},
ios: {
  extension: '.m4a',
  outputFormat: Audio.IOSOutputFormat.LINEARPCM,
  ...
}
```

**REPLACE WITH**:
```javascript
android: {
  extension: '.wav', // WAV container for PCM
  outputFormat: Audio.AndroidOutputFormat.PCM_16BIT,
  audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
  sampleRate: 24000,
  numberOfChannels: 1,
},
ios: {
  extension: '.caf', // CAF container for LINEAR PCM (iOS standard)
  outputFormat: Audio.IOSOutputFormat.LINEARPCM,
  audioQuality: Audio.IOSAudioQuality.HIGH,
  sampleRate: 24000,
  numberOfChannels: 1,
  linearPCMBitDepth: 16,
  linearPCMIsBigEndian: false,
  linearPCMIsFloat: false,
}
```

---

### **SECTION D: Audio Playback** (lines ~1700-1702)

**REMOVE**:
```javascript
const audioUri = `data:audio/pcm;base64,${base64Audio}`;
```

**REPLACE WITH**:
```javascript
// Convert PCM16 to WAV before playing
const wavUri = createWAVFromPCM16(base64Audio, 24000);
const audioUri = wavUri; // Now it's a playable WAV data URI
```

---

### **SECTION E: Speech Ended Event** (add to `stopRealtimeAudioInput`)

**ADD** before stopping recording:
```javascript
// Send speech_ended event to OpenAI
if (realtimeSocketRef.current?.readyState === WebSocket.OPEN) {
  try {
    realtimeSocketRef.current.send(JSON.stringify({
      type: 'input_audio_buffer.speech_ended',
    }));
    console.log('📤 Sent speech_ended event');
  } catch (e) {
    console.warn('Failed to send speech_ended:', e);
  }
}
```

---

### **SECTION F: Keepalive Setup** (add to `connectRealtime`)

**ADD** after `socket.onopen`:
```javascript
// Setup keepalive ping every 25 seconds
const keepaliveInterval = setInterval(() => {
  if (socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify({ type: 'ping' }));
    } catch (e) {
      console.warn('Keepalive ping failed:', e);
    }
  } else {
    clearInterval(keepaliveInterval);
  }
}, 25000);

// Store interval ref for cleanup
keepaliveIntervalRef.current = keepaliveInterval;
```

**ADD** to cleanup in `disconnectRealtime`:
```javascript
if (keepaliveIntervalRef.current) {
  clearInterval(keepaliveIntervalRef.current);
  keepaliveIntervalRef.current = null;
}
```

---

### **SECTION G: State Machine Race Conditions** (fix in `handleRealtimeMessage`)

**CURRENT** (line ~1583):
```javascript
if ((voiceState === 'connecting' || voiceState === 'idle') && isMountedRef.current) {
  setTimeout(() => {
    if (isMountedRef.current && isRealtimeConnected) {
      startRealtimeAudioInput();
    }
  }, 100);
}
```

**REPLACE WITH** (use ref to prevent duplicates):
```javascript
// Use ref to prevent duplicate starts
if (!hasStartedAudioInputRef.current && isMountedRef.current && isRealtimeConnected) {
  hasStartedAudioInputRef.current = true;
  setTimeout(() => {
    if (isMountedRef.current && isRealtimeConnected) {
      startRealtimeAudioInput();
    }
  }, 100);
}
```

**ADD REF** at top of component:
```javascript
const hasStartedAudioInputRef = useRef(false);
```

**RESET REF** in `disconnectRealtime`:
```javascript
hasStartedAudioInputRef.current = false;
```

---

## PART 4: REFS TO ADD/MODIFY

### **ADD NEW REFS**:
```javascript
const keepaliveIntervalRef = useRef(null); // Keepalive interval ID
const hasStartedAudioInputRef = useRef(false); // Prevent duplicate audio starts
const chunkCounterRef = useRef(0); // Track total chunks (moved from local var)
```

### **MODIFY EXISTING REFS**:
- `isStreamingActiveRef` - Keep as-is (used in while-loop)
- `currentChunkRecordingRef` - Keep as-is (now used in continuous loop)

---

## PART 5: AUDIO MODE CONFLICT FIX

### **STRATEGY**: Use single, stable audio mode that supports both recording and playback

**REMOVE** all audio mode switches in recording loop and playback functions

**ADD** single audio mode setup in `connectRealtime()`:
```javascript
await Audio.setAudioModeAsync({
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  // Don't switch modes - keep recording enabled for both record and playback
});
```

**REMOVE** audio mode switch in `playNextAudioChunk()` (line ~1691-1695)

**REMOVE** audio mode switch in `continuousRecordingLoop()` recording section

**KEEP** audio mode in `disconnectRealtime()` to reset:
```javascript
await Audio.setAudioModeAsync({
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
});
```

---

## PART 6: FILE PLACEMENT & STRUCTURE

### **FILES TO MODIFY**:
1. **`src/voice-ai/screens/VoiceCoachHomeScreen.js`** (PRIMARY FILE)
   - Remove: Lines ~783-817 (`readAudioFileAsPCM16`)
   - Remove: Lines ~1302-1460 (`chunkedRecordingLoop`)
   - Replace: Lines ~1050-1757 (entire realtime section)
   - Add: New helper functions (extract PCM, create WAV, validate)
   - Modify: Ref declarations at top

### **NO NEW FILES CREATED**:
- All fixes go in existing `VoiceCoachHomeScreen.js`
- No new utility files
- No new folders

---

## PART 7: NEW PIPELINE FLOW

### **CONNECTION FLOW**:
1. User taps mic → `onRecordPress()` → `connectRealtime()`
2. WebSocket connects with auth in URL query param
3. Wait for `session.created` event
4. Send `session.update` with correct config
5. Wait for `session.updated` event
6. Start `continuousRecordingLoop()` (only once, check ref)
7. Setup keepalive ping interval

### **RECORDING FLOW**:
1. `continuousRecordingLoop()` starts while-loop
2. Create new `Audio.Recording` instance
3. Record for 250ms (faster than 1s, reduces gaps)
4. Stop and get file URI
5. Extract raw PCM16 using `extractPCM16FromFile()`
6. Validate audio size using `validatePCM16Audio()`
7. Send `input_audio_buffer.append` with base64 PCM16
8. On first chunk: send `input_audio_buffer.speech_started`
9. Delete temp file
10. Small delay (50ms) to prevent tight loop
11. Repeat while `isStreamingActiveRef.current === true`

### **USER STOPS SPEAKING**:
1. User taps mic again → `stopRealtimeAudioInput()`
2. Send `input_audio_buffer.speech_ended` event
3. Set `isStreamingActiveRef.current = false` (stops while-loop)
4. Wait for current recording to finish
5. Cleanup recording instance
6. Audio mode stays in recording mode (no switch)

### **AI RESPONSE FLOW**:
1. Receive `response.audio.delta` events (base64 PCM16 chunks)
2. Convert PCM16 to WAV using `createWAVFromPCM16()`
3. Add WAV to audio queue
4. `playNextAudioChunk()` plays WAV using `Audio.Sound`
5. Audio plays while recording continues (same audio mode)
6. Queue processes sequentially

### **DISCONNECT FLOW**:
1. Stop keepalive interval
2. Send `speech_ended` if still recording
3. Stop recording loop (set ref to false)
4. Wait for recording to stop
5. Close WebSocket gracefully
6. Clear audio queue
7. Reset all refs

---

## PART 8: ERROR HANDLING

### **RECORDING FAILURES**:
- Max 5 consecutive failures → stop loop, show error
- Each failure: log error, wait 200ms, retry
- On 5th failure: set `isStreamingActiveRef.current = false`, show error to user

### **WEBSOCKET ERRORS**:
- `onerror` → Log, show user-friendly error, disconnect gracefully
- `onclose` → Check if unexpected, attempt reconnection (max 3 times)

### **AUDIO VALIDATION**:
- Invalid audio size → Skip chunk, log warning, continue loop
- FileSystem unavailable → Show warning, disable realtime (fallback to traditional flow)

---

## PART 9: TESTING CHECKLIST

After implementation, verify:
- [ ] WebSocket connects with auth in URL
- [ ] Session config sent after `session.created`
- [ ] Audio input starts after `session.updated`
- [ ] Recording loop uses while-loop (no recursion)
- [ ] PCM16 extracted correctly (headers stripped)
- [ ] Audio chunks validated before sending
- [ ] `speech_started` sent on first chunk
- [ ] `speech_ended` sent on stop
- [ ] Keepalive ping every 25 seconds
- [ ] PCM16 converted to WAV for playback
- [ ] Audio plays correctly
- [ ] No audio mode conflicts (recording + playback work together)
- [ ] Cleanup properly waits for recording stop
- [ ] No duplicate audio input starts
- [ ] Works on both iOS and Android

---

## PART 10: SUMMARY OF CHANGES

### **REMOVED**:
- ❌ `readAudioFileAsPCM16()` (broken, sends headers)
- ❌ `chunkedRecordingLoop()` (recursive, too slow)
- ❌ M4A recording format (wrong container)
- ❌ Audio mode switching (causes conflicts)
- ❌ WebSocket auth via headers (not reliable in RN)

### **ADDED**:
- ✅ `extractPCM16FromFile()` (strips headers)
- ✅ `createWAVFromPCM16()` (converts for playback)
- ✅ `continuousRecordingLoop()` (while-loop, 250ms chunks)
- ✅ `validatePCM16Audio()` (validates before sending)
- ✅ `sendSpeechEnded()` (proper turn management)
- ✅ `setupWebSocketKeepalive()` (prevents timeouts)
- ✅ Proper session initialization flow
- ✅ Speech_ended events
- ✅ Stable audio mode (no switching)

### **FIXED**:
- ✅ WebSocket authentication (URL query param)
- ✅ Session config timing (wait for `session.created`)
- ✅ Recording format (CAF/WAV, proper PCM extraction)
- ✅ Audio playback (PCM → WAV conversion)
- ✅ Turn management (speech_ended events)
- ✅ State race conditions (ref-based guards)
- ✅ Audio mode conflicts (single stable mode)

---

## END OF PLAN

**Next Step**: Wait for approval, then implement all changes in `VoiceCoachHomeScreen.js` exactly as described above.

