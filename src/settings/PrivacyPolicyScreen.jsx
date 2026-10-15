// Privacy Policy screen: last-updated date, optional web link, then numbered sections.
// Flow: fade in → optional Linking.openURL for the hosted policy → scroll the in-app copy.
// Used from Settings. Section titles and body text are the legal copy that ships.

import React, { useRef } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, StatusBar, Linking, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getSupportEmail, getPrivacyPolicyUrl } from './supportContact';
import TopHeader from '../for-both/loading-and-header/TopHeader';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../navigation/bottomMenuSpacing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const LAST_UPDATED = 'September 23, 2026';
const CYAN = '#06B6D4';
const PURPLE = '#C084FC';
const BORDER_PAD = 0.6;
const SHELL_NAV_INSET = 24;
const EXTRA_SCROLL_PAD = 16;
const FADE_MS = 350;
const RISE_FROM = 10;

const POLICY_SECTIONS = [
  {
    title: '1. Who we are',
    paragraphs: [
      'Coach Connect is operated from the United States. The app may be available in other countries through the app stores; using it does not mean laws in your country do not apply to you, but it also does not mean we are making legal claims about every jurisdiction on earth. If something here conflicts with what a qualified lawyer tells you, follow your lawyer.',
    ],
  },
  {
    title: '2. What we collect',
    paragraphs: [
      'Account and profile information you provide (such as name, email, role as client or trainer, and profile fields you choose to fill in). Fitness-related content you enter or upload, such as workouts, nutrition logs, progress metrics, photos, notes, and files. Messages and other content shared in the product. Preferences such as theme and whether optional AI features are on. Technical data needed to run the app, including device push tokens for notifications you allow, authentication identifiers, and diagnostic information when something fails.',
    ],
  },
  {
    title: '3. How and why we use information',
    paragraphs: [
      'We use personal information to provide the service you asked for (accounts, dashboards, messaging, file sharing, reminders, and optional AI coaching when you turn it on), to secure accounts, to fix bugs, to respond to support requests, and to comply with law where required. Depending on where you live, the legal basis for some processing may include performing a contract with you, legitimate interests in running and improving a secure service, or consent where we ask for it (for example optional features or notifications).',
    ],
  },
  {
    title: '4. Health and fitness-related information',
    paragraphs: [
      'Coach Connect is built for coaching and fitness workflows. Information you add can be sensitive (for example weight, injuries, goals, or meal details). Do not use the app as a substitute for medical advice, diagnosis, or treatment. We do not use this policy to label the app as a regulated medical device; if your situation requires professional healthcare or compliance with specific health laws, speak with qualified professionals.',
    ],
  },
  {
    title: '5. Coaches and clients',
    paragraphs: [
      'If you connect with a trainer or client inside the product, information the app is designed to share with that person (such as progress, messages, shared files, and similar) may be visible to them as part of using Coach Connect. You should only share what you are comfortable having that other person see.',
    ],
  },
  {
    title: '6. Service providers (subprocessors)',
    paragraphs: [
      'We rely on third-party infrastructure and tools to run Coach Connect. That includes Google Firebase (Authentication, Firestore, Storage, Cloud Functions, and related services) for accounts and stored data; Apple for Sign in with Apple and In-App Purchases; Stripe for client-to-trainer coaching payments when that feature is enabled; and push notification delivery. Optional AI Coach and related features may send prompts or images you choose to submit to large-language and vision providers (including Anthropic, DeepSeek, and Replicate) and may use web/nutrition search helpers (including Serper and FatSecret) to look up public food facts. Providers handle data only as needed to deliver their services to us. Their own terms and privacy notices also apply where relevant.',
    ],
  },
  {
    title: '7. If you use the app outside the United States',
    paragraphs: [
      'Your information may be stored or processed in the United States or in other regions where our providers operate. That can mean your data is transferred across borders. Laws such as the GDPR in the European Economic Area or the UK GDPR may give you additional rights depending on your situation. We describe how to reach us below; we are not claiming a specific legal status in every country in this screen.',
    ],
  },
  {
    title: '8. Subscriptions and payments (Coach Connect Pro)',
    paragraphs: [
      'If you subscribe to Coach Connect Pro as a trainer, Apple processes payment through your Apple ID. We receive subscription status from Apple (such as product identifier, transaction identifiers, trial or active status, and renewal dates) to unlock trainer features and show your subscription status in the app. We do not receive your full payment card number from Apple. You can manage or cancel in iOS Settings → Apple ID → Subscriptions. Deleting your Coach Connect account does not cancel an Apple subscription — you must cancel in Apple Subscriptions or you may continue to be billed. Client-to-trainer coaching payments may be processed by Stripe when that feature is enabled.',
    ],
  },
  {
    title: '9. Safety, reporting, and blocking',
    paragraphs: [
      'Coach Connect includes messaging and marketplace profiles. You can report a person or message from chat (header menu or long-press a received message) or report/block a trainer from their marketplace profile. Blocked users are hidden from your inbox; manage the list in Settings → Blocked users. Reports are stored so we can review them and may notify our support inbox. Use Contact Support for anything urgent.',
    ],
  },
  {
    title: '10. Your privacy rights and requests',
    paragraphs: [
      'Depending on where you live, you may have rights to access, correct, delete, or export personal information, to object to or restrict certain processing, or to withdraw consent where processing was based on consent. You can delete your account from in-app Settings; that is intended to remove your personal data from the live product subject to limited exceptions (for example short-term backups, fraud prevention, or where the law requires retention). Account deletion does not cancel Coach Connect Pro billed through Apple (see section 8). For other requests (such as a copy of your data or corrections), use Contact Support in Settings. We may need to verify your identity before fulfilling a request.',
    ],
    appendContactLine: true,
  },
  {
    title: '11. Security',
    paragraphs: [
      'We use reasonable technical and organizational measures to protect personal information. No online service can guarantee perfect security. Help protect your account by using a strong password and keeping your device updated.',
    ],
  },
  {
    title: '12. Retention',
    paragraphs: [
      'We keep information for as long as your account is active and as needed to operate Coach Connect, resolve disputes, enforce agreements, and meet legal obligations. After account deletion, some information may persist for a limited period in backups or logs before it ages out.',
    ],
  },
  {
    title: '13. Your in-app choices',
    paragraphs: [
      'You can adjust notification preferences in the app and your device settings, turn optional AI features off in Settings, block or report other users, and use Delete account if you want to leave. The Privacy and data rights item in Settings summarizes how to exercise common requests alongside this policy.',
    ],
  },
  {
    title: '14. Children',
    paragraphs: [
      'Coach Connect is not directed at children under 13, and we do not knowingly collect personal information from children under 13. If you believe we have collected information from a child under 13, contact us and we will take appropriate steps.',
    ],
  },
  {
    title: '15. Changes to this policy',
    paragraphs: [
      'We may update this policy from time to time. When we do, we will change the “Last updated” date at the top. If changes are material, we may also provide a notice in the app or by email where appropriate.',
    ],
  },
  {
    title: '16. Contact',
    paragraphs: [
      'Questions about this policy or your data: email us at the address below or use Contact Support in Settings.',
    ],
    appendContactLine: true,
  },
];

