// One trainer's card in the marketplace browse list.
// Flow: pull display fields off the trainer object → avatar, name, rating, bio, price → View Profile / Message / Connect.
// Used by: the find-a-trainer browse list. `trainer._firebase` is the raw Firestore doc for fields the list projection omits.

import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  gradGradient,
  trainerFirstName,
  getTrainerPrice,
  MP_FONT,
} from './trainerFilters';
import { trainerPhotoUri } from '../../helpers/trainerProfilePhoto';

// ===== NAMED CONSTANTS =====

// Manipulate here: pink→orange used for BOTH the top accent bar and the primary CTA so they always match.
const CTA_GRADIENT = ['#BE185D', '#C2410C'];
const ONLINE_DOT_COLOR = '#22C55E';
const STAR_COUNT = 5;
const SPECIALTY_FALLBACK = 'General Fitness';
const UNRATED_LABEL = 'New';
const RATE_ON_REQUEST_LABEL = 'Rate on request';
const STAR_FILLED = 'star';
const STAR_EMPTY = 'star-outline';
const MODE_ICON_REMOTE = 'videocam-outline';
const MODE_ICON_IN_PERSON = 'location-outline';
const MODE_ICON_HYBRID = 'git-network-outline';
const CARD_BG_DARK = '#14141C';
const CARD_BG_LIGHT = '#FFFFFF';
const BORDER_DARK = 'rgba(255,255,255,0.10)';
const BORDER_LIGHT = 'rgba(10,10,15,0.08)';
const SPECIALTY_COLOR = '#FDBA74';
const STAR_ACTIVE_COLOR = '#FDBA74';
const CONNECT_COLOR = '#FDBA74';
const VERIFIED_COLOR = '#22C55E';
const PRICE_AMOUNT_COLOR = '#FDBA74';
const GRADIENT_LEFT = { x: 0, y: 0 };
const GRADIENT_RIGHT = { x: 1, y: 0 };
const GRADIENT_DIAGONAL = { x: 1, y: 1 };

// ===== HELPER FUNCTIONS =====

/**
 * Maps a trainer-authored training mode string to an icon.
 * Substring matching (not exact equality) because this text is inconsistently capitalized.
 * @param {string} mode
 * @returns {string}
 */
function trainingModeIcon(mode) {
  const modeText = String(mode || '').toLowerCase();
  if (modeText.includes('remote')) return MODE_ICON_REMOTE;
  if (modeText.includes('person')) return MODE_ICON_IN_PERSON;
  // Manipulate here: hybrid / unknown modes share the network icon.
  return MODE_ICON_HYBRID;
}

/**
 * Dark vs light paint for the card chrome. Theme tokens (`theme.foreground`) still come from the parent.
 * @param {boolean} isDark
 */
function trainerCardChrome(isDark) {
  return {
    cardBackground: isDark ? CARD_BG_DARK : CARD_BG_LIGHT,
    borderColor: isDark ? BORDER_DARK : BORDER_LIGHT,
  };
}

/**
 * Caption after the stars: rating, else "New", then reviews or years if present.
 * Reviews win over years when both exist — the card has one slot for that extra bit.
 * @param {number|null} rating
 * @param {number} reviewCount
 * @param {number} years
 * @returns {string}
 */
function ratingCaption(rating, reviewCount, years) {
  const ratingText = rating != null ? `${Number(rating).toFixed(1)}` : UNRATED_LABEL;
  if (reviewCount > 0) return `${ratingText} · ${reviewCount} reviews`;
  if (years > 0) return `${ratingText} · ${years} yrs`;
  return ratingText;
}

/**
 * Filled star when this index is at or under the rounded rating. Unrated trainers get outlines.
 * @param {number} starIndex
 * @param {number|null} rating
 * @returns {string}
 */
function starIconName(starIndex, rating) {
  const isFilled = rating != null && starIndex <= Math.round(rating);
  return isFilled ? STAR_FILLED : STAR_EMPTY;
}

/**
 * Display fields with "list projection, else raw Firestore" fallbacks.
 * vocab/symbol: ?? falls back only on null/undefined, so a legitimate 0 rating or 0 years survives.
 * @param {object} trainer
 */
function readTrainerCardFields(trainer) {
  const photoUri = trainer.photoURL || trainerPhotoUri(trainer._firebase);
  // vocab: getTrainerPrice reads the billed monthly rate off the raw Firebase doc first.
  const price = getTrainerPrice(trainer._firebase) ?? trainer.price;
  // A price of 0 is treated as "not set" rather than "free".
  const showPrice = price != null && Number(price) > 0;
  const specialty = trainer.specialties?.[0] || SPECIALTY_FALLBACK;
  const years = trainer.years ?? 0;
  const reviewCount = trainer.reviewCount ?? trainer._firebase?.reviewCount ?? 0;
  // rating stays NULL (not 0) when unrated — the star row uses null to mean "New".
  const rating = trainer.rating ?? trainer._firebase?.averageRating ?? null;
  return {
    firstName: trainerFirstName(trainer.name),
    avatarColors: gradGradient(trainer.grad),
    photoUri,
    price,
    showPrice,
    specialty,
    years,
    reviewCount,
    rating,
  };
}

/**
 * Star row + caption. Built here so the JSX below stays a list of card sections.
 */
