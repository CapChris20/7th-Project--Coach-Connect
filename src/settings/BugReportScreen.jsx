// Bug report form: expected vs actual, optional when/device, optional screenshots (up to 3).
// Flow: fade in → ImagePicker for screenshots → POST /api/support/contact → open Mail as backup.
// Used from Settings. Field order (expected, happened, when, device, shots) is what the email body uses.
//
// vocab: ImagePicker = expo-image-picker library assets (uri + fileName) staged locally
// vocab: NbNoticeSheet = Design Law sheet instead of Alert.alert

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
import {
  SHELL_SAFE_AREA_EDGES,
  FORM_SCROLL_PROPS,
  useShellBottomNavInset,
} from '../navigation/bottomMenuSpacing';
import { Ionicons } from '@expo/vector-icons';
import NbButton from '../look-and-feel/NbButton';
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';
import { nb, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_INSET = 24;
const EXTRA_SCROLL_PAD = 16;
// Manipulate here: entrance fade/rise duration (ms)
const FADE_MS = 350;
const RISE_FROM = 10;
const SUPPORT_CONTACT_PATH = '/api/support/contact';
const BUG_MAIL_SUBJECT = 'Bug report — Coach Connect';
const DELIVERY_FIRESTORE = 'firestore';
// Manipulate here: Design Law dashed zone — max optional screenshots
const MAX_BUG_SCREENSHOTS = 3;
const PICKER_QUALITY = 0.8;
const PERMISSION_GRANTED = 'granted';

const BUG_MAIL_BODY_TEMPLATE =
  'What I was doing:\n\n' +
  'What went wrong:\n\n' +
  'Device (iPhone / Android):\n\n' +
  'Rough date/time:\n\n';

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
 * Bottom padding for the bug form scroll.
 * @param {boolean} embedShellBottomNav
 * @param {number} shellNavInset
 * @param {number} bottomInset
 * @returns {number}
 */
function scrollPaddingForBugForm(embedShellBottomNav, shellNavInset, bottomInset) {
  if (embedShellBottomNav) return shellNavInset;
  return Math.max(bottomInset, EXTRA_SCROLL_PAD) + SHELL_NAV_INSET;
}

/**
 * Plain-text email body from the five form fields + screenshot file names.
 * @returns {string}
 */
function buildBugReportEmailBody({
  expectedText,
  happenedText,
  whenText,
  deviceText,
  screenshotNames,
}) {
  const hasScreenshotNames =
    Array.isArray(screenshotNames) && screenshotNames.length > 0;

  let shotLines = '';
  if (hasScreenshotNames) {
    const bulletList = screenshotNames.map((name) => `- ${name}`).join('\n');
    shotLines = `Screenshots ready on device (${screenshotNames.length}):\n${bulletList}\n\n`;
  }

  let whenBlock = '';
  if (whenText) {
    whenBlock = `Rough date and time:\n${whenText}\n\n`;
  }
  let deviceBlock = '';
  if (deviceText) {
    deviceBlock = `Device:\n${deviceText}\n\n`;
  }

  return (
    `What I was trying to do:\n${expectedText}\n\n` +
    `What happened instead:\n${happenedText}\n\n` +
    whenBlock +
    deviceBlock +
    shotLines
  );
}

/**
 * POST the bug report message with the signed-in user's ID token.
 * @param {string} message
 * @returns {Promise<object>}
 */
async function postBugReportToApi(message) {
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
  const sendFailed = !response.ok || json?.ok !== true;
  if (sendFailed) {
    throw new Error(json?.error || 'Failed to send bug report.');
  }
  return json;
}

/**
 * Notice copy after a successful API send.
 * @param {string|null} supportEmail
 * @param {object} json
 * @returns {{ title: string, message: string }}
 */
function buildNoticeAfterBugSend(supportEmail, json) {
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

/**
 * Theme-bound StyleSheet for the bug form (padding depends on shell inset).
 * @param {number} scrollBottomPad
 * @param {object} colors
 */
function createBugReportStyles(scrollBottomPad, colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.nbBackground },
    scroll: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: scrollBottomPad,
    },
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

/**
 * Map ImagePicker assets into local screenshot rows (id / uri / name).
 * @param {Array} assets
 * @param {number} slotsRemaining
 * @returns {Array<{ id: string, uri: string, name: string }>}
 */
function mapPickerAssetsToScreenshots(assets, slotsRemaining) {
  const limitedAssets = assets.slice(0, slotsRemaining);
  return limitedAssets.map((asset, index) => {
    const fallbackName = `screenshot-${index + 1}.jpg`;
    const pathTail = asset.uri.split('/').pop();
    return {
      id: `${Date.now()}-${index}`,
      uri: asset.uri,
      name: asset.fileName || pathTail || fallbackName,
    };
  });
}

/**
 * Thumbnail row with a remove control on each shot.
 */
function ScreenshotThumbRow({ screenshots, onRemove, colors, styles }) {
  if (screenshots.length === 0) return null;

  return (
    <View style={styles.thumbRow}>
      {screenshots.map((screenshot) => (
        <View key={screenshot.id} style={styles.thumbWrap}>
          <Image
            source={{ uri: screenshot.uri }}
            style={[styles.thumb, { borderColor: colors.nbBorder }]}
            resizeMode="cover"
          />
          <TouchableOpacity
            onPress={() => onRemove(screenshot.id)}
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
  );
}

// ===== MAIN FUNCTION =====

/**
 * Settings → Report a bug form with optional screenshots.
 */
export default function BugReportScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = scrollPaddingForBugForm(
    embedShellBottomNav,
    shellNavInset,
    insets.bottom,
  );
  const supportEmail = getSupportEmail();

  const [whatExpected, setWhatExpected] = useState('');
  const [whatHappened, setWhatHappened] = useState('');
  const [whenItHappened, setWhenItHappened] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  // vocab: screenshots = local ImagePicker assets staged before send (not uploaded yet)
  const [screenshots, setScreenshots] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const opacityAnimated = useRef(new Animated.Value(0)).current;
  const riseAnimated = useRef(new Animated.Value(RISE_FROM)).current;

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

  async function addScreenshotsFromLibrary() {
    const slotsRemaining = Math.max(0, MAX_BUG_SCREENSHOTS - screenshots.length);
    if (slotsRemaining <= 0) {
      setNotice({
        title: 'Limit reached',
        message: `You can attach up to ${MAX_BUG_SCREENSHOTS} screenshots.`,
      });
      return;
    }

    try {
      await pickAndAppendScreenshots(slotsRemaining);
    } catch (error) {
      setNotice({
        title: 'Could not open photos',
        message: error?.message || 'Please try again.',
      });
    }
  }

  async function pickAndAppendScreenshots(slotsRemaining) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== PERMISSION_GRANTED) {
      setNotice({
        title: 'Permission needed',
        message: 'Allow photo library access to attach screenshots.',
      });
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: slotsRemaining,
      quality: PICKER_QUALITY,
    });

    const nothingPicked =
      pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0;
    if (nothingPicked) return;

    const picked = mapPickerAssetsToScreenshots(pickerResult.assets, slotsRemaining);
    setScreenshots((previous) => [...previous, ...picked].slice(0, MAX_BUG_SCREENSHOTS));
  }

  function removeScreenshotById(screenshotId) {
    setScreenshots((previous) => previous.filter((shot) => shot.id !== screenshotId));
  }

  async function sendBugReport() {
    const expectedText = asTrimmedString(whatExpected);
    const happenedText = asTrimmedString(whatHappened);
    const whenText = asTrimmedString(whenItHappened);

    // 1. Require the two fields support needs to reproduce the bug.
    if (!expectedText || !happenedText) {
      setNotice({
        title: 'Missing details',
        message: 'Please fill in what you were trying to do and what happened.',
      });
      return;
    }

    // 2. Need a signed-in Firebase user for the Bearer token.
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setNotice({ title: 'Not signed in', message: 'Please sign in again and retry.' });
      return;
    }

    // 3. Build the email body, POST it, clear the form, open Mail as backup.
    setSubmitting(true);
    const screenshotNames = screenshots.map((shot) => shot.name);
    const messageBody = buildBugReportEmailBody({
      expectedText,
      happenedText,
      whenText,
      deviceText: deviceInfo,
      screenshotNames,
    });

    try {
      const json = await postBugReportToApi(messageBody);
      setWhatExpected('');
      setWhatHappened('');
      setWhenItHappened('');
      setDeviceInfo('');
      setScreenshots([]);
      openSupportMailto({ subject: BUG_MAIL_SUBJECT, body: messageBody });
      setNotice(buildNoticeAfterBugSend(supportEmail, json));
    } catch (error) {
      offerSupportMailtoFallback({
        subject: BUG_MAIL_SUBJECT,
        body: messageBody,
        apiError: error?.message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function openBugMailShortcut() {
    openSupportMailto({ subject: BUG_MAIL_SUBJECT, body: BUG_MAIL_BODY_TEMPLATE });
  }

  function closeNoticeSheet() {
    setNotice(null);
  }

  const screenStyles = createBugReportStyles(scrollBottomPad, colors);
  const footerCopy = supportEmail
    ? `Questions? Email ${supportEmail}. We can’t give medical advice; for health emergencies, contact local emergency services.`
    : 'We can’t give medical advice; for health emergencies, contact local emergency services.';
  const canAddMoreScreenshots = screenshots.length < MAX_BUG_SCREENSHOTS;
  const dashZoneIsActive = canAddMoreScreenshots && !submitting;
  let dashZoneOpacity = 0.7;
  if (canAddMoreScreenshots) {
    dashZoneOpacity = 1;
  }
  let dashZonePressHandler = undefined;
  if (dashZoneIsActive) {
    dashZonePressHandler = addScreenshotsFromLibrary;
  }
  const screenshotCountHint =
    screenshots.length > 0 ? ` · ${screenshots.length} added` : '';
  let sendButtonLabel = 'Send bug report';
  if (submitting) {
    sendButtonLabel = 'Sending…';
  }
  let statusBarStyle = 'dark-content';
  if (isDark) {
    statusBarStyle = 'light-content';
  }
  const animatedFormStyle = {
    opacity: opacityAnimated,
    transform: [{ translateY: riseAnimated }],
  };

  return (
    <SafeAreaView style={screenStyles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={colors.nbBackground} />
      <NbPageHeader
        title="Report a bug"
        subtitle="Help us make it better."
        onBack={onClose}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={screenStyles.scroll}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={animatedFormStyle}>
          <Text style={screenStyles.label}>WHAT YOU WERE TRYING TO DO</Text>
          <TextInput
            value={whatExpected}
            onChangeText={setWhatExpected}
            placeholder="Log my lunch with a barcode."
            placeholderTextColor={colors.nbMuted}
            style={[screenStyles.input, screenStyles.inputMultiline]}
            multiline
            editable={!submitting}
          />

          <Text style={screenStyles.label}>WHAT HAPPENED INSTEAD</Text>
          <TextInput
            value={whatHappened}
            onChangeText={setWhatHappened}
            placeholder="The scanner opened, found the product, then the app closed."
            placeholderTextColor={colors.nbMuted}
            style={[screenStyles.input, screenStyles.inputMultiline]}
            multiline
            editable={!submitting}
          />

          <Text style={screenStyles.label}>ROUGH DATE AND TIME</Text>
          <TextInput
            value={whenItHappened}
            onChangeText={setWhenItHappened}
            placeholder="Today, about 12:30 PM"
            placeholderTextColor={colors.nbMuted}
            style={screenStyles.input}
            editable={!submitting}
          />

          <Text style={screenStyles.label}>DEVICE (OPTIONAL)</Text>
          <TextInput
            value={deviceInfo}
            onChangeText={setDeviceInfo}
            placeholder="iPhone 15"
            placeholderTextColor={colors.nbMuted}
            style={screenStyles.input}
            editable={!submitting}
          />

          {/* Design Law dashed drop zone — optional screenshots via ImagePicker */}
          <Pressable
            onPress={dashZonePressHandler}
            disabled={!dashZoneIsActive}
            style={[
              screenStyles.dashZone,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
                opacity: dashZoneOpacity,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add screenshots"
          >
            <Ionicons name="images-outline" size={28} color={colors.nbInk} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[screenStyles.dashTitle, { color: colors.nbInk }]}>
                Screenshots if something looks wrong
              </Text>
              <Text style={[screenStyles.helper, { marginTop: 2 }]}>
                Optional. Up to {MAX_BUG_SCREENSHOTS} images
                {screenshotCountHint}
              </Text>
            </View>
            {canAddMoreScreenshots ? (
              <Ionicons name="add" size={22} color={colors.nbInk} />
            ) : null}
          </Pressable>

          <ScreenshotThumbRow
            screenshots={screenshots}
            onRemove={removeScreenshotById}
            colors={colors}
            styles={screenStyles}
          />

          <View style={screenStyles.buttonWrap}>
            <NbButton variant="fill" onPress={sendBugReport} disabled={submitting}>
              {sendButtonLabel}
            </NbButton>
          </View>

          {supportEmail ? (
            <Pressable onPress={openBugMailShortcut}>
              <Text style={[screenStyles.helper, { marginTop: spacing.sm }]}>
                Or email instead
              </Text>
            </Pressable>
          ) : null}

          <Text style={[screenStyles.footerText, { marginTop: spacing.lg }]}>
            {footerCopy}
          </Text>
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
// (theme styles are built in createBugReportStyles above)
