import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../../app/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CoachConnectHeader from '../../shared/components/AnatroxHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { useTheme } from '../../shared/ui/ThemeContext';
import {
  Camera,
  Dumbbell,
  Pencil,
  X,
  User,
  Mail,
  Calendar,
  Ruler,
  Scale,
  Target,
  Layers,
  Building2,
  Apple,
  Medal,
  Shield,
  Bell,
} from 'lucide-react-native';

const ACCENT = {
  pink: '#FF6B9D',
  cyan: '#64D2FF',
  orange: '#F97316',
  purple: '#C084FC',
  green: '#10B981',
};

const DARK = {
  bg: '#0A0A0F',
  card: '#13131A',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.55)',
  border: 'rgba(255,255,255,0.1)',
  hover: 'rgba(255,255,255,0.04)',
  toggleOff: 'rgba(255,255,255,0.18)',
};

const LIGHT = {
  bg: '#F4F4F7',
  card: '#FFFFFF',
  text: '#0A0A0F',
  muted: 'rgba(10,10,15,0.55)',
  border: 'rgba(10,10,15,0.08)',
  hover: 'rgba(10,10,15,0.04)',
  toggleOff: 'rgba(10,10,15,0.18)',
};

// ============================================================================
// HERO CARD
// ============================================================================

function initialsFromName(name) {
  const s = String(name || '').trim();
  if (!s) return 'CC';
  return s
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function HeroCard({ theme, isDark, name, handle, photoURL, onPressPhoto, uploading, onEditPress }) {
  const heroColors = isDark ? ['#1a0a2e', '#0f0a1a'] : ['#FFFFFF', '#F3F1FF'];
  const heroBorder = isDark ? ACCENT.pink : 'rgba(124,58,237,0.20)';
  const handleColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)';

  return (
    <LinearGradient
      colors={heroColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.heroCard,
        {
          borderColor: heroBorder,
        },
      ]}
    >
      <View style={styles.avatarContainer}>
        <LinearGradient
          colors={[ACCENT.pink, ACCENT.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.avatar,
            {
              borderColor: ACCENT.pink,
            },
          ]}
        >
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{initialsFromName(name)}</Text>
          )}
        </LinearGradient>
        <TouchableOpacity
          onPress={uploading ? undefined : onPressPhoto}
          activeOpacity={0.9}
          style={[styles.cameraButton, { backgroundColor: ACCENT.pink, opacity: uploading ? 0.7 : 1 }]}
        >
          {uploading ? <ActivityIndicator color="#fff" /> : <Camera size={22} color="#fff" />}
        </TouchableOpacity>
      </View>

      <Text style={[styles.heroName, { color: theme.text }]}>{name}</Text>
      <Text style={[styles.heroHandle, { color: handleColor }]}>{handle}</Text>

      <View style={styles.heroButtons}>
        <LinearGradient
          colors={[ACCENT.pink, ACCENT.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.heroButton, { flex: 1 }]}
        >
          <Pressable style={styles.heroButtonInner} onPress={onEditPress} android_ripple={{ color: 'rgba(255,255,255,0.10)' }} hitSlop={12}>
            <Text style={styles.heroButtonText}>Edit Profile</Text>
          </Pressable>
        </LinearGradient>
      </View>
    </LinearGradient>
  );
}

// ============================================================================
// INFO PILL
// ============================================================================

function InfoPill({ theme, color, Icon, value, label, isDark, editable, onEditPress }) {
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,15,0.10)';
  const iconBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.08)';
  const iconBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(10,10,15,0.035)';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={editable ? onEditPress : undefined}
      style={[styles.infoPill, { backgroundColor: theme.card, borderColor: border }]}
    >
      <View style={[styles.infoPillIcon, { backgroundColor: iconBg, borderColor: iconBorder }]}>
        <Icon size={18} color={color} />
      </View>
      <View style={styles.infoPillContent}>
        <Text style={[styles.infoPillLabel, { color: theme.muted }]}>{label}</Text>
        <Text style={[styles.infoPillValue, { color: theme.text }]}>{value}</Text>
      </View>
      {editable ? (
        <View style={styles.pillEditWrap}>
          <Pencil size={16} color={isDark ? 'rgba(255,255,255,0.75)' : 'rgba(10,10,15,0.75)'} />
        </View>
      ) : (
        <View style={[styles.infoPillDot, { backgroundColor: color }]} />
      )}
    </TouchableOpacity>
  );
}

