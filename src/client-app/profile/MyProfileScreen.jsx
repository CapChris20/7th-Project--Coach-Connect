// Design Law Edit profile — identity card, Nb list rows, pink→orange accents only.
// Flow: read the signed-in user → edit one field or certification sheet → save to Firestore.
// Used by the client profile stack and the trainer app. userRole "Client" stays that letter.
// Read order: theme helpers → layout pieces → main screen → PLUMBING (cert pick / AI verify).
//
// vocab: syncTrainerMarketplaceDoc = mirrors trainer-facing listing when profile fields change
// vocab: certificationSheets = Storage metadata array on the trainer user doc
// vocab: setDoc merge = write only the keys we pass; other user fields stay untouched
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Pressable, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../../app-start/cloudConnection';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadTrainerCertificationSheet, deleteTrainerCertificationSheet } from '../../for-both/files-and-notes/saveNotesAndFiles';
import { checkTrainerCertificate, certificationStatusLabel, certificationStatusDetail, certificationStatusTone } from '../../for-both/online-connection/checkTrainerCertificate';
import CertificationUploadSheet from './CertificationUploadSheet';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { ShellBottomNavAnchor, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import ProfileIcon from '../../for-both/icons/ProfileIcon';
import { PROFILE_ROW_ICON_SIZE, PROFILE_ROW_ICON_WRAP, profileCardIconWrapStyle } from '../../for-both/profileCardIconSizes';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { onUserSignOut } from '../../logout-cleanup/clearDataOnLogout';
import { syncTrainerMarketplaceDoc } from '../../for-both/trainer-listing/keepTrainerListingUpdated';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbListRow from '../../look-and-feel/NbListRow';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import HardShadow from '../../look-and-feel/HardShadow';
import { Camera, Dumbbell, Pencil, X, User, Mail, Calendar, Ruler, Scale, Target, Building2, Medal, Bell, MapPin, ClipboardList, Video, Sparkles, Star, Users, Wallet, Link2, AtSign } from 'lucide-react-native';
import { showSetupAnswers, formatEquipmentFromProfile, formatDaysPerWeek } from '../../helpers/showSetupAnswers';
import { fillTraineeProfile } from '../../helpers/fillTraineeProfile';
import { lightColors, darkColors, nb, gradients, navAccentGradient, spacing } from '../../look-and-feel/colorPalette';

/**
 * Walk nested keys; stop and return undefined when any step is missing.
 * @param {any} root
 * @param {...(string|number)} keys
 * @returns {any}
 */
function readNestedValue(root, ...keys) {
  let cursor = root;
  for (const key of keys) {
    if (cursor == null) {
      return undefined;
    }
    cursor = cursor[key];
  }
  return cursor;
}

/**
 * Call a function when it exists; otherwise return undefined.
 * @param {Function|null|undefined} maybeFn
 * @param {...any} args
 * @returns {any}
 */
function callIfFunction(maybeFn, ...args) {
  if (typeof maybeFn !== 'function') {
    return undefined;
  }
  return maybeFn(...args);
}

/**
 * Call obj[methodName](...args) when that method exists (keeps `this`).
 * @param {object|null|undefined} objectValue
 * @param {string} methodName
 * @param {...any} args
 * @returns {any}
 */
function callBoundMethodIfPresent(objectValue, methodName, ...args) {
  if (objectValue == null) {
    return undefined;
  }
  const maybeMethod = objectValue[methodName];
  if (typeof maybeMethod !== 'function') {
    return undefined;
  }
  return maybeMethod.apply(objectValue, args);
}


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
const EMPTY_PROFILE_MARK = '—';

// Manipulate here: icon accent only (avatar chips). No green / purple borders.
const PROFILE = {
  accentSoft: '#FB923C',
  icon: '#FB923C',
  borderGradient: navAccentGradient,
  lineGradient: [...navAccentGradient, 'transparent']
};

/** Design Law surface tokens for profile chrome (3px borders live on NbCard / HardShadow). */
function profileThemeFromMode(isDark) {
  const palette = isDark ? darkColors : lightColors;
  return {
    pageBackground: palette.nbBackground,
    surface: palette.nbSurface,
    ink: palette.nbInk,
    muted: palette.nbMuted,
    border: palette.nbBorder,
    hardShadow: palette.nbShadow,
    fill: palette.nbFill,
    onFill: palette.nbOnFill,
    hoverWash: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(10,10,15,0.04)',
    toggleOffTrack: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(10,10,15,0.18)'
  };
}

// ===== HELPER FUNCTIONS =====

function hexToRgba(hex, alpha) {
  const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!hexMatch) return `rgba(255,107,157,${alpha})`;
  return `rgba(${parseInt(hexMatch[1], 16)},${parseInt(hexMatch[2], 16)},${parseInt(hexMatch[3], 16)},${alpha})`;
}
function coerceNumber(valueToParse) {
  if (valueToParse == null || valueToParse === '') return null;
  if (typeof valueToParse === 'number' && Number.isFinite(valueToParse)) {
    return valueToParse;
  }
  if (typeof valueToParse === 'string') {
    const withoutCommas = String(valueToParse).replace(/,/g, '');
    const parsedNumber = parseFloat(withoutCommas);
    if (!Number.isFinite(parsedNumber)) return null;
    return parsedNumber;
  }
  return null;
}
const EMPTY_HEIGHT_PARSE = {
  display: EMPTY_PROFILE_MARK,
  editSeed: '',
  inches: null
};
function heightParseFromNumber(inchesValue) {
  return {
    display: formatInchesAsFeet(inchesValue),
    editSeed: String(inchesValue),
    inches: inchesValue
  };
}
function heightParseFromString(heightText) {
  const parsedInches = coerceNumber(heightText);
  if (parsedInches != null) {
    return {
      display: formatInchesAsFeet(parsedInches),
      editSeed: String(parsedInches),
      inches: parsedInches
    };
  }
  const trimmedHeight = heightText.trim();
  if (trimmedHeight) {
    return {
      display: trimmedHeight,
      editSeed: trimmedHeight,
      inches: null
    };
  }
  return EMPTY_HEIGHT_PARSE;
}
function heightParseFromObject(heightObject) {
  const centimeters = coerceNumber(heightObject.cm ?? heightObject.CM ?? heightObject.centimeters ?? heightObject.cmTotal);
  if (centimeters != null) {
    const inchesFromCm = centimeters / 2.54;
    const roundedInches = Math.round(inchesFromCm * 10) / 10;
    return {
      display: `${centimeters} cm (${formatInchesAsFeet(inchesFromCm)})`,
      editSeed: String(roundedInches),
      inches: inchesFromCm
    };
  }
  const feetPart = coerceNumber(heightObject.feet ?? heightObject.ft ?? heightObject.f);
  const inchesPart = coerceNumber(heightObject.inches ?? heightObject.in ?? heightObject.inch ?? heightObject.ins);
  if (feetPart != null || inchesPart != null) {
    const totalInches = (feetPart ?? 0) * 12 + (inchesPart ?? 0);
    const roundedTotal = Math.round(totalInches * 10) / 10;
    return {
      display: formatInchesAsFeet(totalInches),
      editSeed: String(roundedTotal),
      inches: totalInches
    };
  }
  const totalInchesField = coerceNumber(heightObject.totalInches ?? heightObject.total_inches ?? heightObject.inchesTotal ?? heightObject.value);
  if (totalInchesField != null) {
    return {
      display: formatInchesAsFeet(totalInchesField),
      editSeed: String(totalInchesField),
      inches: totalInchesField
    };
  }
  return EMPTY_HEIGHT_PARSE;
}

/**
 * Height in Firestore may be a number (inches), string, or legacy object shape.
 * Returns display string, seed for the edit field (inches as number string), and total inches if known.
 */
function parseHeightForProfile(heightValue) {
  if (heightValue == null || heightValue === '') return EMPTY_HEIGHT_PARSE;
  if (typeof heightValue === 'number' && Number.isFinite(heightValue)) {
    return heightParseFromNumber(heightValue);
  }
  if (typeof heightValue === 'string') {
    return heightParseFromString(heightValue);
  }
  const isPlainObject = typeof heightValue === 'object' && heightValue !== null && !Array.isArray(heightValue);
  if (isPlainObject) {
    return heightParseFromObject(heightValue);
  }
  return EMPTY_HEIGHT_PARSE;
}
function formatInchesAsFeet(totalInches) {
  if (totalInches == null || !Number.isFinite(totalInches)) return EMPTY_PROFILE_MARK;
  let totalInchesRounded = Math.round(totalInches);
  let feet = Math.floor(totalInchesRounded / 12);
  let inches = totalInchesRounded - feet * 12;
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return `${feet}'${inches}"`;
}
function formatGenderForDisplay(genderValue) {
  const genderText = String(genderValue || '').trim();
  if (!genderText) return EMPTY_PROFILE_MARK;
  if (genderText === 'male') return 'Male';
  if (genderText === 'female') return 'Female';
  if (genderText === 'prefer_not_to_say') return 'Prefer not to say';
  return genderText.charAt(0).toUpperCase() + genderText.slice(1);
}
function formatWeightForDisplay(weightValue) {
  if (weightValue == null || weightValue === '') return EMPTY_PROFILE_MARK;
  const weightNumber = Number(weightValue);
  if (Number.isFinite(weightNumber)) return `${weightNumber}`;
  return String(weightValue);
}
function formatHeightForDisplay(heightValue) {
  return parseHeightForProfile(heightValue).display;
}
function initialsFromName(name) {
  const nameText = String(name || '').trim();
  if (!nameText) return 'CC';
  const nameParts = nameText.split(/\s+/);
  let initials = '';
  for (let index = 0; index < nameParts.length && initials.length < 2; index += 1) {
    const namePart = nameParts[index];
    if (namePart && namePart[0]) {
      initials += namePart[0];
    }
  }
  return initials.toUpperCase();
}

