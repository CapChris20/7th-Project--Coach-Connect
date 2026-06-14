import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { trainerPhotoUri } from '../../shared/utils/trainerProfileMedia';

const { width: SCREEN_W } = Dimensions.get('window');
const MODAL_MAX_W = Math.min(SCREEN_W * 0.9, 400);

const BORDER_LOOP = ['#F06BA8', '#FB923C', '#C084FC', '#F06BA8'];

function getTrainerPrice(t) {
  if (!t) return null;
  if (t.price != null) return t.price;
  const pm = t.pricing && t.pricing.perMonth != null ? t.pricing.perMonth : null;
  if (pm != null) return pm;
  return t.rate != null ? t.rate : null;
}

export default function TrainerRequestConfirmModal({
  visible,
  trainer,
  onCancel,
  onConfirm,
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

  if (!trainer) return null;

  const name = trainer.displayName || trainer.name || 'Trainer';
  const first = name.trim().split(/\s+/)[0] || name;
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const photoUri = trainerPhotoUri(trainer);
  const price = getTrainerPrice(trainer);
  const hasPrice = price != null && price !== '' && Number.isFinite(Number(price)) && Number(price) > 0;

  const bg = isDark ? '#0A0A0F' : '#F5F5F5';
  const textHi = isDark ? '#FFFFFF' : '#0A0A0F';
  const textMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.6)';
  const textMuted2 = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.5)';
  const borderSoft = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,10,15,0.1)';
  const glassBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdropPress} onPress={busy ? undefined : onCancel} />
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
              <LinearGradient
                colors={
                  isDark
                    ? ['rgba(255,107,157,0.07)', 'rgba(100,210,255,0.05)', 'rgba(192,132,252,0.07)']
                    : ['rgba(255,107,157,0.06)', 'rgba(100,210,255,0.04)', 'rgba(192,132,252,0.06)']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={[styles.avatarRing, { borderColor: '#FF6B9D' }]}>
                  <LinearGradient colors={['#FF6B9D', '#C084FC']} style={styles.avatarGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={[styles.avatarInner, { backgroundColor: isDark ? '#13131A' : '#FFFFFF' }]}>
                      {photoUri ? (
                        <Image source={{ uri: photoUri }} style={styles.avatarImg} resizeMode="cover" />
                      ) : (
                        <Text style={[styles.avatarInitial, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}>{initial}</Text>
                      )}
                    </View>
                  </LinearGradient>
                </View>

                <Text style={[styles.title, { color: textHi }]}>{name}</Text>
                <Text style={[styles.headline, { color: textHi }]}>Let's confirm your request</Text>
                <Text style={[styles.subLead, { color: textMuted }]}>
                  You're about to connect with {first}.
                </Text>

                <View style={[styles.cardBlock, { backgroundColor: glassBg, borderColor: borderSoft }]}>
                  <View style={styles.rowStart}>
                    <Ionicons name="calendar-outline" size={20} color="#64D2FF" style={styles.rowIcon} />
                    <View style={styles.rowBody}>
                      <Text style={[styles.sectionLabel, { color: '#64D2FF' }]}>FREE TRIAL PERIOD: 3–5 DAYS</Text>
                      <Text style={[styles.bodyText, { color: textMuted }]}>
                        You can message {first} and discuss your fitness goals, training style, recovery needs, and anything else
                        you want to cover. Get to know each other first — no commitment yet.
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.cardBlock, { backgroundColor: glassBg, borderColor: borderSoft }]}>
                  <View style={styles.rowStart}>
                    <Ionicons name="card-outline" size={20} color="#FF6B9D" style={styles.rowIcon} />
                    <View style={styles.rowBody}>
                      <Text style={[styles.sectionLabel, { color: '#FF6B9D' }]}>AFTER YOUR TRIAL</Text>
                      {hasPrice ? (
                        <Text style={[styles.bodyText, { color: textMuted }]}>
                          Your first payment of{' '}
                          <Text style={styles.priceAccent}>${Number(price)}</Text>
                          /month will be charged. You can cancel anytime before your trial ends with no charge.
                        </Text>
                      ) : (
                        <Text style={[styles.bodyText, { color: textMuted }]}>
                          Your first payment will follow your coach's listed rate. You can cancel anytime before your trial ends
                          with no charge.
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                <Text style={[styles.trust, { color: textMuted2 }]}>
                  Once you're connected, they'll help you set up your plan and get started on your fitness journey.
                </Text>
              </ScrollView>

              <View style={[styles.actions, { borderTopColor: borderSoft }]}>
                <Pressable
                  onPress={busy ? undefined : onCancel}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.btnOutline,
                    { borderColor: borderSoft, opacity: busy ? 0.5 : pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                  ]}
                >
                  <Text style={[styles.btnOutlineText, { color: textHi }]}>Not right now</Text>
                </Pressable>
                <Pressable
                  onPress={busy ? undefined : onConfirm}
                  disabled={busy}
                  style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.98 : 1 }], opacity: busy ? 0.85 : 1 }]}
                >
                  <LinearGradient
                    colors={['#F06BA8', '#FB923C']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.btnGradient}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.btnPrimaryText}>Yes, let's connect</Text>
                    )}
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropPress: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  borderRing: {
    borderRadius: 24,
    padding: 2.5,
    maxHeight: '88%',
  },
  inner: {
    borderRadius: 21,
    overflow: 'hidden',
    maxHeight: '100%',
  },
  scroll: {
    maxHeight: 420,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 16,
  },
  avatarRing: {
    alignSelf: 'center',
    marginBottom: 14,
  },
  avatarGrad: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 28, fontWeight: '900' },
  title: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  headline: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  subLead: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  cardBlock: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  rowStart: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowIcon: { marginRight: 12, marginTop: 2 },
  rowBody: { flex: 1 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  priceAccent: {
    color: '#FF6B9D',
    fontWeight: '900',
  },
  trust: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnOutline: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOutlineText: {
    fontSize: 15,
    fontWeight: '800',
  },
  btnGradient: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
});
