/**
 * Profile Screen
 *
 * Purpose: UI screen or component: Profile Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/profile
 * Key exports: ProfileScreen
 *
 * @file-header
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../../app/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { BOTTOM_NAV_BAR_HEIGHT } from '../../navigation/bottomNavMetrics';
import ProfileCardIcon from '../../shared/components/ProfileCardIcon';
import {
  PROFILE_ROW_ICON_SIZE,
  PROFILE_ROW_ICON_WRAP,
  profileCardIconWrapStyle,
} from '../../shared/workout/profileCardIcons';
import { useTheme } from '../../shared/ui/ThemeContext';
import { onUserSignOut } from '../../utils/clearDataOnLogout';
import { syncTrainerMarketplaceDoc } from '../../shared/services/trainerMarketplaceSync';
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
  Video,
  Sparkles,
} from 'lucide-react-native';
import {
  formatOnboardingDisplay,
  formatEquipmentFromProfile,
  formatDaysPerWeek,
} from '../../shared/utils/formatOnboardingDisplay';

/** Unified profile chrome — purple → pink only (no rainbow section/card colors). */
const PROFILE = {
  purple: '#9333EA',
  pink: '#DB2777',
  violet: '#7C3AED',
  violetSoft: '#C4B5FD',
  icon: '#A78BFA',
  borderGradient: ['#9333EA', '#DB2777'],
  lineGradient: ['#9333EA', '#DB2777', 'transparent'],
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

function hexToRgba(hex, alpha) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return `rgba(255,107,157,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

// ============================================================================
// FIELD PARSING
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

/** Soft glass panel — purple/pink lives in icon tints + section lines, not card rims */
function AccentPanel({ children, radius = 20, isDark, style }) {
  return (
    <View
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[
          isDark ? 'rgba(147,51,234,0.10)' : 'rgba(147,51,234,0.05)',
          isDark ? 'rgba(219,39,119,0.05)' : 'rgba(219,39,119,0.03)',
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        style={[StyleSheet.absoluteFillObject, { borderRadius: radius }]}
      />
      <View>{children}</View>
    </View>
  );
}

function GradientIconWrap({ children, size = 40, radius = 20, style }) {
  return (
    <LinearGradient
      colors={[hexToRgba(PROFILE.purple, 0.22), hexToRgba(PROFILE.pink, 0.14)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

function SectionTitle({ title, lineColors, theme }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitleText, { color: theme.muted }]}>{title}</Text>
      <View style={styles.sectionTitleLineWrap}>
        <LinearGradient colors={lineColors} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.sectionTitleLine} />
        <View style={[styles.sectionTitleDot, { backgroundColor: lineColors[0] }]} />
      </View>
    </View>
  );
}

function ProfileHero({ kicker, name, handle, headline, photoURL, uploading, onPressPhoto, theme, isDark }) {
  const ring = 188;
  const inner = 176;
  return (
    <View style={styles.heroWrap}>
      <Text style={[styles.heroKicker, { color: theme.muted }]}>{kicker}</Text>
      <View style={styles.heroPhotoWrap}>
        <LinearGradient
          colors={PROFILE.borderGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: ring, height: ring, borderRadius: ring / 2, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={[styles.heroPhotoInner, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: isDark ? '#0f0e14' : '#eee' }]}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={{ width: inner - 4, height: inner - 4, borderRadius: (inner - 4) / 2 }} />
            ) : (
              <Text style={styles.heroInitials}>{initialsFromName(name)}</Text>
            )}
          </View>
        </LinearGradient>
        <Pressable
          onPress={uploading ? undefined : onPressPhoto}
          style={[styles.heroCamBtn, { opacity: uploading ? 0.65 : 1 }]}
        >
          {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Camera size={18} color="#fff" strokeWidth={2.2} />}
        </Pressable>
      </View>
      <Text style={[styles.heroName, { color: theme.text }]}>{name}</Text>
      <Text style={styles.heroHandle}>{handle}</Text>
      {String(headline || '').trim() ? (
        <Text style={[styles.heroBio, { color: theme.muted }]} numberOfLines={3}>
          {headline}
        </Text>
      ) : null}
    </View>
  );
}

function EditPencilBtn({ isDark }) {
  return (
    <View style={[styles.editPencilBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,15,0.08)' }]}>
      <Pencil size={16} color={isDark ? 'rgba(255,255,255,0.9)' : 'rgba(10,10,15,0.75)'} strokeWidth={2.2} />
    </View>
  );
}

/** Single grouped card for profile rows — matches app glass panels (no per-field rainbow borders). */
function ProfileSettingsCard({ children, theme, isDark }) {
  return (
    <View
      style={[
        styles.settingsCard,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)',
        },
      ]}
    >
      {children}
    </View>
  );
}

function ProfileRow({
  label,
  value,
  onPress,
  editable,
  theme,
  isDark,
  iconColor,
  LeadingIcon,
  profileIconId,
  onboardingData,
  showDivider = true,
}) {
  const row = (
    <View style={[styles.profileRow, showDivider && styles.profileRowDivider, { borderBottomColor: theme.border }]}>
      <View style={styles.profileRowLeft}>
        {profileIconId ? (
          <View style={profileCardIconWrapStyle(isDark, { wrapSize: PROFILE_ROW_ICON_WRAP })}>
            <ProfileCardIcon
              itemId={profileIconId}
              onboardingData={onboardingData}
              size={PROFILE_ROW_ICON_SIZE}
            />
          </View>
        ) : LeadingIcon ? (
          <View style={[styles.profileRowIcon, { backgroundColor: hexToRgba(PROFILE.icon, 0.12) }]}>
            <LeadingIcon size={18} color={PROFILE.icon} strokeWidth={2} />
          </View>
        ) : null}
        <View style={styles.profileRowText}>
          <Text style={[styles.profileRowLabel, { color: theme.muted }]}>{label}</Text>
          <Text style={[styles.profileRowValue, { color: theme.text }]} numberOfLines={3}>
            {value}
          </Text>
        </View>
      </View>
      {editable ? <EditPencilBtn isDark={isDark} /> : null}
    </View>
  );
  if (!editable || !onPress) return row;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
      {row}
    </Pressable>
  );
}

function InfoField({ label, value, onPress, editable, theme, isDark, LeadingIcon }) {
  const body = (
    <View style={styles.infoField}>
      <View style={styles.infoFieldHeader}>
        <Text style={[styles.infoLabel, { color: theme.muted, flex: 1 }]}>{label}</Text>
        {editable ? <EditPencilBtn isDark={isDark} /> : null}
      </View>
      <View style={styles.infoValueRow}>
        {LeadingIcon ? <LeadingIcon size={15} color={PROFILE.icon} style={{ marginRight: 6 }} /> : null}
        <Text style={[styles.infoValue, { color: theme.text, flex: 1 }]} numberOfLines={4}>
          {value}
        </Text>
      </View>
    </View>
  );
  if (!editable || !onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
      {body}
    </Pressable>
  );
}

function CredentialPill({ Icon, label, value, theme, isDark, style }) {
  return (
    <AccentPanel radius={18} isDark={isDark} style={[{ flex: 1, minWidth: '46%' }, style]}>
      <View style={styles.credPillInner}>
        <GradientIconWrap size={40} radius={20}>
          <Icon size={20} color={PROFILE.violetSoft} strokeWidth={2} />
        </GradientIconWrap>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.infoLabel, { color: theme.muted }]}>{label}</Text>
          <Text style={[styles.credPillValue, { color: theme.text }]} numberOfLines={2}>
            {value}
          </Text>
        </View>
      </View>
    </AccentPanel>
  );
}

function PhilosophyQuote({ text, onPress, theme, isDark }) {
  const quote = text?.trim() || 'Tap to share how you coach — your voice belongs on your profile.';
  return (
    <Pressable onPress={onPress}>
      <AccentPanel radius={22} isDark={isDark}>
        <View style={styles.philosophyInner}>
          <View style={styles.philosophyEditCorner}>
            <EditPencilBtn isDark={isDark} />
          </View>
          <Text style={[styles.philosophyQuote, { color: theme.text }]}>{`\u201C${quote}\u201D`}</Text>
        </View>
      </AccentPanel>
    </Pressable>
  );
}

function SessionCard({ Icon, label, title, subtitle, theme, isDark }) {
  return (
    <AccentPanel radius={20} isDark={isDark} style={{ marginBottom: 12 }}>
      <View style={styles.sessionCardInner}>
        <GradientIconWrap size={44} radius={14} style={styles.sessionIconWrap}>
          <Icon size={22} color={PROFILE.violetSoft} strokeWidth={2} />
        </GradientIconWrap>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.infoLabel, { color: theme.muted }]}>{label}</Text>
          <Text style={[styles.sessionTitle, { color: theme.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.sessionSub, { color: theme.muted }]}>{subtitle}</Text> : null}
        </View>
      </View>
    </AccentPanel>
  );
}

function GradientSwitch({ value, onValueChange }) {
  return (
    <Pressable onPress={() => onValueChange(!value)} hitSlop={8}>
      {value ? (
        <LinearGradient colors={PROFILE.borderGradient} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.gradSwitchTrack}>
          <View style={[styles.gradSwitchThumb, styles.gradSwitchThumbOn]} />
        </LinearGradient>
      ) : (
        <View style={[styles.gradSwitchTrack, styles.gradSwitchTrackOff]}>
          <View style={styles.gradSwitchThumb} />
        </View>
      )}
    </Pressable>
  );
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

  const profileHeadline = useMemo(() => {
    if (isTrainer) {
      const b = String(trainerDoc?.trainerProfileBio || '').trim();
      if (b.length > 180) return `${b.slice(0, 177)}…`;
      if (b) return b;
      return 'Add a short public line about who you are — it appears on your profile.';
    }
    const g = String(onboardingData?.primaryGoal || '').trim();
    if (g) return formatOnboardingDisplay(g, '');
    return 'Keep your details current for a tailored experience.';
  }, [isTrainer, trainerDoc?.trainerProfileBio, onboardingData?.primaryGoal]);

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
        await syncTrainerMarketplaceDoc(db, uid, {
          patch: { photoURL: downloadURL, avatarUrl: downloadURL, photoUrl: downloadURL },
          forceTrainer: isTrainer,
        });
      } catch (syncErr) {
        console.warn('Trainer marketplace photo sync failed:', syncErr?.message || syncErr);
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
    if (key === 'primaryGoal') return String(onboardingData?.primaryGoal || '').trim();
    if (key === 'fitnessLevel') return String(onboardingData?.fitnessLevel || '').trim();
    if (key === 'daysPerWeek') {
      return onboardingData?.daysPerWeek != null ? String(onboardingData.daysPerWeek) : '';
    }
    if (key === 'equipment') {
      const arr = onboardingData?.equipmentAccess;
      if (Array.isArray(arr) && arr.length) return arr.join(', ');
      return String(onboardingData?.equipment || '').trim();
    }
    return '';
  };

  const openEdit = (key, label, currentDisplay) => {
    setEditKey(key);
    setEditLabel(label);
    if (
      key === 'height' ||
      key === 'name' ||
      key === 'primaryGoal' ||
      key === 'fitnessLevel' ||
      key === 'equipment' ||
      key === 'daysPerWeek'
    ) {
      setEditValue(getEditSeedForKey(key));
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
      } else if (editKey === 'height' || editKey === 'weight' || editKey === 'age' || editKey === 'daysPerWeek') {
        const n = raw === '' ? null : Number(raw);
        payload[editKey] = Number.isFinite(n) ? n : null;
      } else if (editKey === 'equipment') {
        const parts = raw
          .split(',')
          .map((p) => p.trim().toLowerCase().replace(/\s+/g, '_'))
          .filter(Boolean);
        payload.equipmentAccess = parts.length ? parts : null;
        payload.equipment = parts.length ? parts.join(', ') : null;
      } else if (editKey === 'location' || editKey === 'trainerProfileBio' || editKey === 'trainingPhilosophy') {
        payload[editKey] = raw === '' ? null : raw;
      } else {
        payload[editKey] = raw === '' ? null : raw;
      }

      await setDoc(doc(db, 'users', uid), payload, { merge: true });

      try {
        await syncTrainerMarketplaceDoc(db, uid, { patch: payload, forceTrainer: isTrainer });
      } catch (syncErr) {
        console.warn('Trainer marketplace sync failed:', syncErr?.message || syncErr);
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
    { key: 'name', Icon: User, value: displayName || '—', label: 'Full name' },
    { key: 'email', Icon: Mail, value: String(email || '—'), label: 'Email', readOnly: true },
    { key: 'age', profileIconId: 'age', value: onboardingData?.age != null ? String(onboardingData.age) : '—', label: 'Age' },
    { key: 'height', profileIconId: 'height', value: formatHeight(onboardingData?.height), label: 'Height' },
    { key: 'weight', profileIconId: 'weight', value: formatWeight(onboardingData?.weight), label: 'Weight' },
    { key: 'gender', profileIconId: 'gender', value: formatGender(onboardingData?.gender), label: 'Gender' },
  ];

  const trainingPreferences = [
    {
      key: 'primaryGoal',
      profileIconId: 'goal',
      label: 'Primary goal',
      value: formatOnboardingDisplay(onboardingData?.primaryGoal),
    },
    {
      key: 'fitnessLevel',
      profileIconId: 'fitnessLevel',
      label: 'Fitness level',
      value: formatOnboardingDisplay(onboardingData?.fitnessLevel),
    },
    {
      key: 'daysPerWeek',
      profileIconId: 'frequency',
      label: 'Training frequency',
      value: formatDaysPerWeek(onboardingData?.daysPerWeek),
    },
    {
      key: 'equipment',
      profileIconId: 'equipment',
      label: 'Equipment',
      value: formatEquipmentFromProfile(onboardingData),
    },
  ];

  const trainerProfessionalPills = [
    { key: 'name', Icon: User, value: displayName || '—', label: 'DISPLAY NAME' },
    { key: 'email', Icon: Mail, value: String(email || '—'), label: 'EMAIL', readOnly: true },
    {
      key: 'location',
      Icon: MapPin,
      value: String(trainerDoc?.location || '').trim() || '—',
      label: 'CITY / REGION',
    },
    {
      key: 'trainerProfileBio',
      Icon: ClipboardList,
      value: String(trainerDoc?.trainerProfileBio || '').trim() || '—',
      label: 'PUBLIC BIO',
    },
  ];

  const philosophyText = String(trainerDoc?.trainingPhilosophy || '').trim();
  const availabilityTitle = formatAvailability(trainerDoc?.trainerAvailabilityStatus);
  const sessionTitle = String(trainerDoc?.sessionType || '—').trim() || '—';
  const profileKicker = isTrainer ? 'TRAINER PROFILE' : 'YOUR PROFILE';
  const sectionLine = PROFILE.lineGradient;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <CoachConnectHeader
          title="Profile"
          skipTopSafeInset
          onBack={onBack}
          onSettingsPress={nav.settings}
          onProfilePress={nav.profile}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BOTTOM_NAV_BAR_HEIGHT + 24 }]}
        >
          <Animated.View
            style={{
              opacity: heroAnim,
              transform: [{ translateY: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <ProfileHero
              kicker={profileKicker}
              name={displayName}
              handle={handle}
              headline={profileHeadline}
              photoURL={photoURL}
              uploading={uploading}
              onPressPhoto={pickAndUploadPhoto}
              theme={theme}
              isDark={isDark}
            />
          </Animated.View>

          {isTrainer ? (
            <>
              <Animated.View style={{ opacity: personalAnim, transform: [{ translateY: personalAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
                <SectionTitle title="PROFESSIONAL INFO" lineColors={sectionLine} theme={theme} />
                <View style={styles.sectionBody}>
                  {trainerProfessionalPills.map((item) => (
                    <InfoField
                      key={item.key}
                      label={item.label}
                      value={item.value}
                      editable={!item.readOnly}
                      onPress={item.readOnly ? undefined : () => openEdit(item.key, item.label, item.value)}
                      theme={theme}
                      isDark={isDark}
                      LeadingIcon={item.key === 'location' ? MapPin : null}
                    />
                  ))}
                </View>
              </Animated.View>

              <Animated.View style={{ opacity: trainingAnim, transform: [{ translateY: trainingAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
                <SectionTitle title="CREDENTIALS" lineColors={sectionLine} theme={theme} />
                <View style={styles.credRow}>
                  <CredentialPill
                    Icon={Medal}
                    label="CERTIFICATIONS"
                    value={formatCertifications(trainerDoc)}
                    theme={theme}
                    isDark={isDark}
                    style={{ minWidth: '100%' }}
                  />
                  <View style={styles.credRowHalf}>
                    <CredentialPill
                      Icon={Calendar}
                      label="YEARS COACHING"
                      value={formatYearsCoaching(trainerDoc?.yearsExperience)}
                      theme={theme}
                      isDark={isDark}
                    />
                    <CredentialPill
                      Icon={Sparkles}
                      label="SPECIALTIES"
                      value={formatSpecialtyList(trainerDoc?.specialties)}
                      theme={theme}
                      isDark={isDark}
                    />
                  </View>
                </View>

                <SectionTitle title="COACHING PHILOSOPHY" lineColors={sectionLine} theme={theme} />
                <PhilosophyQuote
                  text={philosophyText}
                  onPress={() => openEdit('trainingPhilosophy', 'COACHING PHILOSOPHY', philosophyText || '—')}
                  theme={theme}
                  isDark={isDark}
                />
                <View style={{ height: 8 }} />
              </Animated.View>

              <Animated.View style={{ opacity: accountAnim, transform: [{ translateY: accountAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
                <SectionTitle title="AVAILABILITY & SESSIONS" lineColors={sectionLine} theme={theme} />
                <SessionCard
                  Icon={Calendar}
                  label="AVAILABILITY"
                  title={availabilityTitle === '—' ? 'Set your schedule' : availabilityTitle}
                  subtitle={availabilityTitle !== '—' ? 'Visible to clients on your profile' : 'Tap settings to update'}
                  theme={theme}
                  isDark={isDark}
                />
                <SessionCard
                  Icon={Video}
                  label="SESSION FORMAT"
                  title={sessionTitle === '—' ? 'Virtual & in-person' : sessionTitle}
                  subtitle="Session length & format"
                  theme={theme}
                  isDark={isDark}
                />
              </Animated.View>
            </>
          ) : (
            <>
              <Animated.View style={{ opacity: personalAnim, transform: [{ translateY: personalAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
                <SectionTitle title="PERSONAL INFO" lineColors={sectionLine} theme={theme} />
                <ProfileSettingsCard theme={theme} isDark={isDark}>
                  {personalData.map((item, idx) => (
                    <ProfileRow
                      key={item.key}
                      label={item.label}
                      value={item.value}
                      editable={!item.readOnly}
                      onPress={item.readOnly ? undefined : () => openEdit(item.key, item.label, item.value)}
                      theme={theme}
                      isDark={isDark}
                      iconColor={PROFILE.icon}
                      LeadingIcon={item.Icon}
                      profileIconId={item.profileIconId}
                      onboardingData={onboardingData}
                      showDivider={idx < personalData.length - 1}
                    />
                  ))}
                </ProfileSettingsCard>
              </Animated.View>

              <Animated.View style={{ opacity: trainingAnim, transform: [{ translateY: trainingAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
                <SectionTitle title="TRAINING PREFERENCES" lineColors={sectionLine} theme={theme} />
                <ProfileSettingsCard theme={theme} isDark={isDark}>
                  {trainingPreferences.map((item, idx) => (
                    <ProfileRow
                      key={item.key}
                      label={item.label}
                      value={item.value}
                      editable
                      onPress={() => openEdit(item.key, item.label, item.value)}
                      theme={theme}
                      isDark={isDark}
                      iconColor={PROFILE.icon}
                      LeadingIcon={item.Icon}
                      profileIconId={item.profileIconId}
                      onboardingData={onboardingData}
                      showDivider={idx < trainingPreferences.length - 1}
                    />
                  ))}
                </ProfileSettingsCard>
              </Animated.View>
            </>
          )}

          <Animated.View style={{ opacity: accountAnim, transform: [{ translateY: accountAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
            <SectionTitle title="ACCOUNT" lineColors={sectionLine} theme={theme} />
            <View style={[styles.accountBlock, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }]}>
              <View style={styles.accountNotifyRow}>
                <View style={[styles.accountIconCircle, { backgroundColor: hexToRgba(PROFILE.icon, 0.14) }]}>
                  <Bell size={20} color={PROFILE.icon} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.accountNotifyTitle, { color: theme.text }]}>Notifications</Text>
                  <Text style={[styles.accountNotifySub, { color: theme.muted }]}>Session reminders & messages</Text>
                </View>
                <GradientSwitch value={notificationsOn} onValueChange={setNotificationsOn} />
              </View>
            </View>
            <Pressable
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={({ pressed }) => [
                styles.signOutBtn,
                { borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.signOutBtnText, { color: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(10,10,15,0.88)' }]}>
                Sign out
              </Text>
            </Pressable>
          </Animated.View>
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
              <LinearGradient colors={PROFILE.borderGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.editBtnPrimary}>
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
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 140 },

  heroWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 28, marginBottom: 8 },
  heroKicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  heroPhotoWrap: { position: 'relative', marginBottom: 18 },
  heroPhotoInner: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroInitials: { fontSize: 52, fontWeight: '600', color: '#FFF' },
  heroCamBtn: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PROFILE.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: PROFILE.purple,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  heroName: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 6,
  },
  heroHandle: {
    fontSize: 14,
    fontWeight: '500',
    color: PROFILE.violetSoft,
    textAlign: 'center',
    marginBottom: 14,
  },
  heroBio: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 8,
    maxWidth: 340,
  },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
    marginTop: 8,
    gap: 12,
  },
  sectionTitleText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sectionTitleLineWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 2 },
  sectionTitleLine: { flex: 1, height: 2, borderRadius: 1 },
  sectionTitleDot: { width: 6, height: 6, borderRadius: 3, marginLeft: -3 },

  sectionBody: { marginBottom: 28, gap: 20 },
  settingsCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 28,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  profileRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  profileRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  profileRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRowText: { flex: 1, minWidth: 0, gap: 4 },
  profileRowLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  profileRowValue: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  infoField: { gap: 8 },
  infoFieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  editPencilBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' },
  infoValue: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
  infoValueRow: { flexDirection: 'row', alignItems: 'center' },

  credRow: { gap: 10, marginBottom: 28 },
  credRowHalf: { flexDirection: 'row', gap: 10 },
  credPillInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  credPillValue: { fontSize: 15, fontWeight: '600', marginTop: 6, lineHeight: 20 },

  philosophyInner: { paddingVertical: 26, paddingHorizontal: 22, position: 'relative' },
  philosophyEditCorner: { position: 'absolute', top: 14, right: 14, zIndex: 2 },
  philosophyQuote: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '400',
  },

  sessionCardInner: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16 },
  sessionIconWrap: { width: 44, height: 44, borderRadius: 14 },
  sessionTitle: { fontSize: 17, fontWeight: '600', marginTop: 6, lineHeight: 22 },
  sessionSub: { fontSize: 13, fontWeight: '400', marginTop: 4, lineHeight: 18 },

  accountBlock: { borderRadius: 18, overflow: 'hidden', marginBottom: 24 },
  accountNotifyRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  accountIconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  accountNotifyTitle: { fontSize: 16, fontWeight: '600' },
  accountNotifySub: { fontSize: 13, marginTop: 3, lineHeight: 17 },
  accountDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  signOutBtn: {
    marginTop: 14,
    marginBottom: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  signOutBtnText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  gradSwitchTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 3,
    justifyContent: 'center',
  },
  gradSwitchTrackOff: { backgroundColor: 'rgba(255,255,255,0.14)' },
  gradSwitchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  gradSwitchThumbOn: { alignSelf: 'flex-end' },

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

