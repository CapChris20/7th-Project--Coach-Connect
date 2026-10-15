// Client home card for the linked trainer: photo, specialty, Message / Profile / Pay.
// Flow: read trainer fields → paint the glass card → Message is the brand CTA, Pay only when onPressPayment is passed.
// Used on the client home screen. Accent keys (pink, purple, cyan, orange, green) stay as callers pass `accent`.

import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { trainerPhotoUri } from '../../helpers/trainerProfilePhoto';

// ===== NAMED CONSTANTS =====

const ACCENTS = {
  pink: '#BE185D',
  purple: '#BE185D',
  cyan: '#C2410C',
  orange: '#C2410C',
  green: '#10B981',
};

const BRAND_CTA_GRADIENT = ['#BE185D', '#C2410C'];
const TRAINER_NAME_DEFAULT = 'Your Trainer';
const SPECIALTY_DEFAULT = 'Strength & Nutrition';
const LOCATION_DEFAULT = 'Remote';
const ERROR_STATUS_COLOR = '#FF453A';
const PRESS_IN_SCALE = 0.98;
const SPRING_BOUNCINESS_OUT = 7;

// ===== HELPER FUNCTIONS =====

/**
 * Glass fill/border/text for light versus dark. Keys stay local to this card.
 * @param {boolean} isDark
 * @returns {object}
 */
function glass(isDark) {
  return {
    cardBackground: isDark ? 'rgba(12,10,28,0.96)' : 'rgba(255,255,255,0.97)',
    border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text: isDark ? '#FFFFFF' : '#0A0A0F',
    muted: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.55)',
    dim: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)',
  };
}

/**
 * Initials from the first two words. "Alex Kim" → "AK".
 * @param {string} name
 * @returns {string}
 */
function initialsFromName(name) {
  return name.split(/\s+/).map((word) => word[0]).slice(0, 2).join('').toUpperCase();
}

/**
 * @param {*} rating
 * @returns {number|null}
 */
function numericRating(rating) {
  if (typeof rating === 'number') return rating;
  if (rating) return Number(rating);
  return null;
}

/**
 * @param {*} clients
 * @returns {number|null}
 */
function numericClients(clients) {
  if (typeof clients === 'number') return clients;
  if (clients) return Number(clients);
  return null;
}

/**
 * Chip fill/border/text for the payment status under the CTA row.
 * @param {string} paymentStatusTone
 * @param {boolean} isDark
 * @param {object} tokens
 * @returns {{ backgroundColor: string, borderColor: string, color: string }}
 */
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
    color: tokens.muted,
  };
}

