// Contact Support: in-app ticket form plus a mailto fallback when Cloud Run cannot send email.
// Flow: fade in → POST /api/support/contact with the Firebase ID token → open Mail as a backup.
// Used from Settings. The API path and the "firestore" delivery flag stay as the server already returns them.

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
const MAIL_SUBJECT_DEFAULT = 'Coach Connect support';
const DELIVERY_FIRESTORE = 'firestore';

// ===== HELPER FUNCTIONS =====

// Simple wrapper - no longer using gradients, just NbCard
function GradientCard({ children }) {
  return children;
}

const NUTRITION_GRADIENT = gradients.brand.colors;

function openSupportMail() {
  openSupportMailto({ subject: MAIL_SUBJECT_DEFAULT });
}

/**
 * Extra room above the shell tab bar, or the home-indicator when this screen owns the stack.
 * @param {boolean} embedShellBottomNav
 * @param {number} shellNavInset
 * @param {number} bottomInset
 * @returns {number}
 */
function supportScrollBottomPad(embedShellBottomNav, shellNavInset, bottomInset) {
  if (embedShellBottomNav) return shellNavInset;
  return Math.max(bottomInset, EXTRA_SCROLL_PAD) + SHELL_NAV_INSET;
}

/**
 * POST the ticket. Throws when the server does not return { ok: true }.
 * vocab: getIdToken(true) forces a fresh Firebase JWT so a stale token is not the reason send fails.
 * @param {{ subjectText: string, messageText: string }} fields
 * @returns {Promise<object>}
 */
