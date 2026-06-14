import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { trainerPhotoUri } from '../../shared/utils/trainerProfileMedia';

const ACCENTS = {
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#64D2FF',
  orange: '#F97316',
  green: '#10B981',
};

const glass = (isDark) => ({
  bg: isDark ? 'rgba(12,10,28,0.96)' : 'rgba(255,255,255,0.97)',
  border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  text: isDark ? '#FFFFFF' : '#0A0A0F',
  muted: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.55)',
  dim: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)',
});

export default function PremiumTrainerCard({
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
  paymentRateLabel,
  paymentStatusLabel,
  paymentStatusTone = 'neutral',
}) {
  const t = glass(isDark);
  const a = ACCENTS[accent] || ACCENTS.purple;

  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 7 }).start();

  const name = String(trainer?.name || trainer?.displayName || 'Your Trainer').trim();
  const specialty = String(trainer?.specialty || trainer?.headline || 'Strength & Nutrition').trim();
  const location = String(trainer?.location || 'Remote').trim();
  const rating = typeof trainer?.rating === 'number' ? trainer.rating : trainer?.rating ? Number(trainer.rating) : null;
  const clients = typeof trainer?.clients === 'number' ? trainer.clients : trainer?.clients ? Number(trainer.clients) : null;
  const years = typeof trainer?.experienceYears === 'number' ? trainer.experienceYears : null;
  const photoSrc = trainerPhotoUri(trainer);

  const badge = (icon, label) => (
    <View style={[styles.badge, {
      backgroundColor: isDark ? `${a}14` : `${a}0D`,
      borderColor: isDark ? `${a}30` : `${a}22`,
    }]}>
      <Ionicons name={icon} size={13} color={a} />
      <Text style={[styles.badgeText, { color: t.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

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
              borderColor: t.border,
              backgroundColor: t.bg,
            },
          ]}
        >
          <View style={styles.outer}>
            <View style={styles.row}>
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
                <View style={[styles.avatarInner, { backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF', borderColor: t.border }]}>
                  {photoSrc ? (
                    <Image source={{ uri: photoSrc }} style={styles.avatarImg} />
                  ) : (
                    <Text style={[styles.avatarFallback, { color: a }]}>{name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</Text>
                  )}
                </View>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.titleRow}>
                  <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                    {name}
                  </Text>
                  <LinearGradient
                    colors={[`${a}30`, `${a}18`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.pill, { borderColor: `${a}50` }]}
                  >
                    <Text style={[styles.pillText, { color: a }]}>ACTIVE</Text>
                  </LinearGradient>
                </View>

                <Text style={[styles.specialty, { color: t.muted }]} numberOfLines={1}>
                  {specialty}
                </Text>

                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={13} color={t.dim} />
                  <Text style={[styles.meta, { color: t.dim }]} numberOfLines={1}>
                    {location}
                  </Text>
                </View>
              </View>
            </View>

            {/* Badges */}
            {(rating || clients || years) ? (
              <View style={styles.badgesRow}>
                {rating ? badge('star', `${rating.toFixed(1)} rating`) : null}
                {clients ? badge('people-outline', `${clients} clients`) : null}
                {years ? badge('ribbon-outline', `${years}+ yrs`) : null}
              </View>
            ) : null}

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} />

            {/* CTA row */}
            <View style={styles.ctaRow}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPressSecondaryCTA}
                style={[styles.secondaryBtn, {
                  borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                }]}
              >
                <Ionicons name="person-circle-outline" size={18} color={t.text} />
                <Text style={[styles.secondaryText, { color: t.text }]}>{secondaryCtaLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.9} onPress={onPressCTA} style={styles.primaryBtnWrap}>
                <LinearGradient colors={[a, '#FF6B9D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
                  <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryText}>{ctaLabel}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {typeof onPressPayment === 'function' ? (
              <>
                <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', marginTop: 14 }]} />
                {(paymentRateLabel || paymentStatusLabel) ? (
                  <View style={styles.paymentMetaRow}>
                    {paymentRateLabel ? (
                      <Text style={[styles.paymentRate, { color: t.text }]}>{paymentRateLabel}</Text>
                    ) : null}
                    {paymentStatusLabel ? (
                      <View
                        style={[
                          styles.paymentStatusChip,
                          {
                            backgroundColor:
                              paymentStatusTone === 'success'
                                ? isDark
                                  ? 'rgba(48,209,88,0.15)'
                                  : 'rgba(48,209,88,0.12)'
                                : paymentStatusTone === 'warning'
                                  ? isDark
                                    ? 'rgba(255,159,10,0.15)'
                                    : 'rgba(255,159,10,0.12)'
                                  : paymentStatusTone === 'error'
                                    ? isDark
                                      ? 'rgba(255,59,48,0.15)'
                                      : 'rgba(255,59,48,0.12)'
                                    : isDark
                                      ? 'rgba(255,255,255,0.08)'
                                      : 'rgba(0,0,0,0.06)',
                            borderColor:
                              paymentStatusTone === 'success'
                                ? 'rgba(48,209,88,0.35)'
                                : paymentStatusTone === 'warning'
                                  ? 'rgba(255,159,10,0.35)'
                                  : paymentStatusTone === 'error'
                                    ? 'rgba(255,59,48,0.35)'
                                    : isDark
                                      ? 'rgba(255,255,255,0.12)'
                                      : 'rgba(0,0,0,0.08)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.paymentStatusText,
                            {
                              color:
                                paymentStatusTone === 'success'
                                  ? ACCENTS.green
                                  : paymentStatusTone === 'warning'
                                    ? ACCENTS.orange
                                    : paymentStatusTone === 'error'
                                      ? '#FF453A'
                                      : t.muted,
                            },
                          ]}
                        >
                          {paymentStatusLabel}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={onPressPayment}
                  style={[
                    styles.paymentBtn,
                    {
                      borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    },
                  ]}
                >
                  <Ionicons name="card-outline" size={18} color={a} />
                  <Text style={[styles.paymentBtnText, { color: t.text }]}>{paymentButtonLabel}</Text>
                  <Ionicons name="chevron-forward" size={16} color={t.dim} />
                </TouchableOpacity>
              </>
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
  ctaRow: { flexDirection: 'row', gap: 10 },
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
  primaryBtnWrap: { flex: 1 },
  primaryBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  paymentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    marginBottom: 10,
  },
  paymentRate: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  paymentStatusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  paymentStatusText: { fontSize: 11, fontWeight: '800' },
  paymentBtn: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  paymentBtnText: { flex: 1, fontSize: 13, fontWeight: '900', textAlign: 'center' },
});
