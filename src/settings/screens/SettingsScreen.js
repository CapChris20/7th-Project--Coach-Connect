/**
 * Settings Screen
 *
 * Purpose: UI screen or component: Settings Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: SettingsScreen
 *
 * @file-header
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Switch,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared-ui/ThemeContext';
import { deleteUser, getAuth, signOut, updatePassword } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../app-start/config';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../app-start/config';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { useShellNavigate } from '../../navigation/shellNavigate';
import { BOTTOM_NAV_BAR_HEIGHT, SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS } from '../../navigation/bottomNavMetrics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAI, getAiToggleMeterHint } from '../../shared/contexts/AIContext';
import HoldToConfirmModal from '../../shared/components/modals/HoldToConfirmModal';

/** Settings UI — dark pink → dark orange gradient (no purple). */
const ACCENT_PINK = '#BE185D';
const ACCENT_ORANGE = '#C2410C';
const SWITCH_ON = ACCENT_PINK;

/** Sliding pill segment control: animated highlight moves when selection changes. */
function SegmentedPills({ options, selectedValue, onChange, isDark, colors }) {
  const [trackW, setTrackW] = useState(0);
  const pad = 4;
  const n = options.length;
  const activeIndex = useMemo(() => {
    const i = options.findIndex((o) => o.value === selectedValue);
    return i >= 0 ? i : 0;
  }, [options, selectedValue]);

  const segmentW = trackW > 0 ? (trackW - pad * 2) / n : 0;
  const slide = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: activeIndex,
      useNativeDriver: true,
      friction: 9,
      tension: 140,
      velocity: 0.5,
    }).start();
  }, [activeIndex, slide]);

  const translateX =
    segmentW > 0
      ? slide.interpolate({
          inputRange: options.map((_, i) => i),
          outputRange: options.map((_, i) => i * segmentW),
        })
      : slide.interpolate({ inputRange: [0, 1], outputRange: [0, 0] });

  const trackBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const borderCol = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';

  return (
    <View
      style={[pillStyles.track, { backgroundColor: trackBg, borderColor: borderCol }]}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
    >
      {segmentW > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            pillStyles.thumb,
            {
              width: segmentW,
              transform: [{ translateX }],
              left: pad,
            },
          ]}
        >
          <LinearGradient
            colors={[ACCENT_PINK, ACCENT_ORANGE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      <View style={pillStyles.row}>
        {options.map((opt) => {
          const selected = opt.value === selectedValue;
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              style={({ pressed }) => [pillStyles.cell, pressed && { opacity: 0.85 }]}
            >
              <Text
                style={[
                  pillStyles.cellLabel,
                  { color: selected ? '#FFFFFF' : colors.textSecondary },
                  selected && pillStyles.cellLabelSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const SectionHeader = ({ title, colors }) => (
  <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>
);

function openSettingsSubScreen(screen, onNavigate) {
  if (typeof onNavigate === 'function') {
    onNavigate(screen);
    return;
  }
  Alert.alert('Unavailable', 'This screen could not be opened.');
}

/** Wall-clock + IANA zone for server-side workout reminder job (matches user's picker). */
function workoutReminderClockFromDate(d) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return {
    time: d.toISOString(),
    hourLocal: d.getHours(),
    minuteLocal: d.getMinutes(),
    timeZone,
  };
}

const SettingsRow = ({ label, value, onPress, children, colors, leftIcon }) => (
  <TouchableOpacity onPress={onPress} style={styles.row} disabled={!onPress}>
    <View style={styles.rowLabelWrap}>
      {leftIcon ? <View style={styles.rowIcon}>{leftIcon}</View> : null}
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
    </View>
    <View style={styles.rowValueContainer}>
      {value && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>}
      {children}
    </View>
  </TouchableOpacity>
);

function PaymentStatusChip({ label, tone, colors, isDark }) {
  const toneColor =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'error'
          ? colors.error
          : colors.textSecondary;
  const bg =
    tone === 'success'
      ? isDark
        ? 'rgba(48,209,88,0.15)'
        : 'rgba(48,209,88,0.12)'
      : tone === 'warning'
        ? isDark
          ? 'rgba(255,159,10,0.15)'
          : 'rgba(255,159,10,0.12)'
        : tone === 'error'
          ? isDark
            ? 'rgba(255,59,48,0.15)'
            : 'rgba(255,59,48,0.12)'
          : isDark
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)';

  return (
    <View style={[styles.statusChip, { backgroundColor: bg, borderColor: `${toneColor}44` }]}>
      <Text style={[styles.statusChipText, { color: toneColor }]}>{label}</Text>
    </View>
  );
}

function formatMonthlyRateLabel(rate) {
  if (rate == null || rate === '') return null;
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return null;
  const dollars = n >= 100 ? n / 100 : n;
  return `$${dollars.toFixed(0)}/mo`;
}

function payoutChipLabel(status) {
  if (status === 'active') return 'Active';
  if (status === 'pending') return 'Pending';
  return 'Not connected';
}

function payoutChipTone(status) {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

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
}) {
  const onNavigate = useShellNavigate(onNavigateProp);
  const onBack = onBackProp || onClose;
  const go = (screen) => openSettingsSubScreen(screen, onNavigate);
  const { colors, isDark, themeMode, toggleTheme } = useTheme();
  /** Pill position: explicit light/dark, or match current UI when theme follows system. */
  const appearanceValue = themeMode === 'system' ? (isDark ? 'dark' : 'light') : themeMode;
  const { aiEnabled, toggleAI, toggleMeter, refreshToggleMeter } = useAI();
  const [workoutReminders, setWorkoutReminders] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showDeleteHoldModal, setShowDeleteHoldModal] = useState(false);
  const [resolvedUserRole, setResolvedUserRole] = useState(userRoleProp || null);
  const [stripeConnectStatus, setStripeConnectStatus] = useState('not_connected');
  const [monthlyRate, setMonthlyRate] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('inactive');

  const userRole = userRoleProp || resolvedUserRole || 'client';
  const isTrainer = userRole === 'trainer';

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      getDoc(userRef).then(async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setResolvedUserRole((prev) => userRoleProp || data.role || prev || 'client');
          setStripeConnectStatus(data.stripeConnectStatus || 'not_connected');
          setMonthlyRate(data.monthlyRate ?? null);
          setPaymentStatus(data.paymentStatus || 'inactive');
          setWorkoutReminders(data.workoutReminder?.enabled || false);
          if (data.workoutReminder?.time) {
            setReminderTime(new Date(data.workoutReminder.time));
          }
          const wr = data.workoutReminder;
          if (
            wr?.enabled &&
            wr?.time &&
            (wr.hourLocal == null || wr.minuteLocal == null || !String(wr.timeZone || '').trim())
          ) {
            const t = new Date(wr.time);
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
            try {
              await updateDoc(userRef, {
                'workoutReminder.hourLocal': t.getHours(),
                'workoutReminder.minuteLocal': t.getMinutes(),
                'workoutReminder.timeZone': tz,
              });
            } catch (e) {
              console.warn('workoutReminder backfill', e?.message || e);
            }
          }
        }
      });
    }
  }, [user, userRoleProp]);

  useEffect(() => {
    if (userDataProp?.paymentStatus) {
      setPaymentStatus(userDataProp.paymentStatus);
    }
    if (userDataProp?.monthlyRate != null) {
      setMonthlyRate(userDataProp.monthlyRate);
    }
  }, [userDataProp?.paymentStatus, userDataProp?.monthlyRate]);

  const clientBillingLabel = useMemo(() => {
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

    if (status === 'active' && rateLabel) return `Active — ${rateLabel}`;
    if (status === 'past_due') return rateLabel ? `Past due — ${rateLabel}` : 'Past due';
    if (status === 'payment_required') {
      return rateLabel ? `Payment required — ${rateLabel}` : 'Payment required';
    }
    if (rateLabel && hasTrainer) return `Set up — ${rateLabel}`;
    if (hasTrainer) return 'No rate set';
    return 'No active subscription';
  }, [monthlyRate, paymentStatus, userDataProp, trainerDataProp]);

  const clientBillingTone = useMemo(() => {
    const status = paymentStatus || userDataProp?.paymentStatus || 'inactive';
    if (status === 'active') return 'success';
    if (status === 'past_due') return 'error';
    if (status === 'payment_required') return 'warning';
    const assignedRate = monthlyRate ?? userDataProp?.monthlyRate ?? null;
    const trainerListedRate =
      trainerDataProp?.pricing?.perMonth ??
      trainerDataProp?.monthlyRate ??
      trainerDataProp?.price ??
      null;
    if ((assignedRate ?? trainerListedRate) && (userDataProp?.trainerId || trainerDataProp?.id)) {
      return 'warning';
    }
    return 'neutral';
  }, [monthlyRate, paymentStatus, userDataProp, trainerDataProp]);

  useEffect(() => {
    if (user?.uid) {
      refreshToggleMeter().catch(() => {});
    }
  }, [user?.uid, refreshToggleMeter]);

  const scheduleWorkoutReminder = async (time) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to workout!',
        body: 'Your daily workout reminder.',
      },
      trigger: { hour: time.getHours(), minute: time.getMinutes(), repeats: true },
    });
  };

  const handleReminderToggle = async (value) => {
    setWorkoutReminders(value);
    if (user) {
      if (value) {
        setShowTimePicker(true);
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        try {
          await updateDoc(doc(db, 'users', user.uid), { 'workoutReminder.enabled': false });
        } catch (e) {
          await setDoc(doc(db, 'users', user.uid), { workoutReminder: { enabled: false } }, { merge: true });
        }
      }
    }
  };

  const onTimeChange = async (event, selectedTime) => {
    const currentTime = selectedTime || reminderTime;
    setShowTimePicker(Platform.OS === 'ios');
    setReminderTime(currentTime);

    if (user) {
      try {
        await scheduleWorkoutReminder(currentTime);
        await setDoc(
          doc(db, 'users', user.uid),
          { workoutReminder: { enabled: true, ...workoutReminderClockFromDate(currentTime) } },
          { merge: true }
        );
        Alert.alert('Reminders set', `You'll be notified daily at ${currentTime.toLocaleTimeString()}.`);
      } catch (error) {
        console.error('Error setting reminder: ', error);
        Alert.alert('Error', 'Could not set reminder. Please try again.');
      }
    }
  };

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

  async function callDeleteAccountEndpoint({ userId, idToken }) {
    // Cloud Function endpoint (Firebase Functions): POST /auth/deleteAccount
    // Note: function name is "auth" and route is "/deleteAccount"
    const url = `https://us-central1-anatrox-auth.cloudfunctions.net/auth/deleteAccount`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok !== true) {
      throw new Error(json?.error || `Delete failed (${res.status})`);
    }
    return true;
  }

  async function performDeleteAccount() {
    if (!user) {
      throw new Error('Not signed in. Please sign in again and retry.');
    }
    try {
      try {
        const fn = httpsCallable(functions, 'deleteAccount');
        const resp = await fn({});
        const ok = resp?.data?.ok === true;
        if (!ok) throw new Error('Delete failed');
      } catch (callableError) {
        const idToken = await user.getIdToken(true);
        await callDeleteAccountEndpoint({ userId: user.uid, idToken });
      }

      try {
        await deleteUser(user);
      } catch (_) {
        // ignore — backend already performed canonical deletion
      }

      await signOut(auth);
      Alert.alert('Account deleted', 'Your account and data have been permanently deleted.');
    } catch (e) {
      const msg = e?.message || 'Failed to delete account. Please try again.';
      throw new Error(msg);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={SHELL_SAFE_AREA_EDGES}>
        <CoachConnectHeader
          title="SETTINGS"
          skipTopSafeInset
          onBack={onBack || undefined}
          onProfilePress={onNavigate ? () => go('profile') : null}
          onSettingsPress={() => {}}
        />
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BOTTOM_NAV_BAR_HEIGHT + 24 }]}
          {...FORM_SCROLL_PROPS}
        >
        <SectionHeader title="APPEARANCE" colors={colors} />
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.appearanceBlock}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>Theme</Text>
            <Text style={[styles.blockSubtitle, { color: colors.textSecondary }]}>
              {themeMode === 'system'
                ? 'Following your device — tap to set light or dark.'
                : themeMode === 'dark'
                  ? 'Dark mode is on.'
                  : 'Light mode is on.'}
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
        </View>

        <SectionHeader title="PREFERENCES" colors={colors} />
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsRow label="Workout Reminders" colors={colors}>
            <Switch
              value={workoutReminders}
              onValueChange={handleReminderToggle}
              trackColor={{ false: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', true: SWITCH_ON }}
              thumbColor="#FFFFFF"
            />
          </SettingsRow>
        </View>

        {/* Coaching subscription moved to trainer profile card on client dashboard */}

        <SectionHeader title="AI FEATURES" colors={colors} />
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>AI-powered features</Text>
              <Text style={[styles.aiDescription, { color: colors.textSecondary }]}>
                {aiEnabled
                  ? 'AI Fitness Coach and workout generator are on.'
                  : 'Off — your coach and manual tools still work.'}
              </Text>
              {!toggleMeter.isFrozenFromChurn && (
                <>
                  <Text style={[styles.aiMeterLabel, { color: colors.text }]}>This month's switch use</Text>
                  <View
                    style={[
                      styles.aiMeterTrack,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' },
                    ]}
                    accessibilityRole="progressbar"
                    accessibilityValue={{
                      min: 0,
                      max: 100,
                      now: Math.round((toggleMeter.monthlyUseFraction ?? 0) * 100),
                    }}
                    accessibilityLabel="How much of this month's AI switch allowance has been used"
                  >
                    <View
                      style={[
                        styles.aiMeterFill,
                        {
                          width: `${Math.min(100, Math.round((toggleMeter.monthlyUseFraction ?? 0) * 100))}%`,
                          backgroundColor: SWITCH_ON,
                        },
                      ]}
                    />
                  </View>
                </>
              )}
              <Text style={[styles.aiMeterHint, { color: colors.textSecondary }]}>
                {getAiToggleMeterHint(toggleMeter)}
              </Text>
              <Text style={[styles.aiFeaturesTitle, { color: colors.text }]}>What you can use when AI is on</Text>
              <Text style={[styles.aiBullet, { color: colors.textSecondary }]}>• AI Fitness Coach — chat for coaching-style tips</Text>
              <Text style={[styles.aiBullet, { color: colors.textSecondary }]}>• Workout generator — draft plans from your goals</Text>
              <Text style={[styles.aiBullet, { color: colors.textSecondary }]}>• Progress-style insights in supported screens</Text>
              <Text style={[styles.aiBullet, { color: colors.textSecondary }]}>• Form & recovery suggestions where available</Text>
            </View>
            <Switch
              value={!!aiEnabled}
              onValueChange={(v) => toggleAI(v)}
              trackColor={{ false: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', true: SWITCH_ON }}
              thumbColor="#FFFFFF"
              disabled={toggleMeter.isFrozenFromChurn && !aiEnabled}
            />
          </View>
        </View>

        {showTimePicker && <DateTimePicker value={reminderTime} mode={'time'} is24Hour={true} display="default" onChange={onTimeChange} />}

        {isTrainer ? (
          <>
            <SectionHeader title="PAYMENTS & PAYOUTS" colors={colors} />
            <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SettingsRow
                label="Payout account"
                onPress={() => go('payments')}
                colors={colors}
                leftIcon={<Ionicons name="wallet-outline" size={20} color={colors.textSecondary} />}
              >
                <PaymentStatusChip
                  label={payoutChipLabel(stripeConnectStatus)}
                  tone={payoutChipTone(stripeConnectStatus)}
                  colors={colors}
                  isDark={isDark}
                />
                <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
              </SettingsRow>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <SettingsRow
                label="Earnings & payouts"
                onPress={() => go('payments')}
                colors={colors}
                leftIcon={<Ionicons name="trending-up-outline" size={20} color={colors.textSecondary} />}
              >
                <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
              </SettingsRow>
            </View>
          </>
        ) : null}

        {isTrainer && Platform.OS === 'ios' && platformSubscriptionStatus ? (
          <>
            <SectionHeader title="COACH CONNECT PRO" colors={colors} />
            <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SettingsRow label="Platform subscription" colors={colors} leftIcon={<Ionicons name="card-outline" size={20} color={colors.textSecondary} />}>
                <PaymentStatusChip
                  label={platformSubscriptionStatus}
                  tone={
                    platformSubscriptionStatus.includes('active') || platformSubscriptionStatus.includes('trial')
                      ? 'success'
                      : platformSubscriptionStatus.includes('Expired')
                        ? 'error'
                        : 'neutral'
                  }
                  colors={colors}
                  isDark={isDark}
                />
              </SettingsRow>
              {typeof onRestorePurchases === 'function' ? (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <SettingsRow
                    label="Restore purchases"
                    onPress={() => {
                      if (!restorePurchasesLoading) onRestorePurchases();
                    }}
                    colors={colors}
                    leftIcon={<Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />}
                  >
                    {restorePurchasesLoading ? (
                      <Text style={[styles.rowValue, { color: colors.textSecondary }]}>Working…</Text>
                    ) : (
                      <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
                    )}
                  </SettingsRow>
                </>
              ) : null}
            </View>
          </>
        ) : null}

        <SectionHeader title="ACCOUNT" colors={colors} />
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsRow label="Edit Profile" onPress={() => go('profile')} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="Change Password" onPress={() => setPasswordModalVisible(true)} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            onPress={() => setShowDeleteHoldModal(true)}
            style={[styles.row, { justifyContent: 'space-between' }]}
            disabled={!user}
          >
            <Text style={[styles.rowLabel, { color: '#EF4444', fontWeight: '700' }]}>Delete Account</Text>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </TouchableOpacity>
        </View>

        <SectionHeader title="SUPPORT" colors={colors} />
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsRow label="Contact Support" onPress={() => openSettingsSubScreen('contactSupport', onNavigate)} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="Report a Bug" onPress={() => openSettingsSubScreen('bugReport', onNavigate)} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="FAQ" onPress={() => openSettingsSubScreen('helpFaq', onNavigate)} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="Terms of Service" onPress={() => openSettingsSubScreen('terms', onNavigate)} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="Privacy Policy" onPress={() => openSettingsSubScreen('privacy', onNavigate)} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow
            label="Privacy & data rights"
            onPress={() =>
              Alert.alert(
                'Privacy & your data',
                'Use Delete Account (above) to permanently remove your account from this app. Details and any limits are in the Privacy Policy.\n\nFor a copy of your data, corrections, or other privacy requests (including under laws like the GDPR), contact us through Contact Support. We may ask you to verify your identity.\n\nThis app cannot provide legal advice; work with counsel if you need a formal compliance review.',
                [
                  { text: 'Privacy Policy', onPress: () => openSettingsSubScreen('privacy', onNavigate) },
                  { text: 'Contact Support', onPress: () => openSettingsSubScreen('contactSupport', onNavigate) },
                  { text: 'Close', style: 'cancel' },
                ]
              )
            }
            colors={colors}
          >
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="Version" colors={colors}>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>CoachConnect v1.0.0</Text>
          </SettingsRow>
        </View>
      </ScrollView>

      <Modal visible={isPasswordModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.bottomSheetTitle, { color: colors.text }]}>Change Password</Text>
            <TextInput
              style={[styles.passwordInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', color: colors.text, borderColor: colors.border }]}
              placeholder="New Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <TouchableOpacity
              activeOpacity={0.92}
              onPress={handleChangePassword}
              style={styles.confirmButtonOuter}
            >
              <LinearGradient
                colors={[ACCENT_PINK, ACCENT_ORANGE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmButtonGradient}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setPasswordModalVisible(false)}>
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <HoldToConfirmModal
        visible={showDeleteHoldModal}
        onClose={() => setShowDeleteHoldModal(false)}
        isDark={isDark}
        title="Delete account?"
        message="This is permanent. Your profile, workouts, nutrition logs, and messages tied to this account will be removed. Hold the button until the bar fills to confirm."
        holdDurationMs={1200}
        pillLabel="Hold until bar fills to delete account"
        barGradient={[ACCENT_PINK, ACCENT_ORANGE]}
        onHoldComplete={performDeleteAccount}
      />

      {onNavigate && !embedShellBottomNav ? (
        <BottomNavBar
          onHomePress={() => go('home')}
          onProfilePress={() => go('profile')}
          onPlusPress={() => go('create')}
          onVoicePress={() => go('voice')}
          onWorkoutPress={() => go('workout')}
          onNutritionPress={() => go('nutrition')}
          onMessagesPress={() => go('messages')}
          activeTabKey="home"
        />
      ) : null}
      </SafeAreaView>
  );
}

const pillStyles = StyleSheet.create({
  track: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
    paddingHorizontal: 4,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 44,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: ACCENT_PINK,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  cell: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  cellLabel: { fontSize: 14, fontWeight: '700' },
  cellLabelSelected: { fontWeight: '800' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  sectionHeader: {
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 4,
    marginLeft: 4,
  },
  sectionContainer: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 22,
    overflow: 'hidden',
  },
  appearanceBlock: { padding: 16 },
  blockTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4, letterSpacing: -0.2 },
  blockSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 },
  rowIcon: { marginRight: 10 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  aiDescription: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  aiMeterLabel: { fontSize: 12, fontWeight: '700', marginTop: 12, letterSpacing: 0.2 },
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
  aiMeterHint: { fontSize: 12, marginTop: 8, lineHeight: 17, fontWeight: '600' },
  aiFeaturesTitle: { fontSize: 13, fontWeight: '800', marginTop: 12, marginBottom: 4 },
  aiBullet: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  rowValueContainer: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14 },
  chevron: { fontSize: 22, marginLeft: 8, fontWeight: '300' },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 4,
  },
  statusChipText: { fontSize: 11, fontWeight: '800' },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet: { padding: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  passwordInput: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  confirmButtonOuter: { borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  confirmButtonGradient: { paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center' },
  confirmButtonText: { color: 'white', fontWeight: 'bold' },
  cancelButton: { padding: 16, alignItems: 'center' },
  cancelButtonText: { },
});

