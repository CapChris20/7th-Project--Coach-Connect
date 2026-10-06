// App Store subscription disclosure: length, price, auto-renew, and the legal links.
// Flow: build the price sentence → show the legal paragraph → link terms, privacy, and Apple manage.
// Used by the trainer pro upgrade and expired screens under the offer buttons.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import {
  TRAINER_SUBSCRIPTION_DURATION,
  TRAINER_SUBSCRIPTION_TITLE,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
  TRAINER_SUBSCRIPTION_LEGAL,
  APPLE_MANAGE_SUBSCRIPTIONS_URL,
} from './proPlanSwitches';

// ===== NAMED CONSTANTS =====

const DEFAULT_TEXT_COLOR = 'rgba(255,255,255,0.65)';
const DEFAULT_LINK_COLOR = '#FF6B9D';

// ===== HELPER FUNCTIONS =====

// Apple's guideline wants the title, the price, the length, and that a trial is for new subscribers.
function subscriptionDisclosure(priceLine, durationLabel) {
  if (priceLine) {
    return `${TRAINER_SUBSCRIPTION_TITLE}: ${priceLine} for ${durationLabel}. ${TRAINER_SUBSCRIPTION_TRIAL_LABEL} for new subscribers where offered by Apple.`;
  }
  return `${TRAINER_SUBSCRIPTION_TITLE} — ${durationLabel}. ${TRAINER_SUBSCRIPTION_TRIAL_LABEL} where offered.`;
}

function openAppleManageSubscriptions() {
  if (Platform.OS !== 'ios') return;
  Linking.openURL(APPLE_MANAGE_SUBSCRIPTIONS_URL).catch(() => {});
}

function LegalTextLink({ label, onPress, linkColor }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="link">
      <Text style={[styles.link, { color: linkColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Subscription fine print plus Terms, Privacy, and (on iOS) Manage subscription.
 * @param {{ textColor?: string, linkColor?: string, priceLine?: string, durationLabel?: string, onOpenTerms?: function, onOpenPrivacy?: function }} props
 * @returns {import('react').ReactElement}
 */
export default function ProLegalFooter({
  textColor = DEFAULT_TEXT_COLOR,
  linkColor = DEFAULT_LINK_COLOR,
  priceLine,
  durationLabel = TRAINER_SUBSCRIPTION_DURATION,
  onOpenTerms,
  onOpenPrivacy,
}) {
  const disclosure = subscriptionDisclosure(priceLine, durationLabel);
  const isIos = Platform.OS === 'ios';
  const canOpenTerms = typeof onOpenTerms === 'function';
  const canOpenPrivacy = typeof onOpenPrivacy === 'function';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.disclosure, { color: textColor }]}>{disclosure}</Text>
      <Text style={[styles.legal, { color: textColor }]}>{TRAINER_SUBSCRIPTION_LEGAL}</Text>
      <View style={styles.links}>
        {canOpenTerms ? (
          <LegalTextLink label="Terms of Use" onPress={onOpenTerms} linkColor={linkColor} />
        ) : null}
        {canOpenPrivacy ? (
          <LegalTextLink label="Privacy Policy" onPress={onOpenPrivacy} linkColor={linkColor} />
        ) : null}
        {isIos ? (
          <LegalTextLink
            label="Manage subscription"
            onPress={openAppleManageSubscriptions}
            linkColor={linkColor}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 8 },
  disclosure: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
  legal: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 8 },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  link: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
});