function RatingRow({ rating, reviewCount, years, mutedColor }) {
  const starIndexes = Array.from({ length: STAR_COUNT }, (_, index) => index + 1);
  return (
    <View style={styles.ratingRow}>
      {starIndexes.map((starIndex) => (
        <Ionicons
          key={starIndex}
          name={starIconName(starIndex, rating)}
          size={13}
          color={rating != null ? STAR_ACTIVE_COLOR : mutedColor}
        />
      ))}
      <Text style={[styles.ratingText, { color: mutedColor }]}>
        {ratingCaption(rating, reviewCount, years)}
      </Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Marketplace card for one trainer: photo, rating, bio, monthly price, and the three actions.
 * @param {{ trainer: object, t: object, isDark?: boolean, onMessage: Function, onConnect: Function, onViewProfile: Function }} props
 */
export default function TrainerCard({
  trainer,
  t: theme,
  isDark = true,
  onMessage,
  onConnect,
  onViewProfile,
}) {
  const fields = readTrainerCardFields(trainer);
  const chrome = trainerCardChrome(isDark);
  const mutedColor = theme.mutedForeground;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: chrome.cardBackground,
          borderColor: chrome.borderColor,
        },
      ]}
    >
      <LinearGradient
        colors={CTA_GRADIENT}
        start={GRADIENT_LEFT}
        end={GRADIENT_RIGHT}
        style={styles.accentBar}
      />

      <View style={styles.cardBody}>
        <View style={styles.photoWrap}>
          {fields.photoUri ? (
            <Image source={{ uri: fields.photoUri }} style={styles.avatarImg} />
          ) : (
            <LinearGradient
              colors={fields.avatarColors}
              start={GRADIENT_LEFT}
              end={GRADIENT_DIAGONAL}
              style={styles.avatarFallback}
            >
              <Text style={styles.avatarMdText}>{trainer.initials}</Text>
            </LinearGradient>
          )}
          {trainer.available ? (
            <View style={[styles.onlineDot, { borderColor: chrome.cardBackground }]}>
              <View style={[styles.onlineDotInner, { backgroundColor: ONLINE_DOT_COLOR }]} />
            </View>
          ) : null}
        </View>

        <Text style={[styles.trainerName, { color: theme.foreground }]} numberOfLines={1}>
          {trainer.name}
        </Text>
        {trainer.verified === true ? (
          <View style={styles.verifiedRow}>
            <Ionicons name="shield-checkmark" size={13} color={VERIFIED_COLOR} />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        ) : null}
        <Text style={[styles.specialty, { color: SPECIALTY_COLOR }]} numberOfLines={1}>
          {fields.specialty}
        </Text>

        <RatingRow
          rating={fields.rating}
          reviewCount={fields.reviewCount}
          years={fields.years}
          mutedColor={mutedColor}
        />

        <Text style={[styles.bio, { color: mutedColor }]} numberOfLines={3}>
          {trainer.bio}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={mutedColor} />
          <Text style={[styles.metaText, { color: mutedColor }]} numberOfLines={1}>
            {trainer.location}
          </Text>
          <Text style={[styles.metaDot, { color: mutedColor }]}>·</Text>
          <Ionicons name={trainingModeIcon(trainer.mode)} size={12} color={mutedColor} />
          <Text style={[styles.metaText, { color: mutedColor }]}>{trainer.mode}</Text>
        </View>

        <Text style={[styles.priceLine, { color: theme.foreground }]}>
          {fields.showPrice ? (
            <>
              <Text style={styles.priceAmount}>${fields.price}</Text>
              <Text style={{ color: mutedColor, fontSize: 13, fontWeight: '600' }}> /mo</Text>
            </>
          ) : (
            <Text style={{ color: mutedColor, fontSize: 14, fontWeight: '600' }}>
              {RATE_ON_REQUEST_LABEL}
            </Text>
          )}
        </Text>

        <Pressable
          onPress={() => onViewProfile(trainer)}
          style={({ pressed }) => [styles.ctaHit, pressed && { opacity: 0.9 }]}
        >
          <LinearGradient
            colors={CTA_GRADIENT}
            start={GRADIENT_LEFT}
            end={GRADIENT_RIGHT}
            style={styles.ctaBtn}
          >
            <Text style={styles.ctaText}>View Profile</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable onPress={() => onMessage(trainer)} style={styles.secondaryBtn}>
            <Ionicons name="chatbubble-outline" size={15} color={theme.foreground} />
            <Text style={[styles.secondaryText, { color: theme.foreground }]}>Message</Text>
          </Pressable>
          <Pressable onPress={() => onConnect(trainer)} style={styles.secondaryBtn}>
            <Ionicons name="flash-outline" size={15} color={CONNECT_COLOR} />
            <Text style={[styles.secondaryText, { color: CONNECT_COLOR }]}>Connect</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: VERIFIED_COLOR,
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
  priceAmount: { fontSize: 24, fontFamily: MP_FONT.displayBold, color: PRICE_AMOUNT_COLOR },
  ctaHit: { width: '100%', marginTop: 14 },
  ctaBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 15, fontFamily: MP_FONT.bodyBold },
  secondaryRow: { flexDirection: 'row', gap: 20, marginTop: 12 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  secondaryText: { fontSize: 13, fontFamily: MP_FONT.bodySemi },
});
