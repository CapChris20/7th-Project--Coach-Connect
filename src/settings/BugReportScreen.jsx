// Bug report form: expected vs actual, optional steps, then the same support API as Contact Support.
// Flow: fade in → POST /api/support/contact with a "Bug report" subject → open Mail as a backup.
// Used from Settings. Field order (expected, happened, steps, device) is what the email body uses.

import React, { useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, StatusBar, Alert, Pressable, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getSupportEmail } from './supportContact';
import { openSupportMailto, offerSupportMailtoFallback } from './emailSupport';
import { getApiBase } from '../for-both/online-connection/whereToConnect';
import { getAuth } from 'firebase/auth';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../navigation/bottomMenuSpacing';
import { Ionicons } from '@expo/vector-icons';
import NbButton from '../look-and-feel/NbButton';
import { nb, spacing } from '../look-and-feel/colorPalette';

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
function buildBugMessage({ expectedText, happenedText, whenText, deviceText }) {
  return (
    `What I was trying to do:\n${expectedText}\n\n` +
    `What happened instead:\n${happenedText}\n\n` +
    (whenText ? `Rough date and time:\n${whenText}\n\n` : '') +
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
    buttonWrap: { marginTop: spacing.md },
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
    // Manipulate here: dashed screenshot zone border style
    dashZone: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: 10,
      borderWidth: nb.borderWidth,
      borderStyle: 'dashed',
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: nb.minTouchTarget,
    },
    dashTitle: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 14,
    },
  });
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

  async function submitBug() {
    const expectedText = String(whatExpected || '').trim();
    const happenedText = String(whatHappened || '').trim();
    const whenText = String(steps || '').trim();
    if (!expectedText || !happenedText) {
      Alert.alert('Missing details', 'Please fill in what you were trying to do and what happened.');
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
      whenText,
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
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.nbBackground} />
      <NbPageHeader
        title="Report a bug"
        subtitle="Help us make it better."
        onBack={onClose}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <Text style={styles.label}>WHAT YOU WERE TRYING TO DO</Text>
          <TextInput
            value={whatExpected}
            onChangeText={setWhatExpected}
            placeholder="Log my lunch with a barcode."
            placeholderTextColor={colors.nbMuted}
            style={[styles.input, styles.inputMultiline]}
            multiline
            editable={!submitting}
          />

          <Text style={styles.label}>WHAT HAPPENED INSTEAD</Text>
          <TextInput
            value={whatHappened}
            onChangeText={setWhatHappened}
            placeholder="The scanner opened, found the product, then the app closed."
            placeholderTextColor={colors.nbMuted}
            style={[styles.input, styles.inputMultiline]}
            multiline
            editable={!submitting}
          />

          <Text style={styles.label}>ROUGH DATE AND TIME</Text>
          <TextInput
            value={steps}
            onChangeText={setSteps}
            placeholder="Today, about 12:30 PM"
            placeholderTextColor={colors.nbMuted}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>DEVICE (OPTIONAL)</Text>
          <TextInput
            value={deviceInfo}
            onChangeText={setDeviceInfo}
            placeholder="iPhone 15"
            placeholderTextColor={colors.nbMuted}
            style={styles.input}
            editable={!submitting}
          />

          {/* Design Law dashed drop zone — screenshots stay optional; no picker wired yet */}
          <View
            style={[
              styles.dashZone,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
            ]}
          >
            <Ionicons name="images-outline" size={28} color={colors.nbInk} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[styles.dashTitle, { color: colors.nbInk }]}>
                Screenshots if something looks wrong
              </Text>
              <Text style={[styles.helper, { marginTop: 2 }]}>Optional. Up to 3 images</Text>
            </View>
          </View>

          <View style={styles.buttonWrap}>
            <NbButton variant="fill" onPress={submitBug} disabled={submitting}>
              {submitting ? 'Sending…' : 'Send bug report'}
            </NbButton>
          </View>

          {supportEmail ? (
            <Pressable onPress={openBugMail}>
              <Text style={[styles.helper, { marginTop: spacing.sm }]}>Or email instead</Text>
            </Pressable>
          ) : null}

          <Text style={[styles.footerText, { marginTop: spacing.lg }]}>{footerCopy}</Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
