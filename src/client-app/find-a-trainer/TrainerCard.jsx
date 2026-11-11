// One trainer's card in the marketplace browse list, neobrutalist redesign.
// Flow: pull display fields off the trainer object → avatar, name, rating, bio, price → View Profile / Message / Connect.
// Used by: the find-a-trainer browse list. `trainer._firebase` is the raw Firestore doc for fields the list projection omits.
//
// vocab: neobrutalist = thick 2.5px borders, hard 4/4 shadows (no blur), gradient reserved for primary CTA

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  gradGradient,
  trainerFirstName,
  getTrainerPrice,
} from './trainerFilters';
import { trainerPhotoUri } from '../../helpers/trainerProfilePhoto';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbPill from '../../look-and-feel/NbPill';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const STAR_COUNT = 5;
const SPECIALTY_FALLBACK = 'General Fitness';
const UNRATED_LABEL = 'New';
const RATE_ON_REQUEST_LABEL = 'Rate on request';
const STAR_FILLED = 'star';
const STAR_EMPTY = 'star-outline';
const MODE_ICON_REMOTE = 'videocam-outline';
const MODE_ICON_IN_PERSON = 'location-outline';
const MODE_ICON_HYBRID = 'git-network-outline';

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
 * Manipulate here: star color is #FB923C (brand orange) for rated trainers
 */
function RatingRow({ rating, reviewCount, years, mutedColor }) {
  const starIndexes = Array.from({ length: STAR_COUNT }, (_, index) => index + 1);
  const starColor = rating != null ? '#FB923C' : mutedColor;
  
  return (
    <View style={styles.ratingRow}>
      {starIndexes.map((starIndex) => (
        <Ionicons
          key={starIndex}
          name={starIconName(starIndex, rating)}
          size={13}
          color={starColor}
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
 * Neobrutalist redesign: uses NbCard, NbAvatar, NbPill, NbButton.
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
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const fields = readTrainerCardFields(trainer);
  const mutedColor = colors.nbMuted;

  return (
    <NbCard style={styles.card}>
      <View style={styles.cardBody}>
        {/* Avatar with availability dot */}
        <View style={styles.photoWrap}>
          <NbAvatar
            source={fields.photoUri}
            initials={trainer.initials}
            size={72}
          />
          {trainer.available && (
            <View style={[styles.onlineDot, { borderColor: colors.nbSurface }]}>
              <View style={styles.onlineDotInner} />
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={[styles.trainerName, { color: colors.nbInk }]} numberOfLines={1}>
          {trainer.name}
        </Text>

        {/* Verified badge */}
        {trainer.verified === true && (
          <View style={styles.verifiedRow}>
            <Ionicons name="shield-checkmark" size={13} color="#22C55E" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}

        {/* Specialty pill */}
        <View style={styles.pillWrap}>
          <NbPill variant="energy">{fields.specialty}</NbPill>
        </View>

        {/* Rating stars */}
        <RatingRow
          rating={fields.rating}
          reviewCount={fields.reviewCount}
          years={fields.years}
          mutedColor={mutedColor}
        />

        {/* Bio */}
        <Text style={[styles.bio, { color: mutedColor }]} numberOfLines={3}>
          {trainer.bio}
        </Text>

        {/* Location + mode metadata */}
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={mutedColor} />
          <Text style={[styles.metaText, { color: mutedColor }]} numberOfLines={1}>
            {trainer.location}
          </Text>
          <Text style={[styles.metaDot, { color: mutedColor }]}>·</Text>
          <Ionicons name={trainingModeIcon(trainer.mode)} size={12} color={mutedColor} />
          <Text style={[styles.metaText, { color: mutedColor }]}>{trainer.mode}</Text>
        </View>

        {/* Price */}
        <Text style={[styles.priceLine, { color: colors.nbInk }]}>
          {fields.showPrice ? (
            <>
              <Text style={[styles.priceAmount, { color: '#FB923C' }]}>${fields.price}</Text>
              <Text style={{ color: mutedColor, fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}> /mo</Text>
            </>
          ) : (
            <Text style={{ color: mutedColor, fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}>
              {RATE_ON_REQUEST_LABEL}
            </Text>
          )}
        </Text>

        {/* Primary CTA: View Profile */}
        <View style={styles.ctaWrap}>
          <NbButton variant="brand" onPress={() => onViewProfile(trainer)}>
            View Profile
          </NbButton>
        </View>

        {/* Secondary actions */}
        <View style={styles.secondaryRow}>
          <NbButton variant="plain" sm onPress={() => onMessage(trainer)}>
            Message
          </NbButton>
          <NbButton variant="ink" sm onPress={() => onConnect(trainer)}>
            Connect
          </NbButton>
        </View>
      </View>
    </NbCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
  },
  cardBody: { 
    padding: 14, 
    alignItems: 'center',
    gap: 8,
  },
  photoWrap: { 
    marginBottom: 4, 
    position: 'relative',
  },
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
  onlineDotInner: { 
    width: 8, 
    height: 8, 
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  trainerName: { 
    fontSize: 18, 
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#22C55E',
  },
  pillWrap: {
    marginTop: 4,
  },
  ratingRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 3, 
    marginTop: 4,
  },
  ratingText: { 
    fontSize: 11, 
    fontFamily: 'Inter_500Medium',
    marginLeft: 4,
  },
  bio: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 6,
    minHeight: 57,
  },
  metaRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 4, 
    marginTop: 6, 
    flexWrap: 'wrap', 
    justifyContent: 'center',
  },
  metaText: { 
    fontSize: 11, 
    fontFamily: 'Inter_500Medium',
    maxWidth: 110,
  },
  metaDot: { fontSize: 11 },
  priceLine: { 
    marginTop: 8, 
    textAlign: 'center',
  },
  priceAmount: { 
    fontSize: 24, 
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  ctaWrap: { 
    width: '100%', 
    marginTop: 10,
  },
  secondaryRow: { 
    flexDirection: 'row', 
    gap: 10, 
    marginTop: 8,
    width: '100%',
  },
});