function TrainerBadge({ icon, label, accentColor, isDark, tokens }) {
  return (
    <View style={[styles.badge, {
      backgroundColor: isDark ? `${accentColor}14` : `${accentColor}0D`,
      borderColor: isDark ? `${accentColor}30` : `${accentColor}22`,
    }]}>
      <Ionicons name={icon} size={13} color={accentColor} />
      <Text style={[styles.badgeText, { color: tokens.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function TrainerAvatar({ photoSrc, name, accentColor, isDark, tokens }) {
  return (
    <View
      style={[
        styles.avatarRing,
        {
          borderWidth: 2,
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          padding: 0,
        },
      ]}
    >
      <View style={[styles.avatarInner, { backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF', borderColor: tokens.border }]}>
        {photoSrc ? (
          <Image source={{ uri: photoSrc }} style={styles.avatarImg} />
        ) : (
          <Text style={[styles.avatarFallback, { color: accentColor }]}>{initialsFromName(name)}</Text>
        )}
      </View>
    </View>
  );
}

function PaymentStatusRow({ paymentRateLabel, paymentStatusLabel, paymentStatusTone, isDark, tokens }) {
  const chipColors = paymentStatusChipColors(paymentStatusTone, isDark, tokens);
  return (
    <View style={styles.paymentMetaRow}>
      {paymentRateLabel ? (
        <Text style={[styles.paymentRate, { color: tokens.muted }]}>{paymentRateLabel}</Text>
      ) : null}
      {paymentStatusLabel ? (
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
      ) : null}
    </View>
  );
}

// ===== MAIN FUNCTION =====

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
  paymentButtonLabel = 'Manage Coaching Payment',
  paymentButtonShortLabel = 'Pay',
  paymentRateLabel,
  paymentStatusLabel,
  paymentStatusTone = 'neutral',
}) {
  const tokens = glass(isDark);
  const accentColor = ACCENTS[accent] || ACCENTS.purple;

  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: PRESS_IN_SCALE, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: SPRING_BOUNCINESS_OUT }).start();

  const name = String(trainer?.name || trainer?.displayName || TRAINER_NAME_DEFAULT).trim();
  const specialty = String(trainer?.specialty || trainer?.headline || SPECIALTY_DEFAULT).trim();
  const location = String(trainer?.location || LOCATION_DEFAULT).trim();
  const rating = numericRating(trainer?.rating);
  const clients = numericClients(trainer?.clients);
  const years = typeof trainer?.experienceYears === 'number' ? trainer.experienceYears : null;
  const photoSrc = trainerPhotoUri(trainer);
  const hasPayment = typeof onPressPayment === 'function';
  const showPaymentMeta = (paymentRateLabel || paymentStatusLabel) && hasPayment;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPressCard}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <View
          style={[
            styles.cardShell,
            {
              borderColor: tokens.border,
              backgroundColor: tokens.cardBackground,
            },
          ]}
        >
          <View style={styles.outer}>
            <View style={styles.row}>
              <TrainerAvatar
                photoSrc={photoSrc}
                name={name}
                accentColor={accentColor}
                isDark={isDark}
                tokens={tokens}
              />

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.titleRow}>
                  <Text style={[styles.name, { color: tokens.text }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <LinearGradient
                    colors={[`${accentColor}30`, `${accentColor}18`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.pill, { borderColor: `${accentColor}50` }]}
                  >
                    <Text style={[styles.pillText, { color: accentColor }]}>ACTIVE</Text>
                  </LinearGradient>
                </View>

                <Text style={[styles.specialty, { color: tokens.muted }]} numberOfLines={1}>
                  {specialty}
                </Text>

                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={13} color={tokens.dim} />
                  <Text style={[styles.meta, { color: tokens.dim }]} numberOfLines={1}>
                    {location}
                  </Text>
                </View>
              </View>
            </View>

            {(rating || clients || years) ? (
              <View style={styles.badgesRow}>
                {rating ? <TrainerBadge icon="star" label={`${rating.toFixed(1)} rating`} accentColor={accentColor} isDark={isDark} tokens={tokens} /> : null}
                {clients ? <TrainerBadge icon="people-outline" label={`${clients} clients`} accentColor={accentColor} isDark={isDark} tokens={tokens} /> : null}
                {years ? <TrainerBadge icon="ribbon-outline" label={`${years}+ yrs`} accentColor={accentColor} isDark={isDark} tokens={tokens} /> : null}
              </View>
            ) : null}

            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />

            <View style={styles.ctaRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPressSecondaryCTA}
                style={[styles.tertiaryBtn, {
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                }]}
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
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.primaryText} numberOfLines={1}>{ctaLabel}</Text>
                </LinearGradient>
              </TouchableOpacity>

              {hasPayment ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={onPressPayment}
                  style={[styles.tertiaryBtn, {
                    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  }]}
                >
                  <Ionicons name="card-outline" size={17} color={accentColor} />
                  <Text style={[styles.tertiaryText, { color: tokens.text }]} numberOfLines={1}>
                    {paymentButtonShortLabel}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {showPaymentMeta ? (
              <PaymentStatusRow
                paymentRateLabel={paymentRateLabel}
                paymentStatusLabel={paymentStatusLabel}
                paymentStatusTone={paymentStatusTone}
                isDark={isDark}
                tokens={tokens}
              />
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

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
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatarRing: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden' },
  avatarInner: { flex: 1, borderRadius: 36, borderWidth: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
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
  primaryText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
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
});
