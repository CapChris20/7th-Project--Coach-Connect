// Design Law Edit profile — identity card, Nb list rows, pink→orange accents only.
// Flow: read the signed-in user → edit one field or certification sheet → save to Firestore.
// Used by the client profile stack and the trainer app. userRole "Client" stays that letter.
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db } from '../../app-start/cloudConnection';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  uploadTrainerCertificationSheet,
  deleteTrainerCertificationSheet,
} from '../../for-both/files-and-notes/saveNotesAndFiles';
import {
  checkTrainerCertificate,
  certificationStatusLabel,
  certificationStatusDetail,
  certificationStatusTone,
} from '../../for-both/online-connection/checkTrainerCertificate';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { ShellBottomNavAnchor, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import ProfileIcon from '../../for-both/icons/ProfileIcon';
import {
  PROFILE_ROW_ICON_SIZE,
  PROFILE_ROW_ICON_WRAP,
  profileCardIconWrapStyle,
} from '../../for-both/profileCardIconSizes';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { onUserSignOut } from '../../logout-cleanup/clearDataOnLogout';
import { syncTrainerMarketplaceDoc } from '../../for-both/trainer-listing/keepTrainerListingUpdated';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbListRow from '../../look-and-feel/NbListRow';
import HardShadow from '../../look-and-feel/HardShadow';
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
  showSetupAnswers,
  formatEquipmentFromProfile,
  formatDaysPerWeek,
} from '../../helpers/showSetupAnswers';
import { fillTraineeProfile } from '../../helpers/fillTraineeProfile';
import {
  lightColors,
  darkColors,
  nb,
  gradients,
  navAccentGradient,
  spacing,
} from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_EXTRA_INSET = 24;
const ENTRANCE_FADE_MS = 420;
const ENTRANCE_STAGGER_MS = 90;
const BYTES_PER_KIBIBYTE = 1024;
const KIBIBYTES_PER_MEBIBYTE = 1024;
const MAX_CERT_FILE_MEBIBYTES = 10;
const MAX_CERT_FILE_BYTES = MAX_CERT_FILE_MEBIBYTES * BYTES_PER_KIBIBYTE * KIBIBYTES_PER_MEBIBYTE;
const BIO_PREVIEW_MAX_CHARS = 180;
const BIO_PREVIEW_CUT_CHARS = 177;
const USERS_COLLECTION = 'users';
const PROFILE_PHOTO_FOLDER = 'profile_photos';
const CERT_STATUS_SUCCESS = 'success';
const CERT_STATUS_DANGER = 'danger';
const CERT_SUCCESS_BORDER = 'rgba(22,163,74,0.35)';
const CERT_DANGER_BORDER = 'rgba(220,38,38,0.35)';
const CERT_SUCCESS_FILL = 'rgba(22,163,74,0.08)';
const CERT_DANGER_FILL = 'rgba(220,38,38,0.08)';
const CERT_SUCCESS_TEXT = '#16a34a';
const CERT_DANGER_TEXT = '#dc2626';
const EMPTY_PROFILE_MARK = '—';

// Manipulate here: accent only — pink→orange brand (no purple / no yellow)
const PROFILE = {
  accentSoft: '#FB923C',
  icon: '#FB923C',
  borderGradient: navAccentGradient,
  lineGradient: [...navAccentGradient, 'transparent'],
};

/** Design Law surface tokens for profile chrome (3px borders live on NbCard / HardShadow). */
function profileThemeFromMode(isDark) {
  const palette = isDark ? darkColors : lightColors;
  return {
    bg: palette.nbBackground,
    card: palette.nbSurface,
    text: palette.nbInk,
    muted: palette.nbMuted,
    border: palette.nbBorder,
    shadow: palette.nbShadow,
    fill: palette.nbFill,
    onFill: palette.nbOnFill,
    hover: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(10,10,15,0.04)',
    toggleOff: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(10,10,15,0.18)',
  };
}

// ===== HELPER FUNCTIONS =====

function hexToRgba(hex, alpha) {
  const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!hexMatch) return `rgba(255,107,157,${alpha})`;
  return `rgba(${parseInt(hexMatch[1], 16)},${parseInt(hexMatch[2], 16)},${parseInt(hexMatch[3], 16)},${alpha})`;
}

// ============================================================================
// FIELD PARSING
// ============================================================================

function coerceNumber(rawValue) {
  if (rawValue == null || rawValue === '') return null;
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return rawValue;
  if (typeof rawValue === 'string') {
    const parsedNumber = parseFloat(String(rawValue).replace(/,/g, ''));
    if (!Number.isFinite(parsedNumber)) return null;
    return parsedNumber;
  }
  return null;
}

/**
 * Height in Firestore may be a number (inches), string, or legacy object shape.
 * Returns display string, seed for the edit field (inches as number string), and total inches if known.
 */
