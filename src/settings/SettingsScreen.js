// Design Law Settings — identity card, Light/Dark/System, grouped NbCards, delete alone at bottom.
// Flow: load user doc → edit prefs → Stripe / remove trainer (client) / delete account / open support.
// Used by: client and trainer shells. Firebase projectId stays anatrox-auth.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../look-and-feel/lightDarkMode';
import {
  deleteUser,
  EmailAuthProvider,
  getAuth,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../app-start/cloudConnection';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import BottomMenuBar from '../navigation/BottomMenuBar';
import { useShellNavigate } from '../navigation/goToScreenByKeyword';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, ShellBottomNavAnchor, useShellBottomNavInset } from '../navigation/bottomMenuSpacing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAI, getAiToggleMeterHint } from '../for-both/app-wide-settings/AIPermission';
import HoldToConfirmPopup from '../for-both/popups/HoldToConfirmPopup';
import { resolveStripeStatus } from '../for-both/payments/trainerPayoutSetup';
import { trainerPayoutSetupFlow } from '../for-both/payments/trainerPayoutSetupFlow';
import { TrainerPayoutSetupPopup } from '../for-both/payments/TrainerPayoutSetupPopup';
import BlockedUsersScreen from '../block-and-report/BlockedUsersScreen';
import { APPLE_MANAGE_SUBSCRIPTIONS_URL } from '../trainer-pro-plan/proPlanSwitches';
import { onUserSignOut } from '../logout-cleanup/clearDataOnLogout';
import NbCard from '../look-and-feel/NbCard';
import NbSwitch from '../look-and-feel/NbSwitch';
import NbButton from '../look-and-feel/NbButton';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import NbSheet from '../look-and-feel/NbSheet';
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';
import { nb, gradients, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_INSET = 24;
const SEGMENT_TRACK_PAD = 4;
const SPRING_FRICTION = 9;
const SPRING_TENSION = 140;
const SPRING_VELOCITY = 0.5;
const CENTS_THRESHOLD = 100;
const PERCENT_SCALE = 100;
// Manipulate here: longer hold = harder to delete by accident.
const HOLD_TO_DELETE_MS = 1200;
const USERS_COLLECTION = 'users';
// vocab: anatrox-auth = production Firebase project id (do not rename to match app branding).
const DELETE_ACCOUNT_URL =
  'https://us-central1-anatrox-auth.cloudfunctions.net/auth/deleteAccount';
const DEFAULT_TIME_ZONE = 'UTC';
const PLATFORM_IOS = 'ios';
const STATUS_ACTIVE = 'active';
const STATUS_PENDING = 'pending';
const STATUS_PENDING_VERIFICATION = 'pending_verification';
const ROLE_TRAINER = 'trainer';
const ROLE_CLIENT = 'client';
const APP_VERSION_LABEL = '2.4.0';
const MIN_PASSWORD_LENGTH = 6;
const CHEVRON_SIZE = 20;
const AI_SWITCH_FROZEN_OPACITY = 0.45;

const APPEARANCE_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const AI_FEATURE_BULLETS = [
  '• AI Fitness Coach — chat for coaching-style tips',
  '• Workout generator — draft plans from your goals',
  '• Progress-style insights in supported screens',
  '• Form & recovery suggestions where available',
];

// ===== HELPER FUNCTIONS =====

/**
 * Human message from a caught error, or a fallback string.
 * @param {*} error
 * @param {string} fallbackText
 * @returns {string}
 */
function messageFromCaughtError(error, fallbackText) {
  if (!error) return fallbackText;
  if (error.message) return String(error.message);
  return fallbackText;
}

/**
 * True when the workout reminder flag is on in the user doc.
 * @param {object|undefined} workoutReminder
 * @returns {boolean}
 */
function workoutReminderIsEnabled(workoutReminder) {
  if (!workoutReminder) return false;
  return !!workoutReminder.enabled;
}

/**
 * Stored ISO time string on the workout reminder, or null.
 * @param {object|undefined} workoutReminder
 * @returns {string|null}
 */
function workoutReminderStoredTime(workoutReminder) {
  if (!workoutReminder) return null;
  if (!workoutReminder.time) return null;
  return workoutReminder.time;
}

/**
 * Monthly rate from the client user doc (or null).
 * @param {object|undefined} userData
 * @returns {*|null}
 */
function monthlyRateFromUserData(userData) {
  if (!userData) return null;
  if (userData.monthlyRate == null) return null;
  return userData.monthlyRate;
}

/**
 * Payment status string from the client user doc (or empty).
 * @param {object|undefined} userData
 * @returns {string}
 */
function paymentStatusFromUserData(userData) {
  if (!userData) return '';
  if (!userData.paymentStatus) return '';
  return userData.paymentStatus;
}

/**
 * Trainer list price: pricing.perMonth, then monthlyRate, then price.
 * @param {object|undefined} trainerData
 * @returns {*|null}
 */
function listedRateFromTrainerData(trainerData) {
  if (!trainerData) return null;
  if (trainerData.pricing && trainerData.pricing.perMonth != null) {
    return trainerData.pricing.perMonth;
  }
  if (trainerData.monthlyRate != null) return trainerData.monthlyRate;
  if (trainerData.price != null) return trainerData.price;
  return null;
}

/**
 * True when the client is linked to a trainer (either side has the id).
 * @param {object|undefined} userData
 * @param {object|undefined} trainerData
 * @returns {boolean}
 */
function clientHasLinkedTrainer(userData, trainerData) {
  if (userData && userData.trainerId) return true;
  if (trainerData && trainerData.id) return true;
  return false;
}

/**
 * Display name for the linked coach on billing / identity lines.
 * @param {object|undefined} trainerData
 * @returns {string}
 */
function coachNameFromTrainerData(trainerData) {
  if (!trainerData) return 'Coach';
  if (trainerData.name) return trainerData.name;
  if (trainerData.displayName) return trainerData.displayName;
  if (trainerData.firstName) return trainerData.firstName;
  return 'Coach';
}

/**
 * Email for Stripe connect — Auth user first, then user doc.
 * @param {object|null|undefined} firebaseUser
 * @param {object|undefined} userData
 * @returns {string}
 */
function emailForStripeConnect(firebaseUser, userData) {
  if (firebaseUser && firebaseUser.email) return firebaseUser.email;
  if (userData && userData.email) return userData.email;
  return '';
}

/**
 * Profile / Auth photo URL for the identity card.
 * @param {object|undefined} userData
 * @param {object|null|undefined} firebaseUser
 * @returns {string|null}
 */
function photoUrlForSettings(userData, firebaseUser) {
  if (userData && userData.photoURL) return userData.photoURL;
  if (firebaseUser && firebaseUser.photoURL) return firebaseUser.photoURL;
  return null;
}

/**
 * Client count from the trainer user doc (or null when missing).
 * @param {object|undefined} userData
 * @returns {number|null}
 */
function clientCountFromUserData(userData) {
  if (!userData) return null;
  if (userData.clientCount == null) return null;
  return userData.clientCount;
}

/**
 * True when the deleteAccount callable returned { ok: true }.
 * @param {*} callableResponse
 * @returns {boolean}
 */
function deleteCallableSaidOk(callableResponse) {
  if (!callableResponse) return false;
  if (!callableResponse.data) return false;
  return callableResponse.data.ok === true;
}

/**
 * Open a settings sub-screen, or warn if navigation is missing.
 * @param {string} screen
 * @param {Function} onNavigate
 * @param {Function} [onUnavailable]
 * @returns {void}
 */
function openSettingsSubScreen(screen, onNavigate, onUnavailable) {
  if (typeof onNavigate === 'function') {
    onNavigate(screen);
    return;
  }
  if (typeof onUnavailable === 'function') {
    onUnavailable('Unavailable', 'This screen could not be opened.');
    return;
  }
  Alert.alert('Unavailable', 'This screen could not be opened.');
}

/**
 * Wall-clock + IANA zone for the server-side workout reminder job.
 * @param {Date} dateValue
 * @returns {{ time: string, hourLocal: number, minuteLocal: number, timeZone: string }}
 */
function workoutReminderClockFromDate(dateValue) {
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  return {
    time: dateValue.toISOString(),
    hourLocal: dateValue.getHours(),
    minuteLocal: dateValue.getMinutes(),
    timeZone,
  };
}

/**
 * Text color for a status chip tone.
 * @param {string} tone
 * @param {object} colors
 * @returns {string}
 */
function statusChipToneColor(tone, colors) {
  if (tone === 'success') return colors.success;
  if (tone === 'warning') return colors.warning;
  if (tone === 'error') return colors.error;
  return colors.textSecondary;
}

/**
 * Format a monthly coaching rate for the billing chip.
 * Amounts >= 100 are treated as cents (Stripe-style).
 * @param {number|string|null|undefined} rate
 * @returns {string|null}
 */
function formatMonthlyRateLabel(rate) {
  if (rate == null || rate === '') return null;
  const amount = Number(rate);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const dollars = amount >= CENTS_THRESHOLD ? amount / CENTS_THRESHOLD : amount;
  return `$${dollars.toFixed(0)}/mo`;
}

/**
 * @param {string} status
 * @returns {string}
 */
function payoutChipLabel(status) {
  if (status === STATUS_ACTIVE) return 'Active';
  if (status === STATUS_PENDING || status === STATUS_PENDING_VERIFICATION) return 'Pending';
  return 'Not connected';
}

/**
 * @param {string} status
 * @returns {string}
 */
function payoutChipTone(status) {
  if (status === STATUS_ACTIVE) return 'success';
  if (status === STATUS_PENDING || status === STATUS_PENDING_VERIFICATION) return 'warning';
  return 'neutral';
}

/**
 * Mask a Stripe account id for display (last four only).
 * @param {string} accountId
 * @returns {string}
 */
function maskStripeAccountId(accountId) {
  const id = String(accountId || '').trim();
  if (!id) return '—';
  return `****${id.slice(-4)}`;
}

/**
 * True when the stored reminder is missing local hour/minute/zone fields.
 * @param {object|undefined} workoutReminder
 * @returns {boolean}
 */
function workoutReminderNeedsClockBackfill(workoutReminder) {
  if (!workoutReminderIsEnabled(workoutReminder)) return false;
  if (!workoutReminderStoredTime(workoutReminder)) return false;
  if (workoutReminder.hourLocal == null) return true;
  if (workoutReminder.minuteLocal == null) return true;
  if (!String(workoutReminder.timeZone || '').trim()) return true;
  return false;
}

/**
 * Write hourLocal / minuteLocal / timeZone from the stored ISO time.
 * Older docs only had `time`; the reminder job now needs wall-clock fields.
 * @param {*} userRef
 * @param {string} isoTime
 * @returns {Promise<void>}
 */
async function backfillWorkoutReminderClock(userRef, isoTime) {
  const reminderDate = new Date(isoTime);
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  try {
    await updateDoc(userRef, {
      'workoutReminder.hourLocal': reminderDate.getHours(),
      'workoutReminder.minuteLocal': reminderDate.getMinutes(),
      'workoutReminder.timeZone': timeZone,
    });
  } catch (error) {
    console.warn('workoutReminder backfill', messageFromCaughtError(error, error));
  }
}

/**
 * Apply one users/{uid} snapshot into settings local state.
 * @param {object} data
 * @param {object} setters
 * @param {string|null} userRoleProp
 * @param {*} userRef
 * @returns {Promise<void>}
 */
async function applyUserSettingsDoc(data, setters, userRoleProp, userRef) {
  setters.setResolvedUserRole((previous) => userRoleProp || data.role || previous || ROLE_CLIENT);
  setters.setStripeConnectStatus(data.stripeStatus || data.stripeConnectStatus || 'not_connected');
  setters.setStripeAccountId(data.stripeAccountId || '');
  setters.setMonthlyRate(data.monthlyRate ?? null);
  setters.setPaymentStatus(data.paymentStatus || 'inactive');
  const reminderFromDoc = data.workoutReminder;
  setters.setWorkoutReminders(workoutReminderIsEnabled(reminderFromDoc));
  const reminderIsoTime = workoutReminderStoredTime(reminderFromDoc);
  if (reminderIsoTime) {
    setters.setReminderTime(new Date(reminderIsoTime));
  }
  if (workoutReminderNeedsClockBackfill(reminderFromDoc)) {
    await backfillWorkoutReminderClock(userRef, reminderIsoTime);
  }
}

/**
 * Turn off the daily workout reminder notification + Firestore flag.
 * @param {string} userId
 * @returns {Promise<void>}
 */
async function disableWorkoutReminder(userId) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  try {
    await updateDoc(doc(db, USERS_COLLECTION, userId), { 'workoutReminder.enabled': false });
  } catch (ignoredError) {
    await setDoc(
      doc(db, USERS_COLLECTION, userId),
      { workoutReminder: { enabled: false } },
      { merge: true },
    );
  }
}

