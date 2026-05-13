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
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { useTheme } from '../../shared/ui/ThemeContext';
import { onUserSignOut } from '../../utils/dataCacheCleanup';
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
  Building2,
  Medal,
  Bell,
  MapPin,
  ClipboardList,
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

function coerceNumber(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Height in Firestore may be a number (inches), string, or legacy object shape.
 * Returns display string, seed for the edit field (inches as number string), and total inches if known.
 */
function parseHeightForProfile(h) {
  if (h == null || h === '') return { display: '—', editSeed: '', inches: null };
  if (typeof h === 'number' && Number.isFinite(h)) {
    return { display: formatInchesAsFeet(h), editSeed: String(h), inches: h };
  }
  if (typeof h === 'string') {
    const n = coerceNumber(h);
    if (n != null) return { display: formatInchesAsFeet(n), editSeed: String(n), inches: n };
    const t = h.trim();
    return t ? { display: t, editSeed: t, inches: null } : { display: '—', editSeed: '', inches: null };
  }
  if (typeof h === 'object' && h !== null && !Array.isArray(h)) {
    const cm = coerceNumber(h.cm ?? h.CM ?? h.centimeters ?? h.cmTotal);
    if (cm != null) {
      const inches = cm / 2.54;
      return { display: `${cm} cm (${formatInchesAsFeet(inches)})`, editSeed: String(Math.round(inches * 10) / 10), inches };
    }
    const ft = coerceNumber(h.feet ?? h.ft ?? h.f);
    const inch = coerceNumber(h.inches ?? h.in ?? h.inch ?? h.ins);
    if (ft != null || inch != null) {
      const totalIn = (ft ?? 0) * 12 + (inch ?? 0);
      return { display: formatInchesAsFeet(totalIn), editSeed: String(Math.round(totalIn * 10) / 10), inches: totalIn };
    }
    const total = coerceNumber(h.totalInches ?? h.total_inches ?? h.inchesTotal ?? h.value);
    if (total != null) return { display: formatInchesAsFeet(total), editSeed: String(total), inches: total };
  }
  return { display: '—', editSeed: '', inches: null };
}

function formatInchesAsFeet(totalIn) {
  if (totalIn == null || !Number.isFinite(totalIn)) return '—';
  let ti = Math.round(totalIn);
  let feet = Math.floor(ti / 12);
  let inches = ti - feet * 12;
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}'${inches}"`;
}

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

const YEARS_COACHING_LABELS = {
  less_than_1: 'Less than 1 year',
  '1_2': '1–2 years',
  '3_5': '3–5 years',
  '6_10': '6–10 years',
  '10_plus': '10+ years',
};

function formatYearsCoaching(v) {
  if (v == null || v === '') return '—';
  const key = String(v);
  return YEARS_COACHING_LABELS[key] || key.replace(/_/g, ' ');
}

