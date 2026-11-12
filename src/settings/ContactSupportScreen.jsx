// Design Law Contact support: topic chips, SUBJECT / MESSAGE fields, Send + Email us.
// Flow: pick topic → POST /api/support/contact with Firebase ID token → mailto fallback.
// Used from Settings. API path and firestore delivery flag stay as the server returns them.

import React, { useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getSupportEmail } from './supportContact';
import { openSupportMailto, offerSupportMailtoFallback } from './emailSupport';
import { getApiBase } from '../for-both/online-connection/whereToConnect';
import { getAuth } from 'firebase/auth';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import {
  SHELL_SAFE_AREA_EDGES,
  FORM_SCROLL_PROPS,
  useShellBottomNavInset,
} from '../navigation/bottomMenuSpacing';
import NbButton from '../look-and-feel/NbButton';
import { nb, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_INSET = 24;
const EXTRA_SCROLL_PAD = 16;
const FADE_MS = 350;
const RISE_FROM = 10;
const SUPPORT_CONTACT_PATH = '/api/support/contact';
const MAIL_SUBJECT_DEFAULT = 'Coach Connect support';
const DELIVERY_FIRESTORE = 'firestore';

const TOPIC_CHIPS = [
  'Signing in',
  'Using the app',
  'Payments and billing',
  'AI Coach',
  'Privacy',
];

const TOPIC_HINTS = {
  'Signing in': 'For sign-in issues, try Forgot password first.',
  'Using the app': 'Include what you tapped and what you expected.',
  'Payments and billing': 'Do not include full card numbers.',
  'AI Coach': 'Say whether AI features are on in Settings.',
  Privacy: 'We may ask you to verify your identity for data requests.',
};

// ===== HELPER FUNCTIONS =====

function openSupportMail() {
  openSupportMailto({ subject: MAIL_SUBJECT_DEFAULT });
}

function supportScrollBottomPad(embedShellBottomNav, shellNavInset, bottomInset) {
  if (embedShellBottomNav) return shellNavInset;
  return Math.max(bottomInset, EXTRA_SCROLL_PAD) + SHELL_NAV_INSET;
}

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

// ===== MAIN FUNCTION =====

export default function ContactSupportScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = supportScrollBottomPad(embedShellBottomNav, shellNavInset, insets.bottom);
  const supportEmail = getSupportEmail();
  const [topic, setTopic] = useState(TOPIC_CHIPS[0]);
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

    // Prefix topic so support can route; body stays free-form.
    const routedSubject = `[${topic}] ${subjectText}`;
    const routedMessage = `Topic: ${topic}\n\n${messageText}`;

    setSubmitting(true);
    try {
      const json = await postSupportContact({
        subjectText: routedSubject,
        messageText: routedMessage,
      });
      setSubject('');
      setMessage('');
      openSupportMailto({ subject: routedSubject, body: routedMessage });
      alertAfterSupportSend(supportEmail, json);
    } catch (error) {
      offerSupportMailtoFallback({
        subject: routedSubject,
        body: routedMessage,
        apiError: error?.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

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
        title="Contact support"
        subtitle="Coach Connect support"
        onBack={onClose}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <Text style={[styles.label, { color: colors.nbMuted }]}>WHAT IS IT ABOUT?</Text>
          <View style={styles.chipWrap}>
            {TOPIC_CHIPS.map((chip) => {
              const selected = topic === chip;
              return (
                <Pressable
                  key={chip}
                  onPress={() => setTopic(chip)}
                  style={[
                    styles.chip,
                    {
                      borderColor: colors.nbBorder,
                      backgroundColor: selected ? colors.nbFill : colors.nbSurface,
                      shadowColor: colors.nbShadow,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: selected ? colors.nbOnFill : colors.nbInk },
                    ]}
                  >
                    {chip}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.hint, { color: colors.nbMuted }]}>
            {TOPIC_HINTS[topic] || ''}
          </Text>

          <Text style={[styles.label, { color: colors.nbMuted }]}>SUBJECT</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Cannot sign in on a new phone"
            placeholderTextColor={colors.nbMuted}
            style={[
              styles.input,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
                color: colors.nbInk,
                shadowColor: colors.nbShadow,
              },
            ]}
            autoCapitalize="sentences"
            editable={!submitting}
            returnKeyType="next"
          />

          <Text style={[styles.label, { color: colors.nbMuted }]}>MESSAGE</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Describe what happened…"
            placeholderTextColor={colors.nbMuted}
            style={[
              styles.input,
              styles.inputMultiline,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
                color: colors.nbInk,
                shadowColor: colors.nbShadow,
              },
            ]}
            multiline
            editable={!submitting}
          />

          <View style={styles.buttonWrap}>
            <NbButton variant="fill" onPress={submit} disabled={submitting}>
              {submitting ? 'Sending…' : 'Send message'}
            </NbButton>
          </View>
          <View style={styles.buttonWrap}>
            <NbButton variant="ghost" onPress={openSupportMail} disabled={submitting}>
              Email us instead
            </NbButton>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Manipulate here: topic chip padding / hard shadow
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    minHeight: 40,
    justifyContent: 'center',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  chipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: spacing.sm,
    lineHeight: 17,
  },
  input: {
    fontFamily: 'Inter_400Regular',
    minHeight: 48,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  buttonWrap: { marginTop: spacing.md },
});
