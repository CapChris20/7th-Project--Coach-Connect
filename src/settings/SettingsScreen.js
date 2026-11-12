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
 * Theme subtitle under the Light / Dark / System pills.
 * @param {string} themeMode
 * @returns {string}
 */
function appearanceSubtitle(themeMode) {
  if (themeMode === 'system') return 'Following your device appearance.';
  if (themeMode === 'dark') return 'Dark mode is on.';
  return 'Light mode is on.';
}

/** Initials for the settings identity avatar when no photo is set. */
function initialsFromDisplayName(name) {
  const nameText = String(name || '').trim();
  if (!nameText) return 'CC';
  return nameText
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Design Law identity card at the top of Settings — avatar, name, role line, Edit.
 */
function SettingsProfileCard({ name, subtitle, initials, photoURL, onEdit, colors }) {
  return (
    <NbCard style={styles.identityCard}>
      <View style={styles.identityRow}>
        {/* Design Law: avatar gradient accent OK; 3px border keeps chrome honest */}
        <LinearGradient
          colors={gradients.brand.colors}
          start={gradients.brand.start}
          end={gradients.brand.end}
          style={[styles.identityAvatar, { borderColor: colors.nbBorder }]}
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
        {typeof onEdit === 'function' ? (
          <TouchableOpacity
            onPress={onEdit}
            style={[
              styles.editChip,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
                shadowColor: colors.nbShadow,
              },
            ]}
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
      {/* Design Law selected thumb = solid fill block (not brand gradient) */}
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            pillStyles.thumb,
            {
              width: segmentWidth,
              transform: [{ translateX }],
              left: SEGMENT_TRACK_PAD,
              backgroundColor: colors.nbFill,
            },
          ]}
        />
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
                  { color: selected ? colors.nbOnFill : colors.nbMuted },
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
 * Borderless row inside an NbCard group — Design Law list rows use dividers, not nested cards.
 * vocab: NbListRow draws its own 3px border; that nests badly inside a group card, so we use this instead.
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
  const body = (
    <View style={styles.groupRow}>
      <View style={styles.groupRowText}>
        <Text style={[styles.groupRowTitle, { color: titleColor || colors.nbInk }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.groupRowSubtitle, { color: colors.nbMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.groupRowRight}>{right}</View> : null}
      {showChevron ? <Ionicons name="chevron-forward" size={20} color={colors.nbMuted} /> : null}
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
 */
function PaymentStatusChip({ label, tone, colors }) {
  const isActive = String(label || '').toLowerCase().includes('active') || tone === 'success';
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
 * One payment history line under Coaching payment. Uses nb tokens.
 * @param {{ row: object, colors: object }} props
 */
function PaymentHistoryRow({ row, colors }) {
  const amountText = row.amount % 1 === 0 ? String(row.amount) : row.amount.toFixed(2);
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
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [aiDetailsOpen, setAiDetailsOpen] = useState(false);
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

  // 3. Re-auth with current password, then update Firebase Auth password (Design Law: 3 fields).
  const handleChangePassword = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in again and retry.');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Fill in current, new, and confirm password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters.');
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
      Alert.alert('Error', error?.message || 'Could not update password.');
    }
  };

  const closePasswordModal = () => {
    setPasswordModalVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordUpdatedNote(false);
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
  // Identity card copy — matches Design Law settings header card.
  const settingsDisplayName =
    `${String(userDataProp?.firstName || '').trim()} ${String(userDataProp?.lastName || '').trim()}`.trim() ||
    String(userDataProp?.name || userDataProp?.displayName || user?.displayName || '').trim() ||
    'Your profile';
  const settingsPhotoURL = userDataProp?.photoURL || user?.photoURL || null;
  const settingsRoleSubtitle = isTrainer
    ? `Trainer · ${userDataProp?.clientCount != null ? `${userDataProp.clientCount} clients` : 'Coach Connect'}`
    : trainerDataProp?.id || userDataProp?.trainerId
      ? `Client · ${clientCoachName} is your trainer`
      : 'Client';

  const handleSignOut = async () => {
    try {
      await onUserSignOut();
    } catch (error) {
      Alert.alert('Sign out failed', error?.message || 'Please try again.');
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader
        title="Settings"
        subtitle={isTrainer ? 'Trainer' : null}
        onBack={onBack || undefined}
      />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: shellNavInset }]}
        {...FORM_SCROLL_PROPS}
      >
        <SettingsProfileCard
          name={settingsDisplayName}
          subtitle={settingsRoleSubtitle}
          initials={initialsFromDisplayName(settingsDisplayName)}
          photoURL={settingsPhotoURL}
          onEdit={onNavigate ? () => go('profile') : undefined}
          colors={colors}
        />

        {/* Design Law 01: APPEARANCE = Light / Dark / System only (no Theme essay) */}
        <SectionHeader title="APPEARANCE" colors={colors} />
        <NbCard style={styles.groupCard}>
          <View style={styles.appearancePad}>
            <SegmentedPills
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
              selectedValue={appearanceValue}
              onChange={(mode) => toggleTheme(mode)}
              isDark={isDark}
              colors={colors}
            />
          </View>
        </NbCard>

        <SectionHeader title="PREFERENCES" colors={colors} />
        <NbCard style={styles.groupCard}>
          <SettingsGroupRow
            title="Workout reminders"
            subtitle={
              workoutReminders
                ? `Time to workout! at ${reminderTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : null
            }
            colors={colors}
            right={<NbSwitch value={workoutReminders} onValueChange={handleReminderToggle} />}
          />
        </NbCard>

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
                style={{ opacity: toggleMeter.isFrozenFromChurn && !aiEnabled ? 0.45 : 1 }}
              />
            }
          />
          <GroupDivider colors={colors} />
          <SettingsGroupRow
            title="What you can use when AI is on"
            colors={colors}
            showChevron
            onPress={() => setAiDetailsOpen((open) => !open)}
          />
          {aiDetailsOpen ? (
            <View style={styles.aiDetailsPad}>
              {!toggleMeter.isFrozenFromChurn ? (
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
                    style={[styles.aiMeterFill, { width: `${Math.min(PERCENT_SCALE, aiMeterPercent)}%` }]}
                  />
                </View>
              ) : null}
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
          ) : null}
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
            <NbCard style={styles.groupCard}>
              <SettingsGroupRow
                title="Coaching payment"
                subtitle={
                  clientBillingLabel && clientBillingLabel !== 'Active'
                    ? `${clientCoachName} · ${clientBillingLabel}`
                    : `${clientCoachName}`
                }
                colors={colors}
                showChevron={typeof onOpenCoachingPayment === 'function'}
                onPress={
                  typeof onOpenCoachingPayment === 'function' ? onOpenCoachingPayment : undefined
                }
                right={
                  <PaymentStatusChip
                    label={
                      (paymentStatus || userDataProp?.paymentStatus) === STATUS_ACTIVE
                        ? 'Active'
                        : clientBillingLabel
                    }
                    tone={clientBillingTone}
                    colors={colors}
                  />
                }
              />
            </NbCard>
          </>
        ) : null}

        {isTrainer ? (
          <>
            <SectionHeader title="PAYMENTS AND PAYOUTS" colors={colors} />
            <NbCard style={styles.groupCard}>
              <SettingsGroupRow
                title="Identity verification (Face ID)"
                colors={colors}
                showChevron
                onPress={() => go('profile')}
                right={
                  <PaymentStatusChip
                    label={resolvedStripeStatus === STATUS_ACTIVE ? 'Verified' : payoutChipLabel(resolvedStripeStatus)}
                    tone={payoutChipTone(resolvedStripeStatus)}
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
                onPress={() => {
                  if (stripeConnect.error) stripeConnect.retry();
                  else stripeConnect.startConnect();
                }}
                right={
                  <PaymentStatusChip
                    label={payoutChipLabel(resolvedStripeStatus)}
                    tone={payoutChipTone(resolvedStripeStatus)}
                    colors={colors}
                  />
                }
              />
              <GroupDivider colors={colors} />
              <SettingsGroupRow
                title="Payout account"
                colors={colors}
                showChevron
                onPress={() => go('payments')}
                right={
                  <PaymentStatusChip
                    label={payoutChipLabel(resolvedStripeStatus)}
                    tone={payoutChipTone(resolvedStripeStatus)}
                    colors={colors}
                  />
                }
              />
              <GroupDivider colors={colors} />
              <SettingsGroupRow
                title="Earnings and payouts"
                colors={colors}
                showChevron
                onPress={() => go('payments')}
              />
            </NbCard>
          </>
        ) : null}

        {showProSection ? (
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
              {typeof onRestorePurchases === 'function' ? (
                <>
                  <GroupDivider colors={colors} />
                  <SettingsGroupRow
                    title="Restore purchases"
                    colors={colors}
                    showChevron={!restorePurchasesLoading}
                    onPress={() => {
                      if (!restorePurchasesLoading) onRestorePurchases();
                    }}
                    right={
                      restorePurchasesLoading ? (
                        <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.nbMuted }}>
                          Working…
                        </Text>
                      ) : null
                    }
                  />
                </>
              ) : null}
            </NbCard>
          </>
        ) : null}

        <SectionHeader title="ACCOUNT" colors={colors} />
        <NbCard style={styles.groupCard}>
          <SettingsGroupRow
            title="Edit profile"
            colors={colors}
            showChevron
            onPress={() => go('profile')}
          />
          <GroupDivider colors={colors} />
          <SettingsGroupRow
            title="Change password"
            colors={colors}
            showChevron
            onPress={() => setPasswordModalVisible(true)}
          />
          <GroupDivider colors={colors} />
          <SettingsGroupRow
            title="Blocked users"
            colors={colors}
            showChevron
            onPress={() => setShowBlockedUsers(true)}
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
          <SettingsGroupRow title="Sign out" colors={colors} showChevron onPress={handleSignOut} />
        </NbCard>

        <SectionHeader title="SUPPORT" colors={colors} />
        <NbCard style={styles.groupCard}>
          <SettingsGroupRow
            title="Contact support"
            colors={colors}
            showChevron
            onPress={() => openSettingsSubScreen('contactSupport', onNavigate)}
          />
          <GroupDivider colors={colors} />
          <SettingsGroupRow
            title="Report a bug"
            colors={colors}
            showChevron
            onPress={() => openSettingsSubScreen('bugReport', onNavigate)}
          />
          <GroupDivider colors={colors} />
          <SettingsGroupRow
            title="FAQ"
            colors={colors}
            showChevron
            onPress={() => openSettingsSubScreen('helpFaq', onNavigate)}
          />
          <GroupDivider colors={colors} />
          <SettingsGroupRow
            title="Terms of service"
            colors={colors}
            showChevron
            onPress={() => openSettingsSubScreen('terms', onNavigate)}
          />
          <GroupDivider colors={colors} />
          <SettingsGroupRow
            title="Privacy policy"
            colors={colors}
            showChevron
            onPress={() => openSettingsSubScreen('privacy', onNavigate)}
          />
          <GroupDivider colors={colors} />
          <SettingsGroupRow
            title="Privacy and data rights"
            colors={colors}
            showChevron
            onPress={() => openSettingsSubScreen('privacyDataRights', onNavigate)}
          />
          <GroupDivider colors={colors} />
          <SettingsGroupRow
            title="Version"
            colors={colors}
            right={
              <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 14, color: colors.nbMuted }}>2.4.0</Text>
            }
          />
        </NbCard>

        <NbCard style={styles.deleteCard}>
          <TouchableOpacity
            onPress={() => setShowDeleteHoldModal(true)}
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
      </ScrollView>

      <Modal visible={isPasswordModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === PLATFORM_IOS ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.nbBackground,
                borderColor: colors.nbBorder,
              },
            ]}
          >
            <Text style={[styles.bottomSheetTitle, { color: colors.nbInk }]}>Change password</Text>
            {[
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
            ].map((field) => (
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
              </View>
            ))}
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
              <NbButton variant="fill" onPress={handleChangePassword}>
                Update password
              </NbButton>
            </View>
            <TouchableOpacity style={styles.cancelButton} onPress={closePasswordModal}>
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
        pillLabel="Hold to confirm"
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
