// Client home card for the linked trainer — photo, specialty, Message / Profile / Pay / Remove.
// Flow: pick surface colors → read trainer fields → pressable body (Message) → optional Remove below.
// Used on the client home screen. Accent keys (pink, purple, cyan, orange, green) stay as callers pass them.

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { trainerPhotoUri } from '../../helpers/trainerProfilePhoto';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const ACCENTS = {
  pink: lightColors.primaryDark,
  purple: lightColors.primaryDark,
  cyan: '#C2410C',
  orange: '#C2410C',
  green: '#10B981',
};

const BRAND_CTA_GRADIENT = [lightColors.primaryDark, '#C2410C'];
const TRAINER_NAME_DEFAULT = 'Your Trainer';
const SPECIALTY_DEFAULT = 'Strength & Nutrition';
const LOCATION_DEFAULT = 'Remote';
const ERROR_STATUS_COLOR = '#FF453A';
const PRESS_IN_SCALE = 0.98;
const SPRING_BOUNCINESS_OUT = 7;
const SPRING_SPEED_IN = 22;
const SPRING_BOUNCINESS_IN = 6;
const SPRING_SPEED_OUT = 18;
const AVATAR_BORDER_WIDTH = 2;
const MAX_INITIAL_LETTERS = 2;

// ===== HELPER FUNCTIONS =====

function surfaceTokens(isDark) {
  if (isDark) {
    return {
      cardBackground: darkColors.nbSurface,
      border: darkColors.nbBorder,
      text: darkColors.nbInk,
      muted: darkColors.nbMuted,
      dim: darkColors.nbMuted,
    };
  }
  return {
    cardBackground: lightColors.nbSurface,
    border: lightColors.nbBorder,
    text: lightColors.nbInk,
    muted: lightColors.nbMuted,
    dim: lightColors.nbMuted,
  };
}

function initialsFromName(name) {
  const words = String(name || '').split(/\s+/);
  const letters = [];
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const word = words[wordIndex];
    if (!word) continue;
    letters.push(word[0]);
    if (letters.length >= MAX_INITIAL_LETTERS) break;
  }
  return letters.join('').toUpperCase();
}

function numericRating(rating) {
  if (typeof rating === 'number') return rating;
  if (rating) return Number(rating);
  return null;
}

function numericClients(clients) {
  if (typeof clients === 'number') return clients;
  if (clients) return Number(clients);
  return null;
}

function paymentStatusChipColors(paymentStatusTone, isDark, tokens) {
  if (paymentStatusTone === 'success') {
    return {
      backgroundColor: isDark ? 'rgba(48,209,88,0.15)' : 'rgba(48,209,88,0.12)',
      borderColor: 'rgba(48,209,88,0.35)',
      color: ACCENTS.green,
    };
  }
  if (paymentStatusTone === 'warning') {
    return {
      backgroundColor: isDark ? 'rgba(255,159,10,0.15)' : 'rgba(255,159,10,0.12)',
      borderColor: 'rgba(255,159,10,0.35)',
      color: ACCENTS.orange,
    };
  }
  if (paymentStatusTone === 'error') {
    return {
      backgroundColor: isDark ? 'rgba(255,59,48,0.15)' : 'rgba(255,59,48,0.12)',
      borderColor: 'rgba(255,59,48,0.35)',
      color: ERROR_STATUS_COLOR,
    };
  }
  return {
    backgroundColor: isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip,
    borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
    color: tokens.muted,
  };
}

function chipSurfaceColors(isDark) {
  if (isDark) {
    return {
      borderColor: darkColors.nbBorder,
      backgroundColor: darkColors.nbSurfaceChip,
    };
  }
  return {
    borderColor: lightColors.nbBorder,
    backgroundColor: lightColors.nbSurfaceChip,
  };
}

function pickAccentColor(accentKey) {
  const matched = ACCENTS[accentKey];
  if (matched) return matched;
  return ACCENTS.purple;
}

