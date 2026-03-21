import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  TouchableWithoutFeedback,
  Switch,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../../app/config';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { useTheme } from '../../shared/ui/ThemeContext';

// DESIGN TOKENS (accent colors)
const ACCENTS = {
  hotPink: '#FF6B9D',
  purple: '#C084FC',
  orange: '#F97316',
  cyan: '#06B6D4',
  amber: '#F59E0B',
};

/** Height can be stored as { feet, inches } or a number (cm). Return a string safe for React. */
const formatHeightForDisplay = (h) => {
  if (h == null || h === '') return '';
  if (typeof h === 'object' && (h.feet != null || h.inches != null)) return `${h.feet ?? 0}'${h.inches ?? 0}"`;
  if (typeof h === 'number') return `${h} cm`;
  return String(h);
};

const ProfileScreen = ({ onBack, userRole = 'Client', userData, onboardingData, onNavigate }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  
  // State
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    photoURL: null,
    role: '',
    dob: '',
    height: '',
    weight: '',
    fitnessGoal: '',
    trainingSplit: '',
    experienceLevel: '',
    equipmentAccess: '',
    dietaryPreference: '',
    subscription: 'Free',
  });
  const [stats, setStats] = useState({ workouts: 0, streak: 0, goals: 0 });
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [editSheet, setEditSheet] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Initialize profile data from props or fetch from Firebase
  useEffect(() => {
    const loadProfileData = async () => {
      if (userData || onboardingData) {
        // Use provided data
        const data = userData || onboardingData || {};
        setProfile({
          firstName: data.firstName || data.name?.split(' ')[0] || '',
          lastName: data.lastName || data.name?.split(' ')[1] || '',
          email: data.email || auth.currentUser?.email || '',
          photoURL: data.photoURL || null,
          role: data.role || userRole || 'Client',
          dob: data.dob || '',
          height: data.height || '',
          weight: data.weight || '',
          fitnessGoal: data.primaryGoal || data.fitnessGoal || '',
          trainingSplit: data.trainingSplit || '',
          experienceLevel: data.fitnessLevel || data.experienceLevel || '',
          equipmentAccess: data.equipmentAccess || '',
          dietaryPreference: data.dietaryPreference || '',
          subscription: data.subscription || 'Free',
        });
        
        // Set stats from the same data source
        setStats({
          workouts: data.workoutCount || 0,
          streak: data.streak || 0,
          goals: typeof data.goalProgress === 'number' ? data.goalProgress : 0,
        });
        
        setLoading(false);
      } else {
        // Fetch from Firebase when no data provided
        try {
          const uid = auth.currentUser?.uid;
          if (!uid) {
            setLoading(false);
            return;
          }

          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfile({
              firstName: data.firstName || data.name?.split(' ')[0] || '',
              lastName: data.lastName || data.name?.split(' ')[1] || '',
              email: data.email || auth.currentUser?.email || '',
              photoURL: data.photoURL || null,
              role: data.role || userRole || 'Client',
              dob: data.dob || '',
              height: data.height || '',
              weight: data.weight || '',
              fitnessGoal: data.primaryGoal || data.fitnessGoal || '',
              trainingSplit: data.trainingSplit || '',
              experienceLevel: data.fitnessLevel || data.experienceLevel || '',
              equipmentAccess: data.equipmentAccess || '',
              dietaryPreference: data.dietaryPreference || '',
              subscription: data.subscription || 'Free',
            });
            
            setStats({
              workouts: data.workoutCount || 0,
              streak: data.streak || 0,
              goals: typeof data.goalProgress === 'number' ? data.goalProgress : 0,
            });
          }
        } catch (error) {
          console.error('Profile fetch error:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadProfileData();
  }, [userData, onboardingData, userRole]);

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onBack();
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  // Handle photo change
  const handleChangePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const uid = auth.currentUser?.uid;

      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const storage = getStorage();
        const storageRef = ref(storage, `profile_photos/${uid}`);
        await uploadBytes(storageRef, blob);
        const downloadURL = await getDownloadURL(storageRef);

        // Use set({ merge: true }) for writes (never update)
        await setDoc(doc(db, 'users', uid), { photoURL: downloadURL }, { merge: true });
        setProfile(prev => ({ ...prev, photoURL: downloadURL }));
      } catch (err) {
        console.error('Photo upload error:', err);
      }
    }
  };

  // Open edit sheet
  const openEdit = (field, currentValue) => {
    setEditValue(currentValue || '');
    setEditSheet(field);
  };

  // Handle save
  const handleSave = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !editSheet) return;

    try {
      if (editSheet === 'name') {
        const parts = editValue.trim().split(' ');
        const firstName = parts[0] || '';
        const lastName = parts.slice(1).join(' ') || '';
        await updateDoc(doc(db, 'users', uid), { firstName, lastName, name: editValue.trim() });
        setProfile(prev => ({ ...prev, firstName, lastName }));
      } else {
        await updateDoc(doc(db, 'users', uid), { [editSheet]: editValue });
        setProfile(prev => ({ ...prev, [editSheet]: editValue }));
      }
      setEditSheet(null);
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ACCENTS.hotPink} />
        </View>
      </View>
    );
  }

  const initials = `${profile.firstName[0] || ''}${profile.lastName[0] || ''}`.toUpperCase();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.headerWrapper}>
        <CoachConnectHeader title="Profile" isDark={isDark} onBack={onBack} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <LinearGradient colors={[ACCENTS.hotPink, ACCENTS.purple]} style={styles.avatarRing}>
              <View style={[styles.avatarInner, { backgroundColor: colors.background }]}>
                {profile.photoURL ? (
                  <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.avatarText, { color: colors.text }]}>{initials}</Text>
                  </View>
                )}
              </View>
            </LinearGradient>
            <TouchableOpacity onPress={handleChangePhoto} style={styles.cameraButton}>
              <LinearGradient colors={[ACCENTS.hotPink, ACCENTS.purple]} style={styles.cameraButtonInner}>
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{profile.firstName} {profile.lastName}</Text>
          <View style={[styles.roleBadge, { backgroundColor: isDark ? 'rgba(255,107,157,0.15)' : 'rgba(255,107,157,0.1)', borderColor: ACCENTS.hotPink }]}>
            <Text style={[styles.roleText, { color: ACCENTS.hotPink }]}>{profile.role}</Text>
          </View>
        </View>

        {/* Personal Info Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Personal Info</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.cardAccent, { backgroundColor: ACCENTS.hotPink }]} />
            
            <InfoRow
              icon="person"
              label="Name"
              value={`${profile.firstName} ${profile.lastName}`}
              onPress={() => openEdit('name', `${profile.firstName} ${profile.lastName}`)}
              editable
              accentColor={ACCENTS.hotPink}
              colors={colors}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow
              icon="mail"
              label="Email"
              value={profile.email}
              editable={false}
              accentColor={ACCENTS.hotPink}
              colors={colors}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow
              icon="calendar"
              label="Date of Birth"
              value={profile.dob}
              onPress={() => openEdit('dob', profile.dob)}
              editable
              accentColor={ACCENTS.hotPink}
              colors={colors}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow
              icon="resize"
              label="Height"
              value={profile.height}
              onPress={() => openEdit('height', profile.height)}
              editable
              accentColor={ACCENTS.hotPink}
              colors={colors}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow
              icon="fitness"
              label="Weight"
              value={profile.weight}
              onPress={() => openEdit('weight', profile.weight)}
              editable
              accentColor={ACCENTS.hotPink}
              colors={colors}
              isDark={isDark}
            />
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Preferences</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.cardAccent, { backgroundColor: ACCENTS.cyan }]} />
            
            <InfoRow
              icon="flag"
              label="Fitness Goal"
              value={profile.fitnessGoal}
              onPress={() => openEdit('fitnessGoal', profile.fitnessGoal)}
              editable
              accentColor={ACCENTS.cyan}
              colors={colors}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow
              icon="grid"
              label="Training Split"
              value={profile.trainingSplit}
              onPress={() => openEdit('trainingSplit', profile.trainingSplit)}
              editable
              accentColor={ACCENTS.cyan}
              colors={colors}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow
              icon="barbell"
              label="Experience Level"
              value={profile.experienceLevel}
              onPress={() => openEdit('experienceLevel', profile.experienceLevel)}
              editable
              accentColor={ACCENTS.cyan}
              colors={colors}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow
              icon="basket"
              label="Equipment Access"
              value={profile.equipmentAccess}
              onPress={() => openEdit('equipmentAccess', profile.equipmentAccess)}
              editable
              accentColor={ACCENTS.cyan}
              colors={colors}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <InfoRow
              icon="restaurant"
              label="Dietary Preference"
              value={profile.dietaryPreference}
              onPress={() => openEdit('dietaryPreference', profile.dietaryPreference)}
              editable
              accentColor={ACCENTS.cyan}
              colors={colors}
              isDark={isDark}
            />
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Account</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.cardAccent, { backgroundColor: ACCENTS.purple }]} />
            
            <InfoRow
              icon="shield"
              label="Subscription"
              value={profile.subscription}
              editable={false}
              accentColor={ACCENTS.purple}
              isSubscription={profile.subscription === 'Pro'}
              colors={colors}
              isDark={isDark}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.switchRow}>
              <View style={styles.switchLeft}>
                <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                  <Ionicons name="notifications" size={16} color={ACCENTS.purple} />
                </View>
                <Text style={[styles.switchLabel, { color: colors.textSecondary }]}>Push Notifications</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', true: 'rgba(255,107,157,0.5)' }}
                thumbColor={notifications ? ACCENTS.hotPink : (isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)')}
              />
            </View>
          </View>
        </View>

        {/* Edit Profile Button */}
        <TouchableOpacity onPress={() => openEdit('name', `${profile.firstName} ${profile.lastName}`)} style={styles.editButton}>
          <LinearGradient colors={[ACCENTS.hotPink, ACCENTS.purple]} style={styles.editButtonGradient}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Sign Out */}
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={[styles.signOutText, { color: colors.textSecondary }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavBar
        onHomePress={() => onNavigate && onNavigate('home')}
        onProfilePress={() => onNavigate && onNavigate('profile')}
        onPlusPress={() => onNavigate && onNavigate('create')}
        onVoicePress={() => onNavigate && onNavigate('voice')}
        onWorkoutPress={() => onNavigate && onNavigate('workout')}
        onNutritionPress={() => onNavigate && onNavigate('nutrition')}
      />

      {/* Edit Bottom Sheet */}
      <Modal visible={!!editSheet} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={() => setEditSheet(null)}>
          <View style={styles.sheetOverlay} />
        </TouchableWithoutFeedback>
        <View style={[styles.sheet, { backgroundColor: isDark ? 'rgba(15,10,26,0.97)' : 'rgba(255,255,255,0.97)' }]}>
          <View style={[styles.sheetHandle, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>
            {editSheet === 'name' ? 'Edit Name' :
             editSheet === 'dob' ? 'Edit Date of Birth' :
             editSheet === 'height' ? 'Edit Height' :
             editSheet === 'weight' ? 'Edit Weight' :
             editSheet === 'fitnessGoal' ? 'Edit Fitness Goal' :
             editSheet === 'trainingSplit' ? 'Edit Training Split' :
             editSheet === 'experienceLevel' ? 'Edit Experience Level' :
             editSheet === 'equipmentAccess' ? 'Edit Equipment Access' :
             editSheet === 'dietaryPreference' ? 'Edit Dietary Preference' : 'Edit'}
          </Text>
          <TextInput
            style={[styles.sheetInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', borderColor: colors.border, color: colors.text }]}
            value={editValue}
            onChangeText={setEditValue}
            placeholder="Enter value..."
            placeholderTextColor={colors.textSecondary}
            multiline={editSheet === 'fitnessGoal' || editSheet === 'trainingSplit'}
          />
          <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
            <LinearGradient colors={[ACCENTS.hotPink, ACCENTS.purple]} style={styles.saveButtonGradient}>
              <Text style={styles.saveButtonText}>Save</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

// Safe display value (React cannot render objects/arrays as children)
const displayValue = (val) => {
  if (val == null || val === '') return 'Not set';
  if (Array.isArray(val)) return val.length ? val.join(', ') : 'Not set';
  if (typeof val === 'object' && (val.feet != null || val.inches != null)) return formatHeightForDisplay(val);
  if (typeof val === 'object') return Object.keys(val).length ? JSON.stringify(val) : 'Not set';
  return String(val);
};

// Info Row Component
const InfoRow = ({ icon, label, value, onPress, editable, accentColor, isSubscription, colors, isDark }) => (
  <TouchableOpacity onPress={onPress} disabled={!editable} style={styles.infoRow}>
    <View style={[styles.iconContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
      <Ionicons name={icon} size={16} color={accentColor} />
    </View>
    <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
    <View style={styles.valueContainer}>
      {isSubscription ? (
        <View style={[styles.proBadge, { backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)', borderColor: ACCENTS.amber }]}>
          <Text style={[styles.proText, { color: ACCENTS.amber }]}>Pro</Text>
        </View>
      ) : (
        <Text style={[styles.infoValue, { color: colors.text }]}>{displayValue(value)}</Text>
      )}
    </View>
    {editable && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  themeToggle: {
    padding: 8,
  },
  headerSpacer: {
    width: 40, // Same size as themeToggle to maintain layout
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  avatarSection: {
    alignItems: 'center',
    marginVertical: 32,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  avatarInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  cameraButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  roleBadge: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardAccent: {
    width: 3,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 13,
  },
  valueContainer: {
    maxWidth: 140,
    alignItems: 'flex-end',
  },
  infoValue: {
    fontSize: 13,
    textAlign: 'right',
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 12,
  },
  proText: {
    fontSize: 11,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  switchLabel: {
    fontSize: 13,
    marginLeft: 12,
  },
  editButton: {
    marginBottom: 16,
  },
  editButtonGradient: {
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: ACCENTS.hotPink,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  signOutText: {
    fontSize: 13,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 20,
  },
  sheetInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  saveButton: {
    marginBottom: 8,
  },
  saveButtonGradient: {
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerWrapper: {
    paddingTop: 20,
  },
});

export default ProfileScreen;