// ===== LAYOUT COMPONENTS =====
// Pure presentation pieces — no hooks; main screen composes them below.

/** Design Law surface panel — NbCard chrome, no purple wash. */
function AccentPanel({
  children,
  style
}) {
  return <NbCard style={[{
    marginBottom: 0,
    padding: spacing.md
  }, style]}>{children}</NbCard>;
}
function GradientIconWrap({
  children,
  size = 40,
  radius = 12,
  style
}) {
  return <LinearGradient colors={navAccentGradient} start={{
    x: 0,
    y: 0
  }} end={{
    x: 1,
    y: 1
  }} style={[{
    width: size,
    height: size,
    borderRadius: radius,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: nb.borderWidth,
    borderColor: lightColors.nbInk
  }, style]}>
      {children}
    </LinearGradient>;
}

/** Design Law section label — uppercase muted, no decorative gradient rail. */
function SectionTitle({
  title,
  theme
}) {
  return <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitleText, {
      color: theme.muted
    }]}>{title}</Text>
    </View>;
}

/**
 * Visual identity hero — big pink→orange avatar ring + name (the page should feel like YOU, not a tax form).
 * Design Law still allows gradient accents on avatars; hard border + hard shadow keep the chrome honest.
 */
function ProfileHero({
  kicker,
  name,
  handle,
  headline,
  photoURL,
  uploading,
  onPressPhoto,
  theme
}) {
  // Manipulate here: avatar ring size (outer / photo)
  const ringSize = 148;
  const photoSize = 132;
  const photoInnerSize = photoSize - 4;
  const hasPhoto = Boolean(photoURL);
  const displayNameText = name || 'Your name';
  const headlineText = String(headline || '').trim();
  const showHeadline = Boolean(headlineText);
  const cameraPressHandler = uploading ? undefined : onPressPhoto;
  const cameraOpacity = uploading ? 0.65 : 1;
  const initialsText = initialsFromName(name);
  let photoOrInitials = <Text style={[styles.heroInitials, {
    color: lightColors.nbInk
  }]}>{initialsText}</Text>;
  if (hasPhoto) {
    photoOrInitials = <Image source={{
      uri: photoURL
    }} style={{
      width: photoInnerSize,
      height: photoInnerSize,
      borderRadius: photoInnerSize / 2
    }} />;
  }
  let cameraButtonInner = <>
      <LinearGradient colors={navAccentGradient} start={{
      x: 0,
      y: 0
    }} end={{
      x: 1,
      y: 1
    }} style={StyleSheet.absoluteFillObject} />
      <Camera size={18} color={lightColors.nbInk} strokeWidth={2.4} />
    </>;
  if (uploading) {
    cameraButtonInner = <ActivityIndicator color={lightColors.nbInk} size="small" />;
  }
  return <NbCard style={styles.heroCard}>
      <Text style={[styles.heroKicker, {
      color: theme.muted
    }]}>{kicker}</Text>
      <View style={styles.heroPhotoWrap}>
        <LinearGradient colors={navAccentGradient} start={{
        x: 0,
        y: 0
      }} end={{
        x: 1,
        y: 1
      }} style={[styles.heroRing, {
        width: ringSize,
        height: ringSize,
        borderRadius: ringSize / 2,
        borderColor: theme.border,
        shadowColor: theme.hardShadow
      }]}>
          <View style={[styles.heroPhotoInner, {
          width: photoSize,
          height: photoSize,
          borderRadius: photoSize / 2,
          backgroundColor: theme.surface
        }]}>
            {photoOrInitials}
          </View>
        </LinearGradient>
        <Pressable onPress={cameraPressHandler} style={[styles.heroCamBtn, {
        opacity: cameraOpacity,
        borderColor: theme.border,
        shadowColor: theme.hardShadow
      }]} accessibilityRole="button" accessibilityLabel="Change profile photo">
          {cameraButtonInner}
        </Pressable>
      </View>
      <Text style={[styles.heroName, {
      color: theme.ink
    }]}>{displayNameText}</Text>
      <Text style={[styles.heroHandle, {
      color: theme.muted
    }]}>{handle}</Text>
      {showHeadline ? <Text style={[styles.heroBio, {
      color: theme.muted
    }]} numberOfLines={3}>
          {headline}
        </Text> : null}
    </NbCard>;
}
function EditChevron({
  theme
}) {
  return <Ionicons name="chevron-forward" size={20} color={theme.muted} />;
}

/** Single grouped card for profile rows — matches app glass panels (no per-field rainbow borders). */
function ProfileSettingsCard({
  children,
  theme,
  isDark
}) {
  return <NbCard style={{
    marginBottom: 28
  }}>
      {children}
    </NbCard>;
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
  showDivider = true
}) {
  const row = <View style={[styles.profileRow, showDivider && styles.profileRowDivider, {
    borderBottomColor: theme.border
  }]}>
      <View style={styles.profileRowLeft}>
        {profileIconId ? <View style={profileCardIconWrapStyle(isDark, {
        wrapSize: PROFILE_ROW_ICON_WRAP
      })}>
            <ProfileIcon itemId={profileIconId} onboardingData={onboardingData} size={PROFILE_ROW_ICON_SIZE} />
          </View> : LeadingIcon ? <View style={[styles.profileRowIcon, {
        backgroundColor: hexToRgba(PROFILE.icon, 0.14)
      }]}>
            <LeadingIcon size={18} color={PROFILE.icon} strokeWidth={2} />
          </View> : null}
        <View style={styles.profileRowText}>
          <Text style={[styles.profileRowLabel, {
          color: theme.muted
        }]}>{label}</Text>
          <Text style={[styles.profileRowValue, {
          color: theme.ink
        }]} numberOfLines={3}>
            {value}
          </Text>
        </View>
      </View>
      {editable ? <EditChevron theme={theme} /> : null}
    </View>;
  if (!editable || !onPress) return row;
  return <Pressable onPress={onPress} style={({
    pressed
  }) => ({
    opacity: pressed ? 0.88 : 1
  })}>
      {row}
    </Pressable>;
}
function InfoField({
  label,
  value,
  onPress,
  editable,
  theme,
  LeadingIcon
}) {
  const body = <View style={styles.infoField}>
      <View style={styles.infoFieldHeader}>
        <Text style={[styles.infoLabel, {
        color: theme.muted,
        flex: 1
      }]}>{label}</Text>
        {editable ? <EditChevron theme={theme} /> : null}
      </View>
      <View style={styles.infoValueRow}>
        {LeadingIcon ? <LeadingIcon size={15} color={PROFILE.icon} style={{
        marginRight: 6
      }} /> : null}
        <Text style={[styles.infoValue, {
        color: theme.ink,
        flex: 1
      }]} numberOfLines={4}>
          {value}
        </Text>
      </View>
    </View>;
  if (!editable || !onPress) return body;
  return <Pressable onPress={onPress} style={({
    pressed
  }) => ({
    opacity: pressed ? 0.88 : 1
  })}>
      {body}
    </Pressable>;
}
function CredentialPill({
  Icon,
  label,
  value,
  theme,
  style
}) {
  return <AccentPanel style={[{
    flex: 1,
    minWidth: '46%'
  }, style]}>
      <View style={styles.credPillInner}>
        <GradientIconWrap size={40} radius={12}>
          <Icon size={20} color={lightColors.nbInk} strokeWidth={2} />
        </GradientIconWrap>
        <View style={{
        flex: 1,
        minWidth: 0
      }}>
          <Text style={[styles.infoLabel, {
          color: theme.muted
        }]}>{label}</Text>
          <Text style={[styles.credPillValue, {
          color: theme.ink
        }]} numberOfLines={2}>
            {value}
          </Text>
        </View>
      </View>
    </AccentPanel>;
}
function PhilosophyQuote({
  text,
  onPress,
  theme
}) {
  const quote = callIfFunction(readNestedValue(text, "trim")) || 'Tap to share how you coach — your voice belongs on your profile.';
  return <Pressable onPress={onPress}>
      <AccentPanel>
        <View style={styles.philosophyInner}>
          <View style={styles.philosophyEditCorner}>
            <EditChevron theme={theme} />
          </View>
          <Text style={[styles.philosophyQuote, {
          color: theme.ink
        }]}>{`\u201C${quote}\u201D`}</Text>
        </View>
      </AccentPanel>
    </Pressable>;
}
function SessionCard({
  Icon,
  label,
  title,
  subtitle,
  theme
}) {
  return <AccentPanel style={{
    marginBottom: 12
  }}>
      <View style={styles.sessionCardInner}>
        <GradientIconWrap size={44} radius={12} style={styles.sessionIconWrap}>
          <Icon size={22} color={lightColors.nbInk} strokeWidth={2} />
        </GradientIconWrap>
        <View style={{
        flex: 1,
        minWidth: 0
      }}>
          <Text style={[styles.infoLabel, {
          color: theme.muted
        }]}>{label}</Text>
          <Text style={[styles.sessionTitle, {
          color: theme.ink
        }]}>{title}</Text>
          {subtitle ? <Text style={[styles.sessionSub, {
          color: theme.muted
        }]}>{subtitle}</Text> : null}
        </View>
      </View>
    </AccentPanel>;
}
function TrainerStatTile({
  Icon,
  value,
  label,
  theme
}) {
  return <HardShadow offset={nb.shadowOffsetSmall} radius={12} style={{
    flex: 1
  }}>
      <View style={[styles.statTile, {
      backgroundColor: theme.surface,
      borderColor: theme.border
    }]}>
        <Icon size={16} color={PROFILE.icon} strokeWidth={2} />
        <Text style={[styles.statValue, {
        color: theme.ink
      }]}>{value}</Text>
        <Text style={[styles.statLabel, {
        color: theme.muted
      }]}>{label}</Text>
      </View>
    </HardShadow>;
}
function TrainerStatsStrip({
  clientCount,
  years,
  rating,
  theme
}) {
  return <View style={styles.statsRow}>
      <TrainerStatTile Icon={Users} value={clientCount ?? '—'} label="Clients" theme={theme} />
      <TrainerStatTile Icon={Calendar} value={years ?? '—'} label="Years" theme={theme} />
      <TrainerStatTile Icon={Star} value={rating ?? 'New'} label="Rating" theme={theme} />
    </View>;
}
function paymentStatusLabel(stripeStatus) {
  if (stripeStatus === 'active') return 'Payouts active';
  if (stripeStatus === 'pending') return 'Verification in progress';
  return 'Complete payout setup';
}
function paymentButtonLabel(stripeStatus) {
  if (stripeStatus === 'active') return 'Manage';
  return 'Set Up';
}