const LEGAL_NOTE =
  'This policy is meant to be readable and accurate about our product. It is not a substitute for advice from a licensed attorney in your country or state, and it is not a certification of compliance with GDPR, CCPA, or any other law. Update this text when your product or vendors change.';

// ===== HELPER FUNCTIONS =====

/**
 * @param {boolean} isDark
 * @returns {object}
 */
function getCardTokens(isDark) {
  if (isDark) {
    return {
      cardBackground: '#141419',
      border: 'rgba(255,255,255,0.08)',
      text2: 'rgba(255,255,255,0.92)',
      text3: 'rgba(255,255,255,0.72)',
    };
  }
  return {
    cardBackground: '#FFFFFF',
    border: 'rgba(10,10,15,0.06)',
    text2: 'rgba(10,10,15,0.86)',
    text3: 'rgba(10,10,15,0.68)',
  };
}

function GradientCard({ borderColors, style, innerStyle, children }) {
  return (
    <LinearGradient colors={borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      <View style={innerStyle}>{children}</View>
    </LinearGradient>
  );
}

function PolicySectionCard({ styles: cardStyles, children }) {
  return (
    <View style={cardStyles.sectionCard}>
      <View style={cardStyles.sectionCardBody}>{children}</View>
      <LinearGradient
        colors={[CYAN, PURPLE]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={cardStyles.sectionBottomAccent}
      />
    </View>
  );
}

/**
 * @param {boolean} embedShellBottomNav
 * @param {number} shellNavInset
 * @param {number} bottomInset
 * @returns {number}
 */
function policyScrollBottomPad(embedShellBottomNav, shellNavInset, bottomInset) {
  if (embedShellBottomNav) return shellNavInset;
  return Math.max(bottomInset, EXTRA_SCROLL_PAD) + SHELL_NAV_INSET;
}

function buildPolicyStyles(isDark, cardTokens, scrollBottomPad) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF' },
    scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: scrollBottomPad },
    heroOuter: { borderRadius: 16, padding: BORDER_PAD, marginBottom: 16 },
    heroInner: {
      borderRadius: 14,
      padding: 24,
      backgroundColor: cardTokens.cardBackground,
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
    legalNote: {
      fontSize: 12,
      color: cardTokens.text2,
      fontStyle: 'italic',
      marginTop: 12,
      padding: 16,
      backgroundColor: cardTokens.cardBackground,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: cardTokens.border,
      lineHeight: 18,
    },
    sectionCard: {
      marginBottom: 12,
      backgroundColor: cardTokens.cardBackground,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    sectionCardBody: { padding: 16 },
    sectionBottomAccent: { height: 1, width: '100%' },
    sectionTitle: { fontSize: 16, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0A0A0F', marginBottom: 10, letterSpacing: -0.2 },
    sectionText: {
      fontSize: 14,
      fontWeight: '600',
      color: cardTokens.text2,
      lineHeight: 22,
    },
  });
}

function PolicyHero({ styles: cardStyles }) {
  return (
    <GradientCard borderColors={[CYAN, PURPLE]} style={cardStyles.heroOuter} innerStyle={cardStyles.heroInner}>
      <GradientCard borderColors={[CYAN, PURPLE]} style={cardStyles.heroIconOuter} innerStyle={cardStyles.heroIconInner}>
        <Ionicons name="shield-checkmark-outline" size={34} color="#FFFFFF" />
      </GradientCard>
      <Text style={cardStyles.heroTitle}>Privacy Policy</Text>
      <Text style={cardStyles.heroSub}>Last updated: {LAST_UPDATED}</Text>
    </GradientCard>
  );
}

function PolicySection({ section, contactLine, styles: cardStyles }) {
  return (
    <PolicySectionCard styles={cardStyles}>
      <Text style={cardStyles.sectionTitle}>{section.title}</Text>
      {section.paragraphs.map((paragraph) => (
        <Text key={paragraph.slice(0, 24)} style={cardStyles.sectionText}>
          {paragraph}
        </Text>
      ))}
      {section.appendContactLine ? (
        <Text style={[cardStyles.sectionText, { marginTop: 10 }]}>{contactLine}</Text>
      ) : null}
    </PolicySectionCard>
  );
}

// ===== MAIN FUNCTION =====

export default function PrivacyPolicyScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = policyScrollBottomPad(embedShellBottomNav, shellNavInset, insets.bottom);
  const supportEmail = getSupportEmail();
  const privacyUrl = getPrivacyPolicyUrl();
  const cardTokens = getCardTokens(isDark);
  const contactLine = `Privacy questions: ${supportEmail}`;
  const styles = buildPolicyStyles(isDark, cardTokens, scrollBottomPad);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(RISE_FROM)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  return (
    <SafeAreaView style={styles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <TopHeader title="Privacy Policy" skipTopSafeInset onBack={onClose} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <PolicyHero styles={styles} />

          <Text style={styles.pageSub}>
            Plain-language summary of how Coach Connect handles personal information. This is not personal legal advice.
          </Text>
          {privacyUrl ? (
            <Pressable onPress={() => Linking.openURL(privacyUrl)} style={{ marginBottom: 16 }}>
              <Text style={[styles.pageSub, { color: PURPLE, marginBottom: 0 }]}>
                Also online: {privacyUrl}
              </Text>
            </Pressable>
          ) : null}

          {POLICY_SECTIONS.map((section) => (
            <PolicySection
              key={section.title}
              section={section}
              contactLine={contactLine}
              styles={styles}
            />
          ))}

          <Text style={styles.legalNote}>{LEGAL_NOTE}</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
