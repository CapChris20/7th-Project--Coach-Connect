/**
 * Safe access to expo-speech-recognition — never loads the native module in Expo Go.
 * Voice typing needs `npx expo run:ios` / `run:android`; Expo Go will not crash.
 */
import { useEventListener } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const STUB_EMITTER = {
  addListener: () => ({ remove: () => {} }),
};

let cachedModule = null;
let loadAttempted = false;

/** Lazy load — skipped entirely in Expo Go. */
export function getExpoSpeechRecognitionModule() {
  if (isExpoGo) return null;
  if (loadAttempted) return cachedModule;
  loadAttempted = true;
  try {
    cachedModule = require('expo-speech-recognition').ExpoSpeechRecognitionModule ?? null;
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export function useSpeechRecognitionEvent(eventName, listener) {
  const mod = getExpoSpeechRecognitionModule();
  useEventListener(mod ?? STUB_EMITTER, eventName, listener);
}

export function isSpeechRecognitionNativeAvailable() {
  return Boolean(getExpoSpeechRecognitionModule());
}