// Entrance fade + slight lift for staggered profile sections.
function fadeUpStyleFromAnim(animValue) {
  return {
    opacity: animValue,
    transform: [{
      translateY: animValue.interpolate({
        inputRange: [0, 1],
        outputRange: [8, 0]
      })
    }]
  };
}
function TrainerPaymentCard({
  status,
  onPress,
  theme
}) {
  const label = paymentStatusLabel(status);
  const cta = paymentButtonLabel(status);
  // Design Law: solid fill card — no gradient Save / payment block
  return <Pressable onPress={onPress} disabled={!onPress}>
      <NbCard style={[styles.paymentCard, {
      backgroundColor: theme.fill,
      borderColor: theme.border
    }]}>
        <View style={styles.paymentCardInner}>
          <Wallet size={18} color={theme.onFill} strokeWidth={2} />
          <View style={{
          flex: 1,
          marginLeft: 10
        }}>
            <Text style={[styles.paymentKicker, {
            color: theme.onFill
          }]}>PAYMENTS</Text>
            <Text style={[styles.paymentStatus, {
            color: theme.onFill
          }]}>{label}</Text>
          </View>
          {onPress ? <View style={[styles.paymentCta, {
          borderColor: theme.onFill
        }]}>
              <Text style={[styles.paymentCtaText, {
            color: theme.onFill
          }]}>{cta}</Text>
            </View> : null}
        </View>
      </NbCard>
    </Pressable>;
}
function TrainerContactRow({
  label,
  value,
  Icon,
  onPress,
  editable,
  theme
}) {
  const row = <View style={[styles.contactRow, {
    borderBottomColor: theme.border
  }]}>
      <Icon size={16} color={PROFILE.icon} strokeWidth={2} />
      <View style={{
      flex: 1,
      marginLeft: 10
    }}>
        <Text style={[styles.infoLabel, {
        color: theme.muted
      }]}>{label}</Text>
        <Text style={[styles.contactValue, {
        color: theme.ink
      }]} numberOfLines={2}>
          {value || '—'}
        </Text>
      </View>
      {editable ? <EditChevron theme={theme} /> : null}
    </View>;
  if (!editable || !onPress) return row;
  return <Pressable onPress={onPress} style={({
    pressed
  }) => ({
    opacity: pressed ? 0.88 : 1
  })}>
      {row}
    </Pressable>;
}
const YEARS_COACHING_LABELS = {
  less_than_1: 'Less than 1 year',
  '1_2': '1–2 years',
  '3_5': '3–5 years',
  '6_10': '6–10 years',
  '10_plus': '10+ years'
};
function formatYearsCoaching(yearsValue) {
  if (yearsValue == null || yearsValue === '') return '—';
  const yearsKey = String(yearsValue);
  return YEARS_COACHING_LABELS[yearsKey] || yearsKey.replace(/_/g, ' ');
}
function formatSpecialtyList(specialtyList) {
  if (!Array.isArray(specialtyList) || specialtyList.length === 0) return '—';
  const labeled = [];
  for (let index = 0; index < specialtyList.length; index += 1) {
    const specialty = specialtyList[index];
    const spaced = String(specialty || '').replace(/_/g, ' ');
    const titled = spaced.replace(/\b\w/g, letter => letter.toUpperCase());
    labeled.push(titled);
  }
  return labeled.join(', ');
}
function formatCertifications(data) {
  const certificationList = Array.isArray(readNestedValue(data, "certifications")) ? [...data.certifications] : [];
  const otherCertification = String(readNestedValue(data, "certificationOther") || '').trim();
  const listHasOther = certificationList.includes('Other');
  if (listHasOther && otherCertification) {
    const withoutOtherLabel = certificationList.filter(certName => certName !== 'Other');
    const mergedList = withoutOtherLabel.concat(otherCertification);
    if (mergedList.length) return mergedList.join(', ');
    return otherCertification;
  }
  if (certificationList.length) return certificationList.join(', ');
  return '—';
}
function formatAvailability(status) {
  if (status === 'available') return 'Available — accepting new clients';
  if (status === 'waitlist') return 'Waitlist — currently full';
  return status ? String(status).replace(/_/g, ' ') : '—';
}
const NUMBER_PROFILE_FIELDS = ['height', 'weight', 'age', 'daysPerWeek'];
function genderFromTypedText(typedText) {
  if (typedText === '') return null;
  const genderSlug = typedText.toLowerCase().replace(/\s+/g, '_').replace(/'/g, '');
  if (genderSlug === 'male' || genderSlug === 'm') return 'male';
  if (genderSlug === 'female' || genderSlug === 'f') return 'female';
  if (genderSlug === 'other') return 'other';
  if (genderSlug === 'prefer_not_to_say' || genderSlug === 'prefernottosay') {
    return 'prefer_not_to_say';
  }
  return typedText;
}
function numberFromTypedText(typedText) {
  if (typedText === '') return null;
  const numericValue = Number(typedText);
  if (!Number.isFinite(numericValue)) return null;
  return numericValue;
}
function equipmentFromTypedText(typedText) {
  const rawPieces = typedText.split(',');
  const equipmentParts = [];
  for (let index = 0; index < rawPieces.length; index += 1) {
    const cleaned = rawPieces[index].trim().toLowerCase().replace(/\s+/g, '_');
    if (cleaned) {
      equipmentParts.push(cleaned);
    }
  }
  if (!equipmentParts.length) {
    return {
      equipmentAccess: null,
      equipment: null
    };
  }
  return {
    equipmentAccess: equipmentParts,
    equipment: equipmentParts.join(', ')
  };
}
function profilePayloadForField(editKey, typedText) {
  const payload = {
    updatedAt: new Date().toISOString()
  };
  if (editKey === 'name') {
    let trimmedName = typedText;
    if (typedText === '') trimmedName = null;
    const nameParts = trimmedName ? trimmedName.split(/\s+/).filter(Boolean) : [];
    payload.name = trimmedName;
    payload.firstName = nameParts[0] || '';
    payload.lastName = nameParts.slice(1).join(' ') || '';
    return payload;
  }
  if (editKey === 'gender') {
    payload.gender = genderFromTypedText(typedText);
    return payload;
  }
  if (NUMBER_PROFILE_FIELDS.includes(editKey)) {
    payload[editKey] = numberFromTypedText(typedText);
    return payload;
  }
  if (editKey === 'equipment') {
    return {
      ...payload,
      ...equipmentFromTypedText(typedText)
    };
  }
  if (typedText === '') {
    payload[editKey] = null;
    return payload;
  }
  payload[editKey] = typedText;
  return payload;
}

/**
 * Seed text for the edit sheet from the live profile / trainer docs.
 * Field letters (height, name, instagram, …) stay as the sheet already uses them.
 */
function editSeedForProfileKey(key, profileDoc, trainerDoc, userData) {
  if (key === 'height') return parseHeightForProfile(readNestedValue(profileDoc, "height")).editSeed;
  if (key === 'name') {
    const firstName = readNestedValue(userData, "firstName") != null ? String(userData.firstName).trim() : '';
    const lastName = readNestedValue(userData, "lastName") != null ? String(userData.lastName).trim() : '';
    const combinedName = `${firstName} ${lastName}`.trim();
    if (combinedName) return combinedName;
    return String(readNestedValue(profileDoc, "name") || '').trim();
  }
  if (key === 'location') return String(readNestedValue(trainerDoc, "location") || '').trim();
  if (key === 'trainerProfileBio') return String(readNestedValue(trainerDoc, "trainerProfileBio") || '').trim();
  if (key === 'instagram') {
    return String(readNestedValue(trainerDoc, "instagram") || readNestedValue(trainerDoc, "instagramHandle") || '').trim();
  }
  if (key === 'website') {
    return String(readNestedValue(trainerDoc, "website") || readNestedValue(trainerDoc, "websiteUrl") || '').trim();
  }
  if (key === 'trainingPhilosophy') return String(readNestedValue(trainerDoc, "trainingPhilosophy") || '').trim();
  if (key === 'primaryGoal') return String(readNestedValue(profileDoc, "primaryGoal") || '').trim();
  if (key === 'fitnessLevel') return String(readNestedValue(profileDoc, "fitnessLevel") || '').trim();
  if (key === 'daysPerWeek') {
    return readNestedValue(profileDoc, "daysPerWeek") != null ? String(profileDoc.daysPerWeek) : '';
  }
  if (key === 'equipment') {
    const equipmentList = readNestedValue(profileDoc, "equipmentAccess");
    if (Array.isArray(equipmentList) && equipmentList.length) return equipmentList.join(', ');
    return String(readNestedValue(profileDoc, "equipment") || '').trim();
  }
  return '';
}
const EDIT_KEYS_THAT_USE_SEED = ['height', 'name', 'primaryGoal', 'fitnessLevel', 'equipment', 'daysPerWeek'];

// ===== MAIN FUNCTION =====

/**
 * Edit profile — client and trainer layouts share this screen; role picks which sections render.
 * @param {{
 *   isDark?: boolean,
 *   onBack?: Function,
 *   embedShellBottomNav?: boolean,
 *   onNavigate?: Function,
 *   onHomePress?: Function,
 *   onPlusPress?: Function,
 *   onVoicePress?: Function,
 *   onNutritionPress?: Function,
 *   onWorkoutPress?: Function,
 *   onMessagesPress?: Function,
 *   onProfilePress?: Function,
 *   userRole?: string,
 *   userData?: object,
 *   onboardingData?: object,
 *   onProfileSaved?: Function,
 *   onOpenPayments?: Function,
 *   trainerClientCount?: number,
 * }} props
 */

function buildProfileTabButtons(profileTab, theme, setProfileTab) {
  const tabs = [
    { key: 'yours', label: 'Your profile' },
    { key: 'trainer', label: 'Trainer profile' },
  ];
  const buttons = [];
  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index];
    const selected = profileTab === tab.key;
    const selectedStyle = selected ? { backgroundColor: theme.fill } : null;
    const labelColor = selected ? theme.onFill : theme.ink;
    buttons.push(
      <Pressable
        key={tab.key}
        onPress={() => setProfileTab(tab.key)}
        style={[styles.profileTabCell, selectedStyle]}
      >
        <Text style={[styles.profileTabLabel, { color: labelColor }]}>{tab.label}</Text>
      </Pressable>,
    );
  }
  return buttons;
}

