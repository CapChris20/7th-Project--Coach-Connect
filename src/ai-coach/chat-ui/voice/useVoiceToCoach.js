/**
 * use Coach Speech
 *
 * Purpose: React hook: use Coach Speech. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: useCoachSpeech
 *
 * @file-header
 */
/**
 * Voice for AI Coach: speech-to-text (dictate) + text-to-speech (read replies).
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import * as Speech from 'expo-speech';
import {
  getExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from './speechRecognitionSafe';

/** expo-speech-recognition v3 returns a boolean; older builds may return a Promise. */
async function resolveRecognitionAvailable() {
  const ExpoSpeechRecognitionModule = getExpoSpeechRecognitionModule();
  if (!ExpoSpeechRecognitionModule?.isRecognitionAvailable) return false;
  try {
    const result = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    if (result != null && typeof result.then === 'function') {
      return Boolean(await result);
    }
    return Boolean(result);
  } catch {
    return false;
  }
}

function extractTranscript(event) {
  const results = event?.results;
  if (!Array.isArray(results) || results.length === 0) return '';
  return String(results[0]?.transcript || '').trim();
}

const STT_START_OPTIONS = {
  lang: 'en-US',
  interimResults: true,
  continuous: false,
  maxAlternatives: 1,
  iosTaskHint: 'dictation',
  iosVoiceProcessingEnabled: true,
  iosCategory: {
    category: 'playAndRecord',
    categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
    mode: 'measurement',
  },
  androidIntentOptions: {
    EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2800,
  },
};

export function useCoachSpeech({ onFinalTranscript, onPartialTranscript } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakReplies, setSpeakReplies] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(false);
  const partialRef = useRef('');
  const onFinalRef = useRef(onFinalTranscript);
  const onPartialRef = useRef(onPartialTranscript);

  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
    onPartialRef.current = onPartialTranscript;
  }, [onFinalTranscript, onPartialTranscript]);

  useEffect(() => {
    let cancelled = false;
    resolveRecognitionAvailable().then((ok) => {
      if (!cancelled) setSttAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      try {
        getExpoSpeechRecognitionModule()?.abort?.();
      } catch (_) {
        /* ignore */
      }
    },
    [],
  );

  useSpeechRecognitionEvent('start', () => setListening(true));

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const final = String(partialRef.current || '').trim();
    if (final) onFinalRef.current?.(final);
    partialRef.current = '';
  });

  useSpeechRecognitionEvent('result', (event) => {
    const text = extractTranscript(event);
    if (!text) return;
    partialRef.current = text;
    onPartialRef.current?.(text);
    if (event?.isFinal) onFinalRef.current?.(text);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    const code = event?.error;
    if (code === 'aborted' || code === 'no-speech') return;
    console.warn('[useCoachSpeech]', code, event?.message);
    if (code === 'not-allowed') {
      Alert.alert(
        'Microphone access',
        'Allow microphone and speech recognition in Settings so you can talk to your coach.',
      );
      return;
    }
    if (code === 'service-not-allowed' || code === 'language-not-supported') {
      Alert.alert('Voice typing unavailable', event?.message || 'Speech recognition is not available on this device.');
      return;
    }
    if (code === 'interrupted') return;
    Alert.alert('Voice typing', event?.message || 'Could not recognize speech. Try again.');
  });

  const toggleListen = useCallback(async () => {
    const ExpoSpeechRecognitionModule = getExpoSpeechRecognitionModule();
    if (!ExpoSpeechRecognitionModule) {
      Alert.alert(
        'Voice typing',
        'Voice input needs a dev build with speech recognition. Run: npx expo run:ios (or run:android), then reopen the app.',
      );
      return;
    }

    if (listening) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (_) {
        /* ignore */
      }
      return;
    }

    const available = await resolveRecognitionAvailable();
    if (!available) {
      Alert.alert(
        'Voice typing unavailable',
        Platform.OS === 'ios'
          ? 'Speech recognition needs a physical iPhone with a dev build. Simulators often cannot transcribe voice.'
          : 'Speech recognition is not available on this device.',
      );
      return;
    }

    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm?.granted) {
      if (perm?.restricted) {
        Alert.alert(
          'Speech recognition restricted',
          'Speech recognition is blocked by Screen Time or device restrictions.',
        );
      } else {
        Alert.alert(
          'Microphone access',
          'Allow microphone and speech recognition so you can talk to your coach instead of typing.',
        );
      }
      return;
    }

    Speech.stop();
    setSpeaking(false);
    partialRef.current = '';

    try {
      ExpoSpeechRecognitionModule.start(STT_START_OPTIONS);
    } catch (e) {
      setListening(false);
      Alert.alert('Voice typing', e?.message || 'Could not start listening.');
    }
  }, [listening]);

  const speak = useCallback(
    (text) => {
      const t = String(text || '').trim();
      if (!t || !speakReplies) return;
      Speech.stop();
      setSpeaking(true);
      Speech.speak(t, {
        language: 'en-US',
        rate: Platform.OS === 'ios' ? 0.52 : 0.95,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    },
    [speakReplies],
  );

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setSpeaking(false);
  }, []);

  const toggleSpeakReplies = useCallback(() => {
    setSpeakReplies((prev) => {
      if (prev) Speech.stop();
      return !prev;
    });
  }, []);

  return {
    listening,
    speaking,
    speakReplies,
    setSpeakReplies,
    toggleSpeakReplies,
    toggleListen,
    speak,
    stopSpeaking,
    sttAvailable,
    hasSttModule: Boolean(getExpoSpeechRecognitionModule()),
  };
}
