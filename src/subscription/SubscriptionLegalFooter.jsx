import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import {
  TRAINER_SUBSCRIPTION_DURATION,
  TRAINER_SUBSCRIPTION_TITLE,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
  TRAINER_SUBSCRIPTION_LEGAL,
  APPLE_MANAGE_SUBSCRIPTIONS_URL,
} from './constants';

/**
 * App Store Guideline 3.1.2 subscription disclosure (title, length, price, auto-renew, legal links).
 */
export default function SubscriptionLegalFooter({
  textColor = 'rgba(255,255,255,0.65)',
  linkColor = '#FF6B9D',
  priceLine,
  durationLabel = TRAINER_SUBSCRIPTION_DURATION,
  onOpenTerms,
  onOpenPrivacy,
}) {
  const disclosure = priceLine
    ? `${TRAINER_SUBSCRIPTION_TITLE}: ${priceLine} for ${durationLabel}. ${TRAINER_SUBSCRIPTION_TRIAL_LABEL} for new subscribers where offered by Apple.`
    : `${TRAINER_SUBSCRIPTION_TITLE} — ${durationLabel}. ${TRAINER_SUBSCRIPTION_TRIAL_LABEL} where offered.`;

  const openManage = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL(APPLE_MANAGE_SUBSCRIPTIONS_URL).catch(() => {});
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.disclosure, { color: textColor }]}>{disclosure}</Text>
      <Text style={[styles.legal, { color: textColor }]}>{TRAINER_SUBSCRIPTION_LEGAL}</Text>
      <View style={styles.links}>
        {typeof onOpenTerms === 'function' ? (
          <TouchableOpacity onPress={onOpenTerms} accessibilityRole="link">
            <Text style={[styles.link, { color: linkColor }]}>Terms of Use</Text>
          </TouchableOpacity>
        ) : null}
        {typeof onOpenPrivacy === 'function' ? (
          <TouchableOpacity onPress={onOpenPrivacy} accessibilityRole="link">
            <Text style={[styles.link, { color: linkColor }]}>Privacy Policy</Text>
          </TouchableOpacity>
        ) : null}
        {Platform.OS === 'ios' ? (
          <TouchableOpacity onPress={openManage} accessibilityRole="link">
            <Text style={[styles.link, { color: linkColor }]}>Manage subscription</Text>
          </TouchableOpacity>
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
