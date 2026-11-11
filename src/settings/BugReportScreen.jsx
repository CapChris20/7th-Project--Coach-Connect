// Bug report form: expected vs actual, optional steps, then the same support API as Contact Support.
// Flow: fade in → POST /api/support/contact with a "Bug report" subject → open Mail as a backup.
// Used from Settings. Field order (expected, happened, steps, device) is what the email body uses.

import React, { useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, StatusBar, Alert, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getSupportEmail } from './supportContact';
import { openSupportMailto, offerSupportMailtoFallback } from './emailSupport';
import { getApiBase } from '../for-both/online-connection/whereToConnect';
import { getAuth } from 'firebase/auth';
import TopHeader from '../for-both/loading-and-header/TopHeader';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../navigation/bottomMenuSpacing';
import { Ionicons } from '@expo/vector-icons';
import NbCard from '../look-and-feel/NbCard';
import NbButton from '../look-and-feel/NbButton';
import { nb, gradients, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_INSET = 24;
const EXTRA_SCROLL_PAD = 16;
const FADE_MS = 350;
const RISE_FROM = 10;
const SUPPORT_CONTACT_PATH = '/api/support/contact';
const BUG_MAIL_SUBJECT = 'Bug report — Coach Connect';
const DELIVERY_FIRESTORE = 'firestore';

const BUG_MAIL_BODY_TEMPLATE =
  'What I was doing:\n\n' +
  'What went wrong:\n\n' +
  'Device (iPhone / Android):\n\n' +
  'Rough date/time:\n\n';

// ===== HELPER FUNCTIONS =====

// Helpers removed - using NbCard directly

function openBugMail() {
  openSupportMailto({ subject: BUG_MAIL_SUBJECT, body: BUG_MAIL_BODY_TEMPLATE });
}

/**
 * @param {boolean} embedShellBottomNav
 * @param {number} shellNavInset
 * @param {number} bottomInset
 * @returns {number}
 */
function bugScrollBottomPad(embedShellBottomNav, shellNavInset, bottomInset) {
  if (embedShellBottomNav) return shellNavInset;
  return Math.max(bottomInset, EXTRA_SCROLL_PAD) + SHELL_NAV_INSET;
}

/**
 * @param {{ expectedText: string, happenedText: string, stepsText: string, deviceText: string }} fields
 * @returns {string}
 */
function buildBugMessage({ expectedText, happenedText, stepsText, deviceText }) {
  return (
    `What I expected:\n${expectedText}\n\n` +
    `What happened:\n${happenedText}\n\n` +
    (stepsText ? `Steps:\n${stepsText}\n\n` : '') +
    (deviceText ? `Device:\n${deviceText}\n\n` : '')
  );
}

/**
 * @param {string} message
 * @returns {Promise<object>}
 */
async function postBugReport(message) {
  const auth = getAuth();
  const user = auth.currentUser;
  const token = await user.getIdToken(true);
  const base = getApiBase();
  const response = await fetch(`${base}${SUPPORT_CONTACT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subject: BUG_MAIL_SUBJECT, message }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.ok !== true) {
    throw new Error(json?.error || 'Failed to send bug report.');
  }
  return json;
}

/**
 * @param {string} supportEmail
 * @param {object} json
 */
function alertAfterBugSend(supportEmail, json) {
  if (json?.delivery === DELIVERY_FIRESTORE) {
    Alert.alert(
      'Almost done',
      `We saved your bug report and opened email to ${supportEmail || 'support'}. Tap Send in Mail so it hits the inbox.`,
    );
    return;
  }
  Alert.alert('Sent', 'Thanks — your bug report was sent (email opened as a backup).');
}

function buildBugStyles(scrollBottomPad, colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.nbBackground },
    scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: scrollBottomPad },
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
    intro: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: colors.nbMuted,
      lineHeight: 22,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    sectionHeaderRow: { marginTop: spacing.sm, marginBottom: spacing.sm },
    sectionHeader: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 12,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.nbMuted,
    },
    card: {
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    cardTitle: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 16,
      color: colors.nbInk,
      marginBottom: spacing.sm,
      letterSpacing: -0.2,
    },
    body: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: colors.nbMuted,
      lineHeight: 22,
    },
    bullet: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: colors.nbMuted,
      lineHeight: 22,
      marginBottom: spacing.sm,
    },
    formTitle: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 17,
      color: colors.nbInk,
      marginBottom: 6,
      letterSpacing: -0.2,
    },
    formSub: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: colors.nbMuted,
      lineHeight: 21,
    },
    label: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.nbMuted,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    input: {
      fontFamily: 'Inter_400Regular',
      height: 48,
      borderWidth: nb.borderWidth,
      borderColor: colors.nbBorder,
      borderRadius: 10,
      paddingHorizontal: spacing.sm,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface,
      marginTop: spacing.sm,
    },
    inputMultiline: {
      minHeight: 110,
      height: undefined,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
      textAlignVertical: 'top',
    },
    helper: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: colors.nbMuted,
      marginTop: spacing.sm,
      lineHeight: 17,
    },
    buttonWrap: { marginTop: spacing.sm },
    footer: {
      marginTop: spacing.sm,
      padding: spacing.md,
    },
    footerText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: colors.nbMuted,
      lineHeight: 20,
    },
  });
}

function BugHero({ styles: cardStyles, colors }) {
  return (
    <NbCard style={cardStyles.heroCard}>
      <View style={[cardStyles.heroIcon, { backgroundColor: colors.nbSurfaceChip }]}>
        <Ionicons name="bug-outline" size={34} color={colors.nbInk} />
      </View>
      <Text style={cardStyles.heroTitle}>Report a Bug</Text>
      <Text style={cardStyles.heroSub}>Help us make it better.</Text>
    </NbCard>
  );
}

function SectionHeader({ title, styles: cardStyles }) {
  return (
    <View style={cardStyles.sectionHeaderRow}>
      <Text style={cardStyles.sectionHeader}>{title}</Text>
    </View>
  );
}

function InfoCard({ title, body, styles: cardStyles }) {
  return (
    <NbCard style={cardStyles.card}>
      <Text style={cardStyles.cardTitle}>{title}</Text>
      <Text style={cardStyles.body}>{body}</Text>
    </NbCard>
  );
}

// ===== MAIN FUNCTION =====

export default function BugReportScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = bugScrollBottomPad(embedShellBottomNav, shellNavInset, insets.bottom);
  const supportEmail = getSupportEmail();
  const [whatExpected, setWhatExpected] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [steps, setSteps] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(RISE_FROM)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const includeList = useMemo(
    () => [
      '1. What you expected',
      '2. What you got',
      '3. Steps: “I opened… then I tapped…”',
      '4. How often: once or every time',
      '5. Device: iPhone or Android',
    ],
    [],
  );

  const templateList = useMemo(
    () => [
      'What I was doing:',
      'What went wrong:',
      'Device (iPhone / Android):',
      'Rough date/time:',
    ],
    [],
  );

  async function submitBug() {
    const expectedText = String(whatExpected || '').trim();
    const happenedText = String(whatHappened || '').trim();
    const stepsText = String(steps || '').trim();
    if (!expectedText || !happenedText) {
      Alert.alert('Missing details', 'Please fill in what you expected and what happened.');
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again and retry.');
      return;
    }

    setSubmitting(true);
    const message = buildBugMessage({
      expectedText,
      happenedText,
      stepsText,
      deviceText: deviceInfo,
    });

    try {
      const json = await postBugReport(message);
      setWhatExpected('');
      setWhatHappened('');
      setSteps('');
      setDeviceInfo('');
      openSupportMailto({ subject: BUG_MAIL_SUBJECT, body: message });
      alertAfterBugSend(supportEmail, json);
    } catch (error) {
      offerSupportMailtoFallback({ subject: BUG_MAIL_SUBJECT, body: message, apiError: error?.message });
    } finally {
      setSubmitting(false);
    }
  }

  const styles = buildBugStyles(scrollBottomPad, colors);
  const footerCopy = supportEmail
    ? `Questions? Email ${supportEmail}. We can’t give medical advice; for health emergencies, contact local emergency services.`
    : 'We can’t give medical advice; for health emergencies, contact local emergency services.';

  return (
    <SafeAreaView style={styles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <TopHeader title="Report a bug" skipTopSafeInset onBack={onClose} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <BugHero styles={styles} colors={colors} />

          <Text style={styles.intro}>
            If something broke or feels wrong, we want to know. Your report helps everyone.
          </Text>

          <SectionHeader title="Report details" styles={styles} />

          <InfoCard
            title="What counts as a bug"
            body="Buttons that don’t respond, screens that won’t load, data that disappears, videos that never play, or anything that used to work and suddenly doesn’t."
            styles={styles}
          />

          <NbCard style={styles.card}>
            <Text style={styles.cardTitle}>Please include</Text>
            {includeList.map((line) => (
              <Text key={line} style={styles.bullet}>
                • {line.replace(/^\d+\.\s*/, '')}
              </Text>
            ))}
          </NbCard>

          <InfoCard
            title="Don’t send"
            body="Passwords, full card numbers, or private health details you don’t want stored in email."
            styles={styles}
          />

          <SectionHeader title="Send a bug report" styles={styles} />

          <NbCard style={styles.card}>
            <Text style={styles.formTitle}>Send a bug report</Text>
            <Text style={styles.formSub}>Tell us what you expected, what happened, and steps if you can.</Text>

            <Text style={styles.label}>What you expected</Text>
            <TextInput
              value={whatExpected}
              onChangeText={setWhatExpected}
              placeholder="Example: “I expected the workout to save.”"
              placeholderTextColor={colors.nbMuted}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>What happened instead</Text>
            <TextInput
              value={whatHappened}
              onChangeText={setWhatHappened}
              placeholder="Example: “It froze and kicked me out.”"
              placeholderTextColor={colors.nbMuted}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>Steps (optional)</Text>
            <TextInput
              value={steps}
              onChangeText={setSteps}
              placeholder="Example: “Open Training → Planner → Generate…”"
              placeholderTextColor={colors.nbMuted}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>Device (optional)</Text>
            <TextInput
              value={deviceInfo}
              onChangeText={setDeviceInfo}
              placeholder="Example: “iPhone 14, iOS 18”"
              placeholderTextColor={colors.nbMuted}
              style={styles.input}
              editable={!submitting}
            />
            <Text style={styles.helper}>Don’t include passwords or payment details.</Text>

            <View style={styles.buttonWrap}>
              <NbButton variant="brand" onPress={submitBug} disabled={submitting}>
                {submitting ? 'Sending…' : 'Send bug report'}
              </NbButton>
            </View>

            {supportEmail ? (
              <Pressable onPress={openBugMail}>
                <Text style={[styles.helper, { marginTop: spacing.sm }]}>Or email instead</Text>
              </Pressable>
            ) : null}
          </NbCard>

          <NbCard style={styles.footer}>
            <Text style={styles.footerText}>{footerCopy}</Text>
          </NbCard>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
