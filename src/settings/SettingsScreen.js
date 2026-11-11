// App settings: theme, reminders, AI toggle, billing/payouts, account, and support links.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { deleteUser, getAuth, signOut, updatePassword } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../app-start/cloudConnection';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import TopHeader from '../for-both/loading-and-header/TopHeader';
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
import {
  TRAINER_CLIENT_MESSAGE_RECOMMENDED,
  TRAINER_CLIENT_MESSAGE_VENMO_WARNING,
} from '../for-both/payments/howPaymentsWorkText';
import { traineePaymentHistory } from '../for-both/payments/traineePaymentHistory';
import BlockedUsersScreen from '../block-and-report/BlockedUsersScreen';
import { APPLE_MANAGE_SUBSCRIPTIONS_URL } from '../trainer-pro-plan/proPlanSwitches';
import NbCard from '../look-and-feel/NbCard';
import NbListRow from '../look-and-feel/NbListRow';
import NbSwitch from '../look-and-feel/NbSwitch';
import NbButton from '../look-and-feel/NbButton';
import { nb, gradients, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_INSET = 24;
const SEGMENT_TRACK_PAD = 4;
const SPRING_FRICTION = 9;
const SPRING_TENSION = 140;
const SPRING_VELOCITY = 0.5;
const CENTS_THRESHOLD = 100;
const PERCENT_SCALE = 100;
const HOLD_TO_DELETE_MS = 1200;
const USERS_COLLECTION = 'users';
const DELETE_ACCOUNT_URL =
  'https://us-central1-anatrox-auth.cloudfunctions.net/auth/deleteAccount';
const DEFAULT_TIME_ZONE = 'UTC';
const PLATFORM_IOS = 'ios';
const STATUS_ACTIVE = 'active';
const STATUS_PENDING = 'pending';
const STATUS_PENDING_VERIFICATION = 'pending_verification';
const ROLE_TRAINER = 'trainer';
const ROLE_CLIENT = 'client';

// ===== HELPER FUNCTIONS =====

/**
 * Open a settings sub-screen, or warn if navigation is missing.
 * @param {string} screen
 * @param {Function} onNavigate
 * @returns {void}
 */
function openSettingsSubScreen(screen, onNavigate) {
  if (typeof onNavigate === 'function') {
    onNavigate(screen);
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
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
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
 * Background fill for a status chip tone (dark vs light).
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
 * Format a monthly coaching rate for the billing chip.
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
 * Mask a Stripe account id for display.
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
  if (!workoutReminder?.enabled || !workoutReminder?.time) return false;
  if (workoutReminder.hourLocal == null) return true;
  if (workoutReminder.minuteLocal == null) return true;
  if (!String(workoutReminder.timeZone || '').trim()) return true;
  return false;
}

/**
 * Write hourLocal / minuteLocal / timeZone from the stored ISO time.
 * @param {*} userRef
 * @param {string} isoTime
 * @returns {Promise<void>}
 */
async function backfillWorkoutReminderClock(userRef, isoTime) {
  const reminderDate = new Date(isoTime);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  try {
    await updateDoc(userRef, {
      'workoutReminder.hourLocal': reminderDate.getHours(),
      'workoutReminder.minuteLocal': reminderDate.getMinutes(),
      'workoutReminder.timeZone': timeZone,
    });
  } catch (error) {
    console.warn('workoutReminder backfill', error?.message || error);
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
  setters.setWorkoutReminders(data.workoutReminder?.enabled || false);
  if (data.workoutReminder?.time) {
    setters.setReminderTime(new Date(data.workoutReminder.time));
  }
  if (workoutReminderNeedsClockBackfill(data.workoutReminder)) {
    await backfillWorkoutReminderClock(userRef, data.workoutReminder.time);
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
 * Client billing chip label from rate + payment status.
 * @param {object} args
 * @returns {string}
 */
function buildClientBillingLabel({ monthlyRate, userDataProp, trainerDataProp, paymentStatus }) {
  const assignedRate = monthlyRate ?? userDataProp?.monthlyRate ?? null;
  const trainerListedRate =
    trainerDataProp?.pricing?.perMonth ??
    trainerDataProp?.monthlyRate ??
    trainerDataProp?.price ??
    null;
  const effectiveRate = assignedRate ?? trainerListedRate;
  const rateLabel = formatMonthlyRateLabel(effectiveRate);
  const status = paymentStatus || userDataProp?.paymentStatus || 'inactive';
  const hasTrainer = !!(userDataProp?.trainerId || trainerDataProp?.id);

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
function buildClientBillingTone({ monthlyRate, userDataProp, trainerDataProp, paymentStatus }) {
  const status = paymentStatus || userDataProp?.paymentStatus || 'inactive';
  if (status === STATUS_ACTIVE) return 'success';
  if (status === 'past_due') return 'error';
  if (status === 'payment_required') return 'warning';
  const assignedRate = monthlyRate ?? userDataProp?.monthlyRate ?? null;
  const trainerListedRate =
    trainerDataProp?.pricing?.perMonth ??
    trainerDataProp?.monthlyRate ??
    trainerDataProp?.price ??
    null;
  const hasRate = !!(assignedRate ?? trainerListedRate);
  const hasTrainer = !!(userDataProp?.trainerId || trainerDataProp?.id);
  if (hasRate && hasTrainer) return 'warning';
  return 'neutral';
}

/**
 * Theme subtitle under the Light/Dark pills.
 * @param {string} themeMode
 * @returns {string}
 */
function appearanceSubtitle(themeMode) {
  if (themeMode === 'system') return 'Following your device — tap to set light or dark.';
  if (themeMode === 'dark') return 'Dark mode is on.';
  return 'Light mode is on.';
}

/**
 * Platform Pro chip tone from the subscription status string.
 * @param {string} platformSubscriptionStatus
 * @returns {string}
 */
function platformSubTone(platformSubscriptionStatus) {
  if (
    platformSubscriptionStatus.includes(STATUS_ACTIVE) ||
    platformSubscriptionStatus.includes('trial')
  ) {
    return 'success';
  }
  if (platformSubscriptionStatus.includes('Expired')) return 'error';
  return 'neutral';
}

/**
 * POST /auth/deleteAccount on the Cloud Function when the callable fails.
 * vocab: anatrox-auth = production Firebase project id (do not rename to match app branding).
 * @param {{ userId: string, idToken: string }} args
 * @returns {Promise<boolean>}
 */
async function callDeleteAccountEndpoint({ userId, idToken }) {
  const response = await fetch(DELETE_ACCOUNT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ userId }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.ok !== true) {
    throw new Error(json?.error || `Delete failed (${response.status})`);
  }
  return true;
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

  const segmentWidth = trackWidth > 0 ? (trackWidth - SEGMENT_TRACK_PAD * 2) / optionCount : 0;
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

  const translateX =
    segmentWidth > 0
      ? slide.interpolate({
          inputRange: options.map((_, index) => index),
          outputRange: options.map((_, index) => index * segmentWidth),
        })
      : slide.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });

  return (
    <View
      style={[
        pillStyles.track,
        {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
        },
      ]}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            pillStyles.thumb,
            {
              width: segmentWidth,
              transform: [{ translateX }],
              left: SEGMENT_TRACK_PAD,
            },
          ]}
        >
          <LinearGradient
            colors={gradients.brand.colors}
            start={gradients.brand.start}
            end={gradients.brand.end}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <View style={pillStyles.row}>
        {options.map((option) => {
          const selected = option.value === selectedValue;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [pillStyles.cell, pressed && { opacity: 0.85 }]}
            >
              <Text
                style={[
                  pillStyles.cellLabel,
                  { color: selected ? colors.nbInk : colors.nbMuted },
                  selected && pillStyles.cellLabelSelected,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
 * Small status pill next to a settings row label. Uses nb tokens.
 * @param {{ label: string, tone: string, colors: object, isDark: boolean }} props
 */
function PaymentStatusChip({ label, tone, colors, isDark }) {
  const toneColor = statusChipToneColor(tone, colors);
  const chipBackground = statusChipBackground(tone, isDark);
  return (
    <View
      style={[
        styles.statusChip,
        {
          backgroundColor: colors.nbSurfaceChip,
          borderColor: colors.nbBorder,
        },
      ]}
    >
      <Text style={[styles.statusChipText, { color: toneColor }]}>{label}</Text>
    </View>
  );
}

/**
 * One payment history line under Coaching payment. Uses nb tokens.
 * @param {{ row: object, colors: object }} props
 */
function PaymentHistoryRow({ row, colors }) {
  const amountText = row.amount % 1 === 0 ? String(row.amount) : row.amount.toFixed(2);
  const statusColor = row.status === 'Completed' ? colors.success : colors.warning;
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
          color: statusColor,
        }}
      >
        {row.status}
      </Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Client and trainer Settings screen.
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
  const onNavigate = useShellNavigate(onNavigateProp);
  const onBack = onBackProp || onClose;
  const go = (screen) => openSettingsSubScreen(screen, onNavigate);
  const { colors, isDark, themeMode, toggleTheme } = useTheme();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  /** Pill position: explicit light/dark, or match current UI when theme follows system. */
  const appearanceValue = themeMode === 'system' ? (isDark ? 'dark' : 'light') : themeMode;
  const { aiEnabled, toggleAI, toggleMeter, refreshToggleMeter } = useAI();
  const [workoutReminders, setWorkoutReminders] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showDeleteHoldModal, setShowDeleteHoldModal] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [resolvedUserRole, setResolvedUserRole] = useState(userRoleProp || null);
  const [stripeConnectStatus, setStripeConnectStatus] = useState('not_connected');
  const [stripeAccountId, setStripeAccountId] = useState('');
  const [monthlyRate, setMonthlyRate] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('inactive');

  const auth = getAuth();
  const user = auth.currentUser;

  const userRole = userRoleProp || resolvedUserRole || ROLE_CLIENT;
  const isTrainer = userRole === ROLE_TRAINER;
  const clientCoachName =
    trainerDataProp?.name || trainerDataProp?.displayName || trainerDataProp?.firstName || 'Coach';
  const { rows: clientPaymentHistory, loading: clientPaymentHistoryLoading } = traineePaymentHistory(
    !isTrainer ? user?.uid : null,
    clientCoachName,
  );
  const resolvedStripeStatus = resolveStripeStatus({
    stripeStatus: stripeConnectStatus,
    stripeConnectStatus,
    stripeAccountId,
  });

  const stripeConnect = trainerPayoutSetupFlow({
    email: user?.email || userDataProp?.email || '',
    onActive: async () => {
      setStripeConnectStatus(STATUS_ACTIVE);
      if (!user?.uid) return;
      const snap = await getDoc(doc(db, USERS_COLLECTION, user.uid));
      if (!snap.exists()) return;
      const data = snap.data();
      setStripeAccountId(data.stripeAccountId || '');
      setStripeConnectStatus(data.stripeStatus || data.stripeConnectStatus || STATUS_ACTIVE);
    },
  });

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

  useEffect(() => {
    if (userDataProp?.paymentStatus) {
      setPaymentStatus(userDataProp.paymentStatus);
    }
    if (userDataProp?.monthlyRate != null) {
      setMonthlyRate(userDataProp.monthlyRate);
    }
  }, [userDataProp?.paymentStatus, userDataProp?.monthlyRate]);

  const clientBillingLabel = useMemo(
    () => buildClientBillingLabel({ monthlyRate, userDataProp, trainerDataProp, paymentStatus }),
    [monthlyRate, paymentStatus, userDataProp, trainerDataProp],
  );

  const clientBillingTone = useMemo(
    () => buildClientBillingTone({ monthlyRate, userDataProp, trainerDataProp, paymentStatus }),
    [monthlyRate, paymentStatus, userDataProp, trainerDataProp],
  );

  useEffect(() => {
    if (user?.uid) {
      refreshToggleMeter().catch(() => {});
    }
  }, [user?.uid, refreshToggleMeter]);

  // 1. Toggle reminders — on opens the time picker; off clears the local + Firestore flag.
  const handleReminderToggle = async (value) => {
    setWorkoutReminders(value);
    if (!user) return;
    if (value) {
      setShowTimePicker(true);
      return;
    }
    await disableWorkoutReminder(user.uid);
  };

  // 2. Persist the picked reminder time and schedule the daily notification.
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
      Alert.alert('Reminders set', `You'll be notified daily at ${currentTime.toLocaleTimeString()}.`);
    } catch (error) {
      console.error('Error setting reminder: ', error);
      Alert.alert('Error', 'Could not set reminder. Please try again.');
    }
  };

  // 3. Update Firebase Auth password from the bottom sheet.
  const handleChangePassword = () => {
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password.');
      return;
    }
    updatePassword(user, newPassword)
      .then(() => {
        Alert.alert('Success', 'Password updated successfully.');
        setNewPassword('');
        setPasswordModalVisible(false);
      })
      .catch((error) => {
        Alert.alert('Error', error.message);
      });
  };

  // 4. Delete via callable, then HTTP fallback, then sign out.
  async function deleteViaCallableOrHttp() {
    try {
      const callable = httpsCallable(functions, 'deleteAccount');
      const response = await callable({});
      if (response?.data?.ok === true) return;
      throw new Error('Delete failed');
    } catch (_callableError) {
      const idToken = await user.getIdToken(true);
      await callDeleteAccountEndpoint({ userId: user.uid, idToken });
    }
  }

  async function deleteAuthUserQuietly() {
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
      await deleteViaCallableOrHttp();
      await deleteAuthUserQuietly();
      await signOut(auth);
      Alert.alert('Account deleted', 'Your account and data have been permanently deleted.');
    } catch (error) {
      const message = error?.message || 'Failed to delete account. Please try again.';
      throw new Error(message);
    }
  }

  const showClientBilling = !isTrainer && !!(userDataProp?.trainerId || trainerDataProp?.id);
  // Show Remove Trainer only for clients who still have a linked coach + a wired handler.
  const showRemoveTrainer =
    !isTrainer &&
    typeof onOpenRemoveTrainer === 'function' &&
    !!(userDataProp?.trainerId || trainerDataProp?.id);
  const showProSection = isTrainer && Platform.OS === PLATFORM_IOS && platformSubscriptionStatus;
  const aiMeterPercent = Math.round((toggleMeter.monthlyUseFraction ?? 0) * PERCENT_SCALE);
  const paymentButtonLabel =
    (paymentStatus || userDataProp?.paymentStatus) === STATUS_ACTIVE
      ? 'Update payment method'
      : 'Add payment method';
  const stripeButtonLabel =
    resolvedStripeStatus === STATUS_ACTIVE ? 'Update bank account' : 'Connect with Stripe';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <TopHeader
        title="SETTINGS"
        skipTopSafeInset
        onBack={onBack || undefined}
        onProfilePress={onNavigate ? () => go('profile') : null}
        onSettingsPress={() => {}}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: shellNavInset }]}
        {...FORM_SCROLL_PROPS}
      >
        <SectionHeader title="APPEARANCE" colors={colors} />
        <NbCard style={styles.sectionCard}>
          <View style={styles.appearanceBlock}>
            <Text style={[styles.blockTitle, { color: colors.nbInk }]}>Theme</Text>
            <Text style={[styles.blockSubtitle, { color: colors.nbMuted }]}>
              {appearanceSubtitle(themeMode)}
            </Text>
            <SegmentedPills
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              selectedValue={appearanceValue}
              onChange={(mode) => toggleTheme(mode)}
              isDark={isDark}
              colors={colors}
            />
          </View>
        </NbCard>

        <SectionHeader title="PREFERENCES" colors={colors} />
        <NbCard style={styles.sectionCard}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.nbInk }]}>Workout Reminders</Text>
            <NbSwitch value={workoutReminders} onValueChange={handleReminderToggle} />
          </View>
        </NbCard>

        <SectionHeader title="AI FEATURES" colors={colors} />
        <NbCard style={styles.sectionCard}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: spacing.sm }}>
              <Text style={[styles.rowLabel, { color: colors.nbInk }]}>AI-powered features</Text>
              <Text style={[styles.aiDescription, { color: colors.nbMuted }]}>
                {aiEnabled
                  ? 'AI Fitness Coach and workout generator are on.'
                  : 'Off — your coach and manual tools still work.'}
              </Text>
              {!toggleMeter.isFrozenFromChurn ? (
                <>
                  <Text style={[styles.aiMeterLabel, { color: colors.nbInk }]}>This month's switch use</Text>
                  <View
                    style={[
                      styles.aiMeterTrack,
                      {
                        backgroundColor: colors.nbSurface,
                        borderColor: colors.nbBorder,
                        borderWidth: nb.borderWidth,
                      },
                    ]}
                    accessibilityRole="progressbar"
                    accessibilityValue={{
                      min: 0,
                      max: PERCENT_SCALE,
                      now: aiMeterPercent,
                    }}
                    accessibilityLabel="How much of this month's AI switch allowance has been used"
                  >
                    <LinearGradient
                      colors={gradients.brand.colors}
                      start={gradients.brand.start}
                      end={gradients.brand.end}
                      style={[
                        styles.aiMeterFill,
                        {
                          width: `${Math.min(PERCENT_SCALE, aiMeterPercent)}%`,
                        },
                      ]}
                    />
                  </View>
                </>
              ) : null}
              <Text style={[styles.aiMeterHint, { color: colors.nbMuted }]}>
                {getAiToggleMeterHint(toggleMeter)}
              </Text>
              <Text style={[styles.aiFeaturesTitle, { color: colors.nbInk }]}>What you can use when AI is on</Text>
              <Text style={[styles.aiBullet, { color: colors.nbMuted }]}>
                • AI Fitness Coach — chat for coaching-style tips
              </Text>
              <Text style={[styles.aiBullet, { color: colors.nbMuted }]}>
                • Workout generator — draft plans from your goals
              </Text>
              <Text style={[styles.aiBullet, { color: colors.nbMuted }]}>
                • Progress-style insights in supported screens
              </Text>
              <Text style={[styles.aiBullet, { color: colors.nbMuted }]}>
                • Form & recovery suggestions where available
              </Text>
            </View>
            <NbSwitch
              value={!!aiEnabled}
              onValueChange={(enabled) => toggleAI(enabled)}
              style={{ opacity: toggleMeter.isFrozenFromChurn && !aiEnabled ? 0.45 : 1 }}
            />
          </View>
        </NbCard>

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
          <>
            <SectionHeader title="BILLING" colors={colors} />
            <NbCard style={styles.sectionCard}>
              <NbListRow
                title="Coaching payment"
                right={
                  <PaymentStatusChip
                    label={clientBillingLabel}
                    tone={clientBillingTone}
                    colors={colors}
                    isDark={isDark}
                  />
                }
                style={styles.listRow}
              />
              {typeof onOpenCoachingPayment === 'function' ? (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
                  <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                    <Text
                      style={{
                        fontFamily: 'Inter_400Regular',
                        fontSize: 13,
                        color: colors.nbMuted,
                      }}
                    >
                      Add or update the card you use to pay your coach. This is not a bank payout account — clients
                      pay by card.
                    </Text>
                    <View style={{ marginTop: spacing.sm }}>
                      <NbButton variant="brand" onPress={onOpenCoachingPayment}>
                        {paymentButtonLabel}
                      </NbButton>
                    </View>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
                  <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                    <Text
                      style={{
                        fontFamily: 'SpaceGrotesk_700Bold',
                        fontSize: 15,
                        color: colors.nbInk,
                        marginBottom: spacing.sm,
                      }}
                    >
                      Payment history
                    </Text>
                    {clientPaymentHistoryLoading ? (
                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.nbMuted }}>
                        Loading…
                      </Text>
                    ) : null}
                    {!clientPaymentHistoryLoading && clientPaymentHistory.length === 0 ? (
                      <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.nbMuted }}>
                        No payments yet. Completed payments appear here with date, amount, and status.
                      </Text>
                    ) : null}
                    {!clientPaymentHistoryLoading && clientPaymentHistory.length > 0
                      ? clientPaymentHistory.map((row) => <PaymentHistoryRow key={row.id} row={row} colors={colors} />)
                      : null}
                  </View>
                </>
              ) : null}
            </NbCard>
          </>
        ) : null}

        {isTrainer ? (
          <>
            <SectionHeader title="PAYMENTS & PAYOUTS" colors={colors} />
            <NbCard style={styles.sectionCard}>
              <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
                <Text
                  style={{
                    fontFamily: 'SpaceGrotesk_700Bold',
                    fontSize: 15,
                    color: colors.nbInk,
                    marginBottom: 4,
                  }}
                >
                  Two different steps
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 12,
                    lineHeight: 17,
                    color: colors.nbMuted,
                  }}
                >
                  Identity Verification (Face ID) proves who you are for the Verified badge. Payment Method is Stripe
                  Connect — bank transfer, debit card, or other payout options so you can get paid.
                </Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
              <NbListRow
                title="Identity Verification (Face ID)"
                onPress={() => go('profile')}
                right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
                style={styles.listRow}
              />
              <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
              <NbListRow
                title="Payment Method (Stripe)"
                right={
                  <PaymentStatusChip
                    label={payoutChipLabel(resolvedStripeStatus)}
                    tone={payoutChipTone(resolvedStripeStatus)}
                    colors={colors}
                    isDark={isDark}
                  />
                }
                style={styles.listRow}
              />
              <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.nbMuted }}>
                  Bank account: {maskStripeAccountId(stripeAccountId)}
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.nbMuted, marginTop: 4 }}>
                  Status: {payoutChipLabel(resolvedStripeStatus)}
                </Text>
                <View style={{ marginTop: spacing.sm }}>
                  <NbButton
                    variant="brand"
                    onPress={() => {
                      if (stripeConnect.error) stripeConnect.retry();
                      else stripeConnect.startConnect();
                    }}
                  >
                    {stripeButtonLabel}
                  </NbButton>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
              <NbListRow
                title="Payout account"
                onPress={() => go('payments')}
                right={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <PaymentStatusChip
                      label={payoutChipLabel(resolvedStripeStatus)}
                      tone={payoutChipTone(resolvedStripeStatus)}
                      colors={colors}
                      isDark={isDark}
                    />
                    <Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />
                  </View>
                }
                style={styles.listRow}
              />
              <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
              <NbListRow
                title="Earnings & payouts"
                onPress={() => go('payments')}
                right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
                style={styles.listRow}
              />
              <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
              <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
                <Text
                  style={{
                    fontFamily: 'SpaceGrotesk_700Bold',
                    fontSize: 15,
                    color: colors.nbInk,
                    marginBottom: 6,
                  }}
                >
                  Tell clients how to pay you
                </Text>
                <Text
                  style={{
                    fontFamily: 'Inter_400Regular',
                    fontSize: 12,
                    color: colors.nbMuted,
                    marginBottom: spacing.sm,
                  }}
                >
                  Recommended message (copy and send in chat):
                </Text>
                <View
                  style={{
                    padding: spacing.sm,
                    borderRadius: 12,
                    backgroundColor: colors.nbSurfaceChip,
                    borderWidth: nb.borderWidth,
                    borderColor: colors.success,
                    marginBottom: spacing.sm,
                  }}
                >
                  <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: colors.nbInk, lineHeight: 18 }}>
                    {TRAINER_CLIENT_MESSAGE_RECOMMENDED}
                  </Text>
                </View>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.nbMuted, marginBottom: 6 }}>
                  If a client asks about Venmo:
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 12, color: colors.warning, lineHeight: 17 }}>
                  {TRAINER_CLIENT_MESSAGE_VENMO_WARNING}
                </Text>
              </View>
            </NbCard>
          </>
        ) : null}

        {showProSection ? (
          <>
            <SectionHeader title="COACH CONNECT PRO" colors={colors} />
            <NbCard style={styles.sectionCard}>
              <NbListRow
                title="Platform subscription"
                right={
                  <PaymentStatusChip
                    label={platformSubscriptionStatus}
                    tone={platformSubTone(platformSubscriptionStatus)}
                    colors={colors}
                    isDark={isDark}
                  />
                }
                style={styles.listRow}
              />
              {typeof onRestorePurchases === 'function' ? (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
                  <NbListRow
                    title="Restore purchases"
                    onPress={() => {
                      if (!restorePurchasesLoading) onRestorePurchases();
                    }}
                    right={
                      restorePurchasesLoading ? (
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.nbMuted }}>
                          Working…
                        </Text>
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />
                      )
                    }
                    style={styles.listRow}
                  />
                </>
              ) : null}
            </NbCard>
          </>
        ) : null}

        <SectionHeader title="ACCOUNT" colors={colors} />
        <NbCard style={styles.sectionCard}>
          <NbListRow
            title="Edit Profile"
            onPress={() => go('profile')}
            right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
            style={styles.listRow}
          />
          <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
          <NbListRow
            title="Change Password"
            onPress={() => setPasswordModalVisible(true)}
            right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
            style={styles.listRow}
          />
          <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
          <NbListRow
            title="Blocked users"
            onPress={() => setShowBlockedUsers(true)}
            right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
            style={styles.listRow}
          />
          {showRemoveTrainer ? (
            <>
              <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
              <TouchableOpacity
                onPress={onOpenRemoveTrainer}
                style={[styles.row, { justifyContent: 'space-between' }]}
                accessibilityRole="button"
                accessibilityLabel="Remove trainer"
              >
                <Text
                  style={{
                    fontFamily: 'SpaceGrotesk_700Bold',
                    fontSize: 15,
                    color: colors.error,
                  }}
                >
                  Remove Trainer
                </Text>
                <Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />
              </TouchableOpacity>
            </>
          ) : null}
          <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
          <TouchableOpacity
            onPress={() => setShowDeleteHoldModal(true)}
            style={[styles.row, { justifyContent: 'space-between' }]}
            disabled={!user}
          >
            <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 15, color: colors.error }}>
              Delete Account
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />
          </TouchableOpacity>
        </NbCard>

        <SectionHeader title="SUPPORT" colors={colors} />
        <NbCard style={styles.sectionCard}>
          <NbListRow
            title="Contact Support"
            onPress={() => openSettingsSubScreen('contactSupport', onNavigate)}
            right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
            style={styles.listRow}
          />
          <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
          <NbListRow
            title="Report a Bug"
            onPress={() => openSettingsSubScreen('bugReport', onNavigate)}
            right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
            style={styles.listRow}
          />
          <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
          <NbListRow
            title="FAQ"
            onPress={() => openSettingsSubScreen('helpFaq', onNavigate)}
            right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
            style={styles.listRow}
          />
          <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
          <NbListRow
            title="Terms of Service"
            onPress={() => openSettingsSubScreen('terms', onNavigate)}
            right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
            style={styles.listRow}
          />
          <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
          <NbListRow
            title="Privacy Policy"
            onPress={() => openSettingsSubScreen('privacy', onNavigate)}
            right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
            style={styles.listRow}
          />
          <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
          <NbListRow
            title="Privacy & data rights"
            onPress={() =>
              Alert.alert(
                'Privacy & your data',
                'Use Delete Account (above) to permanently remove your account from this app. Details and any limits are in the Privacy Policy.\n\nFor a copy of your data, corrections, or other privacy requests (including under laws like the GDPR), contact us through Contact Support. We may ask you to verify your identity.\n\nThis app cannot provide legal advice; work with counsel if you need a formal compliance review.',
                [
                  { text: 'Privacy Policy', onPress: () => openSettingsSubScreen('privacy', onNavigate) },
                  { text: 'Contact Support', onPress: () => openSettingsSubScreen('contactSupport', onNavigate) },
                  { text: 'Close', style: 'cancel' },
                ],
              )
            }
            right={<Ionicons name="chevron-forward" size={20} color={colors.nbMuted} />}
            style={styles.listRow}
          />
          <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
          <NbListRow
            title="Version"
            right={
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.nbMuted }}>
                Coach Connect v1.0.0
              </Text>
            }
            style={styles.listRow}
          />
        </NbCard>
      </ScrollView>

      <Modal visible={isPasswordModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === PLATFORM_IOS ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={[styles.bottomSheet, { backgroundColor: colors.nbSurface }]}>
            <Text style={[styles.bottomSheetTitle, { color: colors.nbInk }]}>Change Password</Text>
            <TextInput
              style={[
                styles.passwordInput,
                {
                  backgroundColor: colors.nbSurfaceChip,
                  color: colors.nbInk,
                  borderColor: colors.nbBorder,
                },
              ]}
              placeholder="New Password"
              placeholderTextColor={colors.nbMuted}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <View style={styles.confirmButtonOuter}>
              <NbButton variant="brand" onPress={handleChangePassword}>
                Confirm
              </NbButton>
            </View>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setPasswordModalVisible(false)}>
              <Text style={[styles.cancelButtonText, { color: colors.nbMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
        message={
          'This is permanent. Your profile, workouts, nutrition logs, and messages tied to this account will be removed.\n\n' +
          'Deleting your Coach Connect account does not cancel Coach Connect Pro. If you subscribe through Apple, manage or cancel in Settings → Apple ID → Subscriptions' +
          (Platform.OS === PLATFORM_IOS ? ` (${APPLE_MANAGE_SUBSCRIPTIONS_URL}).` : '.') +
          '\n\nHold the button until the bar fills to confirm.'
        }
        holdDurationMs={HOLD_TO_DELETE_MS}
        pillLabel="Hold until bar fills to delete account"
        barGradient={gradients.brand.colors}
        onHoldComplete={performDeleteAccount}
      />

      <Modal visible={showBlockedUsers} animationType="slide" presentationStyle="fullScreen">
        <BlockedUsersScreen onClose={() => setShowBlockedUsers(false)} />
      </Modal>

      {onNavigate && !embedShellBottomNav ? (
        <ShellBottomNavAnchor>
          <BottomMenuBar
            onHomePress={() => go('home')}
            onProfilePress={() => go('profile')}
            onPlusPress={() => go('create')}
            onVoicePress={() => go('voice')}
            onWorkoutPress={() => go('workout')}
            onNutritionPress={() => go('nutrition')}
            onMessagesPress={() => go('messages')}
            activeTabKey="home"
          />
        </ShellBottomNavAnchor>
      ) : null}
    </SafeAreaView>
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
  sectionHeader: {
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
  },
  sectionCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  listRow: {
    marginBottom: 0,
  },
  appearanceBlock: { padding: 0 },
  blockTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    marginBottom: spacing.xs,
    letterSpacing: -0.2,
  },
  blockSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: nb.minTouchTarget,
  },
  rowLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  aiDescription: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  aiMeterLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    marginTop: spacing.sm,
    letterSpacing: 0.2,
  },
  aiMeterTrack: {
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden',
  },
  aiMeterFill: {
    height: '100%',
    borderRadius: 4,
    minWidth: 2,
  },
  aiMeterHint: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: spacing.sm,
    lineHeight: 17,
  },
  aiFeaturesTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  aiBullet: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    marginRight: spacing.xs,
  },
  statusChipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
  },
  divider: {
    height: nb.borderWidth,
    marginHorizontal: spacing.md,
  },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet: {
    padding: spacing.lg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  bottomSheetTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  passwordInput: {
    fontFamily: 'Inter_400Regular',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: nb.borderWidth,
  },
  confirmButtonOuter: {
    marginBottom: spacing.sm,
  },
  cancelButton: { padding: spacing.md, alignItems: 'center' },
  cancelButtonText: {
    fontFamily: 'Inter_600SemiBold',
  },
});
