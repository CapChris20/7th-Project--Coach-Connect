// In-app Terms of Service: hero, numbered sections, contact line, lawyer-disclaimer note.
// Flow: theme + safe-area → fade the page in → scroll the section cards.
// Used by: Settings. Binding legal copy lives with counsel; this screen is the readable summary.

import React, { useRef } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getSupportEmail } from './supportContact';
import TopHeader from '../for-both/loading-and-header/TopHeader';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../navigation/bottomMenuSpacing';
import { Ionicons } from '@expo/vector-icons';
import NbCard from '../look-and-feel/NbCard';
import { nb, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const LAST_UPDATED = 'May 9, 2026';
const SHELL_NAV_INSET_FALLBACK = 24;
const SCROLL_BOTTOM_EXTRA = 24;
const MIN_BOTTOM_INSET = 16;
const FADE_MS = 350;
const RISE_START = 10;

// ===== HELPER FUNCTIONS =====

// Helpers removed - using NbCard directly

/**
 * Copy is data, not JSX, so legal edits happen in one list.
 * @param {string} contactLine
 * @returns {Array<{ num: string, title: string, body: string }>}
 */
function termsSections(contactLine) {
  return [
    {
      num: '01',
      title: 'Plain summary',
      body: 'These terms explain the rules for using Coach Connect. If you use the app, you agree to them.',
    },
    {
      num: '02',
      title: 'The service',
      body:
        'Coach Connect helps you track training and nutrition, use AI Coach if you turn it on, and optionally work with a human coach through the product.',
    },
    {
      num: '03',
      title: 'Not medical advice',
      body:
        'Coach Connect is not a medical service. It doesn’t diagnose or treat. For emergencies, call local emergency services. For medical decisions, talk to a qualified professional.',
    },
    {
      num: '04',
      title: 'AI Coach',
      body:
        'Automated answers can be wrong or incomplete. Don’t rely on them for emergencies or legally critical decisions.',
    },
    {
      num: '05',
      title: 'Human trainers',
      body:
        'If you work with a trainer, your relationship with them is between you and them unless we say otherwise elsewhere. We don’t control how they train or bill you outside what the product explicitly supports.',
    },
    {
      num: '06',
      title: 'Acceptable use',
      body:
        'No harassment, illegal use, trying to break security, or abusing the service. We may suspend access for serious violations.',
    },
    {
      num: '07',
      title: 'Your account',
      body: 'Keep your login private. Tell us if you think someone else accessed your account.',
    },
    {
      num: '08',
      title: 'Coach Connect Pro (trainers)',
      body:
        'Trainers may subscribe to Coach Connect Pro through Apple In-App Purchase (auto-renewing monthly subscription, currently $59.99/month with a 3-day free trial where offered). Payment is charged to your Apple ID. The subscription renews automatically unless you cancel at least 24 hours before the end of the current period. You can manage or cancel in iOS Settings → Apple ID → Subscriptions. Refunds are handled by Apple under its policies.',
    },
    {
      num: '09',
      title: 'Other payments',
      body:
        'Client payments to a human coach (outside the trainer platform subscription) may use separate flows such as Stripe when enabled. Those transactions are subject to the payment provider’s terms.',
    },
    {
      num: '10',
      title: 'Content you upload',
      body:
        'You’re responsible for photos, files, and messages you send. Don’t upload what you don’t have rights to share.',
    },
    {
      num: '11',
      title: 'Changes',
      body: 'We may change features to improve safety, reliability, or the experience.',
    },
    {
      num: '12',
      title: 'Disclaimer',
      body: 'The app is provided as available. We don’t guarantee it will always be error-free or uninterrupted.',
    },
    {
      num: '13',
      title: 'Limitation of liability',
      body:
        'To the extent allowed by law, we’re not liable for indirect damages from using the app. Have counsel tune this for your country or state.',
    },
    {
      num: '14',
      title: 'Contact',
      body: contactLine,
    },
  ];
}

/**
 * Styles depend on theme + the scroll pad, so they are built after those hooks run.
 */
function buildTermsStyles(scrollBottomPad, colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.nbBackground },
    scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: scrollBottomPad },
    heroCard: {
      alignItems: 'center',
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    heroTitle: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 32,
      color: colors.nbInk,
      textAlign: 'center',
      marginBottom: spacing.sm,
      letterSpacing: -0.3,
    },
    heroSub: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: colors.nbMuted,
      textAlign: 'center',
      lineHeight: 21,
    },
    pageSub: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: colors.nbMuted,
      lineHeight: 22,
      marginBottom: spacing.md,
    },
    sectionCard: {
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
    sectionNum: {
      width: 24,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 14,
      color: colors.nbInk,
    },
    sectionTitle: {
      flex: 1,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 15,
      color: colors.nbInk,
      letterSpacing: -0.15,
    },
    sectionText: {
      marginLeft: 24,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: colors.nbMuted,
      lineHeight: 22,
    },
    legalNote: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: colors.nbMuted,
      fontStyle: 'italic',
      marginTop: spacing.sm,
      padding: spacing.md,
      lineHeight: 18,
    },
  });
}

/**
 * vocab: Animated.timing fades/slides the page in once on mount (useNativeDriver = native thread).
 * @param {Animated.Value} fade
 * @param {Animated.Value} rise
 */
function playTermsEnterAnimation(fade, rise) {
  Animated.parallel([
    Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
    Animated.timing(rise, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
  ]).start();
}

// ===== MAIN FUNCTION =====

/**
 * Terms of Service screen with a gradient hero and numbered legal-summary cards.
 * vocab: useTheme / useSafeAreaInsets / useShellBottomNavInset must stay in this order.
 * @param {{ onClose?: Function, embedShellBottomNav?: boolean }} props
 */
export default function TermsOfServiceScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET_FALLBACK);
  const scrollBottomPad = embedShellBottomNav
    ? shellNavInset
    : Math.max(insets.bottom, MIN_BOTTOM_INSET) + SCROLL_BOTTOM_EXTRA;
  const supportEmail = getSupportEmail();
  const contactLine = `Contact: ${supportEmail}`;
  const styles = buildTermsStyles(scrollBottomPad, colors);
  const sections = termsSections(contactLine);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(RISE_START)).current;
  React.useEffect(() => {
    playTermsEnterAnimation(fade, rise);
  }, [fade, rise]);

  return (
    <SafeAreaView style={styles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <TopHeader title="Terms of Service" skipTopSafeInset onBack={onClose} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <NbCard style={styles.heroCard}>
            <View style={[styles.heroIcon, { backgroundColor: colors.nbSurfaceChip }]}>
              <Ionicons name="document-text-outline" size={34} color={colors.nbInk} />
            </View>
            <Text style={styles.heroTitle}>Terms of Service</Text>
            <Text style={styles.heroSub}>Last updated: {LAST_UPDATED}</Text>
          </NbCard>

          <Text style={styles.pageSub}>Friendly, plain-language terms for using the app.</Text>

          {sections.map((section) => (
            <NbCard key={section.num} style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionNum}>{section.num}</Text>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              <Text style={styles.sectionText}>{section.body}</Text>
            </NbCard>
          ))}

          <NbCard style={styles.legalNote}>
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.nbMuted, lineHeight: 18 }}>
              This is a readable summary. Your lawyer should provide the binding legal version for your entity and
              jurisdiction.
            </Text>
          </NbCard>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
