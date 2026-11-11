// Optional "send a message with this request" popup after a client taps Connect.
// Flow: fade+scale in → optional draft → Skip (no message) or Send/Continue → Close on backdrop.
// Used by: the find-a-trainer connect flow. Busy disables every tap so a double-send cannot fire.
//
// vocab: neobrutalist = thick borders, hard shadows, gradient only for send button

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SCREEN_WIDTH = Dimensions.get('window').width;
const MODAL_MAX_WIDTH_PX = 400;
const MODAL_WIDTH_RATIO = 0.9;
const MODAL_MAX_W = Math.min(SCREEN_WIDTH * MODAL_WIDTH_RATIO, MODAL_MAX_WIDTH_PX);
const FALLBACK_COACH_NAME = 'your coach';
const OPEN_SCALE_START = 0.94;
const OPEN_FADE_MS = 220;
const KEYBOARD_PAD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : undefined;

// ===== HELPER FUNCTIONS =====

/**
 * First name only, so the title stays short. Empty / missing names fall back to "your coach".
 * @param {string} trainerName
 * @returns {string}
 */
function firstNameForTitle(trainerName) {
  const trimmedName = String(trainerName || FALLBACK_COACH_NAME).trim();
  return trimmedName.split(/\s+/)[0] || FALLBACK_COACH_NAME;
}

/**
 * Play the open animation from the starting scale/fade. Called whenever `visible` becomes true.
 * vocab: useNativeDriver true = the animation runs on the native thread (smoother on the phone).
 * @param {Animated.Value} fade
 * @param {Animated.Value} scale
 */
function playIntroOpenAnimation(fade, scale) {
  fade.setValue(0);
  scale.setValue(OPEN_SCALE_START);
  Animated.parallel([
    Animated.timing(fade, { toValue: 1, duration: OPEN_FADE_MS, useNativeDriver: true }),
    Animated.spring(scale, {
      toValue: 1,
      friction: 8,
      tension: 65,
      useNativeDriver: true,
    }),
  ]).start();
}

// ===== MAIN FUNCTION =====

/**
 * Optional intro message before a connection request is sent.
 * Neobrutalist redesign: NbCard, NbButton, thick borders, gradient only for send button.
 * vocab: useRef holds the Animated.Value across re-renders without resetting the animation.
 * vocab: useEffect re-runs the open animation each time the modal becomes visible.
 * @param {object} props
 */
export default function RequestIntroPopup({
  visible,
  trainerName,
  messageDraft,
  onChangeMessage,
  onSkip,
  onSendMessage,
  onClose,
  busy = false,
}) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const scale = useRef(new Animated.Value(OPEN_SCALE_START)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      playIntroOpenAnimation(fade, scale);
    }
  }, [visible, fade, scale]);

  const firstName = firstNameForTitle(trainerName);
  const hasDraft = String(messageDraft || '').trim().length > 0;
  const closeUnlessBusy = busy ? undefined : onClose;
  const skipUnlessBusy = busy ? undefined : onSkip;
  const sendUnlessBusy = busy ? undefined : onSendMessage;
  const sendLabel = hasDraft ? 'Send message' : 'Continue';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeUnlessBusy}>
      <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_PAD_BEHAVIOR}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdropPress} onPress={closeUnlessBusy} />
          <View style={styles.centerWrap} pointerEvents="box-none">
            <Animated.View
              style={{
                opacity: fade,
                transform: [{ scale }],
                width: MODAL_MAX_W,
                maxWidth: '90%',
              }}
            >
              <NbCard style={styles.card}>
                <Text style={[styles.title, { color: colors.nbInk }]}>
                  Send a message to {firstName}?
                </Text>
                <Text style={[styles.subtitle, { color: colors.nbMuted }]}>(Optional)</Text>

                <TextInput
                  value={messageDraft}
                  onChangeText={onChangeMessage}
                  placeholder={`Introduce yourself to ${firstName}...`}
                  placeholderTextColor={colors.nbMuted}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  editable={!busy}
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.nbSurfaceChip,
                      borderColor: colors.nbBorder,
                      color: colors.nbInk,
                    },
                  ]}
                />

                <View style={styles.actions}>
                  <NbButton variant="plain" onPress={skipUnlessBusy} disabled={busy}>
                    Skip
                  </NbButton>
                  <NbButton variant="brand" onPress={sendUnlessBusy} disabled={busy}>
                    {sendLabel}
                  </NbButton>
                </View>
              </NbCard>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderRadius: 12,
    borderWidth: 2.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
});
