/**
 * Trainer Card
 *
 * Purpose: UI screen or component: Trainer Card. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/marketplace
 * Key exports: TrainerCard
 *
 * @file-header
 */
import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  BRAND,
  gradGradient,
  trainerFirstName,
  getTrainerPrice,
  MP_FONT,
} from '../marketplaceFilters';
import { GlassCard, PrimaryButton, SecondaryButton, VerifiedBadge, GradientText } from './MarketplaceUI';
import { trainerPhotoUri } from '../../../shared-utils/getTrainerProfileMedia';

function modeIcon(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('remote')) return 'videocam-outline';
  if (m.includes('person')) return 'location-outline';
  return 'git-network-outline';
}

export default function TrainerCard({ trainer, t, isDark = true, onMessage, onConnect, onViewProfile }) {
  const firstName = trainerFirstName(trainer.name);
  const avatarColors = gradGradient(trainer.grad);
  const photoUri = trainer.photoURL || trainerPhotoUri(trainer._firebase);
  const price = getTrainerPrice(trainer._firebase) ?? trainer.price;
  const showPrice = price != null && Number(price) > 0;
  const years = trainer.years ?? 0;

  return (
    <GlassCard t={t} isDark={isDark} interactive contentStyle={s.cardGap}>
      <View style={s.cardHeader}>
        <View>
          {photoUri ? (
            <LinearGradient colors={avatarColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarRing}>
              <Image source={{ uri: photoUri }} style={s.avatarImg} />
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={avatarColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.avatarBox}
            >
              <Text style={s.avatarMdText}>{trainer.initials}</Text>
            </LinearGradient>
          )}
          {trainer.available ? (
            <View style={[s.onlineDot, { backgroundColor: t.background, borderColor: t.card }]}>
              <View style={[s.onlineDotInner, { backgroundColor: BRAND.cyan }]} />
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          <View style={s.nameRow}>
            <Text style={[s.trainerName, { color: t.foreground }]} numberOfLines={1}>
              {trainer.name}
            </Text>
            {trainer.verified !== false ? <VerifiedBadge /> : null}
          </View>
          <View style={s.metaRow}>
            <Ionicons name="location-outline" size={12} color={t.mutedForeground} />
            <Text style={[s.metaText, { color: t.mutedForeground }]} numberOfLines={1}>
              {trainer.location}
            </Text>
            <Text style={[s.metaDot, { color: t.mutedForeground }]}>•</Text>
            <Ionicons name={modeIcon(trainer.mode)} size={12} color={t.mutedForeground} />
            <Text style={[s.metaText, { color: t.mutedForeground }]}>{trainer.mode}</Text>
          </View>
        </View>
      </View>

      <View style={s.specWrap}>
        {trainer.specialties.map((spec) => (
          <View
            key={spec}
            style={[
              s.specPill,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : t.border,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : t.muted,
              },
            ]}
          >
            <Text style={{ color: t.foreground, fontSize: 12, fontFamily: MP_FONT.bodySemi }}>{spec}</Text>
          </View>
        ))}
      </View>

      <View style={[s.priceRow, { borderTopColor: t.border }]}>
        <View>
          <Text style={[s.fromLabel, { color: t.mutedForeground }]}>FROM</Text>
          {showPrice ? (
            <View style={s.priceLine}>
              <GradientText style={s.priceAmount}>${price}</GradientText>
              <Text style={{ color: t.mutedForeground, fontSize: 14, fontWeight: '600' }}>/mo</Text>
            </View>
          ) : (
            <Text style={{ color: t.mutedForeground, fontSize: 14, marginTop: 4, fontWeight: '600' }}>
              Rate on request
            </Text>
          )}
        </View>
        {years > 0 ? (
          <Text style={[s.yearsText, { color: t.mutedForeground }]}>{years} yrs coaching</Text>
        ) : null}
      </View>

      <View style={s.cardBtns}>
        <SecondaryButton
          onPress={() => onMessage(trainer)}
          style={{ flex: 1 }}
          textColor={t.foreground}
          icon="chatbubble-outline"
          isDark={isDark}
        >
          Message
        </SecondaryButton>
        <PrimaryButton onPress={() => onConnect(trainer)} style={{ flex: 1.05 }} icon="flash-outline">
          Connect with {firstName}
        </PrimaryButton>
      </View>

      <Pressable onPress={() => onViewProfile(trainer)} style={s.viewProfileHit}>
        <Text style={[s.viewProfile, { color: t.mutedForeground }]}>View full profile</Text>
      </Pressable>
    </GlassCard>
  );
}

const s = StyleSheet.create({
  cardGap: { gap: 16 },
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  avatarBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 58,
    height: 58,
    borderRadius: 18,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 54, height: 54, borderRadius: 16 },
  avatarMdText: { color: '#fff', fontWeight: '800', fontSize: 18 },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDotInner: { width: 10, height: 10, borderRadius: 5 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  trainerName: { fontSize: 19, fontFamily: MP_FONT.displayBold, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  metaText: { fontSize: 12, fontFamily: MP_FONT.bodyMedium, maxWidth: 120 },
  metaDot: { fontSize: 12, marginHorizontal: 2 },
  specWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  specPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 14,
    borderTopWidth: 1,
  },
  fromLabel: {
    fontSize: 10,
    fontFamily: MP_FONT.bodyBold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2, gap: 2 },
  priceAmount: { fontSize: 26, fontFamily: MP_FONT.displayBold },
  yearsText: { fontSize: 12, fontFamily: MP_FONT.bodySemi },
  cardBtns: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  viewProfileHit: { alignItems: 'center', paddingTop: 2 },
  viewProfile: { fontSize: 12, fontWeight: '600' },
});