function buildDesignLawDetailRows(designLawDetailRows, theme, openEdit) {
  const rows = [];
  for (let index = 0; index < designLawDetailRows.length; index += 1) {
    const item = designLawDetailRows[index];
    let divider = null;
    if (index > 0) {
      divider = <View style={[styles.detailDivider, { backgroundColor: theme.border }]} />;
    }
    rows.push(
      <View key={item.key}>
        {divider}
        <Pressable
          onPress={() => openEdit(item.key, item.label, item.value)}
          style={styles.detailRow}
        >
          <Text style={[styles.detailLabel, { color: theme.ink }]}>{item.label}</Text>
          <Text style={[styles.detailValue, { color: theme.muted }]} numberOfLines={1}>
            {item.value}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </Pressable>
      </View>,
    );
  }
  return rows;
}

function buildTrainerProfessionalRows(trainerProfessionalPills, theme, isDark, openEdit) {
  const rows = [];
  for (let index = 0; index < trainerProfessionalPills.length; index += 1) {
    const item = trainerProfessionalPills[index];
    const rowIsReadOnly = Boolean(item.readOnly);
    let rowPressHandler = undefined;
    if (!rowIsReadOnly) {
      rowPressHandler = () => openEdit(item.key, item.label, item.value);
    }
    const showRowDivider = item.key !== 'trainerProfileBio';
    rows.push(
      <ProfileRow
        key={item.key}
        label={item.label}
        value={item.value}
        editable={!rowIsReadOnly}
        onPress={rowPressHandler}
        theme={theme}
        isDark={isDark}
        LeadingIcon={item.Icon}
        showDivider={showRowDivider}
      />,
    );
  }
  return rows;
}

function buildCertificationSheetRows(certSheets, theme, handleDeleteCertification) {
  const rows = [];
  for (let index = 0; index < certSheets.length; index += 1) {
    const sheet = certSheets[index];
    const rowKey = sheet.storagePath || sheet.fileName;
    let uploadedLabel = '';
    if (sheet.uploadedAt) {
      uploadedLabel = ` · ${String(sheet.uploadedAt).slice(0, 10)}`;
    }
    rows.push(
      <View
        key={rowKey}
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
          <Text style={{ color: theme.ink, fontWeight: '600', fontSize: 13 }} numberOfLines={1}>
            {sheet.fileName || 'Certification'}
          </Text>
          <Text style={{ color: theme.muted, fontSize: 11 }} numberOfLines={1}>
            {sheet.fileType || 'file'}
            {uploadedLabel}
          </Text>
        </View>
        <TouchableOpacity onPress={() => handleDeleteCertification(sheet)} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>,
    );
  }
  return rows;
}

