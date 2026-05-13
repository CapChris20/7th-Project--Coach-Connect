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

const { width: SCREEN_W } = Dimensions.get('window');
const MODAL_MAX_W = Math.min(SCREEN_W * 0.9, 400);

const BORDER_LOOP = ['#FF6B9D', '#64D2FF', '#C084FC', '#FF6B9D'];

export default function TrainerRequestIntroModal({
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
  const scale = useRef(new Animated.Value(0.94)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      fade.setValue(0);
      scale.setValue(0.94);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 8, tension: 65, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, fade, scale]);

  const first = String(trainerName || 'your coach').trim().split(/\s+/)[0] || 'your coach';

  const bg = isDark ? '#141419' : '#F5F5F5';
  const textHi = isDark ? '#FFFFFF' : '#0A0A0F';
  const textMuted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.6)';
  const inputBg = isDark ? '#0A0A0F' : '#FFFFFF';
  const inputBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,10,15,0.12)';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdropPress} onPress={busy ? undefined : onClose} />
          <View style={styles.centerWrap} pointerEvents="box-none">
            <Animated.View
              style={{
                opacity: fade,
                transform: [{ scale }],
                width: MODAL_MAX_W,
                maxWidth: '90%',
              }}
            >
              <LinearGradient colors={BORDER_LOOP} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.borderRing}>
                <View style={[styles.inner, { backgroundColor: bg }]}>
                  <Text style={[styles.title, { color: textHi }]}>Send a message to {first}?</Text>
                  <Text style={[styles.subtitle, { color: textMuted }]}>(Optional)</Text>

                  <TextInput
                    style={[styles.messageInput, { backgroundColor: inputBg, borderColor: inputBorder, color: textHi }]}
                    placeholder="Write a message (optional)…"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(10,10,15,0.45)'}
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
                      style={[styles.skipButton, { opacity: busy ? 0.55 : 1 }]}
                      onPress={busy ? undefined : onSkip}
                      disabled={busy}
                      activeOpacity={0.88}
                    >
                      <Text style={styles.skipButtonText}>Skip</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sendButton, { opacity: busy ? 0.55 : 1 }]}
                      onPress={busy ? undefined : onSendMessage}
                      disabled={busy}
                      activeOpacity={0.88}
                    >
                      <LinearGradient
                        colors={['#FF6B9D', '#C084FC']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.sendGradient}
                      >
                        <Text style={styles.sendButtonText}>Send message</Text>
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
