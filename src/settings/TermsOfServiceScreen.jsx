// Design Law Terms — black PLAIN SUMMARY block + accordion list in one NbCard.
// Flow: theme + safe-area → fade in → expand a section. Used from Settings.
// Binding legal copy lives with counsel; this screen is the readable summary.

import React, { useRef, useState } from 'react';
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

const LAST_UPDATED = 'September 23, 2026';
const SHELL_NAV_INSET_FALLBACK = 24;
const SCROLL_BOTTOM_EXTRA = 24;
const MIN_BOTTOM_INSET = 16;
const FADE_MS = 350;
const RISE_START = 10;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ===== HELPER FUNCTIONS =====

function termsSections(contactLine) {
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

function GroupDivider({ colors }) {
  return <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />;
}

function TermsAccordionRow({ section, openKey, onToggle, colors, showDivider }) {
  const open = openKey === section.title;
  return (
    <>
      {showDivider ? <GroupDivider colors={colors} /> : null}
      <Pressable
        onPress={() => onToggle(section.title)}
        style={styles.row}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.rowTitle, { color: colors.nbInk }]}>{section.title}</Text>
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={20}
          color={colors.nbMuted}
        />
      </Pressable>
      {open ? (
        <Text style={[styles.rowBody, { color: colors.nbMuted }]}>{section.body}</Text>
      ) : null}
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
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
  const sections = termsSections(contactLine);
  const [openKey, setOpenKey] = useState(sections[0]?.title || null);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(RISE_START)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const toggle = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKey((previousKey) => (previousKey === key ? null : key));
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.nbBackground}
      />
      <NbPageHeader
        title="Terms of service"
        subtitle={`Updated ${LAST_UPDATED}`}
        onBack={onClose}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          {/* Design Law black PLAIN SUMMARY hero */}
          <View style={[styles.summaryBlock, { backgroundColor: colors.nbFill }]}>
            <Text style={[styles.summaryLabel, { color: colors.nbOnFill }]}>PLAIN SUMMARY</Text>
            <Text style={[styles.summaryBody, { color: colors.nbOnFill }]}>
              These terms explain the rules for using Coach Connect. If you use the app, you agree
              to them.
            </Text>
          </View>

          <NbCard style={styles.groupCard}>
            {sections.map((section, index) => (
              <TermsAccordionRow
                key={section.title}
                section={section}
                openKey={openKey}
                onToggle={toggle}
                colors={colors}
                showDivider={index > 0}
              />
            ))}
          </NbCard>

          <Text style={[styles.legalNote, { color: colors.nbMuted }]}>
            This is a readable summary. Your lawyer should provide the binding legal version for
            your entity and jurisdiction.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