function formatSpecialtyList(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '—';
  return arr
    .map((s) =>
      String(s || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
    )
    .join(', ');
}

function formatCertifications(data) {
  const list = Array.isArray(data?.certifications) ? [...data.certifications] : [];
  const other = String(data?.certificationOther || '').trim();
  if (list.includes('Other') && other) {
    return list.filter((x) => x !== 'Other').concat(other).join(', ') || other;
  }
  return list.length ? list.join(', ') : '—';
}

function formatAvailability(status) {
  if (status === 'available') return 'Available — accepting new clients';
  if (status === 'waitlist') return 'Waitlist — currently full';
  return status ? String(status).replace(/_/g, ' ') : '—';
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
  userRole = 'Client',
  userData,
  onboardingData,
  onProfileSaved,
}) {
  const isTrainer = String(userRole || '').toLowerCase() === 'trainer';
  const { isDark: themeIsDark } = useTheme();
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : themeIsDark;
  const theme = isDark ? DARK : LIGHT;
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [photoURL, setPhotoURL] = useState(null);
  const [uploading, setUploading] = useState(false);

  React.useEffect(() => {
    const fromDoc = onboardingData?.photoURL || userData?.photoURL || auth?.currentUser?.photoURL;
    setPhotoURL(fromDoc || null);
  }, [onboardingData?.photoURL, userData?.photoURL, auth?.currentUser?.photoURL]);
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

  const trainerDoc = useMemo(() => ({ ...(userData || {}), ...(onboardingData || {}) }), [userData, onboardingData]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await onUserSignOut();
            await signOut(auth);
          } catch (error) {
            console.error('Sign out error:', error);
            Alert.alert('Error', error?.message || 'Failed to sign out.');
          }
        },
      },
    ]);
  };

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

  const formatHeight = (h) => parseHeightForProfile(h).display;

  const formatWeight = (w) => {
    if (w == null || w === '') return '—';
    const n = Number(w);
    if (Number.isFinite(n)) return `${n}`;
    return String(w);
  };

  const getEditSeedForKey = (key) => {
    if (key === 'height') return parseHeightForProfile(onboardingData?.height).editSeed;
    if (key === 'name') {
      const first = userData?.firstName != null ? String(userData.firstName).trim() : '';
      const last = userData?.lastName != null ? String(userData.lastName).trim() : '';
      const combined = `${first} ${last}`.trim();
      if (combined) return combined;
      return String(onboardingData?.name || '').trim();
    }
    if (key === 'location') return String(trainerDoc?.location || '').trim();
    if (key === 'trainerProfileBio') return String(trainerDoc?.trainerProfileBio || '').trim();
    if (key === 'trainingPhilosophy') return String(trainerDoc?.trainingPhilosophy || '').trim();
    return '';
  };

  const openEdit = (key, label, currentDisplay) => {
    if (!isEditing) return;
    setEditKey(key);
    setEditLabel(label);
    if (key === 'height' || key === 'name') {
      const seed = getEditSeedForKey(key);
      setEditValue(seed);
      return;
    }
    setEditValue(currentDisplay == null || currentDisplay === '—' ? '' : String(currentDisplay));
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
      const updatedAt = new Date().toISOString();
      let payload = { updatedAt };

      if (editKey === 'name') {
        const trimmed = raw === '' ? null : raw;
        const parts = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
        payload.name = trimmed;
        payload.firstName = parts[0] || '';
        payload.lastName = parts.slice(1).join(' ') || '';
      } else if (editKey === 'gender') {
        const g = raw.toLowerCase().replace(/\s+/g, '_').replace(/'/g, '');
        if (g === 'male' || g === 'm') payload.gender = 'male';
        else if (g === 'female' || g === 'f') payload.gender = 'female';
        else if (g === 'prefer_not_to_say' || g === 'prefernottosay' || g === 'other') payload.gender = g === 'other' ? 'other' : 'prefer_not_to_say';
        else payload.gender = raw === '' ? null : raw;
      } else if (editKey === 'height' || editKey === 'weight' || editKey === 'age') {
        const n = raw === '' ? null : Number(raw);
        payload[editKey] = Number.isFinite(n) ? n : null;
      } else if (editKey === 'location' || editKey === 'trainerProfileBio' || editKey === 'trainingPhilosophy') {
        payload[editKey] = raw === '' ? null : raw;
      } else {
        payload[editKey] = raw === '' ? null : raw;
      }

      await setDoc(doc(db, 'users', uid), payload, { merge: true });

      try {
        const us = await getDoc(doc(db, 'users', uid));
        const role = us.exists() ? String(us.data()?.role || '').toLowerCase() : '';
        if (role === 'trainer') {
          if (editKey === 'name') {
            await setDoc(
              doc(db, 'trainers', uid),
              {
                name: payload.name,
                firstName: payload.firstName,
                lastName: payload.lastName,
                updatedAt,
              },
              { merge: true }
            );
          } else if (payload[editKey] !== undefined) {
            await setDoc(doc(db, 'trainers', uid), { [editKey]: payload[editKey], updatedAt }, { merge: true });
          }
        }
      } catch (_) {
        // ignore trainer mirror failures
      }

      await onProfileSaved?.();
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
    { key: 'equipment', color: ACCENT.purple, Icon: Building2, value: String(onboardingData?.equipment || (Array.isArray(onboardingData?.equipmentAccess) ? onboardingData.equipmentAccess.join(', ') : '—')), label: 'EQUIPMENT' },
    { key: 'yearsExperience', color: ACCENT.pink, Icon: Medal, value: onboardingData?.yearsExperience != null ? String(onboardingData.yearsExperience) : '—', label: 'EXPERIENCE' },
  ];

  const trainerProfessionalPills = [
    { key: 'name', color: ACCENT.pink, Icon: User, value: displayName || '—', label: 'DISPLAY NAME' },
    { key: 'email', color: ACCENT.cyan, Icon: Mail, value: String(email || '—'), label: 'EMAIL', readOnly: true },
    {
      key: 'location',
      color: ACCENT.purple,
      Icon: MapPin,
      value: String(trainerDoc?.location || '').trim() || '—',
      label: 'CITY / REGION',
    },
    {
      key: 'trainerProfileBio',
      color: ACCENT.green,
      Icon: ClipboardList,
      value: String(trainerDoc?.trainerProfileBio || '').trim() || '—',
      label: 'PUBLIC BIO',
    },
  ];

  const trainerCredentialsPills = [
    {
      key: 'certifications_display',
      color: ACCENT.orange,
      Icon: Medal,
      value: formatCertifications(trainerDoc),
      label: 'CERTIFICATIONS',
      readOnly: true,
    },
    {
      key: 'years_coaching_display',
      color: ACCENT.pink,
      Icon: Calendar,
      value: formatYearsCoaching(trainerDoc?.yearsExperience),
      label: 'YEARS COACHING CLIENTS',
      readOnly: true,
    },
    {
      key: 'specialties_display',
      color: ACCENT.cyan,
      Icon: Dumbbell,
      value: formatSpecialtyList(trainerDoc?.specialties),
      label: 'SPECIALTIES',
      readOnly: true,
    },
  ];

  const trainerAvailabilityPills = [
    {
      key: 'availability_display',
      color: ACCENT.green,
      Icon: Building2,
      value: formatAvailability(trainerDoc?.trainerAvailabilityStatus),
      label: 'AVAILABILITY',
      readOnly: true,
    },
    {
      key: 'session_display',
      color: ACCENT.purple,
      Icon: Target,
      value: String(trainerDoc?.sessionType || '—'),
      label: 'SESSION FORMAT',
      readOnly: true,
    },
  ];

  const philosophyText = String(trainerDoc?.trainingPhilosophy || '').trim();

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

          {isTrainer ? (
            <>
              <Animated.View
                style={{
                  opacity: personalAnim,
                  transform: [{ translateY: personalAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                }}
              >
                <SectionHeader theme={theme}>PROFESSIONAL</SectionHeader>
                <View style={styles.pillsContainer}>
                  {trainerProfessionalPills.map((item, idx) => (
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
                <SectionHeader theme={theme}>CREDENTIALS & FOCUS</SectionHeader>
                <View style={styles.pillsContainer}>
                  {trainerCredentialsPills.map((item, idx) => (
                    <InfoPill
                      key={item.key || idx}
                      theme={theme}
                      color={item.color}
                      Icon={item.Icon}
                      value={item.value}
                      label={item.label}
                      isDark={isDark}
                      editable={false}
                      onEditPress={() => {}}
                    />
                  ))}
                </View>

                <SectionHeader theme={theme}>COACHING PHILOSOPHY</SectionHeader>
                <TouchableOpacity
                  activeOpacity={isEditing ? 0.85 : 1}
                  disabled={!isEditing}
                  onPress={() =>
                    isEditing ? openEdit('trainingPhilosophy', 'COACHING PHILOSOPHY', philosophyText || '—') : undefined
                  }
                  style={[
                    styles.trainerPhilosophyCard,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.trainerPhilosophyText, { color: philosophyText ? theme.text : theme.muted }]}>
                    {philosophyText || (isEditing ? 'Tap to add how you coach…' : '—')}
                  </Text>
                  {isEditing ? (
                    <View style={styles.pillEditWrap}>
                      <Pencil size={16} color={isDark ? 'rgba(255,255,255,0.75)' : 'rgba(10,10,15,0.75)'} />
                    </View>
                  ) : null}
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                style={{
                  opacity: accountAnim,
                  transform: [{ translateY: accountAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                }}
              >
                <SectionHeader theme={theme}>AVAILABILITY</SectionHeader>
                <View style={[styles.pillsContainer, { marginBottom: 16 }]}>
                  {trainerAvailabilityPills.map((item, idx) => (
                    <InfoPill
                      key={item.key || idx}
                      theme={theme}
                      color={item.color}
                      Icon={item.Icon}
                      value={item.value}
                      label={item.label}
                      isDark={isDark}
                      editable={false}
                      onEditPress={() => {}}
                    />
                  ))}
                </View>
              </Animated.View>
            </>
          ) : (
            <>
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
            </>
          )}

          <Animated.View
            style={{
              opacity: accountAnim,
              transform: [{ translateY: accountAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <SectionHeader theme={theme}>ACCOUNT</SectionHeader>
            <View style={[styles.accountCard, { backgroundColor: theme.card }]}>
            <View style={styles.accountRow}>
              <View style={[styles.accountIcon, { backgroundColor: `${ACCENT.cyan}22` }]}>
                <Bell size={16} color={ACCENT.cyan} />
              </View>
              <Text style={[styles.accountValue, { flex: 1, color: theme.text }]}>Notifications</Text>
              <Toggle on={notificationsOn} onColor={ACCENT.pink} offColor={theme.toggleOff} onChange={setNotificationsOn} />
            </View>

            </View>
          </Animated.View>

          <TouchableOpacity
            style={[styles.signOutButton, { borderColor: theme.border }]}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
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
              placeholder={editKey === 'height' ? 'Total inches (e.g. 70)' : 'Enter value'}
              placeholderTextColor={theme.muted}
              keyboardType={editKey === 'height' || editKey === 'weight' || editKey === 'age' ? 'decimal-pad' : 'default'}
              multiline={editKey === 'trainerProfileBio' || editKey === 'trainingPhilosophy'}
              numberOfLines={editKey === 'trainingPhilosophy' ? 10 : editKey === 'trainerProfileBio' ? 5 : 1}
              textAlignVertical={editKey === 'trainerProfileBio' || editKey === 'trainingPhilosophy' ? 'top' : 'center'}
              style={[
                styles.editInput,
                editKey === 'trainerProfileBio' || editKey === 'trainingPhilosophy' ? styles.editInputMultiline : null,
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
  trainerPhilosophyCard: {
    borderRadius: 14.5,
    padding: 16,
    borderWidth: 1,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  trainerPhilosophyText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
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
  editInputMultiline: {
    minHeight: 120,
    paddingTop: 12,
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

