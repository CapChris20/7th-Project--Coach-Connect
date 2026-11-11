// Trainer section of the client home: the connected coach with Message, Profile and Pay, or a Browse trainers prompt.
// Flow: no trainer → show the prompt → otherwise show name, focus, location and price with the three actions.
// Used by NewHomeLayout. Every handler and label comes from the existing home screen, so payments and messaging work as before.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { NbButton } from '../../../look-and-feel/nb/NbButton';
import { NbAvatar, NbPill } from '../../../look-and-feel/nb/NbAccentPieces';
import { NbSurface } from '../../../look-and-feel/nb/NbSurface';
import { NB_RADIUS, NB_SPACING, getNbAccent, getNbColors } from '../../../look-and-feel/nb/nbTokens';

// ===== NAMED CONSTANTS =====

const AVATAR_SIZE = 56;
const AVATAR_ACCENT_POSITION = 3;
const STATUS_ACCENT_POSITION = 7;
const DEFAULT_SPECIALTY = 'Certified trainer';
const DEFAULT_LOCATION = 'Remote';

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} name
 * @returns {string} First letter of the first and last word, up to two letters.
 */
function initialsFor(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'T';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}

/**
 * @param {object} props
 * @returns {string} The price line, such as "$250/mo", or an empty string.
 */
function priceLine({ coachingRateLabel, trainerPricingLine }) {
  if (coachingRateLabel) return `${coachingRateLabel}/mo`;
  return trainerPricingLine || '';
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} props Same names the home screen already passes down.
 * @returns {JSX.Element}
 */
export function NewHomeTrainer(props) {
  const {
    trainer,
    trainerName,
    trainerTitle,
    trainerSpecialties,
    trainerLocation,
    onPressMessage,
    handleViewProfile,
    showCoachingPaymentOnCard,
    handleOpenPayment,
    coachingPaymentButtonLabel,
    coachingPaymentShortLabel,
    coachingPaymentStatusLabel,
    onPressFindTrainer,
  } = props;

  // 1. Colors for the current theme.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);

  // 2. No trainer yet: one clear prompt.
  if (!trainer) {
    const openDirectory = typeof onPressFindTrainer === 'function' ? onPressFindTrainer : onPressMessage;
    return (
      <NbSurface radius={NB_RADIUS.sheet} innerStyle={styles.cardInner}>
        <View>
          <Text style={[styles.title, { color: colors.ink }]}>No trainer yet</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Browse coaches by specialty, city and price. Message one to start a free trial.
          </Text>
        </View>
        <NbButton label="Browse trainers" onPress={openDirectory} />
      </NbSurface>
    );
  }

  // 3. Connected trainer: who they are, then the actions.
  const focusLine = trainerTitle || (trainerSpecialties || []).join(' · ') || DEFAULT_SPECIALTY;
  const detailLine = [focusLine, trainerLocation || DEFAULT_LOCATION].join(' · ');
  const price = priceLine(props);
  const payLabel = coachingPaymentShortLabel || coachingPaymentButtonLabel || 'Pay';
  return (
    <NbSurface radius={NB_RADIUS.sheet} innerStyle={styles.cardInner}>
      <View style={styles.headerRow}>
        <NbAvatar initial={initialsFor(trainerName)} size={AVATAR_SIZE} accent={getNbAccent(AVATAR_ACCENT_POSITION)} />
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.ink }]}>
            {trainerName}
          </Text>
          <Text numberOfLines={2} style={[styles.subtitle, { color: colors.muted }]}>
            {detailLine}
          </Text>
        </View>
      </View>

      {coachingPaymentStatusLabel || price ? (
        <View style={styles.statusRow}>
          {coachingPaymentStatusLabel ? <NbPill label={coachingPaymentStatusLabel} accent={getNbAccent(STATUS_ACCENT_POSITION)} /> : null}
          {price ? <Text style={[styles.price, { color: colors.ink }]}>{price}</Text> : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.actionSlot}>
          <NbButton label="Message" onPress={onPressMessage} />
        </View>
        <View style={styles.actionSlot}>
          <NbButton label="Profile" variant="plain" onPress={handleViewProfile} />
        </View>
        {showCoachingPaymentOnCard ? (
          <View style={styles.actionSlot}>
            <NbButton label={payLabel} variant="plain" onPress={handleOpenPayment} />
          </View>
        ) : null}
      </View>
    </NbSurface>
  );
}

export default NewHomeTrainer;

const styles = StyleSheet.create({
  cardInner: { padding: NB_SPACING.large, gap: NB_SPACING.large },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: NB_SPACING.medium },
  headerText: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: 15, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: NB_SPACING.small },
  actionSlot: { flex: 1 },
});