function parseHeightForProfile(heightValue) {
  if (heightValue == null || heightValue === '') return { display: '—', editSeed: '', inches: null };
  if (typeof heightValue === 'number' && Number.isFinite(heightValue)) {
    return { display: formatInchesAsFeet(heightValue), editSeed: String(heightValue), inches: heightValue };
  }
  if (typeof heightValue === 'string') {
    const parsedInches = coerceNumber(heightValue);
    if (parsedInches != null) {
      return { display: formatInchesAsFeet(parsedInches), editSeed: String(parsedInches), inches: parsedInches };
    }
    const trimmedHeight = heightValue.trim();
    if (trimmedHeight) return { display: trimmedHeight, editSeed: trimmedHeight, inches: null };
    return { display: '—', editSeed: '', inches: null };
  }
  if (typeof heightValue === 'object' && heightValue !== null && !Array.isArray(heightValue)) {
    const cm = coerceNumber(heightValue.cm ?? heightValue.CM ?? heightValue.centimeters ?? heightValue.cmTotal);
    if (cm != null) {
      const inches = cm / 2.54;
      return { display: `${cm} cm (${formatInchesAsFeet(inches)})`, editSeed: String(Math.round(inches * 10) / 10), inches };
    }
    const ft = coerceNumber(heightValue.feet ?? heightValue.ft ?? heightValue.f);
    const inch = coerceNumber(heightValue.inches ?? heightValue.in ?? heightValue.inch ?? heightValue.ins);
    if (ft != null || inch != null) {
      const totalIn = (ft ?? 0) * 12 + (inch ?? 0);
      return { display: formatInchesAsFeet(totalIn), editSeed: String(Math.round(totalIn * 10) / 10), inches: totalIn };
    }
    const total = coerceNumber(heightValue.totalInches ?? heightValue.total_inches ?? heightValue.inchesTotal ?? heightValue.value);
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
  const nameText = String(name || '').trim();
  if (!nameText) return 'CC';
  return nameText
    .split(/\s+/)
    .map((namePart) => namePart[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/** Design Law surface panel — NbCard chrome, no purple wash. */
function AccentPanel({ children, style }) {
  return <NbCard style={[{ marginBottom: 0, padding: spacing.md }, style]}>{children}</NbCard>;
}

function GradientIconWrap({ children, size = 40, radius = 12, style }) {
  return (
    <LinearGradient
      colors={navAccentGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: nb.borderWidth,
          borderColor: lightColors.nbInk,
        },
        style,
      ]}
    >
      {children}
    </LinearGradient>
  );
}

/** Design Law section label — uppercase muted, no decorative gradient rail. */
function SectionTitle({ title, theme }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitleText, { color: theme.muted }]}>{title}</Text>
    </View>
  );
}

/**
 * Design Law page chrome: hard-shadow back square + title.
 */
