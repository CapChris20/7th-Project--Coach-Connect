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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const PINK = '#FF6B9D';
const ORANGE = '#F97316';
const BORDER_PAD = 0.6;
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
      inputBg: 'rgba(255,255,255,0.03)',
    };
  }
  return {
    cardBackground: '#FFFFFF',
    border: 'rgba(10,10,15,0.06)',
    text2: 'rgba(10,10,15,0.86)',
    text3: 'rgba(10,10,15,0.68)',
    inputBg: 'rgba(0,0,0,0.01)',
  };
}

function GradientCard({ borderColors, style, innerStyle, children }) {
  return (
    <LinearGradient colors={borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      <View style={innerStyle}>{children}</View>
    </LinearGradient>
  );
}

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

function buildBugStyles(isDark, cardTokens, scrollBottomPad) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF' },
    scroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: scrollBottomPad },
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
    intro: { fontSize: 14, fontWeight: '600', color: cardTokens.text2, lineHeight: 22, marginTop: 14, marginBottom: 16 },
    sectionHeaderRow: { marginTop: 8, marginBottom: 12 },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: cardTokens.text3,
    },
    sectionUnderline: { width: 22, height: 1.5, backgroundColor: ORANGE, marginTop: 8, borderRadius: 999 },
    cardOuter: { borderRadius: 14, padding: BORDER_PAD, marginBottom: 12 },
    cardInner: { borderRadius: 12, padding: 16, backgroundColor: cardTokens.cardBackground, borderWidth: 0.5, borderColor: cardTokens.border },
    cardTitle: { fontSize: 16, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0A0A0F', marginBottom: 8, letterSpacing: -0.2 },
    body: { fontSize: 14, fontWeight: '600', color: cardTokens.text2, lineHeight: 22 },
    bullet: { fontSize: 14, fontWeight: '600', color: cardTokens.text2, lineHeight: 22, marginBottom: 8 },
    formTitle: { fontSize: 17, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0A0A0F', marginBottom: 6, letterSpacing: -0.2 },
    formSub: { fontSize: 14, fontWeight: '600', color: cardTokens.text2, lineHeight: 21 },
    label: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase', color: cardTokens.text3, marginTop: 14, marginBottom: 8 },
    input: {
      height: 48,
      borderWidth: 0.5,
      borderColor: 'rgba(249,115,22,0.20)',
      borderRadius: 10,
      paddingHorizontal: 14,
      color: isDark ? '#FFFFFF' : '#0A0A0F',
      backgroundColor: cardTokens.inputBg,
      marginTop: 10,
    },
    inputMultiline: { minHeight: 110, height: undefined, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
    helper: { fontSize: 12, fontWeight: '600', color: cardTokens.text3, marginTop: 10, lineHeight: 17 },
    buttonWrap: { marginTop: 14 },
    button: { borderRadius: 999, overflow: 'hidden' },
    buttonInner: { height: 48, alignItems: 'center', justifyContent: 'center' },
    buttonText: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.3 },
    footer: {
      marginTop: 12,
      padding: 16,
      backgroundColor: cardTokens.cardBackground,
      borderColor: cardTokens.border,
      borderWidth: 0.5,
      borderRadius: 12,
    },
    footerText: { fontSize: 13, fontWeight: '600', color: cardTokens.text2, lineHeight: 20 },
  });
}

function BugHero({ styles: cardStyles }) {
  return (
    <GradientCard borderColors={[ORANGE, PINK]} style={cardStyles.heroOuter} innerStyle={cardStyles.heroInner}>
      <GradientCard borderColors={[ORANGE, PINK]} style={cardStyles.heroIconOuter} innerStyle={cardStyles.heroIconInner}>
        <Ionicons name="bug-outline" size={34} color="#FFFFFF" />
      </GradientCard>
      <Text style={cardStyles.heroTitle}>Report a Bug</Text>
      <Text style={cardStyles.heroSub}>Help us make it better.</Text>
    </GradientCard>
  );
}

function SectionHeader({ title, styles: cardStyles }) {
  return (
    <View style={cardStyles.sectionHeaderRow}>
      <Text style={cardStyles.sectionHeader}>{title}</Text>
      <View style={cardStyles.sectionUnderline} />
    </View>
  );
}

function InfoCard({ title, body, styles: cardStyles }) {
  return (
    <GradientCard borderColors={[ORANGE, PINK]} style={cardStyles.cardOuter} innerStyle={cardStyles.cardInner}>
      <Text style={cardStyles.cardTitle}>{title}</Text>
      <Text style={cardStyles.body}>{body}</Text>
    </GradientCard>
  );
}

// ===== MAIN FUNCTION =====

export default function BugReportScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = bugScrollBottomPad(embedShellBottomNav, shellNavInset, insets.bottom);
  const supportEmail = getSupportEmail();
  const cardTokens = getCardTokens(isDark);
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

  const styles = buildBugStyles(isDark, cardTokens, scrollBottomPad);
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
          <BugHero styles={styles} />

          <Text style={styles.intro}>
            If something broke or feels wrong, we want to know. Your report helps everyone.
          </Text>

          <SectionHeader title="Report details" styles={styles} />

          <InfoCard
            title="What counts as a bug"
            body="Buttons that don’t respond, screens that won’t load, data that disappears, videos that never play, or anything that used to work and suddenly doesn’t."
            styles={styles}
          />

          <GradientCard borderColors={[ORANGE, PINK]} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.cardTitle}>Please include</Text>
            {includeList.map((line) => (
              <Text key={line} style={styles.bullet}>- {line.replace(/^\d+\.\s*/, '')}</Text>
            ))}
          </GradientCard>

          <InfoCard
            title="Don’t send"
            body="Passwords, full card numbers, or private health details you don’t want stored in email."
            styles={styles}
          />

          <SectionHeader title="Send a bug report" styles={styles} />

          <GradientCard borderColors={[ORANGE, PINK]} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.formTitle}>Send a bug report</Text>
            <Text style={styles.formSub}>Tell us what you expected, what happened, and steps if you can.</Text>

            <Text style={styles.label}>What you expected</Text>
            <TextInput
              value={whatExpected}
              onChangeText={setWhatExpected}
              placeholder="Example: “I expected the workout to save.”"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>What happened instead</Text>
            <TextInput
              value={whatHappened}
              onChangeText={setWhatHappened}
              placeholder="Example: “It froze and kicked me out.”"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>Steps (optional)</Text>
            <TextInput
              value={steps}
              onChangeText={setSteps}
              placeholder="Example: “Open Training → Planner → Generate…”"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />

            <Text style={styles.label}>Device (optional)</Text>
            <TextInput
              value={deviceInfo}
              onChangeText={setDeviceInfo}
              placeholder="Example: “iPhone 14, iOS 18”"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={styles.input}
              editable={!submitting}
            />
            <Text style={styles.helper}>Don’t include passwords or payment details.</Text>

            <View style={styles.buttonWrap}>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.98 }] }]}
                onPress={submitBug}
                disabled={submitting}
              >
                <LinearGradient colors={[ORANGE, PINK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.buttonInner}>
                  {submitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.buttonText}>Sending…</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>Send bug report</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>

            {supportEmail ? (
              <Pressable onPress={openBugMail}>
                <Text style={[styles.helper, { marginTop: 10 }]}>Or email instead</Text>
              </Pressable>
            ) : null}
          </GradientCard>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{footerCopy}</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
