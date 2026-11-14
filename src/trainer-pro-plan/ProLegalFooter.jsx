// App Store subscription disclosure under Pro upgrade / expired screens.
// Flow: build Apple one-line disclosure → static legal paragraph → Terms / Privacy / Manage links.
// Used by ProUpgradeOffer. Product copy lives in proPlanSwitches — do not invent prices here.
//
// vocab: nbMuted / nbInk = Design Law text tokens (muted body vs ink links)
// vocab: Platform.OS = 'ios' | 'android' | 'web' from React Native

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import {
  TRAINER_SUBSCRIPTION_DURATION,
  TRAINER_SUBSCRIPTION_TITLE,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
  TRAINER_SUBSCRIPTION_LEGAL,
  APPLE_MANAGE_SUBSCRIPTIONS_URL,
} from './proPlanSwitches';
import { darkColors } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: default ink when the parent does not pass theme colors
const DEFAULT_TEXT_COLOR = darkColors.nbMuted;
const DEFAULT_LINK_COLOR = darkColors.nbInk;
const TERMS_LINK_LABEL = 'Terms of Use';
const PRIVACY_LINK_LABEL = 'Privacy Policy';
const MANAGE_SUBSCRIPTION_LINK_LABEL = 'Manage subscription';
const IOS_PLATFORM = 'ios';

// ===== HELPER FUNCTIONS =====

/**
 * One underlined legal link row.
 * @param {{ label: string, onPress: Function, linkColor: string }} props
 */
function LegalTextLink({ label, onPress, linkColor }) {
  const linkStyle = [styles.link, { color: linkColor }];
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="link">
      <Text style={linkStyle}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Optional Terms / Privacy / Apple Manage row. Missing callbacks hide their link.
 * @param {object} props
 */
function ProLegalFooterLinks({
  linkColor,
  showTermsLink,
  showPrivacyLink,
  showAppleManageLink,
  onOpenTerms,
  onOpenPrivacy,
}) {
  let termsLinkNode = null;
  if (showTermsLink) {
    termsLinkNode = (
      <LegalTextLink label={TERMS_LINK_LABEL} onPress={onOpenTerms} linkColor={linkColor} />
    );
  }

  let privacyLinkNode = null;
  if (showPrivacyLink) {
    privacyLinkNode = (
      <LegalTextLink label={PRIVACY_LINK_LABEL} onPress={onOpenPrivacy} linkColor={linkColor} />
    );
  }

  let appleManageLinkNode = null;
  if (showAppleManageLink) {
    appleManageLinkNode = (
      <LegalTextLink
        label={MANAGE_SUBSCRIPTION_LINK_LABEL}
        onPress={openAppleManageSubscriptions}
        linkColor={linkColor}
      />
    );
  }

  return (
    <View style={styles.links}>
      {termsLinkNode}
      {privacyLinkNode}
      {appleManageLinkNode}
    </View>
  );
}

/**
 * Disclosure paragraph + legal copy + link row.
 * @param {object} props
 */
function ProLegalFooterLayout({
  textColor,
  linkColor,
  disclosureLine,
  showTermsLink,
  showPrivacyLink,
  showAppleManageLink,
  onOpenTerms,
  onOpenPrivacy,
}) {
  const disclosureStyle = [styles.disclosure, { color: textColor }];
  const legalStyle = [styles.legal, { color: textColor }];

  return (
    <View style={styles.wrap}>
      <Text style={disclosureStyle}>{disclosureLine}</Text>
      <Text style={legalStyle}>{TRAINER_SUBSCRIPTION_LEGAL}</Text>
      <ProLegalFooterLinks
        linkColor={linkColor}
        showTermsLink={showTermsLink}
        showPrivacyLink={showPrivacyLink}
        showAppleManageLink={showAppleManageLink}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Legal footer for Trainer Pro purchase screens (Apple disclosure + links).
 * @param {object} props
 * @param {string} [props.textColor]
 * @param {string} [props.linkColor]
 * @param {string} [props.priceLine]
 * @param {string} [props.durationLabel]
 * @param {Function} [props.onOpenTerms]
 * @param {Function} [props.onOpenPrivacy]
 */
export default function ProLegalFooter({
  textColor = DEFAULT_TEXT_COLOR,
  linkColor = DEFAULT_LINK_COLOR,
  priceLine,
  durationLabel = TRAINER_SUBSCRIPTION_DURATION,
  onOpenTerms,
  onOpenPrivacy,
}) {
  // 1. One-line App Store disclosure (title, price, length, trial note).
  const disclosureLine = buildSubscriptionDisclosureLine(priceLine, durationLabel);

  // 2. Only show links the parent actually wired (and Manage only on iOS).
  const showTermsLink = typeof onOpenTerms === 'function';
  const showPrivacyLink = typeof onOpenPrivacy === 'function';
  const showAppleManageLink = Platform.OS === IOS_PLATFORM;

  return (
    <ProLegalFooterLayout
      textColor={textColor}
      linkColor={linkColor}
      disclosureLine={disclosureLine}
      showTermsLink={showTermsLink}
      showPrivacyLink={showPrivacyLink}
      showAppleManageLink={showAppleManageLink}
      onOpenTerms={onOpenTerms}
      onOpenPrivacy={onOpenPrivacy}
    />
  );
}

// PLUMBING — skip unless debugging

/**
 * Apple wants title + price + length + that trials are for new subscribers where offered.
 * @param {string|undefined} priceLine
 * @param {string} durationLabel
 * @returns {string}
 */
function buildSubscriptionDisclosureLine(priceLine, durationLabel) {
  if (priceLine) {
    return `${TRAINER_SUBSCRIPTION_TITLE}: ${priceLine} for ${durationLabel}. ${TRAINER_SUBSCRIPTION_TRIAL_LABEL} for new subscribers where offered by Apple.`;
  }
  return `${TRAINER_SUBSCRIPTION_TITLE} — ${durationLabel}. ${TRAINER_SUBSCRIPTION_TRIAL_LABEL} where offered.`;
}

/**
 * Opens Apple’s subscription management page. No-op off iOS.
 */
function openAppleManageSubscriptions() {
  if (Platform.OS !== IOS_PLATFORM) {
    return;
  }
  // vocab: Linking.openURL = open a system URL (Safari / Settings deep link)
  Linking.openURL(APPLE_MANAGE_SUBSCRIPTIONS_URL).catch(() => {});
}

const styles = StyleSheet.create({
  // Manipulate here: vertical rhythm under the CTA block
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
