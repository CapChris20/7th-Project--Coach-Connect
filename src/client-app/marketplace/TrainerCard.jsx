// One trainer's card in the marketplace browse list.
// Flow: read display fields off the trainer object (with fallbacks) → render avatar, name, rating,
// bio, price → three actions: View Profile (primary), Message, Connect.
// Note: `trainer` is a display-shaped object; `trainer._firebase` is the raw Firestore doc, which is
// where some fields (price, review count) still live.
import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  gradGradient,
  trainerFirstName,
  getTrainerPrice,
  MP_FONT,
} from './marketplaceFilters';
import { trainerPhotoUri } from '../../helpers/getTrainerProfileMedia';

// Manipulate here: the pink→orange gradient used for BOTH the top accent bar and the primary CTA,
// so they always match. Change it once here.
const CTA_GRADIENT = ['#BE185D', '#C2410C'];

// Maps a free-text training mode ("Remote", "In person", "Hybrid") to an icon. Substring matching
// rather than exact equality because this text is trainer-authored and inconsistently capitalized.
// Manipulate here: the network icon is the catch-all, which is what "Hybrid"/unknown modes get.
function modeIcon(mode) {
  const m = String(mode || '').toLowerCase();
  if (m.includes('remote')) return 'videocam-outline';
  if (m.includes('person')) return 'location-outline';
  return 'git-network-outline';
}