/**
 * Client profile screen layout and editing form.
 * @param {object} props
 * @returns {React.ReactElement}
 */
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
  trainerClientCount
}) {
  const isTrainer = String(userRole || '').toLowerCase() === 'trainer';
  const {
    isDark: themeIsDark
  } = useTheme();
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
    // Keep the hero photo in sync with Firestore / auth whenever those URLs change.
    const photoFromDocs = readNestedValue(onboardingData, "photoURL") || readNestedValue(userData, "photoURL") || readNestedValue(auth, "currentUser", "photoURL");
    setPhotoURL(photoFromDocs || null);
  }, [readNestedValue(onboardingData, "photoURL"), readNestedValue(userData, "photoURL"), readNestedValue(auth, "currentUser", "photoURL")]);
  const [editKey, setEditKey] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValue, setEditValue] = useState('');
  const [savingField, setSavingField] = useState(false);
  const [certSheets, setCertSheets] = useState([]);
  const [certUploading, setCertUploading] = useState(false);
  const [certProgress, setCertProgress] = useState(0);
  const [certVerifyStatus, setCertVerifyStatus] = useState(null); // local + live status key
  const [certVerifyBusy, setCertVerifyBusy] = useState(false);
  const [certSheetOpen, setCertSheetOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message, extras = {}) => setNotice({
    title,
    message,
    ...extras
  });

  // Subtle entrance animations (fade + slight lift)
  const heroAnim = useMemo(() => new Animated.Value(0), []);
  const personalAnim = useMemo(() => new Animated.Value(0), []);
  const trainingAnim = useMemo(() => new Animated.Value(0), []);
  const accountAnim = useMemo(() => new Animated.Value(0), []);
  React.useEffect(() => {
    Animated.stagger(ENTRANCE_STAGGER_MS, [Animated.timing(heroAnim, {
      toValue: 1,
      duration: ENTRANCE_FADE_MS,
      useNativeDriver: true
    }), Animated.timing(personalAnim, {
      toValue: 1,
      duration: ENTRANCE_FADE_MS,
      useNativeDriver: true
    }), Animated.timing(trainingAnim, {
      toValue: 1,
      duration: ENTRANCE_FADE_MS,
      useNativeDriver: true
    }), Animated.timing(accountAnim, {
      toValue: 1,
      duration: ENTRANCE_FADE_MS,
      useNativeDriver: true
    })]).start();
  }, [heroAnim, personalAnim, trainingAnim, accountAnim]);
  const trainerDoc = useMemo(() => ({
    ...(userData || {}),
    ...(onboardingData || {})
  }), [userData, onboardingData]);
  React.useEffect(() => {
    if (!isTrainer) return;
    const sheetsFromDoc = Array.isArray(readNestedValue(trainerDoc, "certificationSheets")) ? trainerDoc.certificationSheets : [];
    setCertSheets(sheetsFromDoc);
  }, [isTrainer, readNestedValue(trainerDoc, "certificationSheets")]);
  React.useEffect(() => {
    if (!isTrainer || certVerifyBusy) return;
    const statusFromDoc = readNestedValue(trainerDoc, "certificationVerificationStatus") || readNestedValue(trainerDoc, "aiVerification", "status") || null;
    if (statusFromDoc) setCertVerifyStatus(String(statusFromDoc));
  }, [isTrainer, certVerifyBusy, readNestedValue(trainerDoc, "certificationVerificationStatus"), readNestedValue(trainerDoc, "aiVerification", "status")]);
  const handleAddCertification = async () => {
    // 1. Fail fast when signed out.
    const trainerId = readNestedValue(auth, "currentUser", "uid");
    if (!trainerId) {
      showNotice('Sign in required', 'Sign in again to upload certifications.');
      return;
    }
    try {
      // 2. Pick a PDF/image ≤ 10MB (picker shows its own notices on failure).
      const file = await pickCertificationFile(showNotice);
      if (!file) return;

      // 3. Upload to Storage and append sheet metadata on the trainer user doc.
      setCertSheetOpen(true);
      setCertUploading(true);
      setCertProgress(0);
      const {
        meta,
        url
      } = await uploadTrainerCertificationSheet(trainerId, {
        localUri: file.uri,
        filename: file.name || 'certification.pdf',
        mimeType: file.mimeType,
        fileSize: file.size
      }, percentComplete => setCertProgress(percentComplete));
      setCertSheets(previousSheets => [...previousSheets, meta]);
      callIfFunction(onProfileSaved);

      // 4. AI-verify images; other types get the manual-review copy.
      const trainerNameFromParts = `${String(readNestedValue(userData, "firstName") || '').trim()} ${String(readNestedValue(userData, "lastName") || '').trim()}`.trim();
      const trainerNameFallback = String(readNestedValue(userData, "name") || readNestedValue(onboardingData, "name") || readNestedValue(auth, "currentUser", "displayName") || '').trim();
      const trainerName = trainerNameFromParts || trainerNameFallback || 'Trainer';
      const verifyMessage = await reviewUploadedCertification({
        file,
        meta,
        url,
        trainerId,
        trainerName,
        setCertVerifyBusy,
        setCertVerifyStatus
      });
      showNotice('Certification', verifyMessage);
      setCertSheetOpen(false);
    } catch (uploadError) {
      showNotice('Upload failed', readNestedValue(uploadError, "message") || 'Could not upload certification. Try again.');
    } finally {
      setCertUploading(false);
      setCertProgress(0);
    }
  };
  const handleDeleteCertification = sheetMeta => {
    showNotice('Remove certification', `Delete ${readNestedValue(sheetMeta, "fileName") || 'this file'}?`, {
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        // 1. Need a signed-in trainer before Storage delete.
        const trainerId = readNestedValue(auth, "currentUser", "uid");
        if (!trainerId) return;
        try {
          // 2. Remove the Storage object + metadata, then drop it from local state.
          await deleteTrainerCertificationSheet(trainerId, sheetMeta);
          setCertSheets(previousSheets => previousSheets.filter(sheet => sheet.storagePath !== sheetMeta.storagePath));
          callIfFunction(onProfileSaved);
        } catch (deleteError) {
          showNotice('Delete failed', readNestedValue(deleteError, "message") || 'Could not remove file.');
        }
      }
    });
  };
  const clientProfile = useMemo(() => fillTraineeProfile(userData, onboardingData), [userData, onboardingData]);
  const profileDoc = isTrainer ? trainerDoc : clientProfile;
  const displayName = useMemo(() => {
    const signedInUser = readNestedValue(auth, "currentUser");
    let firstNameText = '';
    if (readNestedValue(userData, "firstName")) firstNameText = String(userData.firstName).trim();
    let lastNameText = '';
    if (readNestedValue(userData, "lastName")) lastNameText = String(userData.lastName).trim();
    const nameFromUserParts = `${firstNameText} ${lastNameText}`.trim();
    const nameFromProfileDoc = String(readNestedValue(clientProfile, "name") || readNestedValue(onboardingData, "name") || '').trim();
    let nameFromAuthAccount = '';
    if (signedInUser) {
      nameFromAuthAccount = String(signedInUser.displayName || '').trim();
    }
    if (nameFromUserParts) return nameFromUserParts;
    if (nameFromProfileDoc) return nameFromProfileDoc;
    if (nameFromAuthAccount) return nameFromAuthAccount;
    return 'Your Profile';
  }, [readNestedValue(userData, "firstName"), readNestedValue(userData, "lastName"), readNestedValue(clientProfile, "name"), readNestedValue(onboardingData, "name")]);
  const handle = useMemo(() => {
    const handleSlug = displayName.toLowerCase().replace(/\s+/g, '_').replace(/[^\w_]/g, '');
    if (handleSlug) return `@${handleSlug}`;
    return '@coachconnect';
  }, [displayName]);
  const profileHeadline = useMemo(() => {
    if (isTrainer) {
      const bioText = String(readNestedValue(trainerDoc, "trainerProfileBio") || '').trim();
      if (bioText.length > BIO_PREVIEW_MAX_CHARS) {
        return `${bioText.slice(0, BIO_PREVIEW_CUT_CHARS)}…`;
      }
      if (bioText) return bioText;
      return 'Add a short public line about who you are — it appears on your profile.';
    }
    const goalText = String(readNestedValue(clientProfile, "primaryGoal") || '').trim();
    if (goalText) return showSetupAnswers(goalText, '');
    return 'Keep your details current for a tailored experience.';
  }, [isTrainer, readNestedValue(trainerDoc, "trainerProfileBio"), readNestedValue(clientProfile, "primaryGoal"), readNestedValue(onboardingData, "primaryGoal")]);
  const handleSignOut = () => {
    showNotice('Sign Out', 'Are you sure you want to sign out?', {
      cancelLabel: 'Cancel',
      confirmLabel: 'Sign Out',
      destructive: true,
      onConfirm: async () => {
        try {
          await onUserSignOut();
          await signOut(auth);
        } catch (error) {
          console.error('Sign out error:', error);
          showNotice('Error', readNestedValue(error, "message") || 'Failed to sign out.');
        }
      }
    });
  };

  // Photo flow: library permission → crop picker → Storage users/{uid} → merge user doc + marketplace.
  const pickAndUploadPhoto = async () => {
    // 1. Fail fast when signed out or already uploading.
    const userId = readNestedValue(auth, "currentUser", "uid");
    if (!userId || uploading) return;
    try {
      // 2. Ask for photo-library permission before opening the picker.
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showNotice('Permission required', 'Please allow photo library access to change your profile picture.');
        return;
      }

      // 3. Let the user crop a square photo.
      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75
      });
      if (pickerResult.canceled || !readNestedValue(pickerResult, "assets", 0, "uri")) return;

      // 4. Upload bytes to Storage profile_photos/{uid}, then merge photoURL on the users doc.
      setUploading(true);
      const localPhotoUri = pickerResult.assets[0].uri;
      const photoResponse = await fetch(localPhotoUri);
      const photoBlob = await photoResponse.blob();
      const storage = getStorage();
      const storageRef = ref(storage, `${PROFILE_PHOTO_FOLDER}/${userId}`);
      await uploadBytes(storageRef, photoBlob);
      const downloadURL = await getDownloadURL(storageRef);
      await setDoc(doc(db, USERS_COLLECTION, userId), {
        photoURL: downloadURL
      }, {
        merge: true
      });
      try {
        await syncTrainerMarketplaceDoc(db, userId, {
          patch: {
            photoURL: downloadURL,
            avatarUrl: downloadURL,
            photoUrl: downloadURL
          },
          forceTrainer: isTrainer
        });
      } catch (syncError) {
        console.warn('Trainer marketplace photo sync failed:', readNestedValue(syncError, "message") || syncError);
      }
      setPhotoURL(downloadURL);
    } catch (uploadError) {
      console.error('Profile photo update failed:', uploadError);
      showNotice('Upload failed', readNestedValue(uploadError, "message") || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };
  const openEdit = (key, label, currentDisplay) => {
    // 1. Remember which field the sheet is editing.
    setEditKey(key);
    setEditLabel(label);

    // 2. Prefer a typed seed (inches, equipment list) over the pretty display string.
    if (EDIT_KEYS_THAT_USE_SEED.includes(key)) {
      setEditValue(editSeedForProfileKey(key, profileDoc, trainerDoc, userData));
      return;
    }

    // 3. Otherwise start from whatever the row showed (blank if it was the empty mark).
    const displayLooksEmpty = currentDisplay == null || currentDisplay === EMPTY_PROFILE_MARK;
    setEditValue(displayLooksEmpty ? '' : String(currentDisplay));
  };
  const closeEdit = () => {
    setEditKey(null);
    setEditLabel('');
    setEditValue('');
    setSavingField(false);
  };

  // Modal editor save — build payload per editKey letter, merge users doc, sync marketplace when trainer.
  const saveField = async () => {
    // 1. Need a signed-in user and an open edit key.
    const userId = readNestedValue(auth, "currentUser", "uid");
    if (!userId || !editKey) return;
    try {
      setSavingField(true);
      // 2. Build the Firestore payload for this field letter (name splits first/last, etc.).
      const typedText = String(editValue ?? '').trim();
      const payload = profilePayloadForField(editKey, typedText);

      // 3. Merge onto users/{uid}. Field letters stay as profilePayloadForField wrote them.
      await setDoc(doc(db, 'users', userId), payload, {
        merge: true
      });
      try {
        await syncTrainerMarketplaceDoc(db, userId, {
          patch: payload,
          forceTrainer: isTrainer
        });
      } catch (syncError) {
        console.warn('Trainer marketplace sync failed:', readNestedValue(syncError, "message") || syncError);
      }

      // 4. Tell the shell to refetch, then close the sheet.
      await callIfFunction(onProfileSaved);
      closeEdit();
    } catch (saveError) {
      console.error('Failed saving profile field:', saveError);
      showNotice('Save failed', readNestedValue(saveError, "message") || 'Please try again.');
      setSavingField(false);
    }
  };

  // When Profile is rendered as an "overlay screen" (ClientAppStart/TrainerAppStart),
  // those apps often short-circuit render on `showProfile`, so we need to
  // route via `onNavigate` to ensure `handleHomePress()` clears showProfile.
  const nav = useMemo(() => {
    const navigateToScreen = screen => typeof onNavigate === 'function' ? onNavigate(screen) : null;
    return {
      home: () => typeof onHomePress === 'function' ? onHomePress() : navigateToScreen('home'),
      create: () => typeof onPlusPress === 'function' ? onPlusPress() : navigateToScreen('create'),
      ai: () => typeof onVoicePress === 'function' ? onVoicePress() : navigateToScreen('voice'),
      nutrition: () => typeof onNutritionPress === 'function' ? onNutritionPress() : navigateToScreen('nutrition'),
      workout: () => typeof onWorkoutPress === 'function' ? onWorkoutPress() : navigateToScreen('workout'),
      messages: () => typeof onMessagesPress === 'function' ? onMessagesPress() : navigateToScreen('messages'),
      profile: () => typeof onProfilePress === 'function' ? onProfilePress() : navigateToScreen('profile'),
      settings: () => navigateToScreen('settings')
    };
  }, [onNavigate, onHomePress, onPlusPress, onVoicePress, onNutritionPress, onWorkoutPress, onMessagesPress, onProfilePress]);
  const email = readNestedValue(auth, "currentUser", "email") || readNestedValue(clientProfile, "email") || readNestedValue(onboardingData, "email") || '—';
  const personalData = [{
    key: 'name',
    Icon: User,
    value: displayName || '—',
    label: 'Full name'
  }, {
    key: 'email',
    Icon: Mail,
    value: String(email || '—'),
    label: 'Email',
    readOnly: true
  }, {
    key: 'age',
    profileIconId: 'age',
    value: readNestedValue(clientProfile, "age") != null ? String(clientProfile.age) : '—',
    label: 'Age'
  }, {
    key: 'height',
    profileIconId: 'height',
    value: formatHeightForDisplay(readNestedValue(clientProfile, "height")),
    label: 'Height'
  }, {
    key: 'weight',
    profileIconId: 'weight',
    value: formatWeightForDisplay(readNestedValue(clientProfile, "weight")),
    label: 'Weight'
  }, {
    key: 'gender',
    profileIconId: 'gender',
    value: formatGenderForDisplay(readNestedValue(clientProfile, "gender")),
    label: 'Gender'
  }];
  const trainingPreferences = [{
    key: 'primaryGoal',
    profileIconId: 'goal',
    label: 'Primary goal',
    value: showSetupAnswers(readNestedValue(clientProfile, "primaryGoal"))
  }, {
    key: 'fitnessLevel',
    profileIconId: 'fitnessLevel',
    label: 'Fitness level',
    value: showSetupAnswers(readNestedValue(clientProfile, "fitnessLevel"))
  }, {
    key: 'daysPerWeek',
    profileIconId: 'frequency',
    label: 'Training frequency',
    value: formatDaysPerWeek(readNestedValue(clientProfile, "daysPerWeek"))
  }, {
    key: 'equipment',
    profileIconId: 'equipment',
    label: 'Equipment',
    value: formatEquipmentFromProfile(clientProfile)
  }];
  const trainerProfessionalPills = [{
    key: 'name',
    Icon: User,
    value: displayName || '—',
    label: 'DISPLAY NAME'
  }, {
    key: 'email',
    Icon: Mail,
    value: String(email || '—'),
    label: 'EMAIL',
    readOnly: true
  }, {
    key: 'location',
    Icon: MapPin,
    value: String(readNestedValue(trainerDoc, "location") || '').trim() || '—',
    label: 'CITY / REGION'
  }, {
    key: 'trainerProfileBio',
    Icon: ClipboardList,
    value: String(readNestedValue(trainerDoc, "trainerProfileBio") || '').trim() || '—',
    label: 'PUBLIC BIO'
  }];
  const philosophyText = String(readNestedValue(trainerDoc, "trainingPhilosophy") || '').trim();
  const availabilityTitle = formatAvailability(readNestedValue(trainerDoc, "trainerAvailabilityStatus"));
  const sessionTitle = String(readNestedValue(trainerDoc, "sessionType") || '—').trim() || '—';
  const stripeStatus = readNestedValue(trainerDoc, "stripeConnectStatus") || 'not_connected';
  const trainerYearsStat = formatYearsCoaching(readNestedValue(trainerDoc, "yearsExperience"));
  const trainerRatingStat = readNestedValue(trainerDoc, "averageRating") != null ? Number(trainerDoc.averageRating).toFixed(1) : null;
  const instagram = String(readNestedValue(trainerDoc, "instagram") || readNestedValue(trainerDoc, "instagramHandle") || '').trim();
  const website = String(readNestedValue(trainerDoc, "website") || readNestedValue(trainerDoc, "websiteUrl") || '').trim();
  React.useEffect(() => {
    setDraftFullName(displayName || '');
    setDraftDisplayName(String(readNestedValue(userData, "firstName") || displayName || '').trim().split(/\s+/)[0] || '');
  }, [displayName, readNestedValue(userData, "firstName")]);
  const designLawDetailRows = profileTab === 'trainer' && isTrainer ? [{
    key: 'location',
    label: 'Location',
    value: String(readNestedValue(trainerDoc, "location") || '').trim() || '—'
  }, {
    key: 'trainerProfileBio',
    label: 'Public bio',
    value: String(readNestedValue(trainerDoc, "trainerProfileBio") || '').trim() || '—'
  }, {
    key: 'yearsExperience',
    label: 'Years coaching',
    value: trainerYearsStat
  }, {
    key: 'specialties',
    label: 'Specialties',
    value: formatSpecialtyList(readNestedValue(trainerDoc, "specialties"))
  }] : [{
    key: 'weight',
    label: 'Weight',
    value: formatWeightForDisplay(readNestedValue(clientProfile, "weight"))
  }, {
    key: 'height',
    label: 'Height',
    value: formatHeightForDisplay(readNestedValue(clientProfile, "height"))
  }, {
    key: 'gender',
    label: 'Gender',
    value: formatGenderForDisplay(readNestedValue(clientProfile, "gender"))
  }, {
    key: 'fitnessLevel',
    label: 'Fitness level',
    value: showSetupAnswers(readNestedValue(clientProfile, "fitnessLevel"))
  }, {
    key: 'primaryGoal',
    label: 'Primary goal',
    value: showSetupAnswers(readNestedValue(clientProfile, "primaryGoal"))
  }, {
    key: 'equipment',
    label: 'Equipment',
    value: formatEquipmentFromProfile(clientProfile)
  }, {
    key: 'daysPerWeek',
    label: 'Training frequency',
    value: formatDaysPerWeek(readNestedValue(clientProfile, "daysPerWeek"))
  }];
  const saveNameFields = async () => {
    // 1. Need a signed-in user.
    const userId = readNestedValue(auth, "currentUser", "uid");
    if (!userId) return;

    // 2. Split full name into first + last; display name defaults to first token.
    const fullName = String(draftFullName || '').trim();
    const nameParts = fullName.split(/\s+/).filter(Boolean);
    const firstName = String(draftDisplayName || nameParts[0] || '').trim();
    const lastName = nameParts.slice(1).join(' ');
    try {
      setSavingField(true);
      // 3. Write name / firstName / lastName / displayName together.
      await setDoc(doc(db, USERS_COLLECTION, userId), {
        name: fullName,
        firstName,
        lastName,
        displayName: firstName
      }, {
        merge: true
      });
      await callIfFunction(onProfileSaved);
    } catch (saveError) {
      showNotice('Save failed', readNestedValue(saveError, "message") || 'Please try again.');
    } finally {
      setSavingField(false);
    }
  };

  // Named decisions for the Design Law page (hero kicker, back target, save label).
  const heroKickerLabel = isTrainer && profileTab === 'trainer' ? 'TRAINER PROFILE' : 'YOUR PROFILE';
  const heroDisplayName = draftFullName || displayName;
  const backHandler = onBack || nav.home;
  const saveButtonLabel = savingField ? 'Saving…' : 'Save changes';
  const showTrainerExtraSections = isTrainer && profileTab === 'trainer';
  const paymentPressHandler = typeof onOpenPayments === 'function' ? onOpenPayments : undefined;
  const trainerClientCountDisplay = trainerClientCount ?? readNestedValue(trainerDoc, "clientCount") ?? EMPTY_PROFILE_MARK;
  let instagramDisplay = 'Add your handle';
  if (instagram) {
    instagramDisplay = instagram.startsWith('@') ? instagram : `@${instagram}`;
  }
  const websiteDisplay = website || 'Add your website';
  const availabilityCardTitle = availabilityTitle === EMPTY_PROFILE_MARK ? 'Set your schedule' : availabilityTitle;
  const availabilityCardSubtitle = availabilityTitle !== EMPTY_PROFILE_MARK ? 'Visible to clients on your profile' : 'Tap settings to update';
  const sessionCardTitle = sessionTitle === EMPTY_PROFILE_MARK ? 'Virtual & in-person' : sessionTitle;

  // Edit-sheet field shape — named before JSX so the TextInput stays flat.
  const isMultilineField = editKey === 'trainerProfileBio' || editKey === 'trainingPhilosophy';
  const usesDecimalPad = editKey === 'height' || editKey === 'weight' || editKey === 'age';
  const editPlaceholder = editKey === 'height' ? 'Total inches (e.g. 70)' : 'Enter value';
  let editLineCount = 1;
  if (editKey === 'trainingPhilosophy') editLineCount = 10;
  if (editKey === 'trainerProfileBio') editLineCount = 5;
  const editVerticalAlign = isMultilineField ? 'top' : 'center';
  const editInk = isDark ? darkColors.nbInk : lightColors.nbInk;
  const editBorder = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const editSurface = isDark ? darkColors.nbSurface : lightColors.nbSurface;
  const editMuted = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const editSheetSaveLabel = savingField ? 'Saving…' : 'Save';
  const editFieldLabelUpper = String(editLabel || 'VALUE').toUpperCase();
  return <View style={[styles.container, {
    backgroundColor: theme.pageBackground
  }]}>
      <View style={{
      flex: 1
    }}>
        <NbPageHeader title="Edit profile" subtitle="Keep your details current for a tailored experience." onBack={backHandler} />

        <ScrollView contentContainerStyle={[styles.scrollContent, {
        paddingBottom: shellNavInset
      }]} {...FORM_SCROLL_PROPS}>
          <ProfileHero kicker={heroKickerLabel} name={heroDisplayName} handle={handle} headline={profileHeadline} photoURL={photoURL} uploading={uploading} onPressPhoto={pickAndUploadPhoto} theme={theme} />

          {/* Design Law 11: Your profile / Trainer profile tabs (trainers only) */}
          {isTrainer ? <View style={[styles.profileTabs, {
          borderColor: theme.border,
          backgroundColor: theme.surface,
          shadowColor: theme.hardShadow
        }]}>
              {buildProfileTabButtons(profileTab, theme, setProfileTab)}
            </View> : null}

          <Text style={[styles.sectionEyebrow, {
          color: theme.muted
        }]}>NAME</Text>
          <NbCard style={styles.nameCard}>
            <Text style={[styles.fieldLabel, {
            color: theme.muted,
            marginTop: 0
          }]}>FULL NAME</Text>
            <TextInput value={draftFullName} onChangeText={setDraftFullName} style={[styles.namedInput, {
            color: theme.ink,
            borderColor: theme.border,
            backgroundColor: theme.pageBackground,
            shadowColor: theme.hardShadow
          }]} placeholder="Full name" placeholderTextColor={theme.muted} />
            <Text style={[styles.fieldLabel, {
            color: theme.muted
          }]}>DISPLAY NAME</Text>
            <TextInput value={draftDisplayName} onChangeText={setDraftDisplayName} style={[styles.namedInput, {
            color: theme.ink,
            borderColor: theme.border,
            backgroundColor: theme.pageBackground,
            shadowColor: theme.hardShadow,
            marginBottom: 0
          }]} placeholder="Display name" placeholderTextColor={theme.muted} />
          </NbCard>

          <Text style={[styles.sectionEyebrow, {
          color: theme.muted
        }]}>DETAILS</Text>
          <NbCard style={styles.detailCard}>
            {buildDesignLawDetailRows(designLawDetailRows, theme, openEdit)}
          </NbCard>

          {/* Save stays primary; Sign out sits under it so Edit profile can leave the session
              without bouncing back through Settings (handler already exists — wire the UI). */}
          <View style={{
          marginTop: spacing.md,
          marginBottom: spacing.lg,
          gap: spacing.sm
        }}>
            <NbButton variant="fill" onPress={saveNameFields} disabled={savingField}>
              {saveButtonLabel}
            </NbButton>
            <NbButton variant="ghost" onPress={handleSignOut}>
              Sign out
            </NbButton>
          </View>

          {showTrainerExtraSections ? <>
              <TrainerStatsStrip clientCount={trainerClientCountDisplay} years={trainerYearsStat} rating={trainerRatingStat} theme={theme} />

              <View style={{
            marginBottom: 20
          }}>
                <TrainerPaymentCard status={stripeStatus} onPress={paymentPressHandler} theme={theme} />
              </View>

              <Animated.View style={fadeUpStyleFromAnim(personalAnim)}>
                <SectionTitle title="PROFILE" theme={theme} />
                <ProfileSettingsCard theme={theme} isDark={isDark}>
                  {buildTrainerProfessionalRows(trainerProfessionalPills, theme, isDark, openEdit)}
                </ProfileSettingsCard>
              </Animated.View>

              <Animated.View style={fadeUpStyleFromAnim(trainingAnim)}>
                <SectionTitle title="SPECIALTIES & CERTIFICATIONS" theme={theme} />
                <View style={styles.credRow}>
                  <CredentialPill Icon={Medal} label="CERTIFICATIONS" value={formatCertifications(trainerDoc)} theme={theme} style={{
                minWidth: '100%'
              }} />
                  <View style={{
                width: '100%',
                marginTop: 12,
                padding: 14,
                borderRadius: 16,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border
              }}>
                    <Text style={{
                  color: theme.muted,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.6
                }}>
                      CERTIFICATION SHEETS
                    </Text>
                    <Text style={{
                  color: theme.muted,
                  fontSize: 12,
                  marginTop: 4,
                  marginBottom: 10
                }}>
                      Upload a photo of your certificate for AI verification (JPG/PNG). PDF is accepted for manual review.
                    </Text>
                    {certVerifyBusy || certificationStatusLabel(certVerifyStatus) ? <View style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 12,
                  // Design Law: 3px ink border — no green / purple status chrome
                  borderWidth: nb.borderWidth,
                  borderColor: theme.border,
                  backgroundColor: theme.surface
                }}>
                        <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8
                  }}>
                          {certVerifyBusy || certVerifyStatus === 'checking' ? <ActivityIndicator size="small" color={theme.muted} /> : null}
                          <Text style={{
                      flex: 1,
                      color: theme.ink,
                      fontSize: 13,
                      fontWeight: '700'
                    }}>
                            {certificationStatusLabel(certVerifyStatus) || 'Checking status…'}
                          </Text>
                        </View>
                        {certificationStatusDetail(certVerifyStatus) ? <Text style={{
                    color: theme.muted,
                    fontSize: 12,
                    marginTop: 6,
                    lineHeight: 17
                  }}>
                            {certificationStatusDetail(certVerifyStatus)}
                          </Text> : null}
                      </View> : null}
                    {certSheets.length === 0 ? <Text style={{
                  color: theme.muted,
                  fontSize: 13,
                  marginBottom: 10
                }}>
                        No files uploaded yet
                      </Text> : buildCertificationSheetRows(certSheets, theme, handleDeleteCertification)}
                    {certUploading ? <View style={{
                  marginTop: 8
                }}>
                        <Text style={{
                    color: theme.muted,
                    fontSize: 12,
                    marginBottom: 6
                  }}>
                          Uploading… {certProgress}%
                        </Text>
                        <View style={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.border,
                    overflow: 'hidden'
                  }}>
                          <View style={{
                      width: `${Math.max(4, certProgress)}%`,
                      height: '100%',
                      backgroundColor: PROFILE.icon
                    }} />
                        </View>
                      </View> : <TouchableOpacity onPress={() => setCertSheetOpen(true)} activeOpacity={0.85} style={{
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: nb.borderWidth,
                  borderColor: theme.border
                }}>
                        <Ionicons name="cloud-upload-outline" size={18} color={theme.ink} />
                        <Text style={{
                    color: theme.ink,
                    fontWeight: '700',
                    fontSize: 13
                  }}>Add Certification</Text>
                      </TouchableOpacity>}
                  </View>
                  <View style={styles.credRowHalf}>
                    <CredentialPill Icon={Calendar} label="YEARS COACHING" value={formatYearsCoaching(readNestedValue(trainerDoc, "yearsExperience"))} theme={theme} isDark={isDark} />
                    <CredentialPill Icon={Sparkles} label="SPECIALTIES" value={formatSpecialtyList(readNestedValue(trainerDoc, "specialties"))} theme={theme} isDark={isDark} />
                  </View>
                </View>

                <SectionTitle title="COACHING PHILOSOPHY" theme={theme} />
                <PhilosophyQuote text={philosophyText} onPress={() => openEdit('trainingPhilosophy', 'COACHING PHILOSOPHY', philosophyText || '—')} theme={theme} isDark={isDark} />

                <SectionTitle title="CONTACT & SOCIAL" theme={theme} />
                <ProfileSettingsCard theme={theme} isDark={isDark}>
                  <TrainerContactRow label="INSTAGRAM" value={instagramDisplay} Icon={AtSign} editable onPress={() => openEdit('instagram', 'INSTAGRAM', instagram)} theme={theme} isDark={isDark} />
                  <TrainerContactRow label="WEBSITE" value={websiteDisplay} Icon={Link2} editable onPress={() => openEdit('website', 'WEBSITE', website)} theme={theme} isDark={isDark} />
                  <TrainerContactRow label="EMAIL" value={String(email || '—')} Icon={Mail} theme={theme} isDark={isDark} />
                </ProfileSettingsCard>
                <View style={{
              height: 8
            }} />
              </Animated.View>

              <Animated.View style={fadeUpStyleFromAnim(accountAnim)}>
                <SectionTitle title="AVAILABILITY & SESSIONS" theme={theme} />
                <SessionCard Icon={Calendar} label="AVAILABILITY" title={availabilityCardTitle} subtitle={availabilityCardSubtitle} theme={theme} isDark={isDark} />
                <SessionCard Icon={Video} label="SESSION FORMAT" title={sessionCardTitle} subtitle="Session length & format" theme={theme} isDark={isDark} />
              </Animated.View>
            </> : null}
        </ScrollView>
      </View>

      <CertificationUploadSheet visible={certSheetOpen} onClose={() => !certUploading && setCertSheetOpen(false)} onPickUpload={handleAddCertification} uploading={certUploading} progress={certProgress} />

      {/* Design Law field editor — bottom sheet, 3px ink, Nb fill/ghost (no gradient Save) */}
      <Modal visible={!!editKey} transparent animationType="slide" onRequestClose={closeEdit}>
        <View style={styles.editOverlay}>
          <Pressable style={styles.editBackdrop} onPress={closeEdit} accessibilityRole="button" accessibilityLabel="Dismiss" />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.editKav}>
            <View style={[styles.editSheet, {
            backgroundColor: isDark ? darkColors.nbSurface : lightColors.nbSurface,
            borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder
          }]}>
              <View style={styles.editHandleWrap}>
                <View style={[styles.editHandle, {
                backgroundColor: isDark ? darkColors.nbBorder : lightColors.nbBorder
              }]} />
              </View>

              <View style={styles.editSheetTop}>
                <Text style={[styles.editTitle, {
                color: isDark ? darkColors.nbInk : lightColors.nbInk
              }]}>
                  {editLabel}
                </Text>
                <TouchableOpacity onPress={closeEdit} activeOpacity={0.85} style={[styles.editCloseBtn, {
                borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
                backgroundColor: isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip
              }]} accessibilityRole="button" accessibilityLabel="Close">
                  <X size={18} color={isDark ? darkColors.nbInk : lightColors.nbInk} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.editFieldLabel, {
              color: editMuted
            }]}>
                {editFieldLabelUpper}
              </Text>
              <TextInput value={editValue} onChangeText={setEditValue} placeholder={editPlaceholder} placeholderTextColor={editMuted} keyboardType={usesDecimalPad ? 'decimal-pad' : 'default'} multiline={isMultilineField} numberOfLines={editLineCount} textAlignVertical={editVerticalAlign} style={[styles.editInput, isMultilineField ? styles.editInputMultiline : null, {
              color: editInk,
              borderColor: editBorder,
              backgroundColor: editSurface
            }]} autoFocus />

              <View style={styles.editActions}>
                <NbButton variant="ghost" onPress={closeEdit} style={styles.editBtnFlex}>
                  Cancel
                </NbButton>
                <NbButton variant="fill" onPress={saveField} disabled={savingField} style={styles.editBtnFlex}>
                  {editSheetSaveLabel}
                </NbButton>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {!embedShellBottomNav ? <ShellBottomNavAnchor>
          <BottomMenuBar onHomePress={nav.home} onPlusPress={nav.create} onVoicePress={nav.ai} onNutritionPress={nav.nutrition} onWorkoutPress={nav.workout} onMessagesPress={nav.messages} onProfilePress={nav.profile} />
        </ShellBottomNavAnchor> : null}

      <NbNoticeSheet visible={!!notice} onClose={() => setNotice(null)} title={readNestedValue(notice, "title") || ''} message={readNestedValue(notice, "message")} confirmLabel={readNestedValue(notice, "confirmLabel") || 'OK'} cancelLabel={readNestedValue(notice, "cancelLabel")} onConfirm={readNestedValue(notice, "onConfirm")} destructive={!!readNestedValue(notice, "destructive")} />
    </View>;
}