/**
 * Schedule a repeating local notification at the picked wall-clock time.
 * @param {Date} time
 * @returns {Promise<void>}
 */
async function scheduleWorkoutReminder(time) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to workout!',
      body: 'Your daily workout reminder.',
    },
    trigger: { hour: time.getHours(), minute: time.getMinutes(), repeats: true },
  });
}

/**
 * Resolve assigned rate vs trainer list price for billing chips.
 * @param {object} args
 * @returns {{ effectiveRate: *, hasTrainer: boolean, status: string }}
 */
function clientBillingFacts({ monthlyRate, userDataProp, trainerDataProp, paymentStatus }) {
  const rateFromUserDoc = monthlyRateFromUserData(userDataProp);
  const assignedRate = monthlyRate ?? rateFromUserDoc ?? null;
  const trainerListedRate = listedRateFromTrainerData(trainerDataProp);
  const effectiveRate = assignedRate ?? trainerListedRate;
  const statusFromUserDoc = paymentStatusFromUserData(userDataProp);
  const status = paymentStatus || statusFromUserDoc || 'inactive';
  const hasTrainer = clientHasLinkedTrainer(userDataProp, trainerDataProp);
  return { effectiveRate, hasTrainer, status, assignedRate, trainerListedRate };
}

/**
 * Client billing chip label from rate + payment status.
 * @param {object} args
 * @returns {string}
 */
function buildClientBillingLabel(args) {
  const { effectiveRate, hasTrainer, status } = clientBillingFacts(args);
  const rateLabel = formatMonthlyRateLabel(effectiveRate);

  if (status === STATUS_ACTIVE && rateLabel) return `Active — ${rateLabel}`;
  if (status === 'past_due') return rateLabel ? `Past due — ${rateLabel}` : 'Past due';
  if (status === 'payment_required') {
    return rateLabel ? `Payment required — ${rateLabel}` : 'Payment required';
  }
  if (rateLabel && hasTrainer) return `Set up — ${rateLabel}`;
  if (hasTrainer) return 'No rate set';
  return 'No active subscription';
}

/**
 * Client billing chip tone from rate + payment status.
 * @param {object} args
 * @returns {string}
 */
function buildClientBillingTone(args) {
  const { status, assignedRate, trainerListedRate, hasTrainer } = clientBillingFacts(args);
  if (status === STATUS_ACTIVE) return 'success';
  if (status === 'past_due') return 'error';
  if (status === 'payment_required') return 'warning';
  const hasRate = !!(assignedRate ?? trainerListedRate);
  if (hasRate && hasTrainer) return 'warning';
  return 'neutral';
}