function TrainerBadge({ icon, label, accentColor, isDark, tokens }) {
  const badgeBackground = isDark ? `${accentColor}14` : `${accentColor}0D`;
  const badgeBorder = isDark ? `${accentColor}30` : `${accentColor}22`;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: badgeBackground,
          borderColor: badgeBorder,
        },
      ]}
    >
      <Ionicons name={icon} size={13} color={accentColor} />
      <Text style={[styles.badgeText, { color: tokens.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function TrainerAvatar({ photoSrc, name, accentColor, isDark, tokens }) {
  const ringBorderColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const innerBackground = isDark ? lightColors.nbInk : lightColors.white;
  const hasPhoto = Boolean(photoSrc);

  let avatarFace = (
    <Text style={[styles.avatarFallback, { color: accentColor }]}>
      {initialsFromName(name)}
    </Text>
  );
  if (hasPhoto) {
    avatarFace = <Image source={{ uri: photoSrc }} style={styles.avatarImg} />;
  }

  return (
    <View
      style={[
        styles.avatarRing,
        {
          borderWidth: AVATAR_BORDER_WIDTH,
          borderColor: ringBorderColor,
          padding: 0,
        },
      ]}
    >
      <View
        style={[
          styles.avatarInner,
          {
            backgroundColor: innerBackground,
            borderColor: tokens.border,
          },
        ]}
      >
        {avatarFace}
      </View>
    </View>
  );
}

function PaymentStatusRow({ paymentRateLabel, paymentStatusLabel, paymentStatusTone, isDark, tokens }) {
  const chipColors = paymentStatusChipColors(paymentStatusTone, isDark, tokens);
  const showRate = Boolean(paymentRateLabel);
  const showStatus = Boolean(paymentStatusLabel);

  let rateText = null;
  if (showRate) {
    rateText = (
      <Text style={[styles.paymentRate, { color: tokens.muted }]}>{paymentRateLabel}</Text>
    );
  }

  let statusChip = null;
  if (showStatus) {
    statusChip = (
      <View
        style={[
          styles.paymentStatusChip,
          {
            backgroundColor: chipColors.backgroundColor,
            borderColor: chipColors.borderColor,
          },
        ]}
      >
        <Text style={[styles.paymentStatusText, { color: chipColors.color }]}>
          {paymentStatusLabel}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.paymentMetaRow}>
      {rateText}
      {statusChip}
    </View>
  );
}

function readTrainerCardFields(trainer) {
  const safeTrainer = trainer || {};
  const rawName = safeTrainer.name || safeTrainer.displayName || TRAINER_NAME_DEFAULT;
  const rawSpecialty = safeTrainer.specialty || safeTrainer.headline || SPECIALTY_DEFAULT;
  const rawLocation = safeTrainer.location || LOCATION_DEFAULT;

  let years = null;
  if (typeof safeTrainer.experienceYears === 'number') {
    years = safeTrainer.experienceYears;
  }

  return {
    name: String(rawName).trim(),
    specialty: String(rawSpecialty).trim(),
    location: String(rawLocation).trim(),
    rating: numericRating(safeTrainer.rating),
    clients: numericClients(safeTrainer.clients),
    years,
    photoSrc: trainerPhotoUri(trainer),
  };
}

function ActivePill({ accentColor }) {
  const pillColors = [`${accentColor}30`, `${accentColor}18`];
  const pillBorderColor = `${accentColor}50`;
  return (
    <LinearGradient
      colors={pillColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.pill, { borderColor: pillBorderColor }]}
    >
      <Text style={[styles.pillText, { color: accentColor }]}>ACTIVE</Text>
    </LinearGradient>
  );
}

function StatBadgesRow({ fields, accentColor, isDark, tokens }) {
  const badgeViews = [];

  if (fields.rating) {
    badgeViews.push(
      <TrainerBadge
        key="rating"
        icon="star"
        label={`${fields.rating.toFixed(1)} rating`}
        accentColor={accentColor}
        isDark={isDark}
        tokens={tokens}
      />,
    );
  }
  if (fields.clients) {
    badgeViews.push(
      <TrainerBadge
        key="clients"
        icon="people-outline"
        label={`${fields.clients} clients`}
        accentColor={accentColor}
        isDark={isDark}
        tokens={tokens}
      />,
    );
  }
  if (fields.years) {
    badgeViews.push(
      <TrainerBadge
        key="years"
        icon="ribbon-outline"
        label={`${fields.years}+ yrs`}
        accentColor={accentColor}
        isDark={isDark}
        tokens={tokens}
      />,
    );
  }

  if (badgeViews.length === 0) return null;
  return <View style={styles.badgesRow}>{badgeViews}</View>;
}

// ===== MAIN FUNCTION =====

/**
 * Linked-trainer card on client home.
 * Flow: 1. theme + fields  2. which CTAs show  3. paint body + optional Remove
 * @param {object} props
 */
export default function MyTrainerCard({
  isDark = true,
  accent = 'purple',
  trainer,
  onPressCard,
  onPressCTA,
  ctaLabel = 'Message',
  secondaryCtaLabel = 'View Profile',
  onPressSecondaryCTA,
  onPressPayment,
  onPressRemove,
  paymentButtonLabel = 'Manage Coaching Payment',
  paymentButtonShortLabel = 'Pay',
  paymentRateLabel,
  paymentStatusLabel,
  paymentStatusTone = 'neutral',
}) {
  // 1. Theme tokens + accent + trainer display fields.
  const tokens = surfaceTokens(isDark);
  const accentColor = pickAccentColor(accent);
  const fields = readTrainerCardFields(trainer);
  const chipColors = chipSurfaceColors(isDark);
  const dividerColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;

  // Hook order frozen: one scale Animated.Value for press-in shrink
  const scale = useRef(new Animated.Value(1)).current;

  const shrinkOnPressIn = () =>
    Animated.spring(scale, {
      toValue: PRESS_IN_SCALE,
      useNativeDriver: true,
      speed: SPRING_SPEED_IN,
      bounciness: SPRING_BOUNCINESS_IN,
    }).start();

  const restoreScaleOnPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: SPRING_SPEED_OUT,
      bounciness: SPRING_BOUNCINESS_OUT,
    }).start();

  // 2. Name which CTAs / meta rows this card actually shows.
  const hasPayment = typeof onPressPayment === 'function';
  const hasRemove = typeof onPressRemove === 'function';
  const showPaymentMeta = Boolean((paymentRateLabel || paymentStatusLabel) && hasPayment);
  const removeAccessibilityLabel = `Remove ${fields.name} as your trainer`;
  const outerStyle = hasRemove ? [styles.outer, styles.outerWithRemove] : styles.outer;

  // secondaryCtaLabel / paymentButtonLabel stay accepted for callers; UI uses short Profile / Pay labels
  void secondaryCtaLabel;
  void paymentButtonLabel;

  let paymentButton = null;
  if (hasPayment) {
    paymentButton = (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPressPayment}
        style={[styles.tertiaryBtn, chipColors]}
      >
        <Ionicons name="card-outline" size={17} color={accentColor} />
        <Text style={[styles.tertiaryText, { color: tokens.text }]} numberOfLines={1}>
          {paymentButtonShortLabel}
        </Text>
      </TouchableOpacity>
    );
  }

  let paymentMetaRow = null;
  if (showPaymentMeta) {
    paymentMetaRow = (
      <PaymentStatusRow
        paymentRateLabel={paymentRateLabel}
        paymentStatusLabel={paymentStatusLabel}
        paymentStatusTone={paymentStatusTone}
        isDark={isDark}
        tokens={tokens}
      />
    );
  }

  let removeRow = null;
  if (hasRemove) {
    removeRow = (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPressRemove}
        accessibilityRole="button"
        accessibilityLabel={removeAccessibilityLabel}
        style={styles.removeRow}
      >
        <Ionicons name="person-remove-outline" size={14} color={ERROR_STATUS_COLOR} />
        <Text style={styles.removeText}>Remove trainer</Text>
      </TouchableOpacity>
    );
  }

  // 3. Paint pressable body + optional Remove row outside the press target.
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View
        style={[
          styles.cardShell,
          {
            borderColor: tokens.border,
            backgroundColor: tokens.cardBackground,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={onPressCard}
          onPressIn={shrinkOnPressIn}
          onPressOut={restoreScaleOnPressOut}
        >
          <View style={outerStyle}>
            <View style={styles.row}>
              <TrainerAvatar
                photoSrc={fields.photoSrc}
                name={fields.name}
                accentColor={accentColor}
                isDark={isDark}
                tokens={tokens}
              />

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.titleRow}>
                  <Text style={[styles.name, { color: tokens.text }]} numberOfLines={1}>
                    {fields.name}
                  </Text>
                  <ActivePill accentColor={accentColor} />
                </View>

                <Text style={[styles.specialty, { color: tokens.muted }]} numberOfLines={1}>
                  {fields.specialty}
                </Text>

                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={13} color={tokens.dim} />
                  <Text style={[styles.meta, { color: tokens.dim }]} numberOfLines={1}>
                    {fields.location}
                  </Text>
                </View>
              </View>
            </View>

            <StatBadgesRow
              fields={fields}
              accentColor={accentColor}
              isDark={isDark}
              tokens={tokens}
            />

            <View style={[styles.divider, { backgroundColor: dividerColor }]} />

            <View style={styles.ctaRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPressSecondaryCTA}
                style={[styles.tertiaryBtn, chipColors]}
              >
                <Ionicons name="person-circle-outline" size={17} color={tokens.text} />
                <Text style={[styles.tertiaryText, { color: tokens.text }]} numberOfLines={1}>
                  Profile
                </Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} onPress={onPressCTA} style={styles.primaryBtnWrap}>
                <LinearGradient
                  colors={BRAND_CTA_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtn}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color={lightColors.white} />
                  <Text style={styles.primaryText} numberOfLines={1}>
                    {ctaLabel}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {paymentButton}
            </View>

            {paymentMetaRow}
          </View>
        </TouchableOpacity>

        {removeRow}
      </View>
    </Animated.View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  cardShell: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  outer: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
  },
  outerWithRemove: {
    paddingBottom: 8,
  },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatarRing: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden' },
  avatarInner: {
    flex: 1,
    borderRadius: 36,
    borderWidth: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { fontSize: 19, fontWeight: '900', flex: 1, letterSpacing: -0.3 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  specialty: { marginTop: 4, fontSize: 13, fontWeight: '700' },
  metaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  meta: { fontSize: 12, fontWeight: '600' },
  badgesRow: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
  divider: { height: 1, marginTop: 16, marginBottom: 14, borderRadius: 1 },
  ctaRow: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  tertiaryBtn: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  tertiaryText: { fontSize: 11, fontWeight: '800' },
  secondaryBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: { fontSize: 13, fontWeight: '900' },
  primaryBtnWrap: { flex: 1.15, minWidth: 0 },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 4,
    paddingHorizontal: 4,
  },
  primaryText: { color: lightColors.white, fontSize: 11, fontWeight: '900' },
  paymentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 10,
  },
  paymentRate: { fontSize: 12, fontWeight: '700' },
  paymentStatusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  paymentStatusText: { fontSize: 11, fontWeight: '800' },
  removeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 0,
    paddingBottom: 14,
    paddingHorizontal: 18,
  },
  removeText: {
    fontSize: 12,
    fontWeight: '700',
    color: ERROR_STATUS_COLOR,
  },
});
