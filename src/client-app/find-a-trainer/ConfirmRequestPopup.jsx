// Confirm-before-send sheet when a client taps Request on a trainer profile.
// Flow: show the trainer → explain the 3–5 day trial → show the first monthly price → Cancel or Confirm.
// Used by SearchTrainersScreen. Price is read from price, then pricing.perMonth, then rate.

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

import { trainerPhotoUri } from '../../helpers/trainerProfilePhoto';

// ===== NAMED CONSTANTS =====

const { width: SCREEN_W } = Dimensions.get('window');
const MODAL_MAX_WIDTH_PX = 400;
const MODAL_MAX_W = Math.min(SCREEN_W * 0.9, MODAL_MAX_WIDTH_PX);
const BORDER_LOOP = ['#F06BA8', '#FB923C', '#C084FC', '#F06BA8'];
const TRAINER_NAME_DEFAULT = 'Trainer';
const PINK = '#FF6B9D';
const CYAN = '#64D2FF';
const PURPLE = '#C084FC';
const WHITE = '#fff';
const SCALE_HIDDEN = 0.94;
const FADE_MS = 220;

// ===== HELPER FUNCTIONS =====

/**
 * Marketplace cards store the monthly rate in three different fields. First one that exists wins.
 * @param {object} trainer
 * @returns {*}
 */
function getTrainerPrice(trainer) {
  if (!trainer) return null;
  if (trainer.price != null) return trainer.price;
  const perMonth = trainer.pricing && trainer.pricing.perMonth != null ? trainer.pricing.perMonth : null;
  if (perMonth != null) return perMonth;
  return trainer.rate != null ? trainer.rate : null;
}

/**
 * @param {object} trainer
 * @returns {{ name: string, firstName: string, initial: string, photoUri: string, price: *, hasPrice: boolean }}
 */
function trainerConfirmFields(trainer) {
  const name = trainer.displayName || trainer.name || TRAINER_NAME_DEFAULT;
  const firstName = name.trim().split(/\s+/)[0] || name;
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const photoUri = trainerPhotoUri(trainer);
  const price = getTrainerPrice(trainer);
  const hasPrice = price != null && price !== '' && Number.isFinite(Number(price)) && Number(price) > 0;
  return { name, firstName, initial, photoUri, price, hasPrice };
}

/**
 * @param {boolean} isDark
 * @returns {object}
 */
function confirmTheme(isDark) {
  return {
    cardBackground: isDark ? '#0A0A0F' : '#F5F5F5',
    textHi: isDark ? '#FFFFFF' : '#0A0A0F',
    textMuted: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.6)',
    textMuted2: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.5)',
    borderSoft: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,10,15,0.1)',
    glassBackground: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
    washColors: isDark
      ? ['rgba(255,107,157,0.07)', 'rgba(100,210,255,0.05)', 'rgba(192,132,252,0.07)']
      : ['rgba(255,107,157,0.06)', 'rgba(100,210,255,0.04)', 'rgba(192,132,252,0.06)'],
    avatarInner: isDark ? '#13131A' : '#FFFFFF',
  };
}

function TrainerAvatar({ photoUri, initial, isDark, avatarInner }) {
  return (
    <View style={[styles.avatarRing, { borderColor: PINK }]}>
      <LinearGradient colors={[PINK, PURPLE]} style={styles.avatarGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <View style={[styles.avatarInner, { backgroundColor: avatarInner }]}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.avatarImg} resizeMode="cover" />
          ) : (
            <Text style={[styles.avatarInitial, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}>{initial}</Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

function TrialCard({ firstName, glassBackground, borderSoft, textMuted }) {
  return (
    <View style={[styles.cardBlock, { backgroundColor: glassBackground, borderColor: borderSoft }]}>
      <View style={styles.rowStart}>
        <Ionicons name="calendar-outline" size={20} color={CYAN} style={styles.rowIcon} />
        <View style={styles.rowBody}>
          <Text style={[styles.sectionLabel, { color: CYAN }]}>FREE TRIAL PERIOD: 3–5 DAYS</Text>
          <Text style={[styles.bodyText, { color: textMuted }]}>
            You can message {firstName} and discuss your fitness goals, training style, recovery needs, and anything else
            you want to cover. Get to know each other first — no commitment yet.
          </Text>
        </View>
      </View>
    </View>
  );
}

function AfterTrialCard({ hasPrice, price, glassBackground, borderSoft, textMuted }) {
  return (
    <View style={[styles.cardBlock, { backgroundColor: glassBackground, borderColor: borderSoft }]}>
      <View style={styles.rowStart}>
        <Ionicons name="card-outline" size={20} color={PINK} style={styles.rowIcon} />
        <View style={styles.rowBody}>
          <Text style={[styles.sectionLabel, { color: PINK }]}>AFTER YOUR TRIAL</Text>
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
  );
}

function outlinePressOpacity(busy, pressed) {
  if (busy) return 0.5;
  if (pressed) return 0.92;
  return 1;
}

function pressScale(pressed) {
  if (pressed) return 0.98;
  return 1;
}

function ConfirmActions({ busy, onCancel, onConfirm, borderSoft, textHi }) {
  return (
    <View style={[styles.actions, { borderTopColor: borderSoft }]}>
      <Pressable
        onPress={busy ? undefined : onCancel}
        disabled={busy}
        style={({ pressed }) => [
          styles.btnOutline,
          {
            borderColor: borderSoft,
            opacity: outlinePressOpacity(busy, pressed),
            transform: [{ scale: pressScale(pressed) }],
          },
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
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.btnPrimaryText}>Yes, let's connect</Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ===== MAIN FUNCTION =====

export default function ConfirmRequestPopup({
  visible,
  trainer,
  onCancel,
  onConfirm,
  isDark = true,
  busy = false,
}) {
  const scale = useRef(new Animated.Value(SCALE_HIDDEN)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    fade.setValue(0);
    scale.setValue(SCALE_HIDDEN);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 65, useNativeDriver: true }),
    ]).start();
  }, [visible, fade, scale]);

  if (!trainer) return null;

  const { name, firstName, initial, photoUri, price, hasPrice } = trainerConfirmFields(trainer);
  const theme = confirmTheme(isDark);

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
            <View style={[styles.inner, { backgroundColor: theme.cardBackground }]}>
              <LinearGradient
                colors={theme.washColors}
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
                <TrainerAvatar photoUri={photoUri} initial={initial} isDark={isDark} avatarInner={theme.avatarInner} />

                <Text style={[styles.title, { color: theme.textHi }]}>{name}</Text>
                <Text style={[styles.headline, { color: theme.textHi }]}>Let's confirm your request</Text>
                <Text style={[styles.subLead, { color: theme.textMuted }]}>
                  You're about to connect with {firstName}.
                </Text>

                <TrialCard
                  firstName={firstName}
                  glassBackground={theme.glassBackground}
                  borderSoft={theme.borderSoft}
                  textMuted={theme.textMuted}
                />
                <AfterTrialCard
                  hasPrice={hasPrice}
                  price={price}
                  glassBackground={theme.glassBackground}
                  borderSoft={theme.borderSoft}
                  textMuted={theme.textMuted}
                />

                <Text style={[styles.trust, { color: theme.textMuted2 }]}>
                  Once you're connected, they'll help you set up your plan and get started on your fitness journey.
                </Text>
              </ScrollView>

              <ConfirmActions
                busy={busy}
                onCancel={onCancel}
                onConfirm={onConfirm}
                borderSoft={theme.borderSoft}
                textHi={theme.textHi}
              />
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
