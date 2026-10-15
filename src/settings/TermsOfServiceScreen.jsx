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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const PINK = '#FF6B9D';
const CYAN = '#06B6D4';
const PURPLE = '#C084FC';
const BORDER_PAD = 0.6;
const LAST_UPDATED = 'May 9, 2026';
const SHELL_NAV_INSET_FALLBACK = 24;
const SCROLL_BOTTOM_EXTRA = 24;
const MIN_BOTTOM_INSET = 16;
const FADE_MS = 350;
const RISE_START = 10;
const HERO_BORDER = [CYAN, PURPLE];
const SECTION_ACCENT = [CYAN, PURPLE];
const GRADIENT_TOP_LEFT = { x: 0, y: 0 };
const GRADIENT_BOTTOM_RIGHT = { x: 1, y: 1 };
const GRADIENT_LEFT = { x: 0, y: 0 };
const GRADIENT_RIGHT = { x: 1, y: 0 };

// ===== HELPER FUNCTIONS =====

/**
 * Dark vs light paint for the cards. Kept as a helper so the screen body is just layout.
 * @param {boolean} isDark
 */
function getCardTokens(isDark) {
  if (isDark) {
    return {
      bg: '#141419',
      border: 'rgba(255,255,255,0.08)',
      text2: 'rgba(255,255,255,0.92)',
      text3: 'rgba(255,255,255,0.72)',
    };
  }
  return {
    bg: '#FFFFFF',
    border: 'rgba(10,10,15,0.06)',
    text2: 'rgba(10,10,15,0.86)',
    text3: 'rgba(10,10,15,0.68)',
  };
}

/**
 * Gradient rim wrapping a solid inner. Reused for the hero, the icon badge, and (via LinearGradient) section feet.
 */
function GradientCard({ borderColors, style, innerStyle, children }) {
  return (
    <LinearGradient colors={borderColors} start={GRADIENT_TOP_LEFT} end={GRADIENT_BOTTOM_RIGHT} style={style}>
      <View style={innerStyle}>{children}</View>
    </LinearGradient>
  );
}

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
      title: 'Human coaches',
      body:
        'If you work with a coach, your relationship with them is between you and them unless we say otherwise elsewhere. We don’t control how they coach or bill you outside what the product explicitly supports.',
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
 * @param {{ isDark: boolean, cardTokens: object, scrollBottomPad: number }} args
 */
function buildTermsStyles({ isDark, cardTokens, scrollBottomPad }) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF' },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: scrollBottomPad },

    heroOuter: { borderRadius: 16, padding: BORDER_PAD, marginBottom: 16 },
    heroInner: {
      borderRadius: 14,
      padding: 24,
      backgroundColor: cardTokens.bg,
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: cardTokens.border,
    },
    heroIconOuter: { width: 64, height: 64, borderRadius: 32, padding: BORDER_PAD, marginBottom: 14 },
    heroIconInner: {
      flex: 1,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderWidth: 0.5,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    heroTitle: { fontSize: 32, fontWeight: '900', color: isDark ? '#FFFFFF' : '#1A1A2E', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
    heroSub: { fontSize: 15, fontWeight: '600', color: cardTokens.text2, textAlign: 'center', lineHeight: 21 },

    pageSub: { fontSize: 14, fontWeight: '600', color: cardTokens.text2, lineHeight: 22, marginBottom: 16 },

    sectionCard: {
      marginBottom: 12,
      backgroundColor: cardTokens.bg,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    sectionCardBody: { padding: 16 },
    sectionBottomAccent: { height: 1, width: '100%' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    sectionNum: { width: 24, fontSize: 14, fontWeight: '900', color: PINK },
    sectionTitle: { flex: 1, fontSize: 15, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0A0A0F', letterSpacing: -0.15 },
    sectionText: { marginLeft: 24, fontSize: 14, fontWeight: '600', color: cardTokens.text2, lineHeight: 22 },

    legalNote: {
      fontSize: 12,
      color: cardTokens.text2,
      fontStyle: 'italic',
      marginTop: 12,
      padding: 16,
      backgroundColor: cardTokens.bg,
      borderRadius: 10,
      borderWidth: 0.5,
      borderColor: cardTokens.border,
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
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET_FALLBACK);
  const scrollBottomPad = embedShellBottomNav ? shellNavInset : Math.max(insets.bottom, MIN_BOTTOM_INSET) + SCROLL_BOTTOM_EXTRA;
  const supportEmail = getSupportEmail();
  const cardTokens = getCardTokens(isDark);
  const contactLine = `Contact: ${supportEmail}`;
  const styles = buildTermsStyles({ isDark, cardTokens, scrollBottomPad });
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
          <GradientCard borderColors={HERO_BORDER} style={styles.heroOuter} innerStyle={styles.heroInner}>
            <GradientCard borderColors={HERO_BORDER} style={styles.heroIconOuter} innerStyle={styles.heroIconInner}>
              <Ionicons name="document-text-outline" size={34} color="#FFFFFF" />
            </GradientCard>
            <Text style={styles.heroTitle}>Terms of Service</Text>
            <Text style={styles.heroSub}>Last updated: {LAST_UPDATED}</Text>
          </GradientCard>

          <Text style={styles.pageSub}>Friendly, plain-language terms for using the app.</Text>

          {sections.map((section) => (
            <View key={section.num} style={styles.sectionCard}>
              <View style={styles.sectionCardBody}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionNum}>{section.num}</Text>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <Text style={styles.sectionText}>{section.body}</Text>
              </View>
              <LinearGradient
                colors={SECTION_ACCENT}
                start={GRADIENT_LEFT}
                end={GRADIENT_RIGHT}
                style={styles.sectionBottomAccent}
              />
            </View>
          ))}

          <Text style={styles.legalNote}>
            This is a readable summary. Your lawyer should provide the binding legal version for your entity and
            jurisdiction.
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