export default function TrainerCard({ trainer, t, isDark = true, onMessage, onConnect, onViewProfile }) {
  const firstName = trainerFirstName(trainer.name);
  // Gradient colors for the initials avatar, derived from the trainer's assigned `grad` key — that's
  // how each trainer gets a stable, distinct color instead of a random one per render.
  const avatarColors = gradGradient(trainer.grad);
  const photoUri = trainer.photoURL || trainerPhotoUri(trainer._firebase);
  // Several fields are read with a "display value, else raw Firestore value" fallback chain, because
  // the marketplace list projection doesn't always carry every field.
  // vocab/symbol: ?? falls back only on null/undefined, so a legitimate 0 rating survives.
  const price = getTrainerPrice(trainer._firebase) ?? trainer.price;
  // A price of 0 is treated as "not set" rather than "free" — that's the deliberate product call
  // behind checking > 0 instead of just != null.
  const showPrice = price != null && Number(price) > 0;
  // Only the FIRST specialty is shown; the card has one line for it. Full list is on the profile.
  // Manipulate here: 'General Fitness' is the fallback for trainers who set no specialty.
  const specialty = trainer.specialties?.[0] || 'General Fitness';
  const years = trainer.years ?? 0;
  const reviewCount = trainer.reviewCount ?? trainer._firebase?.reviewCount ?? 0;
  // rating stays NULL (not 0) when unrated, because the star row below uses null to mean "New"
  // rather than drawing zero stars.
  const rating = trainer.rating ?? trainer._firebase?.averageRating ?? null;
  const cardBg = isDark ? '#14141C' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)';
  const muted = t.mutedForeground;

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: cardBg,
          borderColor: border,
        },
      ]}
    >
      <LinearGradient colors={CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.accentBar} />

      <View style={s.cardBody}>
        <View style={s.photoWrap}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.avatarImg} />
          ) : (
            <LinearGradient colors={avatarColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarFallback}>
              <Text style={s.avatarMdText}>{trainer.initials}</Text>
            </LinearGradient>
          )}
          {trainer.available ? (
            <View style={[s.onlineDot, { borderColor: cardBg }]}>
              <View style={[s.onlineDotInner, { backgroundColor: '#22C55E' }]} />
            </View>
          ) : null}
        </View>

        <Text style={[s.trainerName, { color: t.foreground }]} numberOfLines={1}>
          {trainer.name}
        </Text>
        {trainer.verified === true ? (
          <View style={s.verifiedRow}>
            <Ionicons name="shield-checkmark" size={13} color="#22C55E" />
            <Text style={s.verifiedText}>Verified</Text>
          </View>
        ) : null}
        <Text style={[s.specialty, { color: '#FDBA74' }]} numberOfLines={1}>
          {specialty}
        </Text>

        <View style={s.ratingRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Ionicons
              key={i}
              name={rating != null && i <= Math.round(rating) ? 'star' : 'star-outline'}
              size={13}
              color={rating != null ? '#FDBA74' : muted}
            />
          ))}
          <Text style={[s.ratingText, { color: muted }]}>
            {rating != null ? `${Number(rating).toFixed(1)}` : 'New'}
            {reviewCount > 0 ? ` · ${reviewCount} reviews` : years > 0 ? ` · ${years} yrs` : ''}
          </Text>
        </View>

        <Text style={[s.bio, { color: muted }]} numberOfLines={3}>
          {trainer.bio}
        </Text>

        <View style={s.metaRow}>
          <Ionicons name="location-outline" size={12} color={muted} />
          <Text style={[s.metaText, { color: muted }]} numberOfLines={1}>
            {trainer.location}
          </Text>
          <Text style={[s.metaDot, { color: muted }]}>·</Text>
          <Ionicons name={modeIcon(trainer.mode)} size={12} color={muted} />
          <Text style={[s.metaText, { color: muted }]}>{trainer.mode}</Text>
        </View>

        <Text style={[s.priceLine, { color: t.foreground }]}>
          {showPrice ? (
            <>
              <Text style={s.priceAmount}>${price}</Text>
              <Text style={{ color: muted, fontSize: 13, fontWeight: '600' }}> /mo</Text>
            </>
          ) : (
            <Text style={{ color: muted, fontSize: 14, fontWeight: '600' }}>Rate on request</Text>
          )}
        </Text>

        <Pressable onPress={() => onViewProfile(trainer)} style={({ pressed }) => [s.ctaHit, pressed && { opacity: 0.9 }]}>
          <LinearGradient colors={CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaBtn}>
            <Text style={s.ctaText}>View Profile</Text>
          </LinearGradient>
        </Pressable>

        <View style={s.secondaryRow}>
          <Pressable onPress={() => onMessage(trainer)} style={s.secondaryBtn}>
            <Ionicons name="chatbubble-outline" size={15} color={t.foreground} />
            <Text style={[s.secondaryText, { color: t.foreground }]}>Message</Text>
          </Pressable>
          <Pressable onPress={() => onConnect(trainer)} style={s.secondaryBtn}>
            <Ionicons name="flash-outline" size={15} color="#FDBA74" />
            <Text style={[s.secondaryText, { color: '#FDBA74' }]}>Connect</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
  },
  accentBar: { height: 3, width: '100%' },
  cardBody: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, alignItems: 'center' },
  photoWrap: { marginBottom: 12, position: 'relative' },
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMdText: { color: '#fff', fontWeight: '800', fontSize: 22 },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDotInner: { width: 8, height: 8, borderRadius: 4 },
  trainerName: { fontSize: 20, fontFamily: MP_FONT.displayBold, textAlign: 'center' },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontFamily: MP_FONT.bodySemi,
    color: '#22C55E',
  },
  specialty: { fontSize: 13, fontFamily: MP_FONT.bodySemi, marginTop: 4, textAlign: 'center' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8 },
  ratingText: { fontSize: 11, fontFamily: MP_FONT.bodyMedium, marginLeft: 4 },
  bio: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: MP_FONT.body,
    textAlign: 'center',
    marginTop: 10,
    minHeight: 57,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  metaText: { fontSize: 11, fontFamily: MP_FONT.bodyMedium, maxWidth: 110 },
  metaDot: { fontSize: 11 },
  priceLine: { marginTop: 12, textAlign: 'center' },
  priceAmount: { fontSize: 24, fontFamily: MP_FONT.displayBold, color: '#FDBA74' },
  ctaHit: { width: '100%', marginTop: 14 },
  ctaBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontFamily: MP_FONT.bodyBold },
  secondaryRow: { flexDirection: 'row', gap: 20, marginTop: 12 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  secondaryText: { fontSize: 13, fontFamily: MP_FONT.bodySemi },
});
