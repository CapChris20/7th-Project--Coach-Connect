/**
 * Profile Screen
 *
 * Purpose: UI screen or component: Profile Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/profile
 * Key exports: ViewMyViewMyProfileScreen
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
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../../app-start/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  uploadTrainerCertificationSheet,
  deleteTrainerCertificationSheet,
} from '../../shared/notes-files/manageNotesAndFiles';
import {
  verifyTrainerCertification,
  certificationStatusLabel,
  certificationStatusDetail,
  certificationStatusTone,
} from '../../shared/api/verifyTrainerCertification';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { BOTTOM_NAV_BAR_HEIGHT, ShellBottomNavAnchor, FORM_SCROLL_PROPS } from '../../navigation/bottomNavMetrics';
import ProfileCardIcon from '../../shared/components/icons/ProfileCardIcon';
import {
  PROFILE_ROW_ICON_SIZE,
  PROFILE_ROW_ICON_WRAP,
  profileCardIconWrapStyle,
} from '../../shared/workout-profile/profileCardIcons';
import { useTheme } from '../../shared-ui/ThemeContext';
import { onUserSignOut } from '../../utils/clearDataOnLogout';
import { syncTrainerMarketplaceDoc } from '../../shared/marketplace/trainerMarketplaceSync';
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
  Star,
  Users,
  Wallet,
  Link2,
  AtSign,
} from 'lucide-react-native';
import {
  formatOnboardingDisplay,
  formatEquipmentFromProfile,
  formatDaysPerWeek,
} from '../../shared-utils/formatOnboardingDisplay';
import { resolveClientProfileFields } from '../../shared-utils/resolveClientProfileFields';

/** Unified profile chrome — CoachConnect warm accent (dark pink → dark orange). */
const PROFILE = {
  purple: '#BE185D',
  pink: '#C2410C',
  violet: '#9A3412',
  violetSoft: '#FDBA74',
  icon: '#FDBA74',
  borderGradient: ['#BE185D', '#C2410C'],
  lineGradient: ['#BE185D', '#C2410C', 'transparent'],
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

function ProfileHero({ kicker, name, handle, headline, photoURL, uploading, onPressPhoto, onEditPress, theme, isDark }) {
  const ring = 188;
  const inner = 176;
  return (
    <View style={styles.heroWrap}>
      <View style={styles.heroTopRow}>
        <Text style={[styles.heroKicker, { color: theme.muted, flex: 1 }]}>{kicker}</Text>
        {onEditPress ? (
          <Pressable onPress={onEditPress} style={[styles.heroEditBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.06)' }]}>
            <Pencil size={14} color={PROFILE.violetSoft} strokeWidth={2.2} />
            <Text style={[styles.heroEditText, { color: theme.text }]}>Edit</Text>
          </Pressable>
        ) : null}
      </View>
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

function TrainerStatTile({ Icon, value, label, theme, isDark }) {
  return (
    <View
      style={[
        styles.statTile,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)',
        },
      ]}
    >
      <Icon size={16} color={PROFILE.violetSoft} strokeWidth={2} />
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
    </View>
  );
}

function TrainerStatsStrip({ clientCount, years, rating, theme, isDark }) {
  return (
    <View style={styles.statsRow}>
      <TrainerStatTile Icon={Users} value={clientCount ?? '—'} label="Clients" theme={theme} isDark={isDark} />
      <TrainerStatTile Icon={Calendar} value={years ?? '—'} label="Years" theme={theme} isDark={isDark} />
      <TrainerStatTile Icon={Star} value={rating ?? 'New'} label="Rating" theme={theme} isDark={isDark} />
    </View>
  );
}

function TrainerPaymentCard({ status, onPress, theme, isDark }) {
  const label =
    status === 'active'
      ? 'Payouts active'
      : status === 'pending'
        ? 'Verification in progress'
        : 'Complete payout setup';
  const cta = status === 'active' ? 'Manage' : 'Set Up';
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <LinearGradient colors={['#7C2D12', '#C2410C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.paymentCard}>
        <View style={styles.paymentCardInner}>
          <Wallet size={18} color="#FDBA74" strokeWidth={2} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.paymentKicker}>PAYMENTS</Text>
            <Text style={styles.paymentStatus}>{label}</Text>
          </View>
          {onPress ? (
            <View style={styles.paymentCta}>
              <Text style={styles.paymentCtaText}>{cta}</Text>
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function TrainerContactRow({ label, value, Icon, onPress, editable, theme, isDark }) {
  const row = (
    <View style={[styles.contactRow, { borderBottomColor: theme.border }]}>
      <Icon size={16} color={PROFILE.violetSoft} strokeWidth={2} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.infoLabel, { color: theme.muted }]}>{label}</Text>
        <Text style={[styles.contactValue, { color: theme.text }]} numberOfLines={2}>
          {value || '—'}
        </Text>
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

export function ViewMyViewMyProfileScreen({
  isDark: isDarkProp,
  onBack,
  embedShellBottomNav = false,
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
  onOpenPayments,
  trainerClientCount,
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
  const [certSheets, setCertSheets] = useState([]);
  const [certUploading, setCertUploading] = useState(false);
  const [certProgress, setCertProgress] = useState(0);
  const [certVerifyStatus, setCertVerifyStatus] = useState(null); // local + live status key
  const [certVerifyBusy, setCertVerifyBusy] = useState(false);

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

  const trainerDoc = useMemo(() => ({ ...(userData || {}), ...(onboardingData || {}) }), [userData, onboardingData]);

  React.useEffect(() => {
    if (!isTrainer) return;
    const list = Array.isArray(trainerDoc?.certificationSheets) ? trainerDoc.certificationSheets : [];
    setCertSheets(list);
  }, [isTrainer, trainerDoc?.certificationSheets]);

  React.useEffect(() => {
    if (!isTrainer || certVerifyBusy) return;
    const fromDoc =
      trainerDoc?.certificationVerificationStatus ||
      trainerDoc?.aiVerification?.status ||
      null;
    if (fromDoc) setCertVerifyStatus(String(fromDoc));
  }, [
    isTrainer,
    certVerifyBusy,
    trainerDoc?.certificationVerificationStatus,
    trainerDoc?.aiVerification?.status,
  ]);

  const handleAddCertification = async () => {
    const tid = auth?.currentUser?.uid;
    if (!tid) {
      Alert.alert('Sign in required', 'Sign in again to upload certifications.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets?.[0];
      if (!file?.uri) {
        Alert.alert('Upload failed', 'Could not read the selected file.');
        return;
      }
      if (file.size != null && file.size > 10 * 1024 * 1024) {
        Alert.alert('File too large', 'Certification sheets must be 10MB or smaller.');
        return;
      }
      setCertUploading(true);
      setCertProgress(0);
      const { meta, url } = await uploadTrainerCertificationSheet(
        tid,
        {
          localUri: file.uri,
          filename: file.name || 'certification.pdf',
          mimeType: file.mimeType,
          fileSize: file.size,
        },
        (pct) => setCertProgress(pct),
      );
      setCertSheets((prev) => [...prev, meta]);
      onProfileSaved?.();

      const trainerName =
        `${String(userData?.firstName || '').trim()} ${String(userData?.lastName || '').trim()}`.trim() ||
        String(userData?.name || onboardingData?.name || auth?.currentUser?.displayName || '').trim() ||
        'Trainer';

      let verifyMessage = 'Certification sheet added to your profile.';
      const mime = String(file.mimeType || meta?.fileType || '').toLowerCase();
      if (mime.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(String(file.name || ''))) {
        try {
          setCertVerifyBusy(true);
          setCertVerifyStatus('checking');
          const verification = await verifyTrainerCertification({
            trainerId: tid,
            trainerName,
            localUri: file.uri,
            imageUrl: url,
            mediaType: file.mimeType || 'image/jpeg',
            storagePath: meta?.storagePath,
            fileName: meta?.fileName,
          });
          const nextStatus = verification.status || 'manual_review';
          setCertVerifyStatus(nextStatus);
          verifyMessage =
            verification.userMessage ||
            certificationStatusLabel(nextStatus) ||
            verifyMessage;
          if (verification.analysis?.issues?.length && verification.status === 'rejected') {
            verifyMessage = `${verifyMessage}\n${verification.analysis.issues[0]}`;
          }
        } catch (verifyErr) {
          if (__DEV__) console.warn('cert AI verify:', verifyErr?.message || verifyErr);
          setCertVerifyStatus('manual_review');
          verifyMessage = 'Uploaded — Under review. AI check was unavailable; we’ll review it within 24–48 hours.';
        } finally {
          setCertVerifyBusy(false);
        }
      } else {
        setCertVerifyStatus('manual_review');
        verifyMessage =
          'Uploaded — Under review. Photos (JPG/PNG) get instant AI checks; other file types are reviewed within 24–48 hours.';
      }

      Alert.alert('Certification', verifyMessage);
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not upload certification. Try again.');
    } finally {
      setCertUploading(false);
      setCertProgress(0);
    }
  };

  const handleDeleteCertification = (meta) => {
    Alert.alert('Remove certification', `Delete ${meta?.fileName || 'this file'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const tid = auth?.currentUser?.uid;
          if (!tid) return;
          try {
            await deleteTrainerCertificationSheet(tid, meta);
            setCertSheets((prev) => prev.filter((x) => x.storagePath !== meta.storagePath));
            onProfileSaved?.();
          } catch (e) {
            Alert.alert('Delete failed', e?.message || 'Could not remove file.');
          }
        },
      },
    ]);
  };

  const clientProfile = useMemo(
    () => resolveClientProfileFields(userData, onboardingData),
    [userData, onboardingData],
  );
  const profileDoc = isTrainer ? trainerDoc : clientProfile;

  const displayName = useMemo(() => {
    const u = auth?.currentUser;
    const first = userData?.firstName ? String(userData.firstName).trim() : '';
    const last = userData?.lastName ? String(userData.lastName).trim() : '';
    const fromUser = `${first} ${last}`.trim();
    const fromDoc = String(clientProfile?.name || onboardingData?.name || '').trim();
    return (fromUser || fromDoc || String(u?.displayName || '').trim() || 'Your Profile').trim();
  }, [userData?.firstName, userData?.lastName, clientProfile?.name, onboardingData?.name]);

  const handle = useMemo(() => {
    const raw = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '');
    return `@${raw || 'coachconnect'}`;
  }, [displayName]);

  const profileHeadline = useMemo(() => {
    if (isTrainer) {
      const b = String(trainerDoc?.trainerProfileBio || '').trim();
      if (b.length > 180) return `${b.slice(0, 177)}…`;
      if (b) return b;
      return 'Add a short public line about who you are — it appears on your profile.';
    }
    const g = String(clientProfile?.primaryGoal || '').trim();
    if (g) return formatOnboardingDisplay(g, '');
    return 'Keep your details current for a tailored experience.';
  }, [isTrainer, trainerDoc?.trainerProfileBio, clientProfile?.primaryGoal, onboardingData?.primaryGoal]);

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
    if (key === 'height') return parseHeightForProfile(profileDoc?.height).editSeed;
    if (key === 'name') {
      const first = userData?.firstName != null ? String(userData.firstName).trim() : '';
      const last = userData?.lastName != null ? String(userData.lastName).trim() : '';
      const combined = `${first} ${last}`.trim();
      if (combined) return combined;
      return String(profileDoc?.name || '').trim();
    }
    if (key === 'location') return String(trainerDoc?.location || '').trim();
    if (key === 'trainerProfileBio') return String(trainerDoc?.trainerProfileBio || '').trim();
    if (key === 'instagram') return String(trainerDoc?.instagram || trainerDoc?.instagramHandle || '').trim();
    if (key === 'website') return String(trainerDoc?.website || trainerDoc?.websiteUrl || '').trim();
    if (key === 'trainingPhilosophy') return String(trainerDoc?.trainingPhilosophy || '').trim();
    if (key === 'primaryGoal') return String(profileDoc?.primaryGoal || '').trim();
    if (key === 'fitnessLevel') return String(profileDoc?.fitnessLevel || '').trim();
    if (key === 'daysPerWeek') {
      return profileDoc?.daysPerWeek != null ? String(profileDoc.daysPerWeek) : '';
    }
    if (key === 'equipment') {
      const arr = profileDoc?.equipmentAccess;
      if (Array.isArray(arr) && arr.length) return arr.join(', ');
      return String(profileDoc?.equipment || '').trim();
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
      } else if (editKey === 'location' || editKey === 'trainerProfileBio' || editKey === 'trainingPhilosophy' || editKey === 'instagram' || editKey === 'website') {
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

  const email = auth?.currentUser?.email || clientProfile?.email || onboardingData?.email || '—';

  const personalData = [
    { key: 'name', Icon: User, value: displayName || '—', label: 'Full name' },
    { key: 'email', Icon: Mail, value: String(email || '—'), label: 'Email', readOnly: true },
    { key: 'age', profileIconId: 'age', value: clientProfile?.age != null ? String(clientProfile.age) : '—', label: 'Age' },
    { key: 'height', profileIconId: 'height', value: formatHeight(clientProfile?.height), label: 'Height' },
    { key: 'weight', profileIconId: 'weight', value: formatWeight(clientProfile?.weight), label: 'Weight' },
    { key: 'gender', profileIconId: 'gender', value: formatGender(clientProfile?.gender), label: 'Gender' },
  ];

  const trainingPreferences = [
    {
      key: 'primaryGoal',
      profileIconId: 'goal',
      label: 'Primary goal',
      value: formatOnboardingDisplay(clientProfile?.primaryGoal),
    },
    {
      key: 'fitnessLevel',
      profileIconId: 'fitnessLevel',
      label: 'Fitness level',
      value: formatOnboardingDisplay(clientProfile?.fitnessLevel),
    },
    {
      key: 'daysPerWeek',
      profileIconId: 'frequency',
      label: 'Training frequency',
      value: formatDaysPerWeek(clientProfile?.daysPerWeek),
    },
    {
      key: 'equipment',
      profileIconId: 'equipment',
      label: 'Equipment',
      value: formatEquipmentFromProfile(clientProfile),
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
  const stripeStatus = trainerDoc?.stripeConnectStatus || 'not_connected';
  const trainerYearsStat = formatYearsCoaching(trainerDoc?.yearsExperience);
  const trainerRatingStat =
    trainerDoc?.averageRating != null ? Number(trainerDoc.averageRating).toFixed(1) : null;
  const instagram = String(trainerDoc?.instagram || trainerDoc?.instagramHandle || '').trim();
  const website = String(trainerDoc?.website || trainerDoc?.websiteUrl || '').trim();
  const profileKicker = isTrainer ? 'TRAINER PROFILE' : 'YOUR PROFILE';
  const sectionLine = PROFILE.lineGradient;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ flex: 1 }}>
        <CoachConnectHeader
          title="Profile"
          skipTopSafeInset
          onBack={onBack}
          onSettingsPress={nav.settings}
          onProfilePress={nav.profile}
        />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BOTTOM_NAV_BAR_HEIGHT + 24 }]}
          {...FORM_SCROLL_PROPS}
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
              onEditPress={isTrainer ? () => openEdit('trainerProfileBio', 'PUBLIC BIO', trainerDoc?.trainerProfileBio || '') : undefined}
              theme={theme}
              isDark={isDark}
            />
          </Animated.View>

          {isTrainer ? (
            <>
              <TrainerStatsStrip
                clientCount={trainerClientCount ?? trainerDoc?.clientCount ?? '—'}
                years={trainerYearsStat}
                rating={trainerRatingStat}
                theme={theme}
                isDark={isDark}
              />

              <View style={{ marginBottom: 20 }}>
                <TrainerPaymentCard
                  status={stripeStatus}
                  onPress={typeof onOpenPayments === 'function' ? onOpenPayments : undefined}
                  theme={theme}
                  isDark={isDark}
                />
              </View>

              <Animated.View style={{ opacity: personalAnim, transform: [{ translateY: personalAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
                <SectionTitle title="PROFILE" lineColors={sectionLine} theme={theme} />
                <ProfileSettingsCard theme={theme} isDark={isDark}>
                  {trainerProfessionalPills.map((item) => (
                    <ProfileRow
                      key={item.key}
                      label={item.label}
                      value={item.value}
                      editable={!item.readOnly}
                      onPress={item.readOnly ? undefined : () => openEdit(item.key, item.label, item.value)}
                      theme={theme}
                      isDark={isDark}
                      LeadingIcon={item.Icon}
                      showDivider={item.key !== 'trainerProfileBio'}
                    />
                  ))}
                </ProfileSettingsCard>
              </Animated.View>

              <Animated.View style={{ opacity: trainingAnim, transform: [{ translateY: trainingAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
                <SectionTitle title="SPECIALTIES & CERTIFICATIONS" lineColors={sectionLine} theme={theme} />
                <View style={styles.credRow}>
                  <CredentialPill
                    Icon={Medal}
                    label="CERTIFICATIONS"
                    value={formatCertifications(trainerDoc)}
                    theme={theme}
                    isDark={isDark}
                    style={{ minWidth: '100%' }}
                  />
                  <View
                    style={{
                      width: '100%',
                      marginTop: 12,
                      padding: 14,
                      borderRadius: 16,
                      backgroundColor: theme.card,
                      borderWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <Text style={{ color: theme.muted, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
                      CERTIFICATION SHEETS
                    </Text>
                    <Text style={{ color: theme.muted, fontSize: 12, marginTop: 4, marginBottom: 10 }}>
                      Upload a photo of your certificate for AI verification (JPG/PNG). PDF is accepted for manual review.
                    </Text>
                    {(certVerifyBusy || certificationStatusLabel(certVerifyStatus)) ? (
                      <View
                        style={{
                          marginBottom: 12,
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor:
                            certificationStatusTone(certVerifyStatus) === 'success'
                              ? 'rgba(22,163,74,0.35)'
                              : certificationStatusTone(certVerifyStatus) === 'danger'
                                ? 'rgba(220,38,38,0.35)'
                                : theme.border,
                          backgroundColor:
                            certificationStatusTone(certVerifyStatus) === 'success'
                              ? 'rgba(22,163,74,0.08)'
                              : certificationStatusTone(certVerifyStatus) === 'danger'
                                ? 'rgba(220,38,38,0.08)'
                                : isDark
                                  ? 'rgba(255,255,255,0.04)'
                                  : 'rgba(0,0,0,0.03)',
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          {certVerifyBusy || certVerifyStatus === 'checking' ? (
                            <ActivityIndicator size="small" color={theme.muted} />
                          ) : null}
                          <Text
                            style={{
                              flex: 1,
                              color:
                                certificationStatusTone(certVerifyStatus) === 'success'
                                  ? '#16a34a'
                                  : certificationStatusTone(certVerifyStatus) === 'danger'
                                    ? '#dc2626'
                                    : theme.text,
                              fontSize: 13,
                              fontWeight: '700',
                            }}
                          >
                            {certificationStatusLabel(certVerifyStatus) || 'Checking status…'}
                          </Text>
                        </View>
                        {certificationStatusDetail(certVerifyStatus) ? (
                          <Text style={{ color: theme.muted, fontSize: 12, marginTop: 6, lineHeight: 17 }}>
                            {certificationStatusDetail(certVerifyStatus)}
                          </Text>
                        ) : null}
                      </View>
                    ) : null}
                    {certSheets.length === 0 ? (
                      <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 10 }}>
                        No files uploaded yet
                      </Text>
                    ) : (
                      certSheets.map((sheet) => (
                        <View
                          key={sheet.storagePath || sheet.fileName}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 10,
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: theme.border,
                          }}
                        >
                          <Ionicons name="document-attach-outline" size={18} color={theme.muted} />
                          <View style={{ flex: 1, marginHorizontal: 10 }}>
                            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
                              {sheet.fileName || 'Certification'}
                            </Text>
                            <Text style={{ color: theme.muted, fontSize: 11 }} numberOfLines={1}>
                              {sheet.fileType || 'file'}
                              {sheet.uploadedAt ? ` · ${String(sheet.uploadedAt).slice(0, 10)}` : ''}
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => handleDeleteCertification(sheet)} hitSlop={8}>
                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                    {certUploading ? (
                      <View style={{ marginTop: 8 }}>
                        <Text style={{ color: theme.muted, fontSize: 12, marginBottom: 6 }}>
                          Uploading… {certProgress}%
                        </Text>
                        <View
                          style={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: theme.border,
                            overflow: 'hidden',
                          }}
                        >
                          <View
                            style={{
                              width: `${Math.max(4, certProgress)}%`,
                              height: '100%',
                              backgroundColor: PROFILE.purple,
                            }}
                          />
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={handleAddCertification}
                        activeOpacity={0.85}
                        style={{
                          marginTop: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          paddingVertical: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: theme.border,
                        }}
                      >
                        <Ionicons name="cloud-upload-outline" size={18} color={theme.text} />
                        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 13 }}>Add Certification</Text>
                      </TouchableOpacity>
                    )}
                  </View>
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

                <SectionTitle title="CONTACT & SOCIAL" lineColors={sectionLine} theme={theme} />
                <ProfileSettingsCard theme={theme} isDark={isDark}>
                  <TrainerContactRow
                    label="INSTAGRAM"
                    value={instagram ? (instagram.startsWith('@') ? instagram : `@${instagram}`) : 'Add your handle'}
                    Icon={AtSign}
                    editable
                    onPress={() => openEdit('instagram', 'INSTAGRAM', instagram)}
                    theme={theme}
                    isDark={isDark}
                  />
                  <TrainerContactRow
                    label="WEBSITE"
                    value={website || 'Add your website'}
                    Icon={Link2}
                    editable
                    onPress={() => openEdit('website', 'WEBSITE', website)}
                    theme={theme}
                    isDark={isDark}
                  />
                  <TrainerContactRow
                    label="EMAIL"
                    value={String(email || '—')}
                    Icon={Mail}
                    theme={theme}
                    isDark={isDark}
                  />
                </ProfileSettingsCard>
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
                      onboardingData={profileDoc}
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
                      onboardingData={profileDoc}
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
      </View>

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

      {!embedShellBottomNav ? (
        <ShellBottomNavAnchor>
          <BottomNavBar
            onHomePress={nav.home}
            onPlusPress={nav.create}
            onVoicePress={nav.ai}
            onNutritionPress={nav.nutrition}
            onWorkoutPress={nav.workout}
            onMessagesPress={nav.messages}
            onProfilePress={nav.profile}
          />
        </ShellBottomNavAnchor>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 140 },

  heroWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 28, marginBottom: 8, width: '100%' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 12, paddingHorizontal: 4 },
  heroEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  heroEditText: { fontSize: 13, fontWeight: '700' },
  heroKicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
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

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },

  paymentCard: { borderRadius: 14, overflow: 'hidden' },
  paymentCardInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  paymentKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: 'rgba(255,255,255,0.55)' },
  paymentStatus: { fontSize: 13, fontWeight: '700', color: '#FED7AA', marginTop: 2 },
  paymentCta: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  paymentCtaText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contactValue: { fontSize: 15, fontWeight: '600', marginTop: 2 },

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

export default ViewMyViewMyProfileScreen;