// PLUMBING — skip unless debugging
// Certification pick / upload / AI verify helpers (called from trainer certification block).

const CERT_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
async function pickCertificationFile(showNotice) {
  const result = await DocumentPicker.getDocumentAsync({
    type: CERT_FILE_TYPES,
    copyToCacheDirectory: true
  });
  if (result.canceled) return null;
  const file = readNestedValue(result, "assets", 0);
  if (!readNestedValue(file, "uri")) {
    showNotice('Upload failed', 'Could not read the selected file.');
    return null;
  }
  if (file.size != null && file.size > MAX_CERT_FILE_BYTES) {
    showNotice('File too large', 'Certification sheets must be 10MB or smaller.');
    return null;
  }
  return file;
}
function certificationLooksLikeImage(file, meta) {
  const mime = String(file.mimeType || readNestedValue(meta, "fileType") || '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(String(file.name || ''));
}
async function checkImageCertification({
  file,
  meta,
  url,
  trainerId,
  trainerName
}) {
  const verification = await checkTrainerCertificate({
    trainerId,
    trainerName,
    localUri: file.uri,
    imageUrl: url,
    mediaType: file.mimeType || 'image/jpeg',
    storagePath: readNestedValue(meta, "storagePath"),
    fileName: readNestedValue(meta, "fileName")
  });
  const nextStatus = verification.status || 'manual_review';
  let verifyMessage = verification.userMessage || certificationStatusLabel(nextStatus) || 'Certification sheet added to your profile.';
  const firstIssue = readNestedValue(verification, "analysis", "issues", 0);
  if (firstIssue && verification.status === 'rejected') {
    verifyMessage = `${verifyMessage}\n${firstIssue}`;
  }
  return {
    nextStatus,
    verifyMessage
  };
}
async function reviewUploadedCertification({
  file,
  meta,
  url,
  trainerId,
  trainerName,
  setCertVerifyBusy,
  setCertVerifyStatus
}) {
  if (!certificationLooksLikeImage(file, meta)) {
    setCertVerifyStatus('manual_review');
    return 'Uploaded — Under review. Photos (JPG/PNG) get instant AI checks; other file types are reviewed within 24–48 hours.';
  }
  setCertVerifyBusy(true);
  setCertVerifyStatus('checking');
  try {
    const check = await checkImageCertification({
      file,
      meta,
      url,
      trainerId,
      trainerName
    });
    setCertVerifyStatus(check.nextStatus);
    return check.verifyMessage;
  } catch (verifyErr) {
    if (__DEV__) console.warn('cert AI verify:', readNestedValue(verifyErr, "message") || verifyErr);
    setCertVerifyStatus('manual_review');
    return 'Uploaded — Under review. AI check was unavailable; we’ll review it within 24–48 hours.';
  } finally {
    setCertVerifyBusy(false);
  }
}
const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: 4,
    paddingBottom: 140
  },
  // Manipulate here: Design Law page header under the status bar
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm
  },
  backSq: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {
      width: nb.shadowOffsetSmall,
      height: nb.shadowOffsetSmall
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3
  },
  backSqSpacer: {
    width: 44,
    height: 44
  },
  pageHeaderText: {
    flex: 1,
    minWidth: 0
  },
  pageTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    letterSpacing: -0.4
  },
  pageSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18
  },
  heroCard: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md
  },
  heroKicker: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: spacing.md,
    alignSelf: 'flex-start'
  },
  heroPhotoWrap: {
    position: 'relative',
    marginBottom: spacing.md
  },
  heroRing: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: nb.borderWidth,
    shadowOffset: {
      width: nb.shadowOffsetSmall,
      height: nb.shadowOffsetSmall
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4
  },
  heroPhotoInner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  heroInitials: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 42
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
    shadowOffset: {
      width: nb.shadowOffsetSmall,
      height: nb.shadowOffsetSmall
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4
  },
  heroName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 26,
    letterSpacing: -0.4,
    textAlign: 'center'
  },
  heroHandle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center'
  },
  heroBio: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
    paddingHorizontal: spacing.sm
  },
  // Manipulate here: Design Law Edit profile tabs + named fields
  profileTabs: {
    flexDirection: 'row',
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    padding: 4,
    marginBottom: spacing.md,
    shadowOffset: {
      width: nb.shadowOffsetSmall,
      height: nb.shadowOffsetSmall
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3
  },
  profileTabCell: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10
  },
  profileTabLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14
  },
  sectionEyebrow: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginLeft: 2
  },
  nameCard: {
    marginBottom: spacing.lg,
    padding: spacing.md
  },
  fieldLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4
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
    shadowOffset: {
      width: nb.shadowOffsetSmall,
      height: nb.shadowOffsetSmall
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3
  },
  detailCard: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    marginBottom: spacing.sm
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    minHeight: nb.minTouchTarget,
    gap: 10
  },
  detailLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    flex: 1
  },
  detailValue: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    maxWidth: '45%',
    textAlign: 'right'
  },
  detailDivider: {
    height: nb.borderWidthDivider,
    marginHorizontal: spacing.md
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18
  },
  statTile: {
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  paymentCard: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: nb.borderWidth
  },
  paymentCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  paymentKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1
  },
  paymentStatus: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2
  },
  paymentCta: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    backgroundColor: 'rgba(255,255,255,0.35)'
  },
  paymentCtaText: {
    fontSize: 12,
    fontWeight: '800'
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 2
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 8,
    marginLeft: 4
  },
  sectionTitleText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  },
  sectionBody: {
    marginBottom: 28,
    gap: 20
  },
  settingsCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 28
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12
  },
  profileRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  profileRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0
  },
  profileRowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileRowText: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  profileRowLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  profileRowValue: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22
  },
  infoField: {
    gap: 8
  },
  infoFieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  editPencilBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase'
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  credRow: {
    gap: 10,
    marginBottom: 28
  },
  credRowHalf: {
    flexDirection: 'row',
    gap: 10
  },
  credPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14
  },
  credPillValue: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 20
  },
  philosophyInner: {
    paddingVertical: 26,
    paddingHorizontal: 22,
    position: 'relative'
  },
  philosophyEditCorner: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2
  },
  philosophyQuote: {
    fontSize: 16,
    lineHeight: 26,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '400'
  },
  sessionCardInner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16
  },
  sessionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14
  },
  sessionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 22
  },
  sessionSub: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
    lineHeight: 18
  },
  accountBlock: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24
  },
  accountNotifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14
  },
  accountIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  accountNotifyTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  accountNotifySub: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 17
  },
  accountDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16
  },
  signOutBtn: {
    marginTop: 14,
    marginBottom: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth
  },
  signOutBtnText: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2
  },
  gradSwitchTrack: {
    width: 50,
    height: 30,
    borderRadius: 15,
    padding: 3,
    justifyContent: 'center'
  },
  gradSwitchTrackOff: {
    backgroundColor: 'rgba(255,255,255,0.14)'
  },
  gradSwitchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: lightColors.white,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 1
    }
  },
  gradSwitchThumbOn: {
    alignSelf: 'flex-end'
  },
  editOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  editBackdrop: {
    ...StyleSheet.absoluteFillObject
  },
  editKav: {
    width: '100%'
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
    paddingTop: 8
  },
  editHandleWrap: {
    alignItems: 'center',
    paddingVertical: 6
  },
  editHandle: {
    width: 44,
    height: 4,
    borderRadius: 2
  },
  editSheetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12
  },
  editTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4
  },
  editCloseBtn: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  editFieldLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8
  },
  editInput: {
    borderWidth: nb.borderWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
    fontSize: 16,
    fontWeight: '700'
  },
  editInputMultiline: {
    minHeight: 140,
    paddingTop: 12
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16
  },
  editBtnFlex: {
    flex: 1
  }
});
export default ViewMyMyProfileScreen;
