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
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';
import { deleteUser, getAuth, signOut, updatePassword } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../app/config';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../app/config';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { LinearGradient } from 'expo-linear-gradient';
import { useAI } from '../../contexts/AIContext';

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

const SettingsRow = ({ label, value, onPress, children, colors }) => (
  <TouchableOpacity onPress={onPress} style={styles.row} disabled={!onPress}>
    <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
    <View style={styles.rowValueContainer}>
      {value && <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>}
      {children}
    </View>
  </TouchableOpacity>
);

export default function SettingsScreen({ onNavigate }) {
  const { colors, isDark, themeMode, toggleTheme } = useTheme();
  /** Pill position: explicit light/dark, or match current UI when theme follows system. */
  const appearanceValue = themeMode === 'system' ? (isDark ? 'dark' : 'light') : themeMode;
  const { aiEnabled, toggleAI } = useAI();
  const [workoutReminders, setWorkoutReminders] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isDeleteModalVisible, setDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      getDoc(userRef).then(async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
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
  }, [user]);

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

  async function handleDeleteAccountConfirm() {
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in again and retry.');
      return;
    }
    setIsDeleting(true);
    setDeleteError('');
    try {
      // Preferred: callable function (no hardcoded URL/region).
      try {
        const fn = httpsCallable(functions, 'deleteAccount');
        const resp = await fn({});
        const ok = resp?.data?.ok === true;
        if (!ok) throw new Error('Delete failed');
      } catch (callableError) {
        // Fallback: HTTP endpoint (works if you prefer REST).
        const idToken = await user.getIdToken(true);
        await callDeleteAccountEndpoint({ userId: user.uid, idToken });
      }

      // Best-effort: also delete local Auth user (may fail if server already deleted / needs reauth).
      try {
        await deleteUser(user);
      } catch (_) {
        // ignore — backend already performed canonical deletion
      }

      await signOut(auth);
      setDeleteModalVisible(false);
      Alert.alert('Account deleted', 'Your account and data have been permanently deleted.');
      // App should redirect to login based on auth state.
    } catch (e) {
      const msg = e?.message || 'Failed to delete account. Please try again.';
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <CoachConnectHeader 
          title="SETTINGS" 
          isDark={isDark}
          onProfilePress={onNavigate ? () => onNavigate('profile') : null}
          onSettingsPress={() => {}}
        />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
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
            </View>
            <Switch
              value={!!aiEnabled}
              onValueChange={(v) => toggleAI(v)}
              trackColor={{ false: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', true: SWITCH_ON }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {showTimePicker && <DateTimePicker value={reminderTime} mode={'time'} is24Hour={true} display="default" onChange={onTimeChange} />}

        <SectionHeader title="ACCOUNT" colors={colors} />
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsRow label="Edit Profile" onPress={() => onNavigate('profile')} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="Change Password" onPress={() => setPasswordModalVisible(true)} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            onPress={() => setDeleteModalVisible(true)}
            style={[styles.row, { justifyContent: 'space-between' }]}
            disabled={!user}
          >
            <Text style={[styles.rowLabel, { color: '#F97316', fontWeight: '700' }]}>Delete Account</Text>
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

      <Modal visible={isDeleteModalVisible} transparent={true} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.bottomSheetTitle, { color: colors.text }]}>Delete Account</Text>
            <Text style={[styles.deleteWarningText, { color: colors.textSecondary }]}>
              Are you sure? This cannot be undone. All your data will be permanently deleted.
            </Text>

            {!!deleteError && (
              <View style={[styles.deleteErrorBox, { borderColor: '#FF3B30' }]}>
                <Text style={[styles.deleteErrorText, { color: '#FF3B30' }]}>{deleteError}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.deleteConfirmButton, isDeleting && { opacity: 0.7 }]}
              onPress={handleDeleteAccountConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ActivityIndicator color="#fff" />
                  <Text style={[styles.confirmButtonText, { marginLeft: 10 }]}>Deleting…</Text>
                </View>
              ) : (
                <Text style={styles.confirmButtonText}>Yes, delete permanently</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                if (isDeleting) return;
                setDeleteError('');
                setDeleteModalVisible(false);
              }}
              disabled={isDeleting}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      
      {onNavigate && (
        <BottomNavBar
          onHomePress={() => onNavigate('home')}
          onProfilePress={() => onNavigate('profile')}
          onPlusPress={() => onNavigate('create')}
          onVoicePress={() => onNavigate('voice')}
          onWorkoutPress={() => onNavigate('workout')}
          onNutritionPress={() => onNavigate('nutrition')}
          onMessagesPress={() => onNavigate('messages')}
        />
      )}
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
  rowLabel: { fontSize: 15, fontWeight: '600' },
  aiDescription: { fontSize: 13, marginTop: 6, lineHeight: 18 },
  rowValueContainer: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14 },
  chevron: { fontSize: 22, marginLeft: 8, fontWeight: '300' },
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
  deleteConfirmButton: { backgroundColor: '#FF3B30', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  deleteWarningText: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 14 },
  deleteErrorBox: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  deleteErrorText: { fontSize: 12, lineHeight: 16, textAlign: 'center' },
});

