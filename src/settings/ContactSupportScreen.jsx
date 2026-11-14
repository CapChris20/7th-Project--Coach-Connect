// Design Law Contact support: topic chips, subject + message, Send + Email us.
// Flow: pick topic → POST /api/support/contact with Firebase ID token → mailto fallback.
// Used from Settings. API path and firestore delivery flag stay as the server returns them.
//
// vocab: getIdToken(true) = force-refresh Firebase Auth JWT for the Bearer header
// vocab: NbNoticeSheet = Design Law sheet instead of Alert.alert

import React, { useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
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
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';
import { nb, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_INSET = 24;
const EXTRA_SCROLL_PAD = 16;
// Manipulate here: entrance fade/rise — match other settings forms
const FADE_MS = 350;
const RISE_FROM = 10;
const SUPPORT_CONTACT_PATH = '/api/support/contact';
const MAIL_SUBJECT_DEFAULT = 'Coach Connect support';
const DELIVERY_FIRESTORE = 'firestore';

// Manipulate here: topic chips + per-topic hint copy
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

/**
 * Coerce any value to a trimmed string (empty when missing).
 * @param {*} value
 * @returns {string}
 */
function asTrimmedString(value) {
  return asTrimmedString(value);
}


/**
 * Bottom padding for the form scroll — shell nav or safe-area + gutter.
 * @param {boolean} embedShellBottomNav
 * @param {number} shellNavInset
 * @param {number} bottomInset
 * @returns {number}
 */
function scrollPaddingForSupportForm(embedShellBottomNav, shellNavInset, bottomInset) {
  if (embedShellBottomNav) return shellNavInset;
  return Math.max(bottomInset, EXTRA_SCROLL_PAD) + SHELL_NAV_INSET;
}

/**
 * POST subject/message with the signed-in user's ID token.
 * @param {{ subjectText: string, messageText: string }} fields
 * @returns {Promise<object>}
 */
async function postSupportContactToApi({ subjectText, messageText }) {
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
  const sendFailed = !response.ok || json?.ok !== true;
  if (sendFailed) {
    throw new Error(json?.error || 'Failed to send message.');
  }
  return json;
}

/**
 * Notice copy after a successful API send (Firestore staging vs fully delivered).
 * @param {string|null} supportEmail
 * @param {object} json
 * @returns {{ title: string, message: string }}
 */
function buildNoticeAfterSupportSend(supportEmail, json) {
  if (json?.delivery === DELIVERY_FIRESTORE) {
    return {
      title: 'Almost done',
      message: `We saved your ticket and opened email to ${supportEmail || 'support'}. Tap Send in Mail so it hits the inbox.`,
    };
  }
  return {
    title: 'Sent',
    message: 'Thanks — we received your message (and opened email as a backup).',
  };
}

/**
 * One topic chip — ink fill when selected, surface when not.
 */
function TopicChip({ topicLabel, isSelected, onPickTopic, colors }) {
  let chipBackgroundColor = colors.nbSurface;
  if (isSelected) {
    chipBackgroundColor = colors.nbFill;
  }
  let chipTextColor = colors.nbInk;
  if (isSelected) {
    chipTextColor = colors.nbOnFill;
  }

  return (
    <Pressable
      onPress={() => onPickTopic(topicLabel)}
      style={[
        styles.chip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: chipBackgroundColor,
          shadowColor: colors.nbShadow,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <Text style={[styles.chipText, { color: chipTextColor }]}>{topicLabel}</Text>
    </Pressable>
  );
}

/**
 * Row of topic chips for the support form.
 */
function TopicChipRow({ topic, onPickTopic, colors }) {
  return (
    <View style={styles.chipWrap}>
      {TOPIC_CHIPS.map((topicLabel) => (
        <TopicChip
          key={topicLabel}
          topicLabel={topicLabel}
          isSelected={topic === topicLabel}
          onPickTopic={onPickTopic}
          colors={colors}
        />
      ))}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Settings → Contact support form (topic, subject, message).
 */
export default function ContactSupportScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = scrollPaddingForSupportForm(
    embedShellBottomNav,
    shellNavInset,
    insets.bottom,
  );
  const supportEmail = getSupportEmail();

  const [topic, setTopic] = useState(TOPIC_CHIPS[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // vocab: notice = NbNoticeSheet payload — title + message for the sheet
  const [notice, setNotice] = useState(null);

  const opacityAnimated = useRef(new Animated.Value(0)).current;
  const riseAnimated = useRef(new Animated.Value(RISE_FROM)).current;

  // Entrance: fade + slight rise once on mount (same motion as other settings forms).
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnimated, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
      Animated.timing(riseAnimated, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacityAnimated, riseAnimated]);

  async function sendSupportMessage() {
    const subjectText = asTrimmedString(subject);
    const messageText = asTrimmedString(message);

    // 1. Validate required fields before we hit the network.
    if (!subjectText) {
      setNotice({
        title: 'Missing subject',
        message: 'Please add a short subject so we can route your message.',
      });
      return;
    }
    if (!messageText) {
      setNotice({
        title: 'Missing message',
        message: 'Please describe what you need help with.',
      });
      return;
    }

    const auth = getAuth();
    if (!auth.currentUser) {
      setNotice({ title: 'Not signed in', message: 'Please sign in again and retry.' });
      return;
    }

    // 2. Prefix topic so support can sort tickets; body stays free-form for the user.
    const routedSubject = `[${topic}] ${subjectText}`;
    const routedMessage = `Topic: ${topic}\n\n${messageText}`;

    // 3. POST with Firebase ID token; open Mail as backup; sheet explains the outcome.
    setSubmitting(true);
    try {
      const json = await postSupportContactToApi({
        subjectText: routedSubject,
        messageText: routedMessage,
      });
      setSubject('');
      setMessage('');
      openSupportMailto({ subject: routedSubject, body: routedMessage });
      setNotice(buildNoticeAfterSupportSend(supportEmail, json));
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

  function openSupportMailShortcut() {
    openSupportMailto({ subject: MAIL_SUBJECT_DEFAULT });
  }

  function closeNoticeSheet() {
    setNotice(null);
  }

  const topicHint = TOPIC_HINTS[topic] || '';
  let statusBarStyle = 'dark-content';
  if (isDark) {
    statusBarStyle = 'light-content';
  }
  let sendButtonLabel = 'Send message';
  if (submitting) {
    sendButtonLabel = 'Sending…';
  }
  const subjectFieldStyle = [
    styles.input,
    {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface,
      color: colors.nbInk,
      shadowColor: colors.nbShadow,
    },
  ];
  const messageFieldStyle = [
    styles.input,
    styles.inputMultiline,
    {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface,
      color: colors.nbInk,
      shadowColor: colors.nbShadow,
    },
  ];
  const animatedFormStyle = {
    opacity: opacityAnimated,
    transform: [{ translateY: riseAnimated }],
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <StatusBar barStyle={statusBarStyle} backgroundColor={colors.nbBackground} />
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
        <Animated.View style={animatedFormStyle}>
          <Text style={[styles.label, { color: colors.nbMuted }]}>WHAT IS IT ABOUT?</Text>
          <TopicChipRow topic={topic} onPickTopic={setTopic} colors={colors} />
          <Text style={[styles.hint, { color: colors.nbMuted }]}>{topicHint}</Text>

          <Text style={[styles.label, { color: colors.nbMuted }]}>SUBJECT</Text>
          <TextInput
            value={subject}
            onChangeText={setSubject}
            placeholder="Cannot sign in on a new phone"
            placeholderTextColor={colors.nbMuted}
            style={subjectFieldStyle}
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
            style={messageFieldStyle}
            multiline
            editable={!submitting}
          />

          <View style={styles.buttonWrap}>
            <NbButton variant="fill" onPress={sendSupportMessage} disabled={submitting}>
              {sendButtonLabel}
            </NbButton>
          </View>
          <View style={styles.buttonWrap}>
            <NbButton variant="ghost" onPress={openSupportMailShortcut} disabled={submitting}>
              Email us instead
            </NbButton>
          </View>
        </Animated.View>
      </ScrollView>

      <NbNoticeSheet
        visible={!!notice}
        onClose={closeNoticeSheet}
        title={notice?.title || ''}
        message={notice?.message}
        confirmLabel="OK"
      />
    </SafeAreaView>
  );
}

// PLUMBING — skip unless debugging

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