/**
 * Line under the name on the identity card — trainer client count or linked coach name.
 * @param {object} args
 * @returns {string}
 */
function settingsIdentitySubtitle({ isTrainer, userDataProp, trainerDataProp, clientCoachName }) {
  if (isTrainer) {
    const clientCount = clientCountFromUserData(userDataProp);
    if (clientCount != null) {
      return `Trainer · ${clientCount} clients`;
    }
    return 'Trainer · Coach Connect';
  }
  const hasLinkedTrainer = clientHasLinkedTrainer(userDataProp, trainerDataProp);
  if (hasLinkedTrainer) {
    return `Client · ${clientCoachName} is your trainer`;
  }
  return 'Client';
}

/**
 * Full display name for the settings header card — first/last, then fallbacks.
 * @param {object} userDataProp
 * @param {object} firebaseUser
 * @returns {string}
 */
function settingsDisplayNameFromUser(userDataProp, firebaseUser) {
  let firstNameRaw = '';
  let lastNameRaw = '';
  let profileNameRaw = '';
  let profileDisplayNameRaw = '';
  if (userDataProp) {
    firstNameRaw = userDataProp.firstName || '';
    lastNameRaw = userDataProp.lastName || '';
    profileNameRaw = userDataProp.name || '';
    profileDisplayNameRaw = userDataProp.displayName || '';
  }
  let authDisplayNameRaw = '';
  if (firebaseUser && firebaseUser.displayName) {
    authDisplayNameRaw = firebaseUser.displayName;
  }

  const firstName = String(firstNameRaw).trim();
  const lastName = String(lastNameRaw).trim();
  const fromFirstLast = `${firstName} ${lastName}`.trim();
  if (fromFirstLast) {
    return fromFirstLast;
  }

  const fromProfile = String(
    profileNameRaw || profileDisplayNameRaw || authDisplayNameRaw || '',
  ).trim();
  if (fromProfile) {
    return fromProfile;
  }
  return 'Your profile';
}

/**
 * Initials for the settings identity avatar when no photo is set.
 * @param {string} name
 * @returns {string}
 */
function initialsFromDisplayName(name) {
  const nameText = String(name || '').trim();
  if (!nameText) return 'CC';
  const parts = nameText.split(/\s+/);
  const letters = [];
  for (let i = 0; i < parts.length && letters.length < 2; i += 1) {
    letters.push(parts[i][0]);
  }
  return letters.join('').toUpperCase();
}

/**
 * Platform Pro chip tone from the subscription status string.
 * @param {string} platformSubscriptionStatus
 * @returns {string}
 */
function platformSubTone(platformSubscriptionStatus) {
  const statusText = String(platformSubscriptionStatus || '');
  if (statusText.includes(STATUS_ACTIVE) || statusText.includes('trial')) {
    return 'success';
  }
  if (statusText.includes('Expired')) return 'error';
  return 'neutral';
}

/**
 * POST /auth/deleteAccount on the Cloud Function when the callable fails.
 * @param {{ userId: string, idToken: string }} args
 * @returns {Promise<true>}
 */
async function deleteAccountThroughHttpFallback({ userId, idToken }) {
  const response = await fetch(DELETE_ACCOUNT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ userId }),
  });
  const json = await response.json().catch(() => ({}));
  const deleteSaidOk = json && json.ok === true;
  if (!response.ok || !deleteSaidOk) {
    let errorText = `Delete failed (${response.status})`;
    if (json && json.error) {
      errorText = json.error;
    }
    throw new Error(errorText);
  }
  return true;
}

/**
 * One segment cell inside the Light / Dark / System track.
 * @param {object} props
 */
function SegmentPillOption({ option, selectedValue, onChange, colors }) {
  const isSelected = option.value === selectedValue;
  const labelColor = isSelected ? colors.nbOnFill : colors.nbMuted;

  const handlePress = () => {
    onChange(option.value);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [pillStyles.cell, pressed && { opacity: 0.85 }]}
    >
      <Text
        style={[
          pillStyles.cellLabel,
          { color: labelColor },
          isSelected && pillStyles.cellLabelSelected,
        ]}
      >
        {option.label}
      </Text>
    </Pressable>
  );
}

/**
 * Sliding pill segment control: animated highlight moves when selection changes.
 * Uses nb tokens for styling.
 * @param {{ options: Array<{value: string, label: string}>, selectedValue: string, onChange: Function, isDark: boolean, colors: object }} props
 */
function SegmentedPills({ options, selectedValue, onChange, isDark, colors }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const optionCount = options.length;
  const activeIndex = useMemo(() => {
    const foundIndex = options.findIndex((option) => option.value === selectedValue);
    return foundIndex >= 0 ? foundIndex : 0;
  }, [options, selectedValue]);

  const segmentWidth =
    trackWidth > 0 ? (trackWidth - SEGMENT_TRACK_PAD * 2) / optionCount : 0;
  const slide = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: activeIndex,
      useNativeDriver: true,
      friction: SPRING_FRICTION,
      tension: SPRING_TENSION,
      velocity: SPRING_VELOCITY,
    }).start();
  }, [activeIndex, slide]);

  const indexList = [];
  const offsetList = [];
  for (let optionIndex = 0; optionIndex < optionCount; optionIndex += 1) {
    indexList.push(optionIndex);
    offsetList.push(optionIndex * segmentWidth);
  }

  let translateX;
  if (segmentWidth > 0) {
    translateX = slide.interpolate({ inputRange: indexList, outputRange: offsetList });
  } else {
    translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });
  }

  const handleTrackLayout = (event) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const trackChrome = {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder,
  };
  const thumbChrome = {
    width: segmentWidth,
    transform: [{ translateX }],
    left: SEGMENT_TRACK_PAD,
    backgroundColor: colors.nbFill,
  };

  const pillOptionNodes = [];
  for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
    const option = options[optionIndex];
    pillOptionNodes.push(
      <SegmentPillOption
        key={String(option.value)}
        option={option}
        selectedValue={selectedValue}
        onChange={onChange}
        colors={colors}
      />,
    );
  }

  return (
    <View style={[pillStyles.track, trackChrome]} onLayout={handleTrackLayout}>
      {/* Design Law selected thumb = solid fill block (not brand gradient) */}
      {segmentWidth > 0 ? (
        <Animated.View pointerEvents="none" style={[pillStyles.thumb, thumbChrome]} />
      ) : null}
      <View style={pillStyles.row}>{pillOptionNodes}</View>
    </View>
  );
}

/**
 * Section header with nb styling.
 * @param {{ title: string, colors: object }} props
 */
function SectionHeader({ title, colors }) {
  return <Text style={[styles.sectionHeader, { color: colors.nbMuted }]}>{title}</Text>;
}

/**
 * Borderless row inside an NbCard group — Design Law list rows use dividers, not nested cards.
 * vocab: NbListRow draws its own 3px border; that nests badly inside a group card, so we use this instead.
 * @param {object} props
 */
function SettingsGroupRow({
  title,
  subtitle,
  right,
  onPress,
  colors,
  titleColor,
  showChevron = false,
}) {
  const titlePaint = titleColor || colors.nbInk;
  const body = (
    <View style={styles.groupRow}>
      <View style={styles.groupRowText}>
        <Text style={[styles.groupRowTitle, { color: titlePaint }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.groupRowSubtitle, { color: colors.nbMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.groupRowRight}>{right}</View> : null}
      {showChevron ? (
        <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={colors.nbMuted} />
      ) : null}
    </View>
  );
  if (typeof onPress !== 'function') return body;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      {body}
    </TouchableOpacity>
  );
}

function GroupDivider({ colors }) {
  return <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />;
}

/**
 * Small status pill next to a settings row label.
 * Design Law Active badge = purple→blue gradient fill.
 * @param {object} props
 */