// ============================================================================
// SECTION HEADER
// ============================================================================

function SectionHeader({ theme, children }) {
  return <Text style={[styles.sectionHeader, { color: theme.muted }]}>{children}</Text>;
}

// ============================================================================
// TOGGLE SWITCH
// ============================================================================

function Toggle({ on, onColor, offColor, onChange }) {
  return (
    <TouchableOpacity style={[styles.toggle, { backgroundColor: on ? onColor : offColor }]} onPress={() => onChange(!on)}>
      <View style={[styles.toggleThumb, { left: on ? 32 : 4 }]} />
    </TouchableOpacity>
  );
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export function ProfileScreen({
  isDark: isDarkProp,
  onBack,
  onNavigate,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onProfilePress,
  userData,
  onboardingData,
}) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : themeIsDark;
  const theme = isDark ? DARK : LIGHT;
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [photoURL, setPhotoURL] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');
  const [savingField, setSavingField] = useState(false);

  // Subtle entrance animations (fade + slight lift)
  const heroAnim = useMemo(() => new Animated.Value(0), []);
  const personalAnim = useMemo(() => new Animated.Value(0), []);
  const trainingAnim = useMemo(() => new Animated.Value(0), []);
  const accountAnim = useMemo(() => new Animated.Value(0), []);
  React.useEffect(() => {
    Animated.stagger(90, [
      Animated.timing(heroAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(personalAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(trainingAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(accountAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
    ]).start();
  }, [heroAnim, personalAnim, trainingAnim, accountAnim]);

  const displayName = useMemo(() => {
    const u = auth?.currentUser;
    const first = userData?.firstName ? String(userData.firstName).trim() : '';
    const last = userData?.lastName ? String(userData.lastName).trim() : '';
    const fromUser = `${first} ${last}`.trim();
    const fromDoc = String(onboardingData?.name || '').trim();
    return (fromUser || fromDoc || String(u?.displayName || '').trim() || 'Your Profile').trim();
  }, [userData?.firstName, userData?.lastName, onboardingData?.name]);

  const handle = useMemo(() => {
    const raw = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '');
    return `@${raw || 'coachconnect'}`;
  }, [displayName]);

  const pickAndUploadPhoto = async () => {
    const uid = auth?.currentUser?.uid;
    if (!uid || uploading) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please allow photo library access to change your profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setUploading(true);
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const blob = await response.blob();

      const storage = getStorage();
      const storageRef = ref(storage, `profile_photos/${uid}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      await setDoc(doc(db, 'users', uid), { photoURL: downloadURL }, { merge: true });

      try {
        const us = await getDoc(doc(db, 'users', uid));
        const role = us.exists() ? String(us.data()?.role || '').toLowerCase() : '';
        if (role === 'trainer') {
          await setDoc(doc(db, 'trainers', uid), { photoURL: downloadURL, avatarUrl: downloadURL }, { merge: true });
        }
      } catch (_) {
        // ignore mirror failures
      }

      setPhotoURL(downloadURL);
    } catch (e) {
      console.error('Profile photo update failed:', e);
      Alert.alert('Upload failed', e?.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatGender = (g) => {
    const s = String(g || '').trim();
    if (!s) return '—';
    if (s === 'male') return 'Male';
    if (s === 'female') return 'Female';
    if (s === 'prefer_not_to_say') return 'Prefer not to say';
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const formatHeight = (h) => {
    if (h == null || h === '') return '—';
    const n = Number(h);
    if (Number.isFinite(n)) return `${n}`;
    return String(h);
  };

  const formatWeight = (w) => {
    if (w == null || w === '') return '—';
    const n = Number(w);
    if (Number.isFinite(n)) return `${n}`;
    return String(w);
  };

  const openEdit = (key, label, currentValue) => {
    if (!isEditing) return;
    setEditKey(key);
    setEditLabel(label);
    setEditValue(currentValue == null ? '' : String(currentValue));
  };

  const closeEdit = () => {
    setEditKey(null);
    setEditLabel('');
    setEditValue('');
    setSavingField(false);
  };

  const saveField = async () => {
    const uid = auth?.currentUser?.uid;
    if (!uid || !editKey) return;
    try {
      setSavingField(true);
      const raw = String(editValue ?? '').trim();
      let next;
      if (editKey === 'height' || editKey === 'weight' || editKey === 'age') {
        const n = raw === '' ? null : Number(raw);
        next = Number.isFinite(n) ? n : raw;
      } else {
        next = raw === '' ? null : raw;
      }

      // Write into users/{uid}. These keys already exist in onboarding/user docs.
      await setDoc(doc(db, 'users', uid), { [editKey]: next, updatedAt: new Date().toISOString() }, { merge: true });

      closeEdit();
    } catch (e) {
      console.error('Failed saving profile field:', e);
      Alert.alert('Save failed', e?.message || 'Please try again.');
      setSavingField(false);
    }
  };

  // When Profile is rendered as an "overlay screen" (ClientApp/TrainerApp),
  // those apps often short-circuit render on `showProfile`, so we need to
  // route via `onNavigate` to ensure `handleHomePress()` clears showProfile.
  const nav = useMemo(() => {
    const go = (screen) => (typeof onNavigate === 'function' ? onNavigate(screen) : null);
    return {
      home: () => (typeof onHomePress === 'function' ? onHomePress() : go('home')),
      create: () => (typeof onPlusPress === 'function' ? onPlusPress() : go('create')),
      ai: () => (typeof onVoicePress === 'function' ? onVoicePress() : go('voice')),
      nutrition: () => (typeof onNutritionPress === 'function' ? onNutritionPress() : go('nutrition')),
      workout: () => (typeof onWorkoutPress === 'function' ? onWorkoutPress() : go('workout')),
      messages: () => (typeof onMessagesPress === 'function' ? onMessagesPress() : go('messages')),
      profile: () => (typeof onProfilePress === 'function' ? onProfilePress() : go('profile')),
      settings: () => go('settings'),
    };
  }, [onNavigate, onHomePress, onPlusPress, onVoicePress, onNutritionPress, onWorkoutPress, onMessagesPress, onProfilePress]);

  const email = auth?.currentUser?.email || onboardingData?.email || '—';
  const personalData = [
    { key: 'name', color: ACCENT.pink, Icon: User, value: displayName || '—', label: 'FULL NAME' },
    { key: 'email', color: ACCENT.cyan, Icon: Mail, value: String(email || '—'), label: 'EMAIL', readOnly: true },
    { key: 'age', color: ACCENT.orange, Icon: Calendar, value: onboardingData?.age != null ? String(onboardingData.age) : '—', label: 'AGE' },
    { key: 'height', color: ACCENT.purple, Icon: Ruler, value: formatHeight(onboardingData?.height), label: 'HEIGHT' },
    { key: 'weight', color: ACCENT.green, Icon: Scale, value: formatWeight(onboardingData?.weight), label: 'WEIGHT' },
    { key: 'gender', color: ACCENT.pink, Icon: User, value: formatGender(onboardingData?.gender), label: 'GENDER' },
  ];

  const trainingData = [
    { key: 'primaryGoal', color: ACCENT.pink, Icon: Target, value: String(onboardingData?.primaryGoal || '—'), label: 'PRIMARY GOAL' },
    { key: 'fitnessLevel', color: ACCENT.orange, Icon: Dumbbell, value: String(onboardingData?.fitnessLevel || '—'), label: 'FITNESS LEVEL' },
    { key: 'split', color: ACCENT.cyan, Icon: Layers, value: String(onboardingData?.split || '—'), label: 'SPLIT' },
    { key: 'equipment', color: ACCENT.purple, Icon: Building2, value: String(onboardingData?.equipment || (Array.isArray(onboardingData?.equipmentAccess) ? onboardingData.equipmentAccess.join(', ') : '—')), label: 'EQUIPMENT' },
    { key: 'diet', color: ACCENT.green, Icon: Apple, value: String(onboardingData?.diet || '—'), label: 'DIET' },
    { key: 'yearsExperience', color: ACCENT.pink, Icon: Medal, value: onboardingData?.yearsExperience != null ? String(onboardingData.yearsExperience) : '—', label: 'EXPERIENCE' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <CoachConnectHeader
          title="Profile"
          isDark={isDark}
          onBack={onBack}
          onSettingsPress={nav.settings}
          onProfilePress={nav.profile}
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <Animated.View
            style={{
              opacity: heroAnim,
              transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <HeroCard
              theme={theme}
              isDark={isDark}
              name={displayName}
              handle={handle}
              photoURL={photoURL}
              onPressPhoto={pickAndUploadPhoto}
              uploading={uploading}
              onEditPress={() => setIsEditing((v) => !v)}
            />
          </Animated.View>

          <Animated.View
            style={{
              opacity: personalAnim,
              transform: [{ translateY: personalAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <SectionHeader theme={theme}>PERSONAL INFORMATION</SectionHeader>
            <View style={styles.pillsContainer}>
              {personalData.map((item, idx) => (
                <InfoPill
                  key={item.key || idx}
                  theme={theme}
                  color={item.color}
                  Icon={item.Icon}
                  value={item.value}
                  label={item.label}
                  isDark={isDark}
                  editable={isEditing && !item.readOnly}
                  onEditPress={() => openEdit(item.key, item.label, item.value)}
                />
              ))}
            </View>
          </Animated.View>

          <Animated.View
            style={{
              opacity: trainingAnim,
              transform: [{ translateY: trainingAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <SectionHeader theme={theme}>TRAINING PREFERENCES</SectionHeader>
            <View style={styles.pillsContainer}>
              {trainingData.map((item, idx) => (
                <InfoPill
                  key={item.key || idx}
                  theme={theme}
                  color={item.color}
                  Icon={item.Icon}
                  value={item.value}
                  label={item.label}
                  isDark={isDark}
                  editable={isEditing}
                  onEditPress={() => openEdit(item.key, item.label, item.value)}
                />
              ))}
            </View>
          </Animated.View>

          <Animated.View
            style={{
              opacity: accountAnim,
              transform: [{ translateY: accountAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <SectionHeader theme={theme}>ACCOUNT</SectionHeader>
            <View style={[styles.accountCard, { backgroundColor: theme.card }]}>
            <View style={styles.accountRow}>
              <View style={[styles.accountIcon, { backgroundColor: `${ACCENT.purple}22` }]}>
                <Shield size={16} color={ACCENT.purple} />
              </View>
              <View style={styles.accountContent}>
                <Text style={[styles.accountLabel, { color: theme.muted }]}>SUBSCRIPTION</Text>
                <Text style={[styles.accountValue, { color: theme.text }]}>Free</Text>
              </View>
              <View style={[styles.upgradeBadge, { backgroundColor: `${ACCENT.purple}22` }]}>
                <Text style={[styles.upgradeBadgeText, { color: ACCENT.purple }]}>Upgrade</Text>
              </View>
            </View>

            <View style={[styles.accountRow, { borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
              <View style={[styles.accountIcon, { backgroundColor: `${ACCENT.cyan}22` }]}>
                <Bell size={16} color={ACCENT.cyan} />
              </View>
              <Text style={[styles.accountValue, { flex: 1, color: theme.text }]}>Notifications</Text>
              <Toggle on={notificationsOn} onColor={ACCENT.pink} offColor={theme.toggleOff} onChange={setNotificationsOn} />
            </View>

            </View>
          </Animated.View>

          <TouchableOpacity style={[styles.signOutButton, { borderColor: theme.border }]}>
            <Text style={[styles.signOutText, { color: theme.text }]}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={!!editKey} transparent animationType="fade" onRequestClose={closeEdit}>
        <Pressable style={styles.editBackdrop} onPress={closeEdit} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editKav}>
          <View style={[styles.editSheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.editSheetTop}>
              <Text style={[styles.editTitle, { color: theme.text }]}>{editLabel}</Text>
              <TouchableOpacity onPress={closeEdit} activeOpacity={0.85} style={styles.editCloseBtn}>
                <X size={18} color={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(10,10,15,0.85)'} />
              </TouchableOpacity>
            </View>

            <TextInput
              value={editValue}
              onChangeText={setEditValue}
              placeholder="Enter value"
              placeholderTextColor={theme.muted}
              style={[
                styles.editInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(10,10,15,0.03)',
                },
              ]}
              autoFocus
            />

            <View style={styles.editActions}>
              <TouchableOpacity onPress={closeEdit} activeOpacity={0.9} style={[styles.editBtn, { borderColor: theme.border }]}>
                <Text style={[styles.editBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <LinearGradient colors={[ACCENT.pink, ACCENT.purple]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.editBtnPrimary}>
                <TouchableOpacity onPress={saveField} activeOpacity={0.9} style={styles.editBtnPrimaryInner} disabled={savingField}>
                  {savingField ? <ActivityIndicator color="#fff" /> : <Text style={styles.editBtnPrimaryText}>Save</Text>}
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomNavBar
        onHomePress={nav.home}
        onPlusPress={nav.create}
        onVoicePress={nav.ai}
        onNutritionPress={nav.nutrition}
        onWorkoutPress={nav.workout}
        onMessagesPress={nav.messages}
        onProfilePress={nav.profile}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Extra bottom padding so taps/controls don't sit under the bottom nav bar.
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140 },

  heroCard: {
    borderRadius: 28,
    padding: 28,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  avatarContainer: { position: 'relative', marginBottom: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  avatarText: { fontSize: 48, fontWeight: '900', color: '#FFFFFF' },
  avatarImg: { width: '100%', height: '100%', borderRadius: 60 },
  cameraButton: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroName: { fontSize: 24, fontWeight: '900', marginBottom: 4 },
  heroHandle: { fontSize: 14, fontWeight: '500', marginBottom: 20 },
  heroButtons: { flexDirection: 'row', gap: 10, width: '100%' },
  heroButton: { height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  heroButtonInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heroButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginHorizontal: 0,
  },

  pillsContainer: { gap: 10, marginBottom: 24 },
  infoPill: {
    borderRadius: 14.5,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  infoPillIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  infoPillContent: { flex: 1 },
  infoPillLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  infoPillValue: { fontSize: 14, fontWeight: '800', marginTop: 3, letterSpacing: -0.2 },
  infoPillDot: { width: 6, height: 6, borderRadius: 3 },
  pillEditWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },

  accountCard: { borderRadius: 12, paddingHorizontal: 12, marginBottom: 24 },
  accountRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  accountIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  accountContent: { flex: 1 },
  accountLabel: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  accountValue: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  accountSublabel: { fontSize: 10, fontWeight: '500', marginTop: 2 },
  upgradeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  upgradeBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  toggle: { width: 60, height: 32, borderRadius: 16, justifyContent: 'center', position: 'relative' },
  toggleThumb: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', top: 4 },

  signOutButton: { height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginHorizontal: 16 },
  signOutText: { fontSize: 14, fontWeight: '700' },

  editBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  editKav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  editSheet: {
    margin: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  editSheetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  editTitle: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  editCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '700',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  editBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnText: { fontSize: 13, fontWeight: '800' },
  editBtnPrimary: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  editBtnPrimaryInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBtnPrimaryText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
});

export default ProfileScreen;

