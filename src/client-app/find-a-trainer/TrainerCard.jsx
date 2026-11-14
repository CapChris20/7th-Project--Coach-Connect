// One trainer row in the Find-a-Trainer list — Design Law HardShadow card (PNG 03).
// Flow: read display fields → avatar + name/verified + availability → specialty pills → price + View profile.
// Used by BrowseTrainersScreen. `trainer._firebase` is the raw Firestore doc for fields the list projection omits.

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
const LOCATION_FALLBACK = 'Location TBD';
const VIEW_PROFILE_LABEL = 'View profile';
const MAX_SPECIALTY_PILLS = 3;
const PRESSED_CARD_OPACITY = 0.96;
const YEARS_SUFFIX = 'yrs coaching';
const AVATAR_SIZE = 48;
const VERIFIED_ICON_SIZE = 10;
const CHEVRON_ICON_SIZE = 16;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

// ===== HELPER FUNCTIONS =====

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  maybeFunction(...args);
}

function specialtyListFromTrainer(trainer) {
  if (Array.isArray(trainer.specialties)) {
    return trainer.specialties;
  }
  return [];
}

function firstSpecialtyPills(allSpecialties) {
  const pills = [];
  const pillCount = Math.min(allSpecialties.length, MAX_SPECIALTY_PILLS);
  for (let index = 0; index < pillCount; index += 1) {
    pills.push(allSpecialties[index]);
  }
  return pills;
}

function avatarGradientForTrainer(gradKey) {
  const fromGrad = gradGradient(gradKey);
  if (fromGrad) {
    return fromGrad;
  }
  return accentGradients[0];
}

function monthlyRateFromTrainer(trainer) {
  const firestoreTrainer = trainer._firebase;
  const priceFromFirestore = getTrainerPrice(firestoreTrainer);
  if (priceFromFirestore != null) {
    return priceFromFirestore;
  }
  return trainer.price;
}

function shouldShowMonthlyPrice(monthlyRate) {
  if (monthlyRate == null) {
    return false;
  }
  const rateAsNumber = Number(monthlyRate);
  if (rateAsNumber > 0) {
    return true;
  }
  return false;
}

function readTrainerCardFields(trainer) {
  const firestoreTrainer = trainer._firebase;
  const photoFromList = trainer.photoURL;
  let photoUri = photoFromList;
  if (!photoUri) {
    photoUri = trainerPhotoUri(firestoreTrainer);
  }

  const monthlyRate = monthlyRateFromTrainer(trainer);
  const showMonthlyPrice = shouldShowMonthlyPrice(monthlyRate);
  const yearsCoaching = trainer.years;
  let yearsValue = 0;
  if (yearsCoaching != null) {
    yearsValue = yearsCoaching;
  }

  const allSpecialties = specialtyListFromTrainer(trainer);
  const avatarGradient = avatarGradientForTrainer(trainer.grad);

  return {
    photoUri,
    price: monthlyRate,
    showPrice: showMonthlyPrice,
    years: yearsValue,
    specialties: firstSpecialtyPills(allSpecialties),
    avatarColors: avatarGradient,
  };
}

function locationYearsLine(location, years) {
  const trimmedPlace = String(location || '').trim();
  let place = trimmedPlace;
  if (!place) {
    place = LOCATION_FALLBACK;
  }
  if (years > 0) {
    return `${place} · ${years} ${YEARS_SUFFIX}`;
  }
  return place;
}

function cardPressStyle(colors, isPressed) {
  let pressOpacity = 1;
  if (isPressed) {
    pressOpacity = PRESSED_CARD_OPACITY;
  }
  return {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder,
    opacity: pressOpacity,
  };
}