function PaymentStatusChip({ label, tone, colors }) {
  const labelText = String(label || '');
  const isActive = labelText.toLowerCase().includes('active') || tone === 'success';
  if (isActive) {
    return (
      <LinearGradient
        colors={['#A78BFA', '#60A5FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.statusChip}
      >
        <Text style={[styles.statusChipText, { color: colors.nbInk }]}>{label}</Text>
      </LinearGradient>
    );
  }
  const toneColor = statusChipToneColor(tone, colors);
  return (
    <View
      style={[
        styles.statusChip,
        {
          backgroundColor: colors.nbSurfaceChip,
          borderColor: colors.nbBorder,
          borderWidth: nb.borderWidth,
        },
      ]}
    >
      <Text style={[styles.statusChipText, { color: toneColor }]}>{label}</Text>
    </View>
  );
}

/**
 * Design Law identity card at the top of Settings — avatar, name, role line, Edit.
 * @param {object} props
 */
function SettingsProfileCard({ name, subtitle, initials, photoURL, onEdit, colors }) {
  const hasEditHandler = typeof onEdit === 'function';
  const avatarBorder = { borderColor: colors.nbBorder };
  const editChipChrome = {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
    shadowColor: colors.nbShadow,
  };

  return (
    <NbCard style={styles.identityCard}>
      <View style={styles.identityRow}>
        {/* Design Law: avatar gradient accent OK; 3px border keeps chrome honest */}
        <LinearGradient
          colors={gradients.brand.colors}
          start={gradients.brand.start}
          end={gradients.brand.end}
          style={[styles.identityAvatar, avatarBorder]}
        >
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.identityAvatarImg} />
          ) : (
            <Text style={styles.identityInitials}>{initials}</Text>
          )}
        </LinearGradient>
        <View style={styles.identityCopy}>
          <Text style={[styles.identityName, { color: colors.nbInk }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.identitySub, { color: colors.nbMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        {hasEditHandler ? (
          <TouchableOpacity
            onPress={onEdit}
            style={[styles.editChip, editChipChrome]}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            activeOpacity={0.85}
          >
            <Text style={[styles.editChipText, { color: colors.nbInk }]}>Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </NbCard>
  );
}

/**
 * APPEARANCE — Light / Dark / System only (Design Law 01).
 * @param {object} props
 */
function AppearanceSection({ appearanceValue, onAppearanceChange, isDark, colors }) {
  return (
    <>
      <SectionHeader title="APPEARANCE" colors={colors} />
      <NbCard style={styles.groupCard}>
        <View style={styles.appearancePad}>
          <SegmentedPills
            options={APPEARANCE_OPTIONS}
            selectedValue={appearanceValue}
            onChange={onAppearanceChange}
            isDark={isDark}
            colors={colors}
          />
        </View>
      </NbCard>
    </>
  );
}

/**
 * PREFERENCES — workout reminder switch (+ subtitle when on).
 * @param {object} props
 */
function PreferencesSection({
  workoutReminders,
  reminderTime,
  onReminderToggle,
  colors,
}) {
  const reminderSubtitle = workoutReminders
    ? `Time to workout! at ${reminderTime.toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : null;

  return (
    <>
      <SectionHeader title="PREFERENCES" colors={colors} />
      <NbCard style={styles.groupCard}>
        <SettingsGroupRow
          title="Workout reminders"
          subtitle={reminderSubtitle}
          colors={colors}
          right={<NbSwitch value={workoutReminders} onValueChange={onReminderToggle} />}
        />
      </NbCard>
    </>
  );
}

/**
 * AI feature bullet Text nodes for the expandable details pad.
 * @param {object} colors
 * @returns {Array}
 */
function buildAiFeatureBulletNodes(colors) {
  const bulletNodes = [];
  for (let bulletIndex = 0; bulletIndex < AI_FEATURE_BULLETS.length; bulletIndex += 1) {
    const bulletLine = AI_FEATURE_BULLETS[bulletIndex];
    bulletNodes.push(
      <Text key={bulletLine} style={[styles.aiBullet, { color: colors.nbMuted }]}>
        {bulletLine}
      </Text>,
    );
  }
  return bulletNodes;
}

/**
 * AI FEATURES — toggle, meter, expandable bullet list.
 * @param {object} props
 */
function AiFeaturesSection({
  aiEnabled,
  toggleAI,
  toggleMeter,
  aiDetailsOpen,
  onToggleAiDetails,
  aiMeterPercent,
  colors,
}) {
  const switchIsDimmed = toggleMeter.isFrozenFromChurn && !aiEnabled;
  const switchOpacity = switchIsDimmed ? AI_SWITCH_FROZEN_OPACITY : 1;
  const meterWidthPercent = Math.min(PERCENT_SCALE, aiMeterPercent);
  const showMeter = aiDetailsOpen && !toggleMeter.isFrozenFromChurn;

  return (
    <>
      <SectionHeader title="AI FEATURES" colors={colors} />
      <NbCard style={styles.groupCard}>
        <SettingsGroupRow
          title="AI-powered features"
          subtitle={getAiToggleMeterHint(toggleMeter)}
          colors={colors}
          right={
            <NbSwitch
              value={!!aiEnabled}
              onValueChange={(enabled) => toggleAI(enabled)}
              style={{ opacity: switchOpacity }}
            />
          }
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="What you can use when AI is on"
          colors={colors}
          showChevron
          onPress={onToggleAiDetails}
        />
        {aiDetailsOpen ? (
          <View style={styles.aiDetailsPad}>
            {showMeter ? (
              <View
                style={[
                  styles.aiMeterTrack,
                  {
                    backgroundColor: colors.nbSurfaceChip,
                    borderColor: colors.nbBorder,
                    borderWidth: nb.borderWidth,
                  },
                ]}
              >
                <LinearGradient
                  colors={gradients.brand.colors}
                  start={gradients.brand.start}
                  end={gradients.brand.end}
                  style={[styles.aiMeterFill, { width: `${meterWidthPercent}%` }]}
                />
              </View>
            ) : null}
            {buildAiFeatureBulletNodes(colors)}
          </View>
        ) : null}
      </NbCard>
    </>
  );
}

/**
 * BILLING — client coaching payment row (only when a trainer is linked).
 * @param {object} props
 */
function ClientBillingSection({
  clientCoachName,
  clientBillingLabel,
  clientBillingTone,
  paymentStatus,
  userDataProp,
  onOpenCoachingPayment,
  colors,
}) {
  const canOpenPayment = typeof onOpenCoachingPayment === 'function';
  const statusFromUserDoc = paymentStatusFromUserData(userDataProp);
  const livePaymentStatus = paymentStatus || statusFromUserDoc;
  let chipLabel = clientBillingLabel;
  if (livePaymentStatus === STATUS_ACTIVE) {
    chipLabel = 'Active';
  }
  let billingSubtitle = `${clientCoachName}`;
  if (clientBillingLabel && clientBillingLabel !== 'Active') {
    billingSubtitle = `${clientCoachName} · ${clientBillingLabel}`;
  }

  return (
    <>
      <SectionHeader title="BILLING" colors={colors} />
      <NbCard style={styles.groupCard}>
        <SettingsGroupRow
          title="Coaching payment"
          subtitle={billingSubtitle}
          colors={colors}
          showChevron={canOpenPayment}
          onPress={canOpenPayment ? onOpenCoachingPayment : undefined}
          right={
            <PaymentStatusChip
              label={chipLabel}
              tone={clientBillingTone}
              colors={colors}
            />
          }
        />
      </NbCard>
    </>
  );
}

/**
 * PAYMENTS AND PAYOUTS — trainer Stripe / identity / earnings rows.
 * @param {object} props
 */
function TrainerPayoutsSection({
  resolvedStripeStatus,
  stripeAccountId,
  stripeConnect,
  onOpenProfile,
  onOpenPayments,
  colors,
}) {
  const identityLabel =
    resolvedStripeStatus === STATUS_ACTIVE
      ? 'Verified'
      : payoutChipLabel(resolvedStripeStatus);
  const payoutLabel = payoutChipLabel(resolvedStripeStatus);
  const payoutTone = payoutChipTone(resolvedStripeStatus);

  const handleStripeMethodPress = () => {
    if (stripeConnect.error) {
      stripeConnect.retry();
      return;
    }
    stripeConnect.startConnect();
  };

  return (
    <>
      <SectionHeader title="PAYMENTS AND PAYOUTS" colors={colors} />
      <NbCard style={styles.groupCard}>
        <SettingsGroupRow
          title="Identity verification (Face ID)"
          colors={colors}
          showChevron
          onPress={onOpenProfile}
          right={
            <PaymentStatusChip
              label={identityLabel}
              tone={payoutTone}
              colors={colors}
            />
          }
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="Payment method (Stripe)"
          subtitle={maskStripeAccountId(stripeAccountId)}
          colors={colors}
          showChevron
          onPress={handleStripeMethodPress}
          right={
            <PaymentStatusChip label={payoutLabel} tone={payoutTone} colors={colors} />
          }
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="Payout account"
          colors={colors}
          showChevron
          onPress={onOpenPayments}
          right={
            <PaymentStatusChip label={payoutLabel} tone={payoutTone} colors={colors} />
          }
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="Earnings and payouts"
          colors={colors}
          showChevron
          onPress={onOpenPayments}
        />
      </NbCard>
    </>
  );
}

/**
 * COACH CONNECT PRO — iOS platform subscription + restore.
 * @param {object} props
 */
function ProSubscriptionSection({
  platformSubscriptionStatus,
  onRestorePurchases,
  restorePurchasesLoading,
  colors,
}) {
  const canRestore = typeof onRestorePurchases === 'function';

  const handleRestorePress = () => {
    if (!restorePurchasesLoading) onRestorePurchases();
  };

  return (
    <>
      <SectionHeader title="COACH CONNECT PRO" colors={colors} />
      <NbCard style={styles.groupCard}>
        <SettingsGroupRow
          title="Platform subscription"
          colors={colors}
          right={
            <PaymentStatusChip
              label={platformSubscriptionStatus}
              tone={platformSubTone(platformSubscriptionStatus)}
              colors={colors}
            />
          }
        />
        {canRestore ? (
          <>
            <GroupDivider colors={colors} />
            <SettingsGroupRow
              title="Restore purchases"
              colors={colors}
              showChevron={!restorePurchasesLoading}
              onPress={handleRestorePress}
              right={
                restorePurchasesLoading ? (
                  <Text
                    style={{
                      fontFamily: 'Inter_400Regular',
                      fontSize: 14,
                      color: colors.nbMuted,
                    }}
                  >
                    Working…
                  </Text>
                ) : null
              }
            />
          </>
        ) : null}
      </NbCard>
    </>
  );
}

/**
 * ACCOUNT — profile, password, blocked, optional remove trainer, sign out.
 * @param {object} props
 */
function AccountSection({
  colors,
  onEditProfile,
  onChangePassword,
  onBlockedUsers,
  showRemoveTrainer,
  onOpenRemoveTrainer,
  onSignOut,
}) {
  return (
    <>
      <SectionHeader title="ACCOUNT" colors={colors} />
      <NbCard style={styles.groupCard}>
        <SettingsGroupRow
          title="Edit profile"
          colors={colors}
          showChevron
          onPress={onEditProfile}
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="Change password"
          colors={colors}
          showChevron
          onPress={onChangePassword}
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="Blocked users"
          colors={colors}
          showChevron
          onPress={onBlockedUsers}
        />
        {showRemoveTrainer ? (
          <>
            <GroupDivider colors={colors} />
            <SettingsGroupRow
              title="Remove trainer"
              colors={colors}
              titleColor={colors.error}
              showChevron
              onPress={onOpenRemoveTrainer}
            />
          </>
        ) : null}
        <GroupDivider colors={colors} />
        <SettingsGroupRow title="Sign out" colors={colors} showChevron onPress={onSignOut} />
      </NbCard>
    </>
  );
}

/**
 * SUPPORT — contact, bug, FAQ, terms, privacy, version.
 * @param {object} props
 */
function SupportSection({ colors, onOpenSupportScreen }) {
  return (
    <>
      <SectionHeader title="SUPPORT" colors={colors} />
      <NbCard style={styles.groupCard}>
        <SettingsGroupRow
          title="Contact support"
          colors={colors}
          showChevron
          onPress={() => onOpenSupportScreen('contactSupport')}
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="Report a bug"
          colors={colors}
          showChevron
          onPress={() => onOpenSupportScreen('bugReport')}
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="FAQ"
          colors={colors}
          showChevron
          onPress={() => onOpenSupportScreen('helpFaq')}
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="Terms of service"
          colors={colors}
          showChevron
          onPress={() => onOpenSupportScreen('terms')}
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="Privacy policy"
          colors={colors}
          showChevron
          onPress={() => onOpenSupportScreen('privacy')}
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="Privacy and data rights"
          colors={colors}
          showChevron
          onPress={() => onOpenSupportScreen('privacyDataRights')}
        />
        <GroupDivider colors={colors} />
        <SettingsGroupRow
          title="Version"
          colors={colors}
          right={
            <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.nbMuted }}>
              {APP_VERSION_LABEL}
            </Text>
          }
        />
      </NbCard>
    </>
  );
}

/**
 * Delete account card alone at the bottom (Design Law).
 * @param {object} props
 */
function DeleteAccountCard({ colors, user, onPressDelete }) {
  return (
    <NbCard style={styles.deleteCard}>
      <TouchableOpacity
        onPress={onPressDelete}
        disabled={!user}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
        style={styles.deleteRow}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.deleteTitle, { color: colors.nbInk }]}>Delete account</Text>
          <Text style={[styles.deleteHint, { color: colors.nbMuted }]}>
            Permanently removes your data.
          </Text>
        </View>
      </TouchableOpacity>
    </NbCard>
  );
}

/**
 * Change-password bottom sheet fields (current / new / confirm).
 * @param {object} props
 */
function ChangePasswordSheet({
  colors,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  passwordUpdatedNote,
  onUpdatePassword,
  onCancel,
}) {
  const passwordFields = [
    {
      key: 'current',
      label: 'CURRENT PASSWORD',
      value: currentPassword,
      setValue: setCurrentPassword,
    },
    {
      key: 'new',
      label: 'NEW PASSWORD',
      value: newPassword,
      setValue: setNewPassword,
    },
    {
      key: 'confirm',
      label: 'CONFIRM NEW PASSWORD',
      value: confirmPassword,
      setValue: setConfirmPassword,
    },
  ];
  const keyboardBehavior = Platform.OS === PLATFORM_IOS ? 'padding' : 'height';
  const sheetChrome = {
    backgroundColor: colors.nbBackground,
    borderColor: colors.nbBorder,
  };
  const passwordFieldNodes = [];
  for (let fieldIndex = 0; fieldIndex < passwordFields.length; fieldIndex += 1) {
    const field = passwordFields[fieldIndex];
    passwordFieldNodes.push(
      <View key={field.key}>
        <Text style={[styles.passwordLabel, { color: colors.nbMuted }]}>{field.label}</Text>
        <TextInput
          style={[
            styles.passwordInput,
            {
              backgroundColor: colors.nbSurface,
              color: colors.nbInk,
              borderColor: colors.nbBorder,
              shadowColor: colors.nbShadow,
            },
          ]}
          placeholder="••••••••"
          placeholderTextColor={colors.nbMuted}
          secureTextEntry
          value={field.value}
          onChangeText={field.setValue}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>,
    );
  }

  return (
    <KeyboardAvoidingView behavior={keyboardBehavior} style={styles.modalContainer}>
      <View style={[styles.bottomSheet, sheetChrome]}>
        <Text style={[styles.bottomSheetTitle, { color: colors.nbInk }]}>Change password</Text>
        {passwordFieldNodes}
        {passwordUpdatedNote ? (
          <NbCard style={styles.passwordSuccessCard}>
            <Text style={[styles.passwordSuccessTitle, { color: colors.nbInk }]}>
              Password updated successfully.
            </Text>
            <Text style={[styles.passwordSuccessBody, { color: colors.nbMuted }]}>
              This is the success message, shown after saving.
            </Text>
          </NbCard>
        ) : null}
        <View style={styles.confirmButtonOuter}>
          <NbButton variant="fill" onPress={onUpdatePassword}>
            Update password
          </NbButton>
        </View>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={[styles.cancelButtonText, { color: colors.nbMuted }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Sign-out confirmation body inside NbSheet.
 * @param {object} props
 */
function SignOutSheetBody({ colors, signingOut, onConfirm, onCancel }) {
  const confirmLabel = signingOut ? 'Signing out…' : 'Sign out';
  return (
    <>
      <View
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 999,
          borderWidth: nb.borderWidthPill,
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSoft,
          marginBottom: 10,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '900', color: colors.nbInk }}>Signed out</Text>
      </View>
      <Text style={{ fontSize: 20, fontWeight: '900', color: colors.nbInk, marginBottom: 8 }}>
        Please sign in again.
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: colors.nbMuted,
          lineHeight: 20,
          marginBottom: 16,
        }}
      >
        Your session will end. Logs on this phone are kept and will sync after you sign in.
      </Text>
      <NbButton variant="fill" onPress={onConfirm} disabled={signingOut}>
        {confirmLabel}
      </NbButton>
      <View style={{ height: 10 }} />
      <NbButton variant="ghost" onPress={onCancel} disabled={signingOut}>
        Cancel
      </NbButton>
    </>
  );
}

/**
 * Hold-to-delete message — mentions Apple subscriptions on iOS.
 * @returns {string}
 */
function deleteAccountHoldMessage() {
  const appleTail =
    Platform.OS === PLATFORM_IOS
      ? ` (${APPLE_MANAGE_SUBSCRIPTIONS_URL}).`
      : '.';
  return (
    'This is permanent. Your profile, workouts, nutrition logs, and messages tied to this account will be removed.\n\n' +
    'Deleting your Coach Connect account does not cancel Coach Connect Pro. If you subscribe through Apple, manage or cancel in Settings → Apple ID → Subscriptions' +
    appleTail +
    '\n\nHold the button until the bar fills to confirm.'
  );
}

// ===== MAIN FUNCTION =====

/**
 * Client and trainer Settings screen.
 * Flow: 1. hooks + load user  2. reminder / password / delete handlers  3. section flags  4. render groups
 * @param {object} props
 */
export default function SettingsScreen({
  onNavigate: onNavigateProp,
  onBack: onBackProp,
  onClose,
  userRole: userRoleProp,
  userData: userDataProp,
  trainerData: trainerDataProp,
  embedShellBottomNav = false,
  platformSubscriptionStatus,
  onRestorePurchases,
  restorePurchasesLoading = false,
  onOpenCoachingPayment,
  // Client only: opens RemoveTrainerPopup to end the coach link (same sheet as the home card).
  onOpenRemoveTrainer,
}) {
  // --- Hook order frozen (do not reorder) ---
  const onNavigate = useShellNavigate(onNavigateProp);
  const onBack = onBackProp || onClose;
  const { colors, isDark, themeMode, toggleTheme } = useTheme();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  // Design Law Appearance has Light / Dark / System — selected value is the saved themeMode itself.
  const appearanceValue = themeMode || 'system';
  const { aiEnabled, toggleAI, toggleMeter, refreshToggleMeter } = useAI();
  const [workoutReminders, setWorkoutReminders] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdatedNote, setPasswordUpdatedNote] = useState(false);
  const [showDeleteHoldModal, setShowDeleteHoldModal] = useState(false);
  const [showSignOutSheet, setShowSignOutSheet] = useState(false);
  const [notice, setNotice] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [aiDetailsOpen, setAiDetailsOpen] = useState(false);
  const [resolvedUserRole, setResolvedUserRole] = useState(userRoleProp || null);
  const [stripeConnectStatus, setStripeConnectStatus] = useState('not_connected');
  const [stripeAccountId, setStripeAccountId] = useState('');
  const [monthlyRate, setMonthlyRate] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('inactive');

  const showNotice = (title, message) => setNotice({ title, message });
  const navigateFromSettings = (screenKey) =>
    openSettingsSubScreen(screenKey, onNavigate, showNotice);

  const auth = getAuth();
  const user = auth.currentUser;
  const signedInUserId = user ? user.uid : null;

  const userRole = userRoleProp || resolvedUserRole || ROLE_CLIENT;
  const isTrainer = userRole === ROLE_TRAINER;
  const clientCoachName = coachNameFromTrainerData(trainerDataProp);
  const resolvedStripeStatus = resolveStripeStatus({
    stripeStatus: stripeConnectStatus,
    stripeConnectStatus,
    stripeAccountId,
  });

  const stripeConnect = trainerPayoutSetupFlow({
    email: emailForStripeConnect(user, userDataProp),
    onActive: async () => {
      setStripeConnectStatus(STATUS_ACTIVE);
      if (!signedInUserId) return;
      const snap = await getDoc(doc(db, USERS_COLLECTION, signedInUserId));
      if (!snap.exists()) return;
      const data = snap.data();
      setStripeAccountId(data.stripeAccountId || '');
      setStripeConnectStatus(data.stripeStatus || data.stripeConnectStatus || STATUS_ACTIVE);
    },
  });

  // 1. Load users/{uid} once signed in; backfill reminder clock fields if missing.
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, USERS_COLLECTION, user.uid);
    getDoc(userRef).then(async (docSnap) => {
      if (!docSnap.exists()) return;
      await applyUserSettingsDoc(
        docSnap.data(),
        {
          setResolvedUserRole,
          setStripeConnectStatus,
          setStripeAccountId,
          setMonthlyRate,
          setPaymentStatus,
          setWorkoutReminders,
          setReminderTime,
        },
        userRoleProp,
        userRef,
      );
    });
  }, [user, userRoleProp]);

  // Keep billing chips in sync when the parent passes fresher userData.
  const propPaymentStatus = paymentStatusFromUserData(userDataProp);
  const propMonthlyRate = monthlyRateFromUserData(userDataProp);
  useEffect(() => {
    if (propPaymentStatus) {
      setPaymentStatus(propPaymentStatus);
    }
    if (propMonthlyRate != null) {
      setMonthlyRate(propMonthlyRate);
    }
  }, [propPaymentStatus, propMonthlyRate]);

  const clientBillingLabel = useMemo(
    () => buildClientBillingLabel({ monthlyRate, userDataProp, trainerDataProp, paymentStatus }),
    [monthlyRate, paymentStatus, userDataProp, trainerDataProp],
  );

  const clientBillingTone = useMemo(
    () => buildClientBillingTone({ monthlyRate, userDataProp, trainerDataProp, paymentStatus }),
    [monthlyRate, paymentStatus, userDataProp, trainerDataProp],
  );

  useEffect(() => {
    if (signedInUserId) {
      refreshToggleMeter().catch(() => {});
    }
  }, [signedInUserId, refreshToggleMeter]);

  // 2a. Toggle reminders — on opens the time picker; off clears the local + Firestore flag.
  const handleReminderToggle = async (value) => {
    setWorkoutReminders(value);
    if (!user) return;
    if (value) {
      setShowTimePicker(true);
      return;
    }
    await disableWorkoutReminder(user.uid);
  };

  // 2b. Persist the picked reminder time and schedule the daily notification.
  const onTimeChange = async (event, selectedTime) => {
    const currentTime = selectedTime || reminderTime;
    setShowTimePicker(Platform.OS === PLATFORM_IOS);
    setReminderTime(currentTime);

    if (!user) return;
    try {
      await scheduleWorkoutReminder(currentTime);
      await setDoc(
        doc(db, USERS_COLLECTION, user.uid),
        { workoutReminder: { enabled: true, ...workoutReminderClockFromDate(currentTime) } },
        { merge: true },
      );
      showNotice(
        'Reminders set',
        `You'll be notified daily at ${currentTime.toLocaleTimeString()}.`,
      );
    } catch (error) {
      console.error('Error setting reminder: ', error);
      showNotice('Could not set reminder', 'Please try again.');
    }
  };

  // 2c. Re-auth with current password, then update Firebase Auth password (Design Law: 3 fields).
  const handleChangePassword = async () => {
    if (!user) {
      showNotice('Sign in required', 'Please sign in again and retry.');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      showNotice('Missing fields', 'Fill in current, new, and confirm password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotice('Passwords do not match', 'New password and confirmation must match.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      showNotice('Password too short', 'New password must be at least 6 characters.');
      return;
    }
    try {
      const email = user.email;
      if (!email) throw new Error('No email on this account — sign in again.');
      // vocab: reauthenticateWithCredential proves they know the current password before updatePassword.
      const credential = EmailAuthProvider.credential(email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordUpdatedNote(true);
    } catch (error) {
      showNotice(
        'Could not update password',
        messageFromCaughtError(error, 'Please try again.'),
      );
    }
  };

  const closePasswordModal = () => {
    setPasswordModalVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordUpdatedNote(false);
  };

  // 2d. Delete via callable, then HTTP fallback, then sign out.
  async function runDeleteAccountOnServer() {
    try {
      const deleteCallable = httpsCallable(functions, 'deleteAccount');
      const callableResponse = await deleteCallable({});
      if (deleteCallableSaidOk(callableResponse)) {
        return;
      }
      throw new Error('Delete failed');
    } catch (_callableError) {
      const freshIdToken = await user.getIdToken(true);
      await deleteAccountThroughHttpFallback({ userId: user.uid, idToken: freshIdToken });
    }
  }

  async function tryRemoveAuthUserAfterServerDelete() {
    try {
      await deleteUser(user);
    } catch (_ignoredError) {
      // ignore — backend already performed canonical deletion
    }
  }

  async function performDeleteAccount() {
    if (!user) {
      throw new Error('Not signed in. Please sign in again and retry.');
    }
    try {
      await runDeleteAccountOnServer();
      await tryRemoveAuthUserAfterServerDelete();
      await signOut(auth);
      showNotice('Account deleted', 'Your account and data have been permanently deleted.');
    } catch (error) {
      const message = messageFromCaughtError(
        error,
        'Failed to delete account. Please try again.',
      );
      throw new Error(message);
    }
  }

  // 3. Section visibility flags (same gates as before).
  const hasLinkedTrainer = clientHasLinkedTrainer(userDataProp, trainerDataProp);
  const showClientBilling = !isTrainer && hasLinkedTrainer;
  const canOpenRemoveTrainer = typeof onOpenRemoveTrainer === 'function';
  const showRemoveTrainer = !isTrainer && canOpenRemoveTrainer && hasLinkedTrainer;
  const showProSection = isTrainer && Platform.OS === PLATFORM_IOS && platformSubscriptionStatus;
  const aiUseFraction = toggleMeter.monthlyUseFraction ?? 0;
  const aiMeterPercent = Math.round(aiUseFraction * PERCENT_SCALE);
  const settingsDisplayName = settingsDisplayNameFromUser(userDataProp, user);
  const settingsPhotoURL = photoUrlForSettings(userDataProp, user);
  const settingsRoleSubtitle = settingsIdentitySubtitle({
    isTrainer,
    userDataProp,
    trainerDataProp,
    clientCoachName,
  });
  const settingsInitials = initialsFromDisplayName(settingsDisplayName);
  let headerSubtitle = null;
  if (isTrainer) {
    headerSubtitle = 'Trainer';
  }
  const showShellBottomNav = !!(onNavigate && !embedShellBottomNav);
  const deleteHoldMessage = deleteAccountHoldMessage();
  let noticeTitle = '';
  let noticeMessage;
  if (notice) {
    noticeTitle = notice.title || '';
    noticeMessage = notice.message;
  }

  const handleSignOutPress = () => setShowSignOutSheet(true);

  const confirmSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onUserSignOut();
      setShowSignOutSheet(false);
    } catch (error) {
      showNotice('Sign out failed', messageFromCaughtError(error, 'Please try again.'));
    } finally {
      setSigningOut(false);
    }
  };

  const openProfileFromSettings = () => navigateFromSettings('profile');
  const openPaymentsFromSettings = () => navigateFromSettings('payments');
  const openSupportScreen = (screenKey) =>
    openSettingsSubScreen(screenKey, onNavigate, showNotice);
  const handleAppearanceChange = (mode) => toggleTheme(mode);
  const handleToggleAiDetails = () => setAiDetailsOpen((open) => !open);
  let handleEditFromIdentityCard;
  if (onNavigate) {
    handleEditFromIdentityCard = () => navigateFromSettings('profile');
  }

  // 4. Render: identity → grouped sections → delete → sheets / modals → optional shell nav.
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader title="Settings" subtitle={headerSubtitle} onBack={onBack || undefined} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: shellNavInset }]}
        {...FORM_SCROLL_PROPS}
      >
        <SettingsProfileCard
          name={settingsDisplayName}
          subtitle={settingsRoleSubtitle}
          initials={settingsInitials}
          photoURL={settingsPhotoURL}
          onEdit={handleEditFromIdentityCard}
          colors={colors}
        />

        <AppearanceSection
          appearanceValue={appearanceValue}
          onAppearanceChange={handleAppearanceChange}
          isDark={isDark}
          colors={colors}
        />

        <PreferencesSection
          workoutReminders={workoutReminders}
          reminderTime={reminderTime}
          onReminderToggle={handleReminderToggle}
          colors={colors}
        />

        <AiFeaturesSection
          aiEnabled={aiEnabled}
          toggleAI={toggleAI}
          toggleMeter={toggleMeter}
          aiDetailsOpen={aiDetailsOpen}
          onToggleAiDetails={handleToggleAiDetails}
          aiMeterPercent={aiMeterPercent}
          colors={colors}
        />

        {showTimePicker ? (
          <DateTimePicker
            value={reminderTime}
            mode="time"
            is24Hour={true}
            display="default"
            onChange={onTimeChange}
          />
        ) : null}

        {showClientBilling ? (
          <ClientBillingSection
            clientCoachName={clientCoachName}
            clientBillingLabel={clientBillingLabel}
            clientBillingTone={clientBillingTone}
            paymentStatus={paymentStatus}
            userDataProp={userDataProp}
            onOpenCoachingPayment={onOpenCoachingPayment}
            colors={colors}
          />
        ) : null}

        {isTrainer ? (
          <TrainerPayoutsSection
            resolvedStripeStatus={resolvedStripeStatus}
            stripeAccountId={stripeAccountId}
            stripeConnect={stripeConnect}
            onOpenProfile={openProfileFromSettings}
            onOpenPayments={openPaymentsFromSettings}
            colors={colors}
          />
        ) : null}

        {showProSection ? (
          <ProSubscriptionSection
            platformSubscriptionStatus={platformSubscriptionStatus}
            onRestorePurchases={onRestorePurchases}
            restorePurchasesLoading={restorePurchasesLoading}
            colors={colors}
          />
        ) : null}

        <AccountSection
          colors={colors}
          onEditProfile={openProfileFromSettings}
          onChangePassword={() => setPasswordModalVisible(true)}
          onBlockedUsers={() => setShowBlockedUsers(true)}
          showRemoveTrainer={showRemoveTrainer}
          onOpenRemoveTrainer={onOpenRemoveTrainer}
          onSignOut={handleSignOutPress}
        />

        <SupportSection colors={colors} onOpenSupportScreen={openSupportScreen} />

        <DeleteAccountCard
          colors={colors}
          user={user}
          onPressDelete={() => setShowDeleteHoldModal(true)}
        />
      </ScrollView>

      <Modal visible={isPasswordModalVisible} transparent={true} animationType="slide">
        <ChangePasswordSheet
          colors={colors}
          currentPassword={currentPassword}
          setCurrentPassword={setCurrentPassword}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          passwordUpdatedNote={passwordUpdatedNote}
          onUpdatePassword={handleChangePassword}
          onCancel={closePasswordModal}
        />
      </Modal>

      <TrainerPayoutSetupPopup
        visible={!!stripeConnect.webViewUrl}
        url={stripeConnect.webViewUrl}
        title="Connect with Stripe"
        isDark={isDark}
        onClose={() => stripeConnect.closeWebView({ userClosed: true })}
        onComplete={stripeConnect.handleWebViewComplete}
      />

      <HoldToConfirmPopup
        visible={showDeleteHoldModal}
        onClose={() => setShowDeleteHoldModal(false)}
        isDark={isDark}
        title="Delete account?"
        message={deleteHoldMessage}
        holdDurationMs={HOLD_TO_DELETE_MS}
        pillLabel="Hold to confirm"
        onHoldComplete={performDeleteAccount}
      />

      <NbSheet
        visible={showSignOutSheet}
        onClose={() => !signingOut && setShowSignOutSheet(false)}
        title="Sign out"
      >
        <SignOutSheetBody
          colors={colors}
          signingOut={signingOut}
          onConfirm={confirmSignOut}
          onCancel={() => setShowSignOutSheet(false)}
        />
      </NbSheet>

      <NbNoticeSheet
        visible={!!notice}
        onClose={() => setNotice(null)}
        title={noticeTitle}
        message={noticeMessage}
        confirmLabel="OK"
      />

      <Modal visible={showBlockedUsers} animationType="slide" presentationStyle="fullScreen">
        <BlockedUsersScreen onClose={() => setShowBlockedUsers(false)} />
      </Modal>

      {showShellBottomNav ? (
        <ShellBottomNavAnchor>
          <BottomMenuBar
            onHomePress={() => navigateFromSettings('home')}
            onProfilePress={() => navigateFromSettings('profile')}
            onPlusPress={() => navigateFromSettings('create')}
            onVoicePress={() => navigateFromSettings('voice')}
            onWorkoutPress={() => navigateFromSettings('workout')}
            onNutritionPress={() => navigateFromSettings('nutrition')}
            onMessagesPress={() => navigateFromSettings('messages')}
            activeTabKey="home"
          />
        </ShellBottomNavAnchor>
      ) : null}
    </SafeAreaView>
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Background fill for a status chip tone (dark vs light).
 * Kept for callers / future chips — not used by the Active gradient path.
 * @param {string} tone
 * @param {boolean} isDark
 * @returns {string}
 */
