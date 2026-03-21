# Better Voice Libraries for Voice AI

## Problem
expo-speech uses device system voices which are often robotic and limited.

## Solution: expo-edge-speech
I've added **expo-edge-speech** which gives you access to **400+ natural voices** from Microsoft Edge TTS.

### Installation
Run this command to install:
```bash
npm install expo-edge-speech
# or
npx expo install expo-edge-speech
```

Then rebuild your app:
```bash
npx expo prebuild --clean
npx expo run:ios
# or
npx expo run:android
```

### What You Get
- **400+ natural voices** (vs ~5-10 system voices)
- **Multiple languages and accents**
- **Better voice quality** - sounds more human
- **Drop-in replacement** for expo-speech
- **Same API** - just import differently

### How It Works
The code now:
1. Tries to use `expo-edge-speech` first (better voices)
2. Falls back to `expo-speech` if not available
3. Shows all available voices in the voice menu
4. You can switch between "Device Voices" (expo-speech) and "Edge Voices" (expo-edge-speech) tabs

### Alternative Libraries (if expo-edge-speech doesn't work)
1. **react-native-speech** - High performance, TypeScript
2. **expo-kokoro-onnx** - On-device, offline TTS
3. **ElevenLabs API** - Premium voices (paid)



