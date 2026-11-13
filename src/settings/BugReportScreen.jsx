// Bug report form: expected vs actual, optional steps/device, optional screenshots (up to 3).
// Flow: fade in → ImagePicker for screenshots → POST /api/support/contact → open Mail as backup.
// Used from Settings. Field order (expected, happened, when, device, shots) is what the email body uses.

import React, { useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Pressable,
  TextInput,
  Image,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getSupportEmail } from './supportContact';
import { openSupportMailto, offerSupportMailtoFallback } from './emailSupport';
import { getApiBase } from '../for-both/online-connection/whereToConnect';
import { getAuth } from 'firebase/auth';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../navigation/bottomMenuSpacing';
import { Ionicons } from '@expo/vector-icons';
import NbButton from '../look-and-feel/NbButton';
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';
import { nb, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_INSET = 24;
const EXTRA_SCROLL_PAD = 16;
const FADE_MS = 350;
const RISE_FROM = 10;
const SUPPORT_CONTACT_PATH = '/api/support/contact';
const BUG_MAIL_SUBJECT = 'Bug report — Coach Connect';
const DELIVERY_FIRESTORE = 'firestore';
// Manipulate here: Design Law dashed zone — max optional screenshots
const MAX_BUG_SCREENSHOTS = 3;
const PICKER_QUALITY = 0.8;

const BUG_MAIL_BODY_TEMPLATE =
  'What I was doing:\n\n' +
  'What went wrong:\n\n' +
  'Device (iPhone / Android):\n\n' +
  'Rough date/time:\n\n';

// ===== HELPER FUNCTIONS =====

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
 * @param {{ expectedText: string, happenedText: string, whenText: string, deviceText: string, screenshotNames: string[] }} fields
 * @returns {string}
 */
function buildBugMessage({ expectedText, happenedText, whenText, deviceText, screenshotNames }) {
  const shotLines =
    Array.isArray(screenshotNames) && screenshotNames.length > 0
      ? `Screenshots ready on device (${screenshotNames.length}):\n${screenshotNames.map((n) => `- ${n}`).join('\n')}\n\n`
      : '';
  return (
    `What I was trying to do:\n${expectedText}\n\n` +
    `What happened instead:\n${happenedText}\n\n` +
    (whenText ? `Rough date and time:\n${whenText}\n\n` : '') +
    (deviceText ? `Device:\n${deviceText}\n\n` : '') +
    shotLines
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
 * @returns {{ title: string, message: string }}
 */
function noticeAfterBugSend(supportEmail, json) {
  if (json?.delivery === DELIVERY_FIRESTORE) {
    return {
      title: 'Almost done',
      message: `We saved your bug report and opened email to ${supportEmail || 'support'}. Tap Send in Mail so it hits the inbox.`,
    };
  }
  return {
    title: 'Sent',
    message: 'Thanks — your bug report was sent (email opened as a backup).',
  };
}

function buildBugStyles(scrollBottomPad, colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.nbBackground },
    scroll: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: scrollBottomPad },
    label: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 11,
      letterSpacing: 0.6,
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
    thumbRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: spacing.sm,
    },
    thumbWrap: {
      position: 'relative',
      width: 72,
      height: 72,
    },
    thumb: {
      width: 72,
      height: 72,
      borderRadius: 10,
      borderWidth: nb.borderWidth,
    },
    thumbRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: nb.borderWidth,
      alignItems: 'center',
      justifyContent: 'center',
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
  // vocab: screenshots = local ImagePicker assets staged before send (not uploaded yet)
  const [screenshots, setScreenshots] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  // vocab: notice = NbNoticeSheet payload — Design Law sheet instead of Alert.alert
  const [notice, setNotice] = useState(null);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(RISE_FROM)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  async function pickScreenshots() {
    const room = Math.max(0, MAX_BUG_SCREENSHOTS - screenshots.length);
    if (room <= 0) {
      setNotice({
        title: 'Limit reached',
        message: `You can attach up to ${MAX_BUG_SCREENSHOTS} screenshots.`,
      });
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setNotice({
          title: 'Permission needed',
          message: 'Allow photo library access to attach screenshots.',
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: room,
        quality: PICKER_QUALITY,
      });
      if (result.canceled || !result.assets?.length) return;
      const next = result.assets.slice(0, room).map((asset, index) => ({
        id: `${Date.now()}-${index}`,
        uri: asset.uri,
        name: asset.fileName || asset.uri.split('/').pop() || `screenshot-${index + 1}.jpg`,
      }));
      setScreenshots((prev) => [...prev, ...next].slice(0, MAX_BUG_SCREENSHOTS));
    } catch (error) {
      setNotice({
        title: 'Could not open photos',
        message: error?.message || 'Please try again.',
      });
    }
  }

  function removeScreenshot(id) {
    setScreenshots((prev) => prev.filter((shot) => shot.id !== id));
  }

  async function submitBug() {
    const expectedText = String(whatExpected || '').trim();
    const happenedText = String(whatHappened || '').trim();
    const whenText = String(steps || '').trim();
    if (!expectedText || !happenedText) {
      setNotice({
        title: 'Missing details',
        message: 'Please fill in what you were trying to do and what happened.',
      });
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setNotice({ title: 'Not signed in', message: 'Please sign in again and retry.' });
      return;
    }

    setSubmitting(true);
    const message = buildBugMessage({
      expectedText,
      happenedText,
      whenText,
      deviceText: deviceInfo,
      screenshotNames: screenshots.map((s) => s.name),
    });

    try {
      const json = await postBugReport(message);
      setWhatExpected('');
      setWhatHappened('');
      setSteps('');
      setDeviceInfo('');
      setScreenshots([]);
      openSupportMailto({ subject: BUG_MAIL_SUBJECT, body: message });
      setNotice(noticeAfterBugSend(supportEmail, json));
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
  const canAddMore = screenshots.length < MAX_BUG_SCREENSHOTS;

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

          {/* Design Law dashed drop zone — optional screenshots via ImagePicker */}
          <Pressable
            onPress={canAddMore && !submitting ? pickScreenshots : undefined}
            disabled={!canAddMore || submitting}
            style={[
              styles.dashZone,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface, opacity: canAddMore ? 1 : 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add screenshots"
          >
            <Ionicons name="images-outline" size={28} color={colors.nbInk} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[styles.dashTitle, { color: colors.nbInk }]}>
                Screenshots if something looks wrong
              </Text>
              <Text style={[styles.helper, { marginTop: 2 }]}>
                Optional. Up to {MAX_BUG_SCREENSHOTS} images
                {screenshots.length > 0 ? ` · ${screenshots.length} added` : ''}
              </Text>
            </View>
            {canAddMore ? <Ionicons name="add" size={22} color={colors.nbInk} /> : null}
          </Pressable>

          {screenshots.length > 0 ? (
            <View style={styles.thumbRow}>
              {screenshots.map((shot) => (
                <View key={shot.id} style={styles.thumbWrap}>
                  <Image
                    source={{ uri: shot.uri }}
                    style={[styles.thumb, { borderColor: colors.nbBorder }]}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    onPress={() => removeScreenshot(shot.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={[
                      styles.thumbRemove,
                      { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Remove screenshot"
                  >
                    <Ionicons name="close" size={14} color={colors.nbOnFill} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null}

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
      <NbNoticeSheet
        visible={!!notice}
        onClose={() => setNotice(null)}
        title={notice?.title || ''}
        message={notice?.message}
        confirmLabel="OK"
      />
    </SafeAreaView>
  );
}
