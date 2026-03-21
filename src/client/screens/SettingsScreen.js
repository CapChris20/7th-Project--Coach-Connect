import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Linking,
  Platform,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';
import { getAuth, updatePassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../app/config';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { AppNavigationProvider } from '../../navigation/AppNavigationContext';

const SectionHeader = ({ title, colors }) => <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{title}</Text>;

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
  const [weightUnit, setWeightUnit] = useState('lbs');
  const [workoutReminders, setWorkoutReminders] = useState(false);
  const [reminderTime, setReminderTime] = useState(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isPasswordModalVisible, setPasswordModalVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const auth = getAuth();
  const user = auth.currentUser;

  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      getDoc(userRef).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWeightUnit(data.weightUnit || 'lbs');
          setWorkoutReminders(data.workoutReminder?.enabled || false);
          if (data.workoutReminder?.time) {
            setReminderTime(new Date(data.workoutReminder.time));
          }
        }
      });
    }
  }, [user]);

  const handleWeightUnitToggle = async (value) => {
    setWeightUnit(value);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), { weightUnit: value }, { merge: true });
      } catch (error) {
        console.error('Error updating weight unit: ', error);
        Alert.alert('Error', 'Could not save your preference. Please try again.');
      }
    }
  };

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
        await setDoc(doc(db, 'users', user.uid), { workoutReminder: { enabled: false } }, { merge: true });
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
        await setDoc(doc(db, 'users', user.uid), { workoutReminder: { enabled: true, time: currentTime.toISOString() } }, { merge: true });
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <CoachConnectHeader 
          title="SETTINGS" 
          isDark={isDark}
          onProfilePress={onNavigate ? () => onNavigate('profile') : null}
          onSettingsPress={() => {}}
        />
        <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionHeader title="APPEARANCE" colors={colors} />
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsRow label="Light Mode" onPress={() => toggleTheme('light')} colors={colors}>
            <View style={styles.modeIndicator}>
              <Text style={[styles.modeText, { color: colors.textSecondary }, themeMode === 'light' && styles.activeMode]}>Light</Text>
              {themeMode === 'light' && <View style={styles.activeDot} />}
            </View>
          </SettingsRow>
          <SettingsRow label="Dark Mode" onPress={() => toggleTheme('dark')} colors={colors}>
            <View style={styles.modeIndicator}>
              <Text style={[styles.modeText, { color: colors.textSecondary }, themeMode === 'dark' && styles.activeMode]}>Dark</Text>
              {themeMode === 'dark' && <View style={styles.activeDot} />}
            </View>
          </SettingsRow>
        </View>

        <SectionHeader title="PREFERENCES" colors={colors} />
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsRow label="Weight Units" colors={colors}>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity onPress={() => handleWeightUnitToggle('lbs')} style={[styles.unitButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }, weightUnit === 'lbs' && styles.unitButtonActive]}>
                <Text style={[styles.unitButtonText, { color: colors.text }, weightUnit === 'lbs' && styles.unitButtonTextActive]}>LBS</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleWeightUnitToggle('kg')} style={[styles.unitButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }, weightUnit === 'kg' && styles.unitButtonActive]}>
                <Text style={[styles.unitButtonText, { color: colors.text }, weightUnit === 'kg' && styles.unitButtonTextActive]}>KG</Text>
              </TouchableOpacity>
            </View>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="Workout Reminders" colors={colors}>
            <Switch
              value={workoutReminders}
              onValueChange={handleReminderToggle}
              trackColor={{ false: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', true: '#FF6B9D' }}
              thumbColor="#FFFFFF"
            />
          </SettingsRow>
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
        </View>

        <SectionHeader title="SUPPORT" colors={colors} />
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <SettingsRow label="Contact Support" onPress={() => Linking.openURL('mailto:support@coachconnect.ai?subject=CoachConnect%20Support%20Request')} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="Report a Bug" onPress={() => Linking.openURL('mailto:support@coachconnect.ai?subject=Bug%20Report%20%E2%80%94%20CoachConnect&body=Describe%20the%20bug%20here:')} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="FAQ" onPress={() => Linking.openURL('https://coachconnect.ai/faq')} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="Terms of Service" onPress={() => Linking.openURL('https://coachconnect.ai/terms')} colors={colors}>
            <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
          </SettingsRow>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <SettingsRow label="Privacy Policy" onPress={() => Linking.openURL('https://coachconnect.ai/privacy')} colors={colors}>
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
            <TouchableOpacity style={styles.confirmButton} onPress={handleChangePassword}>
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setPasswordModalVisible(false)}>
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
        />
      )}
      </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 24 },
  sectionHeader: { textTransform: 'uppercase', fontSize: 11, letterSpacing: 2, marginBottom: 8, marginLeft: 16 },
  sectionContainer: { borderRadius: 16, borderWidth: 1, marginBottom: 24, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  rowLabel: { fontSize: 14 },
  rowValueContainer: { flexDirection: 'row', alignItems: 'center' },
  rowValue: { fontSize: 14 },
  chevron: { fontSize: 20, marginLeft: 8 },
  divider: { height: 1, marginHorizontal: 16 },
  unitButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
  unitButtonActive: { backgroundColor: '#FF6B9D' },
  unitButtonText: { fontSize: 12, fontWeight: 'bold' },
  unitButtonTextActive: { color: 'white' },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  bottomSheet: { padding: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  bottomSheetTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16 },
  passwordInput: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  confirmButton: { backgroundColor: '#FF6B9D', padding: 16, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  confirmButtonText: { color: 'white', fontWeight: 'bold' },
  cancelButton: { padding: 16, alignItems: 'center' },
  cancelButtonText: { },
  modeIndicator: { flexDirection: 'row', alignItems: 'center' },
  modeText: { fontSize: 14, fontWeight: '500' },
  activeMode: { color: '#FF6B9D' },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6B9D', marginLeft: 8 },
});