function ProfilePageHeader({ title, subtitle, onBack, theme, topInset = 0 }) {
  return (
    <View style={[styles.pageHeader, { paddingTop: topInset + spacing.sm }]}>
      {typeof onBack === 'function' ? (
        <TouchableOpacity
          onPress={onBack}
          style={[
            styles.backSq,
            {
              borderColor: theme.border,
              backgroundColor: theme.card,
              shadowColor: theme.shadow,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backSqSpacer} />
      )}
      <View style={styles.pageHeaderText}>
        <Text style={[styles.pageTitle, { color: theme.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.pageSubtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

/**
 * Visual identity hero — big pink→orange avatar ring + name (the page should feel like YOU, not a tax form).
 * Design Law still allows gradient accents on avatars; hard border + hard shadow keep the chrome honest.
 */
function ProfileHero({ kicker, name, handle, headline, photoURL, uploading, onPressPhoto, theme }) {
  // Manipulate here: avatar ring size (outer / photo)
  const ring = 148;
  const photo = 132;
  return (
    <NbCard style={styles.heroCard}>
      <Text style={[styles.heroKicker, { color: theme.muted }]}>{kicker}</Text>
      <View style={styles.heroPhotoWrap}>
        <LinearGradient
          colors={navAccentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.heroRing,
            {
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View
            style={[
              styles.heroPhotoInner,
              {
                width: photo,
                height: photo,
                borderRadius: photo / 2,
                backgroundColor: theme.card,
              },
            ]}
          >
            {photoURL ? (
              <Image
                source={{ uri: photoURL }}
                style={{ width: photo - 4, height: photo - 4, borderRadius: (photo - 4) / 2 }}
              />
            ) : (
              <Text style={[styles.heroInitials, { color: lightColors.nbInk }]}>{initialsFromName(name)}</Text>
            )}
          </View>
        </LinearGradient>
        <Pressable
          onPress={uploading ? undefined : onPressPhoto}
          style={[
            styles.heroCamBtn,
            {
              opacity: uploading ? 0.65 : 1,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
        >
          {uploading ? (
            <ActivityIndicator color={lightColors.nbInk} size="small" />
          ) : (
            <LinearGradient
              colors={navAccentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          {!uploading ? <Camera size={18} color={lightColors.nbInk} strokeWidth={2.4} /> : null}
        </Pressable>
      </View>
      <Text style={[styles.heroName, { color: theme.text }]}>{name || 'Your name'}</Text>
      <Text style={[styles.heroHandle, { color: theme.muted }]}>{handle}</Text>
      {String(headline || '').trim() ? (
        <Text style={[styles.heroBio, { color: theme.muted }]} numberOfLines={3}>
          {headline}
        </Text>
      ) : null}
    </NbCard>
  );
}

function EditChevron({ theme }) {
  return <Ionicons name="chevron-forward" size={20} color={theme.muted} />;
}

/** Single grouped card for profile rows — matches app glass panels (no per-field rainbow borders). */
function ProfileSettingsCard({ children, theme, isDark }) {
  return (
    <NbCard style={{ marginBottom: 28 }}>
      {children}
    </NbCard>
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
            <ProfileIcon
              itemId={profileIconId}
              onboardingData={onboardingData}
              size={PROFILE_ROW_ICON_SIZE}
            />
          </View>
        ) : LeadingIcon ? (
          <View style={[styles.profileRowIcon, { backgroundColor: hexToRgba(PROFILE.icon, 0.14) }]}>
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
      {editable ? <EditChevron theme={theme} /> : null}
    </View>
  );
  if (!editable || !onPress) return row;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}>
      {row}
    </Pressable>
  );
}

function InfoField({ label, value, onPress, editable, theme, LeadingIcon }) {
  const body = (
    <View style={styles.infoField}>
      <View style={styles.infoFieldHeader}>
        <Text style={[styles.infoLabel, { color: theme.muted, flex: 1 }]}>{label}</Text>
        {editable ? <EditChevron theme={theme} /> : null}
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

function CredentialPill({ Icon, label, value, theme, style }) {
  return (
    <AccentPanel style={[{ flex: 1, minWidth: '46%' }, style]}>
      <View style={styles.credPillInner}>
        <GradientIconWrap size={40} radius={12}>
          <Icon size={20} color={lightColors.nbInk} strokeWidth={2} />
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

function PhilosophyQuote({ text, onPress, theme }) {
  const quote = text?.trim() || 'Tap to share how you coach — your voice belongs on your profile.';
  return (
    <Pressable onPress={onPress}>
      <AccentPanel>
        <View style={styles.philosophyInner}>
          <View style={styles.philosophyEditCorner}>
            <EditChevron theme={theme} />
          </View>
          <Text style={[styles.philosophyQuote, { color: theme.text }]}>{`\u201C${quote}\u201D`}</Text>
        </View>
      </AccentPanel>
    </Pressable>
  );
}

function SessionCard({ Icon, label, title, subtitle, theme }) {
  return (
    <AccentPanel style={{ marginBottom: 12 }}>
      <View style={styles.sessionCardInner}>
        <GradientIconWrap size={44} radius={12} style={styles.sessionIconWrap}>
          <Icon size={22} color={lightColors.nbInk} strokeWidth={2} />
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

function TrainerStatTile({ Icon, value, label, theme }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={12} style={{ flex: 1 }}>
      <View
        style={[
          styles.statTile,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
          },
        ]}
      >
        <Icon size={16} color={PROFILE.icon} strokeWidth={2} />
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.muted }]}>{label}</Text>
      </View>
    </HardShadow>
  );
}

function TrainerStatsStrip({ clientCount, years, rating, theme }) {
  return (
    <View style={styles.statsRow}>
      <TrainerStatTile Icon={Users} value={clientCount ?? '—'} label="Clients" theme={theme} />
      <TrainerStatTile Icon={Calendar} value={years ?? '—'} label="Years" theme={theme} />
      <TrainerStatTile Icon={Star} value={rating ?? 'New'} label="Rating" theme={theme} />
    </View>
  );
}

function paymentStatusLabel(status) {
  if (status === 'active') return 'Payouts active';
  if (status === 'pending') return 'Verification in progress';
  return 'Complete payout setup';
}

function paymentButtonLabel(status) {
  if (status === 'active') return 'Manage';
  return 'Set Up';
}

function TrainerPaymentCard({ status, onPress, theme }) {
  const label = paymentStatusLabel(status);
  const cta = paymentButtonLabel(status);
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <HardShadow offset={nb.shadowOffsetCard} radius={14}>
        <LinearGradient
          colors={gradients.brand.colors}
          start={gradients.brand.start}
          end={gradients.brand.end}
          style={[styles.paymentCard, { borderColor: theme.border }]}
        >
          <View style={styles.paymentCardInner}>
            <Wallet size={18} color={lightColors.nbInk} strokeWidth={2} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.paymentKicker, { color: lightColors.nbInk }]}>PAYMENTS</Text>
              <Text style={[styles.paymentStatus, { color: lightColors.nbInk }]}>{label}</Text>
            </View>
            {onPress ? (
              <View style={[styles.paymentCta, { borderColor: lightColors.nbInk }]}>
                <Text style={[styles.paymentCtaText, { color: lightColors.nbInk }]}>{cta}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </HardShadow>
    </Pressable>
  );
}

function TrainerContactRow({ label, value, Icon, onPress, editable, theme }) {
  const row = (
    <View style={[styles.contactRow, { borderBottomColor: theme.border }]}>
      <Icon size={16} color={PROFILE.icon} strokeWidth={2} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={[styles.infoLabel, { color: theme.muted }]}>{label}</Text>
        <Text style={[styles.contactValue, { color: theme.text }]} numberOfLines={2}>
          {value || '—'}
        </Text>
      </View>
      {editable ? <EditChevron theme={theme} /> : null}
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

function formatYearsCoaching(yearsValue) {
  if (yearsValue == null || yearsValue === '') return '—';
  const yearsKey = String(yearsValue);
  return YEARS_COACHING_LABELS[yearsKey] || yearsKey.replace(/_/g, ' ');
}

function formatSpecialtyList(specialtyList) {
  if (!Array.isArray(specialtyList) || specialtyList.length === 0) return '—';
  return specialtyList
    .map((specialty) =>
      String(specialty || '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
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

const CERT_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const NUMBER_PROFILE_FIELDS = ['height', 'weight', 'age', 'daysPerWeek'];

function genderFromTypedText(raw) {
  const genderSlug = raw.toLowerCase().replace(/\s+/g, '_').replace(/'/g, '');
  if (genderSlug === 'male' || genderSlug === 'm') return 'male';
  if (genderSlug === 'female' || genderSlug === 'f') return 'female';
  if (genderSlug === 'other') return 'other';
  if (genderSlug === 'prefer_not_to_say' || genderSlug === 'prefernottosay') return 'prefer_not_to_say';
  if (raw === '') return null;
  return raw;
}

function numberFromTypedText(raw) {
  if (raw === '') return null;
  const numericValue = Number(raw);
  if (!Number.isFinite(numericValue)) return null;
  return numericValue;
}

function equipmentFromTypedText(raw) {
  const parts = raw
    .split(',')
    .map((piece) => piece.trim().toLowerCase().replace(/\s+/g, '_'))
    .filter(Boolean);
  return {
    equipmentAccess: parts.length ? parts : null,
    equipment: parts.length ? parts.join(', ') : null,
  };
}

function profilePayloadForField(editKey, raw) {
  const payload = { updatedAt: new Date().toISOString() };
  if (editKey === 'name') {
    const trimmed = raw === '' ? null : raw;
    const parts = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    payload.name = trimmed;
    payload.firstName = parts[0] || '';
    payload.lastName = parts.slice(1).join(' ') || '';
    return payload;
  }
  if (editKey === 'gender') {
    payload.gender = genderFromTypedText(raw);
    return payload;
  }
  if (NUMBER_PROFILE_FIELDS.includes(editKey)) {
    payload[editKey] = numberFromTypedText(raw);
    return payload;
  }
  if (editKey === 'equipment') {
    return { ...payload, ...equipmentFromTypedText(raw) };
  }
  payload[editKey] = raw === '' ? null : raw;
  return payload;
}

async function pickCertificationFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: CERT_FILE_TYPES,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = result.assets?.[0];
  if (!file?.uri) {
    Alert.alert('Upload failed', 'Could not read the selected file.');
    return null;
  }
  if (file.size != null && file.size > MAX_CERT_FILE_BYTES) {
    Alert.alert('File too large', 'Certification sheets must be 10MB or smaller.');
    return null;
  }
  return file;
}

function certificationLooksLikeImage(file, meta) {
  const mime = String(file.mimeType || meta?.fileType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(String(file.name || ''));
}

async function checkImageCertification({ file, meta, url, trainerId, trainerName }) {
  const verification = await checkTrainerCertificate({
    trainerId,
    trainerName,
    localUri: file.uri,
    imageUrl: url,
    mediaType: file.mimeType || 'image/jpeg',
    storagePath: meta?.storagePath,
    fileName: meta?.fileName,
  });
  const nextStatus = verification.status || 'manual_review';
  let verifyMessage =
    verification.userMessage ||
    certificationStatusLabel(nextStatus) ||
    'Certification sheet added to your profile.';
  const firstIssue = verification.analysis?.issues?.[0];
  if (firstIssue && verification.status === 'rejected') {
    verifyMessage = `${verifyMessage}\n${firstIssue}`;
  }
  return { nextStatus, verifyMessage };
}

async function reviewUploadedCertification({
  file,
  meta,
  url,
  trainerId,
  trainerName,
  setCertVerifyBusy,
  setCertVerifyStatus,
}) {
  if (!certificationLooksLikeImage(file, meta)) {
    setCertVerifyStatus('manual_review');
    return 'Uploaded — Under review. Photos (JPG/PNG) get instant AI checks; other file types are reviewed within 24–48 hours.';
  }
  setCertVerifyBusy(true);
  setCertVerifyStatus('checking');
  try {
    const check = await checkImageCertification({ file, meta, url, trainerId, trainerName });
    setCertVerifyStatus(check.nextStatus);
    return check.verifyMessage;
  } catch (verifyErr) {
    if (__DEV__) console.warn('cert AI verify:', verifyErr?.message || verifyErr);
    setCertVerifyStatus('manual_review');
    return 'Uploaded — Under review. AI check was unavailable; we’ll review it within 24–48 hours.';
  } finally {
    setCertVerifyBusy(false);
  }
}

// ===== MAIN FUNCTION =====

export function ViewMyMyProfileScreen({
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
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_EXTRA_INSET);
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : themeIsDark;
  const theme = profileThemeFromMode(isDark);
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [photoURL, setPhotoURL] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [profileTab, setProfileTab] = useState(isTrainer ? 'trainer' : 'yours');
  const [draftFullName, setDraftFullName] = useState('');
  const [draftDisplayName, setDraftDisplayName] = useState('');

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
    Animated.stagger(ENTRANCE_STAGGER_MS, [
      Animated.timing(heroAnim, { toValue: 1, duration: ENTRANCE_FADE_MS, useNativeDriver: true }),
      Animated.timing(personalAnim, { toValue: 1, duration: ENTRANCE_FADE_MS, useNativeDriver: true }),
      Animated.timing(trainingAnim, { toValue: 1, duration: ENTRANCE_FADE_MS, useNativeDriver: true }),
      Animated.timing(accountAnim, { toValue: 1, duration: ENTRANCE_FADE_MS, useNativeDriver: true }),
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
    const trainerId = auth?.currentUser?.uid;
    if (!trainerId) {
      Alert.alert('Sign in required', 'Sign in again to upload certifications.');
      return;
    }
    try {
      const file = await pickCertificationFile();
      if (!file) return;
      setCertUploading(true);
      setCertProgress(0);
      const { meta, url } = await uploadTrainerCertificationSheet(
        trainerId,
        {
          localUri: file.uri,
          filename: file.name || 'certification.pdf',
          mimeType: file.mimeType,
          fileSize: file.size,
        },
        (pct) => setCertProgress(pct),
      );
      setCertSheets((previousSheets) => [...previousSheets, meta]);
      onProfileSaved?.();

      const trainerName =
        `${String(userData?.firstName || '').trim()} ${String(userData?.lastName || '').trim()}`.trim() ||
        String(userData?.name || onboardingData?.name || auth?.currentUser?.displayName || '').trim() ||
        'Trainer';

      const verifyMessage = await reviewUploadedCertification({
        file,
        meta,
        url,
        trainerId,
        trainerName,
        setCertVerifyBusy,
        setCertVerifyStatus,
      });

      Alert.alert('Certification', verifyMessage);
    } catch (uploadError) {
      Alert.alert('Upload failed', uploadError?.message || 'Could not upload certification. Try again.');
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
    () => fillTraineeProfile(userData, onboardingData),
    [userData, onboardingData],
  );
  const profileDoc = isTrainer ? trainerDoc : clientProfile;

  const displayName = useMemo(() => {
    const signedInUser = auth?.currentUser;
    const first = userData?.firstName ? String(userData.firstName).trim() : '';
    const last = userData?.lastName ? String(userData.lastName).trim() : '';
    const fromUser = `${first} ${last}`.trim();
    const fromDoc = String(clientProfile?.name || onboardingData?.name || '').trim();
    const accountName = signedInUser ? String(signedInUser.displayName || '').trim() : '';
    return (fromUser || fromDoc || accountName || 'Your Profile').trim();
  }, [userData?.firstName, userData?.lastName, clientProfile?.name, onboardingData?.name]);

  const handle = useMemo(() => {
    const raw = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '');
    return `@${raw || 'coachconnect'}`;
  }, [displayName]);

  const profileHeadline = useMemo(() => {
    if (isTrainer) {
      const bioText = String(trainerDoc?.trainerProfileBio || '').trim();
      if (bioText.length > BIO_PREVIEW_MAX_CHARS) return `${bioText.slice(0, BIO_PREVIEW_CUT_CHARS)}…`;
      if (bioText) return bioText;
      return 'Add a short public line about who you are — it appears on your profile.';
    }
    const goalText = String(clientProfile?.primaryGoal || '').trim();
    if (goalText) return showSetupAnswers(goalText, '');
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
      const storageRef = ref(storage, `${PROFILE_PHOTO_FOLDER}/${uid}`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      await setDoc(doc(db, USERS_COLLECTION, uid), { photoURL: downloadURL }, { merge: true });

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

function formatGender(genderValue) {
  const genderText = String(genderValue || '').trim();
  if (!genderText) return '—';
  if (genderText === 'male') return 'Male';
  if (genderText === 'female') return 'Female';
  if (genderText === 'prefer_not_to_say') return 'Prefer not to say';
  return genderText.charAt(0).toUpperCase() + genderText.slice(1);
}

  const formatHeight = (h) => parseHeightForProfile(h).display;

function formatWeight(weightValue) {
  if (weightValue == null || weightValue === '') return '—';
  const weightNumber = Number(weightValue);
  if (Number.isFinite(weightNumber)) return `${weightNumber}`;
  return String(weightValue);
}

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
      const payload = profilePayloadForField(editKey, raw);

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

  // When Profile is rendered as an "overlay screen" (ClientAppStart/TrainerAppStart),
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
      value: showSetupAnswers(clientProfile?.primaryGoal),
    },
    {
      key: 'fitnessLevel',
      profileIconId: 'fitnessLevel',
      label: 'Fitness level',
      value: showSetupAnswers(clientProfile?.fitnessLevel),
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

  React.useEffect(() => {
    setDraftFullName(displayName || '');
    setDraftDisplayName(String(userData?.firstName || displayName || '').trim().split(/\s+/)[0] || '');
  }, [displayName, userData?.firstName]);

  const designLawDetailRows =
    profileTab === 'trainer' && isTrainer
      ? [
          {
            key: 'location',
            label: 'Location',
            value: String(trainerDoc?.location || '').trim() || '—',
          },
          {
            key: 'trainerProfileBio',
            label: 'Public bio',
            value: String(trainerDoc?.trainerProfileBio || '').trim() || '—',
          },
          {
            key: 'yearsExperience',
            label: 'Years coaching',
            value: trainerYearsStat,
          },
          {
            key: 'specialties',
            label: 'Specialties',
            value: formatSpecialtyList(trainerDoc?.specialties),
          },
        ]
      : [
          { key: 'weight', label: 'Weight', value: formatWeight(clientProfile?.weight) },
          { key: 'height', label: 'Height', value: formatHeight(clientProfile?.height) },
          { key: 'gender', label: 'Gender', value: formatGender(clientProfile?.gender) },
          {
            key: 'fitnessLevel',
            label: 'Fitness level',
            value: showSetupAnswers(clientProfile?.fitnessLevel),
          },
          {
            key: 'primaryGoal',
            label: 'Primary goal',
            value: showSetupAnswers(clientProfile?.primaryGoal),
          },
          {
            key: 'equipment',
            label: 'Equipment',
            value: formatEquipmentFromProfile(clientProfile),
          },
          {
            key: 'daysPerWeek',
            label: 'Training frequency',
            value: formatDaysPerWeek(clientProfile?.daysPerWeek),
          },
        ];

  const saveNameFields = async () => {
    const uid = auth?.currentUser?.uid;
    if (!uid) return;
    const full = String(draftFullName || '').trim();
    const parts = full.split(/\s+/).filter(Boolean);
    const first = String(draftDisplayName || parts[0] || '').trim();
    const last = parts.slice(1).join(' ');
    try {
      setSavingField(true);
      await setDoc(
        doc(db, USERS_COLLECTION, uid),
        { name: full, firstName: first, lastName: last, displayName: first },
        { merge: true },
      );
      await onProfileSaved?.();
    } catch (error) {
      Alert.alert('Save failed', error?.message || 'Please try again.');
    } finally {
      setSavingField(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={{ flex: 1 }}>
        <ProfilePageHeader
          title="Edit profile"
          subtitle="Keep your details current for a tailored experience."
          onBack={onBack || nav.home}
          theme={theme}
          topInset={insets.top}
        />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: shellNavInset }]}
          {...FORM_SCROLL_PROPS}
        >
          <ProfileHero
            kicker={isTrainer && profileTab === 'trainer' ? 'TRAINER PROFILE' : 'YOUR PROFILE'}
            name={draftFullName || displayName}
            handle={handle}
            headline={profileHeadline}
            photoURL={photoURL}
            uploading={uploading}
            onPressPhoto={pickAndUploadPhoto}
            theme={theme}
          />

          {/* Design Law 11: Your profile / Trainer profile tabs (trainers only) */}
          {isTrainer ? (
            <View
              style={[
                styles.profileTabs,
                { borderColor: theme.border, backgroundColor: theme.card, shadowColor: theme.shadow },
              ]}
            >
              {[
                { key: 'yours', label: 'Your profile' },
                { key: 'trainer', label: 'Trainer profile' },
              ].map((tab) => {
                const selected = profileTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setProfileTab(tab.key)}
                    style={[
                      styles.profileTabCell,
                      selected ? { backgroundColor: theme.fill } : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.profileTabLabel,
                        { color: selected ? theme.onFill : theme.text },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Text style={[styles.sectionEyebrow, { color: theme.muted }]}>NAME</Text>
          <NbCard style={styles.nameCard}>
            <Text style={[styles.fieldLabel, { color: theme.muted, marginTop: 0 }]}>FULL NAME</Text>
            <TextInput
              value={draftFullName}
              onChangeText={setDraftFullName}
              style={[
                styles.namedInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.bg,
                  shadowColor: theme.shadow,
                },
              ]}
              placeholder="Full name"
              placeholderTextColor={theme.muted}
            />
            <Text style={[styles.fieldLabel, { color: theme.muted }]}>DISPLAY NAME</Text>
            <TextInput
              value={draftDisplayName}
              onChangeText={setDraftDisplayName}
              style={[
                styles.namedInput,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.bg,
                  shadowColor: theme.shadow,
                  marginBottom: 0,
                },
              ]}
              placeholder="Display name"
              placeholderTextColor={theme.muted}
            />
          </NbCard>

          <Text style={[styles.sectionEyebrow, { color: theme.muted }]}>DETAILS</Text>
          <NbCard style={styles.detailCard}>
            {designLawDetailRows.map((item, index) => (
              <View key={item.key}>
                {index > 0 ? (
                  <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />
                ) : null}
                <Pressable
                  onPress={() => openEdit(item.key, item.label, item.value)}
                  style={styles.detailRow}
                >
                  <Text style={[styles.detailLabel, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[styles.detailValue, { color: theme.muted }]} numberOfLines={1}>
                    {item.value}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.muted} />
                </Pressable>
              </View>
            ))}
          </NbCard>

          {/* Save stays primary; Sign out sits under it so Edit profile can leave the session
              without bouncing back through Settings (handler already exists — wire the UI). */}
          <View style={{ marginTop: spacing.md, marginBottom: spacing.lg, gap: spacing.sm }}>
            <NbButton variant="fill" onPress={saveNameFields} disabled={savingField}>
              {savingField ? 'Saving…' : 'Save changes'}
            </NbButton>
            <NbButton variant="ghost" onPress={handleSignOut}>
              Sign out
            </NbButton>
          </View>

          {isTrainer && profileTab === 'trainer' ? (
            <>
              <TrainerStatsStrip
                clientCount={trainerClientCount ?? trainerDoc?.clientCount ?? '—'}
                years={trainerYearsStat}
                rating={trainerRatingStat}
                theme={theme}
              />

              <View style={{ marginBottom: 20 }}>
                <TrainerPaymentCard
                  status={stripeStatus}
                  onPress={typeof onOpenPayments === 'function' ? onOpenPayments : undefined}
                  theme={theme}
                />
              </View>

              <Animated.View style={{ opacity: personalAnim, transform: [{ translateY: personalAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
                <SectionTitle title="PROFILE" theme={theme} />
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
                <SectionTitle title="SPECIALTIES & CERTIFICATIONS" theme={theme} />
                <View style={styles.credRow}>
                  <CredentialPill
                    Icon={Medal}
                    label="CERTIFICATIONS"
                    value={formatCertifications(trainerDoc)}
                    theme={theme}
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
                              backgroundColor: PROFILE.icon,
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

                <SectionTitle title="COACHING PHILOSOPHY" theme={theme} />
                <PhilosophyQuote
                  text={philosophyText}
                  onPress={() => openEdit('trainingPhilosophy', 'COACHING PHILOSOPHY', philosophyText || '—')}
                  theme={theme}
                  isDark={isDark}
                />

                <SectionTitle title="CONTACT & SOCIAL" theme={theme} />
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
                <SectionTitle title="AVAILABILITY & SESSIONS" theme={theme} />
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
          ) : null}
        </ScrollView>
      </View>

      {/* Design Law field editor — bottom sheet, 3px ink, Nb fill/ghost (no gradient Save) */}
      <Modal visible={!!editKey} transparent animationType="slide" onRequestClose={closeEdit}>
        <View style={styles.editOverlay}>
          <Pressable style={styles.editBackdrop} onPress={closeEdit} accessibilityRole="button" accessibilityLabel="Dismiss" />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editKav}>
            <View
              style={[
                styles.editSheet,
                {
                  backgroundColor: isDark ? darkColors.nbSurface : lightColors.nbSurface,
                  borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
                },
              ]}
            >
              <View style={styles.editHandleWrap}>
                <View
                  style={[
                    styles.editHandle,
                    { backgroundColor: isDark ? darkColors.nbBorder : lightColors.nbBorder },
                  ]}
                />
              </View>

              <View style={styles.editSheetTop}>
                <Text
                  style={[
                    styles.editTitle,
                    { color: isDark ? darkColors.nbInk : lightColors.nbInk },
                  ]}
                >
                  {editLabel}
                </Text>
                <TouchableOpacity
                  onPress={closeEdit}
                  activeOpacity={0.85}
                  style={[
                    styles.editCloseBtn,
                    {
                      borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
                      backgroundColor: isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <X size={18} color={isDark ? darkColors.nbInk : lightColors.nbInk} />
                </TouchableOpacity>
              </View>

              <Text
                style={[
                  styles.editFieldLabel,
                  { color: isDark ? darkColors.nbMuted : lightColors.nbMuted },
                ]}
              >
                {String(editLabel || 'VALUE').toUpperCase()}
              </Text>
              <TextInput
                value={editValue}
                onChangeText={setEditValue}
                placeholder={editKey === 'height' ? 'Total inches (e.g. 70)' : 'Enter value'}
                placeholderTextColor={isDark ? darkColors.nbMuted : lightColors.nbMuted}
                keyboardType={
                  editKey === 'height' || editKey === 'weight' || editKey === 'age'
                    ? 'decimal-pad'
                    : 'default'
                }
                multiline={editKey === 'trainerProfileBio' || editKey === 'trainingPhilosophy'}
                numberOfLines={editKey === 'trainingPhilosophy' ? 10 : editKey === 'trainerProfileBio' ? 5 : 1}
                textAlignVertical={
                  editKey === 'trainerProfileBio' || editKey === 'trainingPhilosophy' ? 'top' : 'center'
                }
                style={[
                  styles.editInput,
                  editKey === 'trainerProfileBio' || editKey === 'trainingPhilosophy'
                    ? styles.editInputMultiline
                    : null,
                  {
                    color: isDark ? darkColors.nbInk : lightColors.nbInk,
                    borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
                    backgroundColor: isDark ? darkColors.nbSurface : lightColors.nbSurface,
                  },
                ]}
                autoFocus
              />

              <View style={styles.editActions}>
                <NbButton variant="ghost" onPress={closeEdit} style={styles.editBtnFlex}>
                  Cancel
                </NbButton>
                <NbButton variant="fill" onPress={saveField} disabled={savingField} style={styles.editBtnFlex}>
                  {savingField ? 'Saving…' : 'Save'}
                </NbButton>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {!embedShellBottomNav ? (
        <ShellBottomNavAnchor>
          <BottomMenuBar
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
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: 4, paddingBottom: 140 },

  // Manipulate here: Design Law page header under the status bar
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  backSq: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  backSqSpacer: { width: 44, height: 44 },
  pageHeaderText: { flex: 1, minWidth: 0 },
  pageTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },

  heroCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  heroKicker: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  heroPhotoWrap: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  heroRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: nb.borderWidth,
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  heroPhotoInner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroInitials: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 42,
  },
  heroCamBtn: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  heroName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 26,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  heroHandle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  heroBio: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },

  // Manipulate here: Design Law Edit profile tabs + named fields
  profileTabs: {
    flexDirection: 'row',
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    padding: 4,
    marginBottom: spacing.md,
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  profileTabCell: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  profileTabLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  sectionEyebrow: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginLeft: 2,
  },
  nameCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  fieldLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },
  namedInput: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    borderWidth: nb.borderWidth,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    marginBottom: spacing.md,
    minHeight: 48,
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  detailCard: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginBottom: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: nb.minTouchTarget,
    gap: 10,
  },
  detailLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    flex: 1,
  },
  detailValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    maxWidth: '45%',
    textAlign: 'right',
  },
  detailDivider: {
    height: nb.borderWidthDivider,
    marginHorizontal: spacing.md,
  },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statTile: {
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },

  paymentCard: { borderRadius: 14, overflow: 'hidden', borderWidth: nb.borderWidth },
  paymentCardInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  paymentKicker: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  paymentStatus: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  paymentCta: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  paymentCtaText: { fontSize: 12, fontWeight: '800' },

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
    marginBottom: 10,
    marginTop: 8,
    marginLeft: 4,
  },
  sectionTitleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

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
    backgroundColor: lightColors.white,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  gradSwitchThumbOn: { alignSelf: 'flex-end' },

  editOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  editBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  editKav: {
    width: '100%',
  },
  // Manipulate here: sheet top radius matches Design Law sheet (24)
  editSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    paddingHorizontal: 16,
    paddingBottom: 28,
    paddingTop: 8,
  },
  editHandleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  editHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
  },
  editSheetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  editTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  editCloseBtn: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editFieldLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  editInput: {
    borderWidth: nb.borderWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 16,
    fontWeight: '700',
  },
  editInputMultiline: {
    minHeight: 140,
    paddingTop: 12,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  editBtnFlex: {
    flex: 1,
  },
});

export default ViewMyMyProfileScreen;