async function postSupportContact({ subjectText, messageText }) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error('not_signed_in');
  }
  const token = await user.getIdToken(true);
  const base = getApiBase();
  const response = await fetch(`${base}${SUPPORT_CONTACT_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ subject: subjectText, message: messageText }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.ok !== true) {
    throw new Error(json?.error || 'Failed to send message.');
  }
  return json;
}

/**
 * @param {string} supportEmail
 * @param {object} json
 */
function alertAfterSupportSend(supportEmail, json) {
  if (json?.delivery === DELIVERY_FIRESTORE) {
    Alert.alert(
      'Almost done',
      `We saved your ticket and opened email to ${supportEmail || 'support'}. Tap Send in Mail so it hits the inbox.`,
    );
    return;
  }
  Alert.alert('Sent', 'Thanks — we received your message (and opened email as a backup).');
}

function buildSupportStyles(scrollBottomPad, colors) {
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
    label: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 11,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.nbMuted,
      marginTop: spacing.sm,
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
      minHeight: 120,
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

function SupportHero({ styles: cardStyles }) {
  return (
    <GradientCard borderColors={NUTRITION_GRADIENT} style={cardStyles.heroOuter} innerStyle={cardStyles.heroInner}>
      <GradientCard borderColors={NUTRITION_GRADIENT} style={cardStyles.heroIconOuter} innerStyle={cardStyles.heroIconInner}>
        <Ionicons name="headset-outline" size={34} color="#FFFFFF" />
      </GradientCard>
      <Text style={cardStyles.heroTitle}>Contact Support</Text>
      <Text style={cardStyles.heroSub}>We’re here to help.</Text>
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

function BulletCard({ title, lines, styles: cardStyles }) {
  return (
    <GradientCard borderColors={NUTRITION_GRADIENT} style={cardStyles.cardOuter} innerStyle={cardStyles.cardInner}>
      <Text style={cardStyles.cardTitle}>{title}</Text>
      {lines.map((line, index) => (
        <Text
          key={line}
          style={[cardStyles.bullet, index === lines.length - 1 ? { marginBottom: 0 } : null]}
        >
          - {line}
        </Text>
      ))}
    </GradientCard>
  );
}

// ===== MAIN FUNCTION =====

export default function ContactSupportScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = supportScrollBottomPad(embedShellBottomNav, shellNavInset, insets.bottom);
  const supportEmail = getSupportEmail();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(RISE_FROM)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const checklist = useMemo(
    () => ({
      before: [
        'Fully close the app and open it again.',
        'Check you’re on the account you normally use.',
        'For sign-in issues, try Forgot password first.',
      ],
      include: [
        'What you were trying to do',
        'What happened instead',
        'iPhone or Android (approximate model is fine)',
        'Screenshots if something looks wrong',
      ],
    }),
    [],
  );

  async function submit() {
    const subjectText = String(subject || '').trim();
    const messageText = String(message || '').trim();
    if (!subjectText) {
      Alert.alert('Missing subject', 'Please add a short subject so we can route your message.');
      return;
    }
    if (!messageText) {
      Alert.alert('Missing message', 'Please describe what you need help with.');
      return;
    }

    const auth = getAuth();
    if (!auth.currentUser) {
      Alert.alert('Not signed in', 'Please sign in again and retry.');
      return;
    }

    setSubmitting(true);
    try {
      const json = await postSupportContact({ subjectText, messageText });
      setSubject('');
      setMessage('');
      openSupportMailto({ subject: subjectText, body: messageText });
      alertAfterSupportSend(supportEmail, json);
    } catch (error) {
      offerSupportMailtoFallback({
        subject: subjectText,
        body: messageText,
        apiError: error?.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const styles = buildSupportStyles(scrollBottomPad, colors);
  const footerCopy = supportEmail
    ? `Questions? Email ${supportEmail}. We can’t give medical advice; for health emergencies, contact local emergency services.`
    : 'We can’t give medical advice; for health emergencies, contact local emergency services.';

  return (
    <SafeAreaView style={styles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <TopHeader title="Contact support" skipTopSafeInset onBack={onClose} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <SupportHero styles={styles} colors={colors} />

          <Text style={styles.intro}>
            We’re glad you’re here. Tell us what’s going on and we’ll work through it with you.
          </Text>

          <SectionHeader title="Using the app" styles={styles} />

          <BulletCard
            title="What we can help with"
            lines={[
              'Signing in, password reset, or account deletion',
              'Workout planner, exercise library, active workouts, or history',
              'Nutrition logging, barcode search, or home dashboard numbers',
              'Messages, trainer requests, files your coach shared',
              'AI Coach (limits, scope, or turning AI off in Settings)',
              'Privacy questions or requests about your data',
            ]}
            styles={styles}
          />

          <BulletCard title="Before you email" lines={checklist.before} styles={styles} />
          <BulletCard title="In your email, please include" lines={checklist.include} styles={styles} />

          <GradientCard borderColors={NUTRITION_GRADIENT} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.cardTitle}>What we can’t do</Text>
            <Text style={styles.body}>We can’t diagnose conditions, prescribe treatment, or replace your doctor or dietitian.</Text>
          </GradientCard>

          <SectionHeader title="Email us" styles={styles} />

          <GradientCard borderColors={NUTRITION_GRADIENT} style={styles.cardOuter} innerStyle={styles.cardInner}>
            <Text style={styles.formTitle}>Email us</Text>
            <Text style={styles.formSub}>
              Send a message right here. If delivery fails, you can still email us.
            </Text>

            <Text style={styles.label}>Subject</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject (required)"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={styles.input}
              autoCapitalize="sentences"
              editable={!submitting}
              returnKeyType="next"
            />
            <Text style={styles.label}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Message (required)"
              placeholderTextColor={getCardTokens(isDark).text3}
              style={[styles.input, styles.inputMultiline]}
              multiline
              editable={!submitting}
            />
            <Text style={styles.helper}>
              Tip: include what you tapped, what you expected, and what happened instead.
            </Text>

            <View style={styles.buttonWrap}>
              <NbButton variant="brand" onPress={submit} disabled={submitting}>
                {submitting ? 'Sending…' : 'Send message'}
              </NbButton>
            </View>

            {supportEmail ? (
              <>
                <Text style={[styles.body, { marginTop: 12 }]}>Email: {supportEmail}</Text>
                <Pressable onPress={openSupportMail}>
                  <Text style={[styles.helper, { marginTop: 8 }]}>Or email instead</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.helper}>No support email is configured for this build.</Text>
            )}
          </GradientCard>

          <View style={styles.footer}>
            <Text style={styles.footerText}>{footerCopy}</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
