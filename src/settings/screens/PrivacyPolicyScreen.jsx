/**
 * Privacy Policy Screen
 *
 * Purpose: UI screen or component: Privacy Policy Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/settings
 * Key exports: PrivacyPolicyScreen
 *
 * @file-header
 */
import React, { useRef } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';
import { getSupportEmail } from '../supportConfig';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const LAST_UPDATED = 'May 11, 2026';
const CYAN = '#06B6D4';
const PURPLE = '#C084FC';
const BORDER_PAD = 0.6;

function getCardTokens(isDark) {
  return isDark
    ? {
        bg: '#141419',
        border: 'rgba(255,255,255,0.08)',
        text2: 'rgba(255,255,255,0.92)',
        text3: 'rgba(255,255,255,0.72)',
      }
    : {
        bg: '#FFFFFF',
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

function PolicySectionCard({ styles: s, children }) {
  return (
    <View style={s.sectionCard}>
      <View style={s.sectionCardBody}>{children}</View>
      <LinearGradient
        colors={[CYAN, PURPLE]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.sectionBottomAccent}
      />
    </View>
  );
}

export default function PrivacyPolicyScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();
  const supportEmail = getSupportEmail();
  const t = getCardTokens(isDark);
  const contactLine = `Privacy questions: ${supportEmail}`;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF' },
    scrollContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 24 },

    heroOuter: { borderRadius: 16, padding: BORDER_PAD, marginBottom: 16 },
    heroInner: {
      borderRadius: 14,
      padding: 24,
      backgroundColor: t.bg,
      alignItems: 'center',
      borderWidth: 0.5,
      borderColor: t.border,
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
    heroSub: { fontSize: 15, fontWeight: '600', color: t.text2, textAlign: 'center', lineHeight: 21 },

    pageSub: { fontSize: 14, fontWeight: '600', color: t.text2, lineHeight: 22, marginBottom: 16 },
    legalNote: {
      fontSize: 12,
      color: t.text2,
      fontStyle: 'italic',
      marginTop: 12,
      padding: 16,
      backgroundColor: t.bg,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: t.border,
      lineHeight: 18,
    },
    sectionCard: {
      marginBottom: 12,
      backgroundColor: t.bg,
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
      color: t.text2,
      lineHeight: 22,
    },
  });

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(10)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <CoachConnectHeader title="Privacy Policy" skipTopSafeInset onBack={onClose} />

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <GradientCard borderColors={[CYAN, PURPLE]} style={styles.heroOuter} innerStyle={styles.heroInner}>
            <GradientCard borderColors={[CYAN, PURPLE]} style={styles.heroIconOuter} innerStyle={styles.heroIconInner}>
              <Ionicons name="shield-checkmark-outline" size={34} color="#FFFFFF" />
            </GradientCard>
            <Text style={styles.heroTitle}>Privacy Policy</Text>
            <Text style={styles.heroSub}>Last updated: {LAST_UPDATED}</Text>
          </GradientCard>

          <Text style={styles.pageSub}>
            Plain-language summary of how Coach Connect handles personal information. This is not personal legal advice.
          </Text>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>1. Who we are</Text>
            <Text style={styles.sectionText}>
              Coach Connect is operated from the United States. The app may be available in other countries through the
              app stores; using it does not mean laws in your country do not apply to you, but it also does not mean we
              are making legal claims about every jurisdiction on earth. If something here conflicts with what a
              qualified lawyer tells you, follow your lawyer.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>2. What we collect</Text>
            <Text style={styles.sectionText}>
              Account and profile information you provide (such as name, email, role as client or trainer, and profile
              fields you choose to fill in). Fitness-related content you enter or upload, such as workouts, nutrition
              logs, progress metrics, photos, notes, and files. Messages and other content shared in the product.
              Preferences such as theme and whether optional AI features are on. Technical data needed to run the app,
              including device push tokens for notifications you allow, authentication identifiers, and diagnostic
              information when something fails.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>3. How and why we use information</Text>
            <Text style={styles.sectionText}>
              We use personal information to provide the service you asked for (accounts, dashboards, messaging, file
              sharing, reminders, and optional AI coaching when you turn it on), to secure accounts, to fix bugs, to
              respond to support requests, and to comply with law where required. Depending on where you live, the legal
              basis for some processing may include performing a contract with you, legitimate interests in running and
              improving a secure service, or consent where we ask for it (for example optional features or notifications).
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>4. Health and fitness-related information</Text>
            <Text style={styles.sectionText}>
              Coach Connect is built for coaching and fitness workflows. Information you add can be sensitive (for
              example weight, injuries, goals, or meal details). Do not use the app as a substitute for medical advice,
              diagnosis, or treatment. We do not use this policy to label the app as a regulated medical device; if your
              situation requires professional healthcare or compliance with specific health laws, speak with qualified
              professionals.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>5. Coaches and clients</Text>
            <Text style={styles.sectionText}>
              If you connect with a trainer or client inside the product, information the app is designed to share with
              that person (such as progress, messages, shared files, and similar) may be visible to them as part of using
              Coach Connect. You should only share what you are comfortable having that other person see.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>6. Service providers (subprocessors)</Text>
            <Text style={styles.sectionText}>
              We rely on third-party infrastructure and tools. That includes, for example, Google Firebase (such as
              Authentication, Firestore, Storage, Cloud Functions, and related services) for accounts and stored data,
              and notification services for push messages. Providers are expected to handle data only as needed to
              deliver their services to us. Their own terms and privacy notices also apply where relevant.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>7. If you use the app outside the United States</Text>
            <Text style={styles.sectionText}>
              Your information may be stored or processed in the United States or in other regions where our providers
              operate. That can mean your data is transferred across borders. Laws such as the GDPR in the European
              Economic Area or the UK GDPR may give you additional rights depending on your situation. We describe how to
              reach us in the next section; we are not claiming a specific legal status in every country in this screen.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>8. Your privacy rights and requests</Text>
            <Text style={styles.sectionText}>
              Depending on where you live, you may have rights to access, correct, delete, or export personal
              information, to object to or restrict certain processing, or to withdraw consent where processing was based
              on consent. You can delete your account from in-app Settings; that is intended to remove your personal data
              from the live product subject to limited exceptions (for example short-term backups, fraud prevention, or
              where the law requires retention). For other requests (such as a copy of your data or corrections), use
              Contact Support in Settings. We may need to verify your identity before fulfilling a request. We will
              respond within a reasonable time; specific deadlines may apply under local law.
            </Text>
            <Text style={[styles.sectionText, { marginTop: 10 }]}>{contactLine}</Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>9. Security</Text>
            <Text style={styles.sectionText}>
              We use reasonable technical and organizational measures to protect personal information. No online service
              can guarantee perfect security. Help protect your account by using a strong password and keeping your device
              updated.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>10. Retention</Text>
            <Text style={styles.sectionText}>
              We keep information for as long as your account is active and as needed to operate Coach Connect, resolve
              disputes, enforce agreements, and meet legal obligations. After account deletion, some information may
              persist for a limited period in backups or logs before it ages out.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>11. Your in-app choices</Text>
            <Text style={styles.sectionText}>
              You can adjust notification preferences in the app and your device settings, turn optional AI features off
              in Settings, and use Delete account if you want to leave. The Privacy and data rights item in Settings
              summarizes how to exercise common requests alongside this policy.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>12. Children</Text>
            <Text style={styles.sectionText}>
              Coach Connect is not directed at children under 13, and we do not knowingly collect personal information
              from children under 13. If you believe we have collected information from a child under 13, contact us and
              we will take appropriate steps.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>13. Changes to this policy</Text>
            <Text style={styles.sectionText}>
              We may update this policy from time to time. When we do, we will change the “Last updated” date at the top.
              If changes are material, we may also provide a notice in the app or by email where appropriate.
            </Text>
          </PolicySectionCard>

          <PolicySectionCard styles={styles}>
            <Text style={styles.sectionTitle}>14. Contact</Text>
            <Text style={styles.sectionText}>
              Questions about this policy or your data: email us at the address below or use Contact Support in Settings.
            </Text>
            <Text style={[styles.sectionText, { marginTop: 10 }]}>{contactLine}</Text>
          </PolicySectionCard>

          <Text style={styles.legalNote}>
            This policy is meant to be readable and accurate about our product. It is not a substitute for advice from a
            licensed attorney in your country or state, and it is not a certification of compliance with GDPR, CCPA, or
            any other law. Update this text when your product or vendors change.
          </Text>
        </Animated.View>
      </ScrollView>

      <BottomNavBar activeTabKey="home" />
    </SafeAreaView>
  );
}