function statusChipBackground(tone, isDark) {
  if (tone === 'success') return isDark ? 'rgba(48,209,88,0.15)' : 'rgba(48,209,88,0.12)';
  if (tone === 'warning') return isDark ? 'rgba(255,159,10,0.15)' : 'rgba(255,159,10,0.12)';
  if (tone === 'error') return isDark ? 'rgba(255,59,48,0.15)' : 'rgba(255,59,48,0.12)';
  return isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
}

/**
 * Theme subtitle under the Light / Dark / System pills (available for future copy).
 * @param {string} themeMode
 * @returns {string}
 */
function appearanceSubtitle(themeMode) {
  if (themeMode === 'system') return 'Following your device appearance.';
  if (themeMode === 'dark') return 'Dark mode is on.';
  return 'Light mode is on.';
}

/**
 * One payment history line under Coaching payment. Uses nb tokens.
 * @param {{ row: object, colors: object }} props
 */
function PaymentHistoryRow({ row, colors }) {
  const amountIsWholeDollars = row.amount % 1 === 0;
  let amountText = row.amount.toFixed(2);
  if (amountIsWholeDollars) {
    amountText = String(row.amount);
  }
  // Design Law: status text stays ink/muted — no green status chrome
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderTopWidth: nb.borderWidth,
        borderTopColor: colors.nbBorder,
      }}
    >
      <Text
        style={{
          width: 52,
          fontSize: 12,
          fontFamily: 'Inter_400Regular',
          color: colors.nbMuted,
        }}
      >
        {row.date}
      </Text>
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          fontFamily: 'Inter_600SemiBold',
          color: colors.nbInk,
        }}
        numberOfLines={1}
      >
        {row.coach}
      </Text>
      <Text
        style={{
          width: 52,
          fontSize: 13,
          fontFamily: 'SpaceGrotesk_700Bold',
          color: colors.nbInk,
          textAlign: 'right',
        }}
      >
        ${amountText}
      </Text>
      <Text
        style={{
          width: 78,
          fontSize: 11,
          fontFamily: 'SpaceGrotesk_700Bold',
          textAlign: 'right',
          color: colors.nbMuted,
        }}
      >
        {row.status}
      </Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  track: {
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    paddingVertical: 4,
    paddingHorizontal: 4,
    position: 'relative',
    overflow: 'hidden',
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  cellLabel: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14 },
  cellLabelSelected: { fontFamily: 'SpaceGrotesk_700Bold' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  identityCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  identityAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: nb.borderWidth,
  },
  identityAvatarImg: { width: 52, height: 52, borderRadius: 26 },
  identityInitials: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    color: '#0A0A0A',
  },
  identityCopy: { flex: 1, minWidth: 0 },
  identityName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    letterSpacing: -0.2,
  },
  identitySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 17,
  },
  editChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  editChipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  sectionHeader: {
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  // Manipulate here: group cards are padding:0 so rows + dividers own the spacing
  groupCard: {
    marginBottom: spacing.lg,
    padding: 0,
    overflow: 'hidden',
  },
  appearancePad: { padding: spacing.md },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: nb.minTouchTarget,
    gap: spacing.sm,
  },
  groupRowText: { flex: 1, minWidth: 0 },
  groupRowTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    letterSpacing: -0.15,
  },
  groupRowSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 17,
  },
  groupRowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deleteCard: {
    marginBottom: spacing.xl,
    padding: spacing.md,
  },
  deleteRow: {
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  deleteTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  deleteHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 4,
  },
  aiDetailsPad: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  aiMeterTrack: {
    height: 8,
    borderRadius: 4,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  aiMeterFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 2,
  },
  aiBullet: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  statusChipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
  },
  divider: {
    height: nb.borderWidthDivider,
    marginHorizontal: spacing.md,
  },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  bottomSheet: {
    padding: spacing.lg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
  },
  bottomSheetTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  passwordLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
  passwordInput: {
    fontFamily: 'Inter_400Regular',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: nb.borderWidth,
    minHeight: 48,
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  confirmButtonOuter: {
    marginBottom: spacing.sm,
  },
  cancelButton: { padding: spacing.md, alignItems: 'center' },
  cancelButtonText: {
    fontFamily: 'Inter_600SemiBold',
  },
  passwordSuccessCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  passwordSuccessTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    marginBottom: 4,
  },
  passwordSuccessBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
});
