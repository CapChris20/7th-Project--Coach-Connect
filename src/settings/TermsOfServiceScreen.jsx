// Terms of Service — black PLAIN SUMMARY hero + accordion sections in one NbCard.
// Flow: fade in → tap a section title → read body. Used from Settings.
// Binding legal copy lives with counsel; this screen is the readable summary.

import React, { useRef, useState, useEffect } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getSupportEmail } from './supportContact';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import {
  SHELL_SAFE_AREA_EDGES,
  FORM_SCROLL_PROPS,
  useShellBottomNavInset,
} from '../navigation/bottomMenuSpacing';
import NbCard from '../look-and-feel/NbCard';
import { nb, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: date string shown under the header — update when counsel revises terms.
const LAST_UPDATED = 'September 23, 2026';
const SHELL_NAV_INSET_FALLBACK = 24;
const SCROLL_BOTTOM_EXTRA = 24;
const MIN_BOTTOM_INSET = 16;
// Manipulate here: raise FADE_MS = slower entrance; lower = snappier.
const FADE_MS = 350;
const RISE_START = 10;
const PLATFORM_ANDROID = 'android';
const STATUS_BAR_LIGHT_ICONS = 'light-content';
const STATUS_BAR_DARK_ICONS = 'dark-content';
const CHEVRON_SIZE = 20;

// vocab: LayoutAnimation on Android needs this experimental flag once per process.
if (Platform.OS === PLATFORM_ANDROID && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ===== HELPER FUNCTIONS =====

/**
 * Coerce any value to a trimmed string (empty when missing).
 * @param {*} value
 * @returns {string}
 */
function asTrimmedString(value) {
  return asTrimmedString(value);
}


/**
 * Readable summary sections — not the binding legal text.
 * Contact line is built by the caller so the support email stays in one place.
 * @param {string} contactLine
 * @returns {Array<{ title: string, body: string }>}
 */
function buildTermsSectionList(contactLine) {
  return [
    {
      title: 'Your account',
      body: 'Keep your login private. Tell us if you think someone else accessed your account.',
    },
    {
      title: 'The service',
      body:
        'Coach Connect helps you track training and nutrition, use AI Coach if you turn it on, and optionally work with a human coach through the product.',
    },
    {
      title: 'Content you upload',
      body:
        'You’re responsible for photos, files, and messages you send. Don’t upload what you don’t have rights to share.',
    },
    {
      title: 'Acceptable use',
      body:
        'No harassment, illegal use, trying to break security, or abusing the service. We may suspend access for serious violations.',
    },
    {
      title: 'Human trainers',
      body:
        'If you work with a trainer, your relationship with them is between you and them unless we say otherwise elsewhere. We don’t control how they train or bill you outside what the product explicitly supports.',
    },
    {
      title: 'Not medical advice',
      body:
        'Coach Connect is not a medical service. It doesn’t diagnose or treat. For emergencies, call local emergency services. For medical decisions, talk to a qualified professional.',
    },
    {
      title: 'Limitation of liability',
      body:
        'To the extent allowed by law, we’re not liable for indirect damages from using the app. Have counsel tune this for your country or state.',
    },
    {
      title: 'Changes',
      body: 'We may change features to improve safety, reliability, or the experience.',
    },
    {
      title: 'Contact',
      body: contactLine,
    },
  ];
}

/**
 * Bottom padding so the last accordion row clears the shell nav or home indicator.
 * @param {boolean} embedShellBottomNav
 * @param {number} shellNavInset
 * @param {number} bottomSafeInset
 * @returns {number}
 */
function scrollBottomPaddingForTerms(embedShellBottomNav, shellNavInset, bottomSafeInset) {
  if (embedShellBottomNav) {
    return shellNavInset;
  }
  const safeBottom = Math.max(bottomSafeInset, MIN_BOTTOM_INSET);
  return safeBottom + SCROLL_BOTTOM_EXTRA;
}

/**
 * Status bar icon color — light icons on dark chrome, dark icons on light chrome.
 * @param {boolean} isDark
 * @returns {string}
 */
function statusBarStyleForTheme(isDark) {
  if (isDark) return STATUS_BAR_LIGHT_ICONS;
  return STATUS_BAR_DARK_ICONS;
}

/**
 * Chevron points down when the row is open, forward when closed.
 * @param {boolean} isExpanded
 * @returns {string}
 */
function chevronNameForExpandedState(isExpanded) {
  if (isExpanded) return 'chevron-down';
  return 'chevron-forward';
}

/**
 * Thin divider between accordion rows (skipped above the first row).
 * @param {object} props
 */
function TermsRowDivider({ colors }) {
  return <View style={[termsStyles.divider, { backgroundColor: colors.nbBorder }]} />;
}

/**
 * One accordion row: tap title to expand / collapse the body.
 * @param {object} props
 */
function TermsAccordionRow({ section, openSectionTitle, onSectionPress, colors, showDivider }) {
  const isExpanded = openSectionTitle === section.title;
  const chevronName = chevronNameForExpandedState(isExpanded);

  const handlePress = () => {
    onSectionPress(section.title);
  };

  return (
    <>
      {showDivider ? <TermsRowDivider colors={colors} /> : null}
      <Pressable
        onPress={handlePress}
        style={termsStyles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <Text style={[termsStyles.rowTitle, { color: colors.nbInk }]}>{section.title}</Text>
        <Ionicons name={chevronName} size={CHEVRON_SIZE} color={colors.nbMuted} />
      </Pressable>
      {isExpanded ? (
        <Text style={[termsStyles.rowBody, { color: colors.nbMuted }]}>{section.body}</Text>
      ) : null}
    </>
  );
}

/**
 * Black PLAIN SUMMARY hero — Design Law terms header block.
 * @param {object} props
 */
function TermsPlainSummaryHero({ colors }) {
  return (
    <View style={[termsStyles.summaryBlock, { backgroundColor: colors.nbFill }]}>
      <Text style={[termsStyles.summaryLabel, { color: colors.nbOnFill }]}>PLAIN SUMMARY</Text>
      <Text style={[termsStyles.summaryBody, { color: colors.nbOnFill }]}>
        These terms explain the rules for using Coach Connect. If you use the app, you agree to
        them.
      </Text>
    </View>
  );
}

/**
 * Accordion list inside one NbCard — one open section at a time.
 * @param {object} props
 */
function TermsSectionsCard({ sectionList, openSectionTitle, onSectionPress, colors }) {
  return (
    <NbCard style={termsStyles.groupCard}>
      {sectionList.map((section, index) => (
        <TermsAccordionRow
          key={section.title}
          section={section}
          openSectionTitle={openSectionTitle}
          onSectionPress={onSectionPress}
          colors={colors}
          showDivider={index > 0}
        />
      ))}
    </NbCard>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Terms of Service screen — readable summary with accordion sections.
 * Flow: 1. theme + padding  2. sections  3. fade in  4. toggle accordion  5. render
 * @param {object} props
 */
export default function TermsOfServiceScreen({ onClose, embedShellBottomNav = false }) {
  // 1. Theme, safe area, and scroll padding so content clears the shell nav.
  const { colors, isDark } = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET_FALLBACK);
  const scrollBottomPad = scrollBottomPaddingForTerms(
    embedShellBottomNav,
    shellNavInset,
    safeAreaInsets.bottom,
  );

  // 2. Section list — first section starts open so the screen is not empty accordion chrome.
  const supportEmail = getSupportEmail();
  const contactLine = `Contact: ${supportEmail}`;
  const sectionList = buildTermsSectionList(contactLine);
  const firstSectionTitle = sectionList[0]?.title || null;

  // Hook order frozen: openSectionTitle → opacityAnimation → riseAnimation → useEffect.
  const [openSectionTitle, setOpenSectionTitle] = useState(firstSectionTitle);
  const opacityAnimation = useRef(new Animated.Value(0)).current;
  const riseAnimation = useRef(new Animated.Value(RISE_START)).current;

  // 3. Fade + rise once on mount so the summary hero settles in.
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnimation, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(riseAnimation, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnimation, riseAnimation]);

  // 4. Tap the open row again to close; tap another to open that one.
  // vocab: LayoutAnimation.configureNext = animate the next layout change (expand/collapse).
  const handleSectionPress = (sectionTitle) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSectionTitle((previousTitle) => {
      const tappingOpenRow = previousTitle === sectionTitle;
      if (tappingOpenRow) return null;
      return sectionTitle;
    });
  };

  // 5. Named locals for status bar + entrance transform before JSX.
  const statusBarStyle = statusBarStyleForTheme(isDark);
  const headerSubtitle = `Updated ${LAST_UPDATED}`;
  const entranceMotionStyle = {
    opacity: opacityAnimation,
    transform: [{ translateY: riseAnimation }],
  };
  const scrollContentStyle = [termsStyles.scrollContent, { paddingBottom: scrollBottomPad }];

  return (
    <SafeAreaView
      style={[termsStyles.container, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <StatusBar barStyle={statusBarStyle} backgroundColor={colors.nbBackground} />
      <NbPageHeader title="Terms of service" subtitle={headerSubtitle} onBack={onClose} />

      <ScrollView
        style={termsStyles.scrollFlex}
        contentContainerStyle={scrollContentStyle}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={entranceMotionStyle}>
          <TermsPlainSummaryHero colors={colors} />
          <TermsSectionsCard
            sectionList={sectionList}
            openSectionTitle={openSectionTitle}
            onSectionPress={handleSectionPress}
            colors={colors}
          />
          <Text style={[termsStyles.legalNote, { color: colors.nbMuted }]}>
            This is a readable summary. Your lawyer should provide the binding legal version for
            your entity and jurisdiction.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== PLUMBING — skip unless debugging =====

const termsStyles = StyleSheet.create({
  container: { flex: 1 },
  scrollFlex: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  summaryBlock: {
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    opacity: 0.75,
  },
  summaryBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  groupCard: {
    paddingVertical: spacing.xs,
    paddingHorizontal: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: nb.minTouchTarget,
    gap: spacing.sm,
  },
  rowTitle: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  rowBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  divider: {
    height: nb.borderWidthDivider,
    marginHorizontal: spacing.md,
  },
  legalNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
});
