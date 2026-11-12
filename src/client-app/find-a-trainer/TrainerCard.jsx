// One trainer row in the Find-a-Trainer list — Design Law HardShadow card (PNG 03).
// Flow: read display fields → avatar + name/verified + availability → specialty pills → price + View profile.
// Used by BrowseTrainersScreen. `trainer._firebase` is the raw Firestore doc for fields the list projection omits.
//
// vocab: HardShadow = solid offset shadow sibling (no blur); nbFill = primary black/white block

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  gradGradient,
  getTrainerPrice,
} from './trainerFilters';
import { trainerPhotoUri } from '../../helpers/trainerProfilePhoto';
import HardShadow from '../../look-and-feel/HardShadow';
import NbAvatar from '../../look-and-feel/NbAvatar';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const RATE_ON_REQUEST_LABEL = 'Rate on request';
const AVAILABLE_LABEL = 'Available';
const WAITLIST_LABEL = 'Waitlist';
const MAX_SPECIALTY_PILLS = 3;
// Manipulate here: years caption when the trainer has coaching experience on file
const YEARS_SUFFIX = 'yrs coaching';

// ===== HELPER FUNCTIONS =====

/**
 * Display fields with "list projection, else raw Firestore" fallbacks.
 * vocab/symbol: ?? falls back only on null/undefined, so a legitimate 0 price survives the first check.
 * @param {object} trainer
 */
function readTrainerCardFields(trainer) {
  const photoUri = trainer.photoURL || trainerPhotoUri(trainer._firebase);
  const price = getTrainerPrice(trainer._firebase) ?? trainer.price;
  const showPrice = price != null && Number(price) > 0;
  const years = trainer.years ?? 0;
  const specialties = Array.isArray(trainer.specialties) ? trainer.specialties : [];
  return {
    photoUri,
    price,
    showPrice,
    years,
    specialties: specialties.slice(0, MAX_SPECIALTY_PILLS),
    avatarColors: gradGradient(trainer.grad) || accentGradients[0],
  };
}

/**
 * Location · N yrs coaching — matches the muted subtitle under the name in PNG 03.
 * @param {string} location
 * @param {number} years
 * @returns {string}
 */
function locationYearsLine(location, years) {
  const place = String(location || '').trim() || 'Location TBD';
  if (years > 0) return `${place} · ${years} ${YEARS_SUFFIX}`;
  return place;
}

/**
 * Compact verified tick — solid fill circle + check (never green).
 */
function VerifiedTick({ colors }) {
  return (
    <View style={[styles.verifiedTick, { backgroundColor: colors.nbFill, borderColor: colors.nbBorder }]}>
      <Ionicons name="checkmark" size={10} color={colors.nbOnFill} />
    </View>
  );
}

/**
 * Available = brand gradient pill; Waitlist = plain outlined pill (PNG 03).
 */
function AvailabilityBadge({ available, colors }) {
  if (available) {
    return (
      <LinearGradient
        colors={accentGradients[0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.statusPill, { borderColor: colors.nbBorder }]}
      >
        <Text style={[styles.statusPillText, { color: colors.nbInk }]}>{AVAILABLE_LABEL}</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={[styles.statusPill, styles.statusPillPlain, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
      <Text style={[styles.statusPillText, { color: colors.nbInk }]}>{WAITLIST_LABEL}</Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Marketplace card for one trainer — horizontal identity row, specialty pills, price footer.
 * Tap anywhere (or View profile) opens the profile sheet via onViewProfile.
 * @param {{ trainer: object, onViewProfile: Function, onMessage?: Function, onConnect?: Function }} props
 */
export default function TrainerCard({
  trainer,
  onViewProfile,
  // BrowseTrainers still passes these; Message / Connect live on the profile sheet (PNG).
  onMessage: _onMessage,
  onConnect: _onConnect,
}) {
  const { colors } = useTheme();
  const fields = readTrainerCardFields(trainer);

  const openProfile = () => onViewProfile?.(trainer);

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.cardWrap}>
      <Pressable
        onPress={openProfile}
        accessibilityRole="button"
        accessibilityLabel={`View profile for ${trainer.name}`}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: colors.nbSurface,
            borderColor: colors.nbBorder,
            opacity: pressed ? 0.96 : 1,
          },
        ]}
      >
        {/* Identity row: avatar | name + meta | availability */}
        <View style={styles.topRow}>
          <NbAvatar
            source={fields.photoUri}
            initials={trainer.initials}
            size={48}
          />
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.trainerName, { color: colors.nbInk }]} numberOfLines={1}>
                {trainer.name}
              </Text>
              {trainer.verified === true ? <VerifiedTick colors={colors} /> : null}
            </View>
            <Text style={[styles.metaLine, { color: colors.nbMuted }]} numberOfLines={1}>
              {locationYearsLine(trainer.location, fields.years)}
            </Text>
          </View>
          <AvailabilityBadge available={trainer.available !== false} colors={colors} />
        </View>

        {/* Specialty pills — plain outlined (accent reserved for Available / avatar) */}
        {fields.specialties.length > 0 ? (
          <View style={styles.pillRow}>
            {fields.specialties.map((spec) => (
              <View
                key={spec}
                style={[styles.specPill, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}
              >
                <Text style={[styles.specPillText, { color: colors.nbInk }]} numberOfLines={1}>
                  {spec}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Footer: price left, View profile right */}
        <View style={[styles.footer, { borderTopColor: colors.nbBorder }]}>
          <Text style={[styles.priceText, { color: colors.nbInk }]} numberOfLines={1}>
            {fields.showPrice ? (
              <>
                ${fields.price}
                <Text style={[styles.priceSuffix, { color: colors.nbMuted }]}> / mo</Text>
              </>
            ) : (
              RATE_ON_REQUEST_LABEL
            )}
          </Text>
          <View style={styles.viewProfileRow}>
            <Text style={[styles.viewProfileText, { color: colors.nbInk }]}>View profile</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.nbInk} />
          </View>
        </View>
      </Pressable>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    marginBottom: spacing.md,
  },
  card: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
  },
  nameBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trainerName: {
    flexShrink: 1,
    fontSize: 17,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.2,
  },
  verifiedTick: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLine: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
  statusPill: {
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  statusPillPlain: {},
  statusPillText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specPill: {
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  specPillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: spacing.sm + 4,
    marginTop: 2,
    gap: spacing.sm,
  },
  priceText: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    flexShrink: 1,
  },
  priceSuffix: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  viewProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewProfileText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});
