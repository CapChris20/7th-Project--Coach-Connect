// Optional "send a message with this request" popup after a client taps Connect.
// Flow: fade+scale in → optional draft → Skip (no message) or Send/Continue → Close on backdrop.
// Used by: the find-a-trainer connect flow. Busy disables every tap so a double-send cannot fire.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const SCREEN_WIDTH = Dimensions.get('window').width;
const MODAL_MAX_WIDTH_PX = 400;
const MODAL_WIDTH_RATIO = 0.9;
const MODAL_MAX_W = Math.min(SCREEN_WIDTH * MODAL_WIDTH_RATIO, MODAL_MAX_WIDTH_PX);
const BORDER_LOOP = ['#F06BA8', '#FB923C', '#C084FC', '#F06BA8'];
const SEND_GRADIENT = ['#F06BA8', '#FB923C'];
const FALLBACK_COACH_NAME = 'your coach';
const OPEN_SCALE_START = 0.94;
const OPEN_FADE_MS = 220;
const SPRING_FRICTION = 8;
const SPRING_TENSION = 65;
const BUSY_OPACITY = 0.55;
const KEYBOARD_PAD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : undefined;
const GRADIENT_TOP_LEFT = { x: 0, y: 0 };
const GRADIENT_BOTTOM_RIGHT = { x: 1, y: 1 };
const GRADIENT_LEFT = { x: 0, y: 0 };
const GRADIENT_RIGHT = { x: 1, y: 0 };

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
 * @param {boolean} isDark
 */
function introPopupColors(isDark) {
  return {
    cardBackground: isDark ? '#141419' : '#F5F5F5',
    textHigh: isDark ? '#FFFFFF' : '#0A0A0F',
    textMuted: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.6)',
    inputBackground: isDark ? '#0A0A0F' : '#FFFFFF',
    inputBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,10,15,0.12)',
    placeholder: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(10,10,15,0.45)',
  };
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
      friction: SPRING_FRICTION,
      tension: SPRING_TENSION,
      useNativeDriver: true,
    }),
  ]).start();
}

// ===== MAIN FUNCTION =====

/**
 * Optional intro message before a connection request is sent.
 * vocab: useRef holds the Animated.Value across re-renders without resetting the animation.
 * vocab: useEffect re-runs the open animation each time the modal becomes visible.
 * @param {{ visible: boolean, trainerName: string, messageDraft: string, onChangeMessage: Function, onSkip: Function, onSendMessage: Function, onClose: Function, isDark?: boolean, busy?: boolean }} props
 */
export default function RequestIntroPopup({
  visible,
  trainerName,
  messageDraft,
  onChangeMessage,
  onSkip,
  onSendMessage,
  onClose,
  isDark = true,
  busy = false,
}) {
  const scale = useRef(new Animated.Value(OPEN_SCALE_START)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      playIntroOpenAnimation(fade, scale);
    }
  }, [visible, fade, scale]);

  const firstName = firstNameForTitle(trainerName);
  const hasDraft = String(messageDraft || '').trim().length > 0;
  const colors = introPopupColors(isDark);
  const closeUnlessBusy = busy ? undefined : onClose;
  const skipUnlessBusy = busy ? undefined : onSkip;
  const sendUnlessBusy = busy ? undefined : onSendMessage;
  const busyOpacity = busy ? BUSY_OPACITY : 1;
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
              <LinearGradient
                colors={BORDER_LOOP}
                start={GRADIENT_TOP_LEFT}
                end={GRADIENT_BOTTOM_RIGHT}
                style={styles.borderRing}
              >
                <View style={[styles.inner, { backgroundColor: colors.cardBackground }]}>
                  <Text style={[styles.title, { color: colors.textHigh }]}>
                    Send a message to {firstName}?
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textMuted }]}>(Optional)</Text>

                  <TextInput
                    style={[
                      styles.messageInput,
                      {
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.inputBorder,
                        color: colors.textHigh,
                      },
                    ]}
                    placeholder="Write a message (optional)…"
                    placeholderTextColor={colors.placeholder}
                    value={messageDraft}
                    onChangeText={onChangeMessage}
                    multiline
                    editable={!busy}
                  />

                  {messageDraft.length > 0 ? (
                    <TouchableOpacity
                      onPress={() => onChangeMessage('')}
                      style={styles.deleteButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      disabled={busy}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF6B9D" />
                    </TouchableOpacity>
                  ) : null}

                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[styles.skipButton, { opacity: busyOpacity }]}
                      onPress={skipUnlessBusy}
                      disabled={busy}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.skipButtonText}>Skip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sendButton, { opacity: busyOpacity }]}
                      onPress={sendUnlessBusy}
                      disabled={busy}
                      activeOpacity={0.88}
                    >
                      <LinearGradient
                        colors={SEND_GRADIENT}
                        start={GRADIENT_LEFT}
                        end={GRADIENT_RIGHT}
                        style={styles.sendGradient}
                      >
                        <Text style={styles.sendButtonText}>{sendLabel}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  borderRing: {
    borderRadius: 16,
    padding: 2.5,
  },
  inner: {
    borderRadius: 14,
    padding: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  messageInput: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
    fontSize: 13,
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  deleteButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  skipButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#FF6B9D',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  skipButtonText: {
    color: '#FF6B9D',
    fontSize: 14,
    fontWeight: '700',
  },
  sendButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    marginLeft: 6,
  },
  sendGradient: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