function buildSpecialtyPillElements(specialties, colors) {
  const pills = [];
  for (let index = 0; index < specialties.length; index += 1) {
    const specialtyName = specialties[index];
    pills.push(
      <View
        key={specialtyName}
        style={[
          styles.specPill,
          { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
        ]}
      >
        <Text style={[styles.specPillText, { color: colors.nbInk }]} numberOfLines={1}>
          {specialtyName}
        </Text>
      </View>,
    );
  }
  return pills;
}

// ===== SMALL UI PIECES =====

function VerifiedTick({ colors }) {
  return (
    <View
      style={[
        styles.verifiedTick,
        { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
      ]}
    >
      <Ionicons name="checkmark" size={VERIFIED_ICON_SIZE} color={colors.nbOnFill} />
    </View>
  );
}

function AvailabilityBadge({ available, colors }) {
  if (available) {
    return (
      <LinearGradient
        colors={accentGradients[0]}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={[styles.statusPill, { borderColor: colors.nbBorder }]}
      >
        <Text style={[styles.statusPillText, { color: colors.nbInk }]}>
          {AVAILABLE_LABEL}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.statusPill,
        styles.statusPillPlain,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
      ]}
    >
      <Text style={[styles.statusPillText, { color: colors.nbInk }]}>
        {WAITLIST_LABEL}
      </Text>
    </View>
  );
}

function FooterPriceRow({ showPrice, price, colors }) {
  if (!showPrice) {
    return (
      <Text style={[styles.priceText, { color: colors.nbInk }]} numberOfLines={1}>
        {RATE_ON_REQUEST_LABEL}
      </Text>
    );
  }

  return (
    <Text style={[styles.priceText, { color: colors.nbInk }]} numberOfLines={1}>
      ${price}
      <Text style={[styles.priceSuffix, { color: colors.nbMuted }]}> / mo</Text>
    </Text>
  );
}

function SpecialtyPillRow({ specialties, colors }) {
  if (specialties.length === 0) {
    return null;
  }

  const pillElements = buildSpecialtyPillElements(specialties, colors);
  return <View style={styles.pillRow}>{pillElements}</View>;
}

function VerifiedTickOrNull({ showVerifiedTick, colors }) {
  if (!showVerifiedTick) {
    return null;
  }
  return <VerifiedTick colors={colors} />;
}

function IdentityRow({ trainer, fields, trainerIsAvailable, showVerifiedTick, metaSubtitle, colors }) {
  return (
    <View style={styles.topRow}>
      <NbAvatar
        source={fields.photoUri}
        initials={trainer.initials}
        size={AVATAR_SIZE}
      />
      <View style={styles.nameBlock}>
        <View style={styles.nameRow}>
          <Text style={[styles.trainerName, { color: colors.nbInk }]} numberOfLines={1}>
            {trainer.name}
          </Text>
          <VerifiedTickOrNull showVerifiedTick={showVerifiedTick} colors={colors} />
        </View>
        <Text style={[styles.metaLine, { color: colors.nbMuted }]} numberOfLines={1}>
          {metaSubtitle}
        </Text>
      </View>
      <AvailabilityBadge available={trainerIsAvailable} colors={colors} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * One HardShadow trainer card in the Find-a-Trainer list (PNG 03).
 * @param {object} props
 */
export default function TrainerCard({
  trainer,
  onViewProfile,
  // BrowseTrainers still passes these; Message / Connect live on the profile sheet (PNG).
  onMessage: _onMessage,
  onConnect: _onConnect,
}) {
  // 1. Theme + display fields from list projection / raw Firestore.
  const { colors } = useTheme();
  const fields = readTrainerCardFields(trainer);

  // 2. Whole card opens the profile sheet (PNG 03).
  function openProfile() {
    callIfFunction(onViewProfile, trainer);
  }

  const trainerIsAvailable = trainer.available !== false;
  const showVerifiedTick = trainer.verified === true;
  const metaSubtitle = locationYearsLine(trainer.location, fields.years);
  const accessibilityLabel = `View profile for ${trainer.name}`;

  // 3. Identity row → specialty pills → price footer.
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.cardWrap}>
      <Pressable
        onPress={openProfile}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed: isPressed }) => [
          styles.card,
          cardPressStyle(colors, isPressed),
        ]}
      >
        <IdentityRow
          trainer={trainer}
          fields={fields}
          trainerIsAvailable={trainerIsAvailable}
          showVerifiedTick={showVerifiedTick}
          metaSubtitle={metaSubtitle}
          colors={colors}
        />

        <SpecialtyPillRow specialties={fields.specialties} colors={colors} />

        <View style={[styles.footer, { borderTopColor: colors.nbBorder }]}>
          <FooterPriceRow
            showPrice={fields.showPrice}
            price={fields.price}
            colors={colors}
          />
          <View style={styles.viewProfileRow}>
            <Text style={[styles.viewProfileText, { color: colors.nbInk }]}>
              {VIEW_PROFILE_LABEL}
            </Text>
            <Ionicons name="chevron-forward" size={CHEVRON_ICON_SIZE} color={colors.nbInk} />
          </View>
        </View>
      </Pressable>
    </HardShadow>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
