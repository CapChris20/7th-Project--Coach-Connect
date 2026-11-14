// Design Law trainer onboarding — parts 1 + 2 (screens/trainer-setup + trainer-setup-part-2 PNGs).
// Flow: Profile → Credentials → Rates → Invite → Review → Availability → Almost done → Payouts → Pro → Live.
// Used by NewUserSetupScreen when role === 'trainer'. Firestore field names unchanged.
//
// Priority: PNG > DESIGN-SYSTEM > mockups/trainer-setup*.html

import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NbSlider from '../look-and-feel/NbSlider';
import NbCard from '../look-and-feel/NbCard';
import NbButton from '../look-and-feel/NbButton';
import NbChip from '../look-and-feel/NbChip';
import HardShadow from '../look-and-feel/HardShadow';
import { accentGradients, borderRadius, gradients, nb, spacing } from '../look-and-feel/colorPalette';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getOnboardingIconSource } from '../for-both/setup-icons/onboardingIconRegistry';
import { certificationStatusLabel, certificationStatusDetail } from '../for-both/online-connection/checkTrainerCertificate';
import { TrainerPayoutSetupStep } from './TrainerPayoutSetupStep';
import { TrainerProOfferStep } from '../for-both/setup-steps/TrainerProOfferStep';

// ===== NAMED CONSTANTS =====

export const TRAINER_ONBOARDING_STEPS = 10;
export const TRAINER_BUSINESS_STEP_COUNT = 8;
export const TRAINER_INVITE_STEP = 4;
export const TRAINER_PAYOUT_STEP = 8;
export const TRAINER_PRO_STEP = 9;
export const TRAINER_COMPLETE_STEP = 10;
const SPECIALTY_MAX = 5;
const PHILOSOPHY_MAX = 500;
const RATE_MIN = 25;
const RATE_MAX = 200;
const RATE_DEFAULT = 75;
const MARKETPLACE_BIO_MAX = 250;
const CHAPTER_PROFILE_STEP_COUNT = 5;
const STEPPER_YEARS_MAX = 25;
const STEPPER_YEARS_LEGACY_MID = 7;
const ONBOARDING_STEP_ALMOST_DONE = 7;
const CHAPTER_META_N_SIX = 6;
const CHAPTER_META_N_SEVEN = 7;
const LOTTIE_HERO_SIZE = 88;
const FORMAT_ICON_SIZE = 28;
const PREVIEW_PACKAGE_DISCOUNT = 0.88;
const PACK_FOUR_SESSION_DISCOUNT = 0.95;
const PACK_TWELVE_SESSION_DISCOUNT = 0.88;
const CERT_PREVIEW_ROW_MAX = 3;
const SPECIALTY_PREVIEW_MAX = 3;
const INITIALS_MAX_LETTERS = 2;
const YEARS_BADGE_EXPERIENCED = 8;
const YEARS_BADGE_SEASONED = 4;
const YEARS_BADGE_GROWING = 1;
const CHAPTER_TOTAL = 3;
const LOTTIE_SPECIALTIES = require('../assets/animations/app-flows/specialties');
const LOTTIE_CERTS = require('../assets/animations/app-flows/certifications');
const LOTTIE_RATES = require('../assets/animations/app-flows/rates');
const LOTTIE_INVITE = require('../assets/animations/app-flows/invite-code');
const SPECIALTY_OPTIONS = [{
  value: 'strength',
  label: 'Strength'
}, {
  value: 'weight_loss',
  label: 'Fat loss'
}, {
  value: 'mobility',
  label: 'Mobility'
}, {
  value: 'bodybuilding',
  label: 'Hypertrophy'
}, {
  value: 'powerlifting',
  label: 'Powerlifting'
}, {
  value: 'boxing',
  label: 'Boxing'
}, {
  value: 'postnatal',
  label: 'Postnatal'
}, {
  value: 'senior',
  label: 'Senior fitness'
}, {
  value: 'rehabilitation',
  label: 'Return from injury'
}, {
  value: 'athletic',
  label: 'Sports prep'
}, {
  value: 'nutrition',
  label: 'Nutrition coaching'
}, {
  value: 'calisthenics',
  label: 'Calisthenics'
}];
const CERT_OPTIONS = [{
  value: 'NASM-CPT',
  label: 'NASM Certified Personal Trainer',
  org: 'NASM'
}, {
  value: 'ACE',
  label: 'ACE Certified Personal Trainer',
  org: 'ACE'
}, {
  value: 'ISSA',
  label: 'ISSA Certified',
  org: 'ISSA'
}, {
  value: 'ACSM',
  label: 'ACSM Certified',
  org: 'ACSM'
}, {
  value: 'NSCA-CPT',
  label: 'NSCA-CPT',
  org: 'NSCA'
}, {
  value: 'Other',
  label: 'Other certification',
  org: 'Other'
}, {
  value: 'None',
  label: 'No formal certification',
  org: null
}];
const SESSION_FORMAT_OPTIONS = [{
  value: 'In-person',
  label: 'In person',
  iconKey: 'gym'
}, {
  value: 'Remote',
  label: 'Online',
  iconKey: 'remote'
}, {
  value: 'Both',
  label: 'Both',
  iconKey: 'both'
}];
const TIME_CHIPS = [{
  id: 'morning',
  label: 'Morning'
}, {
  id: 'afternoon',
  label: 'Afternoon'
}, {
  id: 'evening',
  label: 'Evening'
}, {
  id: 'weekends',
  label: 'Weekends'
}];
const AVAILABILITY_STATUS_OPTIONS = [{
  id: 'available',
  label: 'Available now'
}, {
  id: 'waitlist',
  label: 'Waitlist'
}];
const INVITE_HOW_IT_WORKS = [{
  stepNumber: 1,
  title: 'You send the code',
  sub: 'By text, email or in person'
}, {
  stepNumber: 2,
  title: 'They enter it in the app',
  sub: 'Under Find a trainer, Have a code'
}, {
  stepNumber: 3,
  title: 'You approve the request',
  sub: 'It lands in your Today timeline'
}];
const REVIEW_EDIT_STEP_BY_KEY = {
  specialties: 1,
  credentials: 2,
  rates: 3,
  invite: 4
};
const CHAPTER_BY_STEP = {
  1: {
    chapter: 1,
    fraction: 0.4,
    label: 'PROFILE',
    n: 1,
    heroTime: 'About 4 minutes'
  },
  2: {
    chapter: 1,
    fraction: 0.75,
    label: 'PROFILE',
    n: 2
  },
  3: {
    chapter: 2,
    fraction: 0.45,
    label: 'PROOF',
    n: 3
  },
  4: {
    chapter: 2,
    fraction: 0.8,
    label: 'PROOF',
    n: 4
  },
  5: {
    chapter: 2,
    fraction: 1,
    label: 'PROOF',
    n: 5
  },
  6: {
    chapter: 3,
    fraction: 0.35,
    label: 'BUSINESS',
    n: 5
  },
  [ONBOARDING_STEP_ALMOST_DONE]: {
    chapter: 3,
    fraction: 0.55,
    label: 'BUSINESS',
    n: CHAPTER_META_N_SIX
  },
  [TRAINER_PAYOUT_STEP]: {
    chapter: 3,
    fraction: 0.75,
    label: 'BUSINESS',
    n: CHAPTER_META_N_SEVEN
  },
  [TRAINER_PRO_STEP]: {
    chapter: 3,
    fraction: 0.95,
    label: 'BUSINESS',
    n: TRAINER_BUSINESS_STEP_COUNT
  },
  10: {
    chapter: 3,
    fraction: 1,
    label: 'BUSINESS',
    n: 8,
    done: true
  }
};
const SCREEN_TITLES = {
  1: 'Set up your profile',
  2: 'Credentials',
  3: 'Your rates',
  4: 'Your trainer code',
  5: 'Review',
  6: 'Availability',
  [ONBOARDING_STEP_ALMOST_DONE]: 'Almost done',
  [TRAINER_PAYOUT_STEP]: 'Payouts',
  [TRAINER_PRO_STEP]: 'Coach Connect Pro',
  10: 'You are live'
};

// ===== HELPER FUNCTIONS =====

/**
 * Wizard header title for each trainer step (matches SCREEN_TITLES / Design Law PNGs).
 * @param {number} step
 * @returns {string}
 */
export function getTrainerScreenTitle(step) {
  return SCREEN_TITLES[step] || 'Setup';
}
function stepLabelForChapterMeta(meta) {
  if (meta.done) {
    return `${TRAINER_BUSINESS_STEP_COUNT} / ${TRAINER_BUSINESS_STEP_COUNT}`;
  }
  if (meta.chapter === CHAPTER_TOTAL) {
    return `${meta.n} / ${TRAINER_BUSINESS_STEP_COUNT}`;
  }
  return `${meta.n} / ${CHAPTER_PROFILE_STEP_COUNT}`;
}

/** Three chapter bars + “CHAPTER N OF 3 · LABEL” meta (matches client + part-2 PNGs). */
export function getTrainerChapterMeta(step) {
  const meta = CHAPTER_BY_STEP[step] || CHAPTER_BY_STEP[1];
  return {
    chapter: meta.chapter,
    of: CHAPTER_TOTAL,
    fraction: meta.fraction,
    label: meta.label,
    heroTime: meta.heroTime || null,
    stepLabel: stepLabelForChapterMeta(meta),
    done: Boolean(meta.done)
  };
}

/** Map Design Law stepper years to existing bucket keys (Firestore / filters). */
export function yearsBucketFromStepper(yearsInput) {
  const roundedYears = Math.max(0, Math.round(Number(yearsInput) || 0));
  if (roundedYears < 1) {
    return 'less_than_1';
  }
  if (roundedYears <= 2) {
    return '1_2';
  }
  if (roundedYears <= 5) {
    return '3_5';
  }
  if (roundedYears <= 10) {
    return '6_10';
  }
  return '10_plus';
}
function yearsFromLegacyBucketString(bucketOrYears) {
  if (bucketOrYears === 'less_than_1') return 0;
  if (bucketOrYears === '1_2') return 2;
  if (bucketOrYears === '3_5') return 4;
  if (bucketOrYears === '6_10') return STEPPER_YEARS_LEGACY_MID;
  if (bucketOrYears === '10_plus') return 12;
  const asNumber = Number(bucketOrYears);
  if (Number.isFinite(asNumber)) {
    return Math.max(0, Math.min(STEPPER_YEARS_MAX, Math.round(asNumber)));
  }
  return 0;
}

/**
 * Display years for the ± stepper.
 * Prefer a real number (so +1/-1 actually moves). Fall back from legacy bucket strings.
 */
export function stepperFromYearsBucket(bucketOrYears) {
  if (typeof bucketOrYears === 'number' && Number.isFinite(bucketOrYears)) {
    return Math.max(0, Math.min(STEPPER_YEARS_MAX, Math.round(bucketOrYears)));
  }
  return yearsFromLegacyBucketString(bucketOrYears);
}
function yearsBadgeLabel(yearsCoaching) {
  if (yearsCoaching >= YEARS_BADGE_EXPERIENCED) return 'Experienced';
  if (yearsCoaching >= YEARS_BADGE_SEASONED) return 'Seasoned';
  if (yearsCoaching >= YEARS_BADGE_GROWING) return 'Growing';
  return 'New coach';
}

/**
 * Ensures pricing.perSession exists before the rates slider mounts.
 * @param {object} data
 * @returns {object}
 */
export function withTrainerSliderDefaults(data) {
  var _optObj;
  const hasSavedRate = ((_optObj = data == null ? void 0 : data.pricing) == null ? void 0 : _optObj.perSession) != null;
  const perSession = hasSavedRate ? data.pricing.perSession : RATE_DEFAULT;
  return {
    ...data,
    pricing: {
      ...(data.pricing || {}),
      perSession
    }
  };
}
function profileStepIsComplete(data) {
  const hasSpecialties = Array.isArray(data.specialties) && data.specialties.length > 0;
  const hasYears = data.yearsExperience != null;
  return hasSpecialties && hasYears;
}
function credentialsStepIsComplete(data) {
  return Array.isArray(data.certifications) && data.certifications.length > 0;
}
function ratesStepIsComplete(data) {
  var _optObj2;
  const perSession = (_optObj2 = data == null ? void 0 : data.pricing) == null ? void 0 : _optObj2.perSession;
  const rateLooksValid = perSession != null && perSession >= RATE_MIN;
  const hasSessionType = !!data.sessionType;
  return rateLooksValid && hasSessionType;
}
function availabilityStepIsComplete(data) {
  return !!data.trainerAvailabilityStatus && !!data.sessionType;
}
function almostDoneStepIsComplete(data) {
  const nameFilled = Boolean(String(data.name || '').trim());
  const locationFilled = Boolean(String(data.location || '').trim());
  return nameFilled && locationFilled;
}

/**
 * Whether Continue is allowed on this trainer onboarding step (Firestore keys unchanged).
 * @param {number} step
 * @param {object} data
 * @returns {boolean}
 */
export function validateTrainerOnboardingStep(step, data) {
  if (step === 1) return profileStepIsComplete(data);
  if (step === 2) return credentialsStepIsComplete(data);
  if (step === 3) return ratesStepIsComplete(data);
  if (step === 4) return true;
  if (step === 5) return true;
  if (step === 6) return availabilityStepIsComplete(data);
  if (step === ONBOARDING_STEP_ALMOST_DONE) return almostDoneStepIsComplete(data);
  if (step === 8) return true;
  if (step === 9) return true;
  if (step === 10) return true;
  return false;
}
function specialtyLabelByValue() {
  const labelByValue = {};
  for (let index = 0; index < SPECIALTY_OPTIONS.length; index += 1) {
    const option = SPECIALTY_OPTIONS[index];
    labelByValue[option.value] = option.label;
  }
  return labelByValue;
}
function specialtyLabels(data) {
  const labelByValue = specialtyLabelByValue();
  const selectedValues = data.specialties || [];
  const firstThree = selectedValues.slice(0, SPECIALTY_PREVIEW_MAX);
  const labels = firstThree.map(specialtyValue => labelByValue[specialtyValue] || specialtyValue);
  return labels.join(', ');
}
function formatInviteDisplay(code) {
  if (!code) return 'COACH-····';
  const digitsOnly = String(code).replace(/-/g, '');
  return `COACH-${digitsOnly.slice(0, 4).toUpperCase()}`;
}
function packageRows(sessionRate) {
  const base = Number(sessionRate) || RATE_DEFAULT;
  const fourSessionPack = Math.round(base * 4 * PACK_FOUR_SESSION_DISCOUNT);
  const twelveSessionPack = Math.round(base * 12 * PACK_TWELVE_SESSION_DISCOUNT);
  return [{
    title: 'Single session',
    sub: 'Pay as you go',
    price: base
  }, {
    title: '4-session pack',
    sub: '5% off, one month',
    price: fourSessionPack
  }, {
    title: '12-session pack',
    sub: '12% off, one quarter',
    price: twelveSessionPack
  }];
}
function initialsFromName(fullName, fallbackLetters) {
  const trimmed = String(fullName || fallbackLetters).trim();
  const parts = trimmed.split(/\s+/);
  const letters = parts.map(namePart => namePart[0]).join('');
  return letters.slice(0, INITIALS_MAX_LETTERS).toUpperCase() || fallbackLetters;
}
function countSelectedCertsExcludingNone(certifications) {
  const list = certifications || [];
  return list.filter(certValue => certValue !== 'None').length;
}
function certRowStatusLabel(isSelected, verificationStatus) {
  if (!isSelected) return null;
  if (verificationStatus === 'verified') return 'Verified';
  return 'In review';
}
function SectionLabel({
  text,
  right,
  colors
}) {
  return <View style={styles.sectionRow}>
      <Text style={[styles.sectionLabel, {
      color: colors.nbMuted
    }]}>{text}</Text>
      {right || null}
    </View>;
}
function HeroWithLottie({
  title,
  subtitle,
  lottie,
  colors
}) {
  return <HardShadow>
      <NbCard style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={{
          flex: 1,
          minWidth: 0
        }}>
            <Text style={[styles.h1, {
            color: colors.nbInk
          }]}>{title}</Text>
            {subtitle ? <Text style={[styles.sub, {
            color: colors.nbMuted
          }]}>{subtitle}</Text> : null}
          </View>
          {lottie ? <LottieView source={lottie} autoPlay loop style={{
          width: LOTTIE_HERO_SIZE,
          height: LOTTIE_HERO_SIZE
        }} /> : null}
        </View>
      </NbCard>
    </HardShadow>;
}
function FormatTile({
  option,
  selected,
  onPress,
  colors
}) {
  const iconSource = getOnboardingIconSource(option.iconKey);
  const tileBackground = selected ? colors.nbFill : colors.nbSurface;
  const labelColor = selected ? colors.nbOnFill : colors.nbInk;
  return <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={[styles.formatTile, {
    borderColor: colors.nbBorder,
    backgroundColor: tileBackground,
    shadowColor: colors.nbShadow
  }]}>
      {selected ? <Ionicons name="checkmark" size={16} color={colors.nbOnFill} style={styles.formatTick} /> : null}
      <View style={[styles.formatIcon, {
      borderColor: colors.nbBorder
    }]}>
        <LinearGradient colors={accentGradients[2]} style={StyleSheet.absoluteFillObject} />
        {iconSource ? <Image source={iconSource} style={{
        width: FORMAT_ICON_SIZE,
        height: FORMAT_ICON_SIZE
      }} resizeMode="contain" /> : null}
      </View>
      <Text style={[styles.formatLabel, {
      color: labelColor
    }]}>{option.label}</Text>
    </TouchableOpacity>;
}

// ===== STEP SCREENS =====

function ProfileStep({
  data,
  setData,
  onToggleSpecialty
}) {
  var _optObj3, _optObj4, _optObj5;
  const {
    colors
  } = useTheme();
  const yearsCoaching = stepperFromYearsBucket(data.yearsExperience);
  const selectedSpecialties = data.specialties || [];
  const specialtyCounterText = `${Math.min(selectedSpecialties.length, SPECIALTY_MAX)} OF ${SPECIALTY_MAX}`;
  const tryToggleSpecialty = specialtyValue => {
    const alreadySelected = selectedSpecialties.includes(specialtyValue);
    if (alreadySelected) {
      onToggleSpecialty(specialtyValue, true);
      return;
    }
    const atMaxSpecialties = selectedSpecialties.length >= SPECIALTY_MAX;
    if (atMaxSpecialties) {
      return;
    }
    onToggleSpecialty(specialtyValue, true);
  };
  const decreaseCoachingYears = () => {
    setData(previousData => {
      const nextYears = Math.max(0, yearsCoaching - 1);
      return {
        ...previousData,
        yearsExperience: nextYears,
        yearsExperienceBucket: yearsBucketFromStepper(nextYears)
      };
    });
  };
  const increaseCoachingYears = () => {
    setData(previousData => {
      const nextYears = Math.min(STEPPER_YEARS_MAX, yearsCoaching + 1);
      return {
        ...previousData,
        yearsExperience: nextYears,
        yearsExperienceBucket: yearsBucketFromStepper(nextYears)
      };
    });
  };
  const savePhilosophyText = text => {
    setData(previousData => ({
      ...previousData,
      trainingPhilosophy: text.slice(0, PHILOSOPHY_MAX)
    }));
  };
  return <View style={styles.stack}>
      <HeroWithLottie title="What do you coach best?" subtitle="Clients filter by these. Your first three count most." lottie={LOTTIE_SPECIALTIES} colors={colors} />

      <SectionLabel text="SPECIALTIES" colors={colors} right={<Text style={[styles.counter, {
      color: colors.nbMuted
    }]}>{specialtyCounterText}</Text>} />
      {/* PNG 01: solid fill when selected (not brand gradient) — left-aligned wrap so rows don’t look random */}
      <View style={styles.chipGrid}>
        {SPECIALTY_OPTIONS.map(specialtyOption => {
        const isSelected = selectedSpecialties.includes(specialtyOption.value);
        const pillBackground = isSelected ? colors.nbFill : colors.nbSurface;
        const pillTextColor = isSelected ? colors.nbOnFill : colors.nbInk;
        const pillLabel = isSelected ? `${specialtyOption.label} ✓` : specialtyOption.label;
        return <HardShadow key={specialtyOption.value} offset={nb.shadowOffsetSmall} radius={999}>
              <TouchableOpacity accessibilityRole="button" accessibilityState={{
            selected: isSelected
          }} onPress={() => tryToggleSpecialty(specialtyOption.value)} activeOpacity={0.88} style={[styles.specPill, {
            backgroundColor: pillBackground,
            borderColor: colors.nbBorder
          }]}>
                <Text style={[styles.specPillText, {
              color: pillTextColor
            }]}>{pillLabel}</Text>
              </TouchableOpacity>
            </HardShadow>;
      })}
      </View>

      <SectionLabel text="YEARS COACHING" colors={colors} />
      <HardShadow>
        <NbCard style={styles.stepperCard}>
          <View style={styles.stepperRow}>
            <TouchableOpacity accessibilityRole="button" onPress={decreaseCoachingYears} style={[styles.stepBtn, {
            borderColor: colors.nbBorder
          }]}>
              <Text style={{
              fontSize: 22,
              fontWeight: '900',
              color: colors.nbInk
            }}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.stepperVal, {
            color: colors.nbInk
          }]}>{yearsCoaching}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={increaseCoachingYears} style={[styles.stepBtn, {
            borderColor: colors.nbBorder
          }]}>
              <Text style={{
              fontSize: 22,
              fontWeight: '900',
              color: colors.nbInk
            }}>+</Text>
            </TouchableOpacity>
            <View style={{
            flex: 1
          }} />
            {/* Small accent only — brand pink→orange, never purple chrome */}
            <LinearGradient colors={((_optObj3 = gradients.brand) == null ? void 0 : _optObj3.colors) || accentGradients[0]} start={(_optObj4 = gradients.brand) == null ? void 0 : _optObj4.start} end={(_optObj5 = gradients.brand) == null ? void 0 : _optObj5.end} style={[styles.expBadge, {
            borderColor: colors.nbBorder
          }]}>
              <Text style={[styles.expBadgeText, {
              color: colors.nbInk
            }]}>
                {yearsBadgeLabel(yearsCoaching)}
              </Text>
            </LinearGradient>
          </View>
        </NbCard>
      </HardShadow>

      <SectionLabel text="YOUR COACHING PHILOSOPHY" colors={colors} />
      <TextInput value={data.trainingPhilosophy || ''} onChangeText={savePhilosophyText} placeholder="Strong first, pretty second. I build programs around the lifts you can repeat for years." placeholderTextColor={colors.nbMuted} multiline style={[styles.textArea, {
      borderColor: colors.nbBorder,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface
    }]} />
    </View>;
}
function CredentialsStep({
  data,
  setData,
  onToggleCert,
  onUploadCert,
  certUploading
}) {
  const {
    colors
  } = useTheme();
  const verificationStatus = data.certificationVerificationStatus;
  const selectedCerts = data.certifications || [];
  const verifiedCounterText = `${Math.min(countSelectedCertsExcludingNone(selectedCerts), CERT_PREVIEW_ROW_MAX)} OF ${CERT_PREVIEW_ROW_MAX} VERIFIED`;
  const previewCertRows = CERT_OPTIONS.filter(certOption => certOption.value !== 'None').slice(0, CERT_PREVIEW_ROW_MAX);
  const showOtherCertInput = selectedCerts.includes('Other');
  const statusHeadline = certificationStatusLabel(verificationStatus);
  const statusDetailText = certificationStatusDetail(verificationStatus) || 'Reviews usually take one to two days. You can start taking clients while a credential is in review.';
  const uploadButtonLabel = certUploading ? 'Uploading…' : '+ Add a certification';
  const saveOtherCertText = text => {
    setData(previousData => ({
      ...previousData,
      certificationOther: text
    }));
  };
  return <View style={styles.stack}>
      <HeroWithLottie title="Show what you hold" subtitle="Clients see a badge next to each verified one." lottie={LOTTIE_CERTS} colors={colors} />
      <SectionLabel text="YOUR CERTIFICATIONS" colors={colors} right={<Text style={[styles.counter, {
      color: colors.nbMuted
    }]}>{verifiedCounterText}</Text>} />
      <HardShadow>
        <NbCard style={{
        paddingVertical: 4
      }}>
          {previewCertRows.map((certOption, rowIndex) => {
          const isSelected = selectedCerts.includes(certOption.value);
          const rowStatus = certRowStatusLabel(isSelected, verificationStatus);
          const dotBackground = isSelected ? colors.nbFill : colors.nbSurface;
          const orgLine = certOption.org ? `${certOption.org} · —` : '';
          const topBorder = rowIndex > 0 ? {
            borderTopWidth: nb.borderWidth,
            borderTopColor: colors.nbBorder
          } : null;
          return <View key={certOption.value} style={[styles.certRow, topBorder]}>
                <View style={[styles.certDot, {
              borderColor: colors.nbBorder,
              backgroundColor: dotBackground
            }]}>
                  {isSelected ? <Ionicons name="checkmark" size={14} color={colors.nbOnFill} /> : null}
                </View>
                <View style={{
              flex: 1
            }}>
                  <Text style={[styles.certTitle, {
                color: colors.nbInk
              }]}>{certOption.label}</Text>
                  <Text style={[styles.certMeta, {
                color: colors.nbMuted
              }]}>{orgLine}</Text>
                </View>
                {rowStatus ? <LinearGradient colors={accentGradients[1]} style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{rowStatus}</Text>
                  </LinearGradient> : null}
              </View>;
        })}
        </NbCard>
      </HardShadow>

      <View style={styles.chipGrid}>
        {CERT_OPTIONS.map(certOption => <NbChip key={certOption.value} selected={selectedCerts.includes(certOption.value)} onPress={() => onToggleCert(certOption.value, true)} style={styles.specChip}>
            {certOption.label}
          </NbChip>)}
      </View>

      {showOtherCertInput ? <TextInput value={data.certificationOther || ''} onChangeText={saveOtherCertText} placeholder="e.g. Precision Nutrition Level 1" placeholderTextColor={colors.nbMuted} style={[styles.singleInput, {
      borderColor: colors.nbBorder,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface
    }]} /> : null}

      <NbButton variant="plain" onPress={onUploadCert} disabled={certUploading}>
        {uploadButtonLabel}
      </NbButton>
      {statusHeadline ? <Text style={[styles.hint, {
      color: colors.nbMuted
    }]}>{statusDetailText}</Text> : <Text style={[styles.hint, {
      color: colors.nbMuted
    }]}>
          Reviews usually take one to two days. You can start taking clients while a credential is in review.
        </Text>}
    </View>;
}
function RatesStep({
  data,
  setData
}) {
  var _optObj6;
  const {
    colors
  } = useTheme();
  const sessionRate = ((_optObj6 = data == null ? void 0 : data.pricing) == null ? void 0 : _optObj6.perSession) ?? RATE_DEFAULT;
  const packageList = packageRows(sessionRate);
  const sessionType = data.sessionType || 'Both';
  const initials = initialsFromName(data.name, 'YO');
  const previewFromPrice = Math.round(sessionRate * PREVIEW_PACKAGE_DISCOUNT);
  const specialtyLine = specialtyLabels(data) || 'Your specialties';
  const saveSessionRate = nextRate => {
    setData(previousData => ({
      ...previousData,
      pricing: {
        ...(previousData.pricing || {}),
        perSession: nextRate
      }
    }));
  };
  const saveSessionType = nextType => {
    setData(previousData => ({
      ...previousData,
      sessionType: nextType
    }));
  };
  return <View style={styles.stack}>
      <HardShadow>
        <View style={[styles.rateHero, {
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbFill
      }]}>
          <Text style={[styles.rateEyebrow, {
          color: colors.nbMuted
        }]}>PER ONE-HOUR SESSION</Text>
          <Text style={[styles.rateBig, {
          color: colors.nbOnFill
        }]}>
            ${sessionRate}
            <Text style={styles.rateUnit}> / session</Text>
          </Text>
          <NbSlider value={sessionRate} min={RATE_MIN} max={RATE_MAX} colors={accentGradients[0]} onChange={saveSessionRate} />
        </View>
      </HardShadow>

      <SectionLabel text="HOW YOU TRAIN" colors={colors} />
      <View style={[styles.segRow, {
      borderColor: colors.nbBorder
    }]}>
        {SESSION_FORMAT_OPTIONS.map((formatOption, formatIndex) => {
        const isSelected = sessionType === formatOption.value;
        const cellBackground = isSelected ? colors.nbFill : colors.nbSurface;
        const cellTextColor = isSelected ? colors.nbOnFill : colors.nbInk;
        const leftBorder = formatIndex > 0 ? {
          borderLeftWidth: nb.borderWidth,
          borderLeftColor: colors.nbBorder
        } : null;
        return <TouchableOpacity key={formatOption.value} onPress={() => saveSessionType(formatOption.value)} style={[styles.segCell, {
          backgroundColor: cellBackground
        }, leftBorder]}>
              <Text style={[styles.segText, {
            color: cellTextColor
          }]}>{formatOption.label}</Text>
            </TouchableOpacity>;
      })}
      </View>

      <SectionLabel text="PACKAGES" colors={colors} />
      <HardShadow>
        <NbCard>
          {packageList.map((packageRow, packageIndex) => {
          const topBorder = packageIndex > 0 ? {
            borderTopWidth: nb.borderWidth,
            borderTopColor: colors.nbBorder
          } : null;
          return <View key={packageRow.title} style={[styles.packRow, topBorder]}>
                <Text style={[styles.packTitle, {
              color: colors.nbInk
            }]}>{packageRow.title}</Text>
                <Text style={[styles.packSub, {
              color: colors.nbMuted
            }]}>{packageRow.sub}</Text>
                <Text style={[styles.packPrice, {
              color: colors.nbInk
            }]}>${packageRow.price}</Text>
              </View>;
        })}
        </NbCard>
      </HardShadow>

      <SectionLabel text="PREVIEW" colors={colors} />
      <HardShadow>
        <NbCard style={styles.previewCard}>
          <LinearGradient colors={accentGradients[3]} style={styles.previewAvatar}>
            <Text style={{
            fontWeight: '900',
            color: colors.nbInk
          }}>{initials}</Text>
          </LinearGradient>
          <View style={{
          flex: 1
        }}>
            <Text style={[styles.previewTitle, {
            color: colors.nbInk
          }]}>You, as clients see you</Text>
            <Text style={[styles.previewSub, {
            color: colors.nbMuted
          }]}>{specialtyLine}</Text>
          </View>
          <Text style={[styles.previewFrom, {
          color: colors.nbInk
        }]}>
            from <Text style={{
            fontWeight: '900'
          }}>${previewFromPrice}</Text>
          </Text>
        </NbCard>
      </HardShadow>
    </View>;
}
function InviteStep({
  inviteCode,
  generatingCode,
  onCopy,
  onShare
}) {
  const {
    colors
  } = useTheme();
  const displayCode = formatInviteDisplay(inviteCode);
  const codeDisabled = !inviteCode;
  return <View style={styles.stack}>
      <HardShadow>
        <View style={[styles.codeHero, {
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbFill
      }]}>
          <Text style={[styles.codeEyebrow, {
          color: colors.nbMuted
        }]}>SHARE THIS WITH CURRENT CLIENTS</Text>
          {generatingCode ? <ActivityIndicator color={colors.nbOnFill} /> : <Text style={[styles.codeText, {
          color: colors.nbOnFill
        }]}>{displayCode}</Text>}
          <NbButton variant="plain" onPress={onCopy} disabled={codeDisabled} style={{
          marginTop: 12
        }}>
            Copy code
          </NbButton>
        </View>
      </HardShadow>

      <HeroWithLottie title="Anyone who enters it is linked to you." subtitle="You approve them before they see your plans." lottie={LOTTIE_INVITE} colors={colors} />

      <SectionLabel text="HOW IT WORKS" colors={colors} />
      {INVITE_HOW_IT_WORKS.map(howStep => {
      const isFirstStep = howStep.stepNumber === 1;
      const dotBackground = isFirstStep ? colors.nbFill : colors.nbSurface;
      const numberColor = isFirstStep ? colors.nbOnFill : colors.nbInk;
      return <View key={howStep.stepNumber} style={styles.timelineRow}>
            <View style={[styles.timelineDot, {
          borderColor: colors.nbBorder,
          backgroundColor: dotBackground
        }]}>
              <Text style={{
            fontWeight: '900',
            color: numberColor
          }}>{howStep.stepNumber}</Text>
            </View>
            <View style={{
          flex: 1
        }}>
              <Text style={[styles.timelineTitle, {
            color: colors.nbInk
          }]}>{howStep.title}</Text>
              <Text style={[styles.timelineSub, {
            color: colors.nbMuted
          }]}>{howStep.sub}</Text>
            </View>
          </View>;
    })}

      <SectionLabel text="SEND IT" colors={colors} />
      <View style={{
      flexDirection: 'row',
      gap: 10
    }}>
        <NbButton variant="plain" onPress={onShare} disabled={codeDisabled} style={{
        flex: 1
      }}>
          Message
        </NbButton>
        <NbButton variant="plain" onPress={onCopy} disabled={codeDisabled} style={{
        flex: 1
      }}>
          Copy link
        </NbButton>
      </View>
    </View>;
}
function ReviewStep({
  data,
  inviteCode,
  onEditStep,
  onGoLive,
  onSaveLater
}) {
  var _optObj7;
  const {
    colors
  } = useTheme();
  const sessionRate = ((_optObj7 = data == null ? void 0 : data.pricing) == null ? void 0 : _optObj7.perSession) ?? RATE_DEFAULT;
  const yearsShown = stepperFromYearsBucket(data.yearsExperience);
  const certCount = countSelectedCertsExcludingNone(data.certifications);
  const summaryRows = [{
    key: 'specialties',
    title: 'Specialties',
    sub: `${specialtyLabels(data) || '—'} · ${yearsShown} years`,
    gradient: accentGradients[0],
    icon: 'barbell'
  }, {
    key: 'credentials',
    title: 'Credentials',
    sub: `${certCount} selected`,
    gradient: accentGradients[2],
    icon: 'time'
  }, {
    key: 'rates',
    title: 'Rates',
    sub: `$${sessionRate} per session · 3 packages`,
    gradient: accentGradients[1],
    icon: 'rates'
  }, {
    key: 'invite',
    title: 'Invite code',
    sub: formatInviteDisplay(inviteCode),
    gradient: accentGradients[3],
    icon: 'invite'
  }];
  return <View style={styles.stack}>
      <HardShadow>
        <NbCard>
          <View style={styles.reviewTop}>
            <Text style={[styles.reviewTitle, {
            color: colors.nbInk
          }]}>Profile complete</Text>
            <Text style={[styles.reviewPct, {
            color: colors.nbInk
          }]}>100%</Text>
          </View>
          <LinearGradient colors={accentGradients[0]} start={{
          x: 0,
          y: 0.5
        }} end={{
          x: 1,
          y: 0.5
        }} style={styles.reviewBar} />
          <Text style={[styles.hint, {
          color: colors.nbMuted,
          marginTop: 8
        }]}>
            One credential may still be in review. It does not block going live.
          </Text>
        </NbCard>
      </HardShadow>

      <HardShadow>
        <NbCard style={{
        paddingVertical: 0
      }}>
          {summaryRows.map((summaryRow, rowIndex) => {
          const topBorder = rowIndex > 0 ? {
            borderTopWidth: nb.borderWidth,
            borderTopColor: colors.nbBorder
          } : null;
          return <TouchableOpacity key={summaryRow.key} onPress={() => onEditStep == null ? void 0 : onEditStep(REVIEW_EDIT_STEP_BY_KEY[summaryRow.key])} style={[styles.summaryRow, topBorder]}>
                <LinearGradient colors={summaryRow.gradient} style={styles.summaryIcon}>
                  <Ionicons name="ellipse" size={8} color={colors.nbInk} />
                </LinearGradient>
                <View style={{
              flex: 1
            }}>
                  <Text style={[styles.summaryTitle, {
                color: colors.nbInk
              }]}>{summaryRow.title}</Text>
                  <Text style={[styles.summarySub, {
                color: colors.nbMuted
              }]}>{summaryRow.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
              </TouchableOpacity>;
        })}
        </NbCard>
      </HardShadow>

      <NbButton variant="fill" onPress={onGoLive}>
        Go live in the marketplace
      </NbButton>
      <NbButton variant="plain" onPress={onSaveLater}>
        Save and finish later
      </NbButton>
    </View>;
}
function AvailabilityStep({
  data,
  setData
}) {
  const {
    colors
  } = useTheme();
  // Persist best-times on onboardingData (was local-only useState — lost on Continue).
  // vocab: preferredSessionTimes = string[] of TIME_CHIPS ids saved with the trainer profile
  const selectedTimes = Array.isArray(data.preferredSessionTimes) ? data.preferredSessionTimes : [];
  const togglePreferredTime = timeChipId => {
    setData(previousData => {
      const currentTimes = Array.isArray(previousData.preferredSessionTimes) ? previousData.preferredSessionTimes : [];
      if (currentTimes.includes(timeChipId)) {
        return {
          ...previousData,
          preferredSessionTimes: currentTimes.filter(existingId => existingId !== timeChipId)
        };
      }
      return {
        ...previousData,
        preferredSessionTimes: [...currentTimes, timeChipId]
      };
    });
  };
  const saveAvailabilityStatus = statusId => {
    setData(previousData => ({
      ...previousData,
      trainerAvailabilityStatus: statusId
    }));
  };
  const saveSessionType = formatValue => {
    setData(previousData => ({
      ...previousData,
      sessionType: formatValue
    }));
  };
  return <View style={styles.stack}>
      <HeroWithLottie title="How can clients book you?" subtitle="Set how clients can book with you." lottie={LOTTIE_RATES} colors={colors} />

      <SectionLabel text="AVAILABILITY" colors={colors} />
      <View style={[styles.segRow, {
      borderColor: colors.nbBorder
    }]}>
        {AVAILABILITY_STATUS_OPTIONS.map((statusOption, statusIndex) => {
        const isSelected = data.trainerAvailabilityStatus === statusOption.id;
        const cellBackground = isSelected ? colors.nbFill : colors.nbSurface;
        const cellTextColor = isSelected ? colors.nbOnFill : colors.nbInk;
        const leftBorder = statusIndex > 0 ? {
          borderLeftWidth: nb.borderWidth,
          borderLeftColor: colors.nbBorder
        } : null;
        return <TouchableOpacity key={statusOption.id} onPress={() => saveAvailabilityStatus(statusOption.id)} style={[styles.segCell, {
          backgroundColor: cellBackground
        }, leftBorder]}>
              <Text style={[styles.segText, {
            color: cellTextColor
          }]}>{statusOption.label}</Text>
            </TouchableOpacity>;
      })}
      </View>
      <Text style={[styles.hint, {
      color: colors.nbMuted
    }]}>
        Waitlist shows a badge on your card and still lets clients request you.
      </Text>

      <SectionLabel text="SESSION FORMAT" colors={colors} />
      <View style={styles.formatGrid}>
        {SESSION_FORMAT_OPTIONS.map(formatOption => <FormatTile key={formatOption.value} option={formatOption} selected={data.sessionType === formatOption.value} onPress={() => saveSessionType(formatOption.value)} colors={colors} />)}
      </View>

      <SectionLabel text="BEST TIMES FOR SESSIONS · optional" colors={colors} />
      <View style={styles.chipGrid}>
        {TIME_CHIPS.map(timeChip => <NbChip key={timeChip.id} selected={selectedTimes.includes(timeChip.id)} onPress={() => togglePreferredTime(timeChip.id)} style={styles.specChip}>
            {timeChip.label}
          </NbChip>)}
      </View>
    </View>;
}
function FaceVerificationSubmittedBlock({
  data,
  colors
}) {
  return <>
      <HardShadow>
        <NbCard style={styles.faceCard}>
          <LinearGradient colors={accentGradients[2]} style={styles.summaryIcon}>
            <Ionicons name="time-outline" size={18} color={colors.nbInk} />
          </LinearGradient>
          <View style={{
          flex: 1,
          minWidth: 0
        }}>
            <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap'
          }}>
              <Text style={[styles.summaryTitle, {
              color: colors.nbInk
            }]}>
                Identity Verification submitted
              </Text>
              <View style={{
              borderWidth: nb.borderWidth,
              borderColor: colors.nbBorder,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
              backgroundColor: colors.nbSoft
            }}>
                <Text style={{
                fontSize: 11,
                fontWeight: '900',
                color: colors.nbInk
              }}>In review</Text>
              </View>
            </View>
            <Text style={[styles.summarySub, {
            color: colors.nbMuted,
            marginTop: 4
          }]}>
              Face photo uploaded for manual review. You can keep going. We will tell you when it is approved.
            </Text>
          </View>
        </NbCard>
      </HardShadow>
      <HardShadow>
        <View style={[styles.facePreviewFrame, {
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbSoft
      }]}>
          {data.faceVerificationPhotoURL ? <Image source={{
          uri: data.faceVerificationPhotoURL
        }} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : null}
          <View pointerEvents="none" style={[styles.faceOvalGuide, {
          borderColor: colors.nbBorder
        }]} />
        </View>
      </HardShadow>
    </>;
}
function FaceVerificationStartBlock({
  onStartFace,
  faceCapturing,
  colors
}) {
  return <HardShadow>
      <NbCard style={styles.faceCard}>
        <LinearGradient colors={accentGradients[2]} style={styles.summaryIcon}>
          <Ionicons name="scan-outline" size={18} color={colors.nbInk} />
        </LinearGradient>
        <View style={{
        flex: 1
      }}>
          <Text style={[styles.summaryTitle, {
          color: colors.nbInk
        }]}>
            Identity verification (Face ID)
          </Text>
          <Text style={[styles.summarySub, {
          color: colors.nbMuted
        }]}>
            Takes 30 seconds. Reviewed by a person.
          </Text>
        </View>
        <NbButton variant="plain" onPress={onStartFace} disabled={faceCapturing}>
          Start
        </NbButton>
      </NbCard>
    </HardShadow>;
}
function AlmostDoneStep({
  data,
  setData,
  onStartFace,
  faceCapturing,
  faceSubmitted
}) {
  const {
    colors
  } = useTheme();
  const initials = initialsFromName(data.name, 'JR');
  const cardName = data.name || 'Your name';
  const cardLocation = data.location || 'City, ST';
  const cardBlurb = data.trainerProfileBio || data.trainingPhilosophy || 'Your blurb';
  const previewSpecialties = (data.specialties || []).slice(0, SPECIALTY_PREVIEW_MAX);

  // PNG 09: after capture, show submitted card + striped oval preview (form stays above for edits).
  const faceVerificationBlock = faceSubmitted ? <FaceVerificationSubmittedBlock data={data} colors={colors} /> : <FaceVerificationStartBlock onStartFace={onStartFace} faceCapturing={faceCapturing} colors={colors} />;
  const saveName = text => {
    setData(previousData => ({
      ...previousData,
      name: text
    }));
  };
  const saveLocation = text => {
    setData(previousData => ({
      ...previousData,
      location: text
    }));
  };
  const saveMarketplaceBio = text => {
    setData(previousData => ({
      ...previousData,
      trainerProfileBio: text.slice(0, MARKETPLACE_BIO_MAX)
    }));
  };
  return <View style={styles.stack}>
      <Text style={[styles.h1, {
      color: colors.nbInk
    }]}>A few last details</Text>
      <Text style={[styles.sub, {
      color: colors.nbMuted,
      marginBottom: spacing.md
    }]}>
        A few last details for your profile.
      </Text>

      <SectionLabel text="FULL NAME" colors={colors} />
      <TextInput value={data.name || ''} onChangeText={saveName} style={[styles.singleInput, {
      borderColor: colors.nbBorder,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface
    }]} />

      <SectionLabel text="CITY, STATE" colors={colors} />
      <TextInput value={data.location || ''} onChangeText={saveLocation} style={[styles.singleInput, {
      borderColor: colors.nbBorder,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface
    }]} />

      <SectionLabel text="MARKETPLACE BLURB" colors={colors} />
      <TextInput value={data.trainerProfileBio || ''} onChangeText={saveMarketplaceBio} multiline style={[styles.textArea, {
      borderColor: colors.nbBorder,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface
    }]} />

      <SectionLabel text="HOW YOUR CARD LOOKS" colors={colors} />
      <HardShadow>
        <NbCard>
          <View style={{
          flexDirection: 'row',
          gap: 12,
          alignItems: 'flex-start'
        }}>
            <LinearGradient colors={accentGradients[0]} style={styles.previewAvatar}>
              <Text style={{
              fontWeight: '900',
              color: colors.nbInk
            }}>{initials}</Text>
            </LinearGradient>
            <View style={{
            flex: 1
          }}>
              <Text style={[styles.previewTitle, {
              color: colors.nbInk
            }]}>{cardName}</Text>
              <Text style={[styles.previewSub, {
              color: colors.nbMuted
            }]}>{cardLocation}</Text>
              <Text style={[styles.previewSub, {
              color: colors.nbInk,
              marginTop: 6
            }]}>{cardBlurb}</Text>
              <View style={[styles.chipGrid, {
              marginTop: 8
            }]}>
                {previewSpecialties.map((specialtyValue, specialtyIndex) => {
                var _optObj8;
                const specialtyLabel = ((_optObj8 = SPECIALTY_OPTIONS.find(option => option.value === specialtyValue)) == null ? void 0 : _optObj8.label) || specialtyValue;
                const gradientColors = accentGradients[specialtyIndex % accentGradients.length];
                return <LinearGradient key={specialtyValue} colors={gradientColors} style={styles.tagPill}>
                      <Text style={styles.tagText}>{specialtyLabel}</Text>
                    </LinearGradient>;
              })}
              </View>
            </View>
          </View>
        </NbCard>
      </HardShadow>

      {faceVerificationBlock}
    </View>;
}
function CompleteStep({
  data,
  inviteCode,
  userName
}) {
  var _optObj9;
  const {
    colors
  } = useTheme();
  const sessionRate = ((_optObj9 = data == null ? void 0 : data.pricing) == null ? void 0 : _optObj9.perSession) ?? RATE_DEFAULT;
  const displayName = String(userName || data.name || 'Coach').split(' ')[0];
  const certCount = countSelectedCertsExcludingNone(data.certifications);
  const identitySub = data.faceVerificationPhotoURL ? 'In review' : 'Not submitted';
  const summaryRows = [{
    title: 'Profile and rates',
    sub: `$${sessionRate} per session · ${data.sessionType || 'Both'}`
  }, {
    title: 'Credentials',
    sub: `${certCount} selected`
  }, {
    title: 'Identity',
    sub: identitySub
  }, {
    title: 'Payouts',
    sub: 'Set up in Settings anytime'
  }, {
    title: 'Invite code',
    sub: formatInviteDisplay(inviteCode)
  }];
  return <View style={styles.stack}>
      <HardShadow>
        <View style={[styles.liveHero, {
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbFill
      }]}>
          <Text style={[styles.codeEyebrow, {
          color: colors.nbMuted
        }]}>SETUP COMPLETE</Text>
          <Text style={[styles.liveTitle, {
          color: colors.nbOnFill
        }]}>{`Welcome, ${displayName}.`}</Text>
          <Text style={[styles.liveBody, {
          color: colors.nbOnFill
        }]}>
            Your profile is in the marketplace and your invite code is ready.
          </Text>
        </View>
      </HardShadow>

      <HardShadow>
        <NbCard style={{
        paddingVertical: 0
      }}>
          {summaryRows.map((summaryRow, rowIndex) => {
          const topBorder = rowIndex > 0 ? {
            borderTopWidth: nb.borderWidth,
            borderTopColor: colors.nbBorder
          } : null;
          return <View key={summaryRow.title} style={[styles.summaryRow, topBorder]}>
                <View style={[styles.checkDot, {
              borderColor: colors.nbBorder,
              backgroundColor: colors.nbFill
            }]}>
                  <Ionicons name="checkmark" size={14} color={colors.nbOnFill} />
                </View>
                <View style={{
              flex: 1
            }}>
                  <Text style={[styles.summaryTitle, {
                color: colors.nbInk
              }]}>{summaryRow.title}</Text>
                  <Text style={[styles.summarySub, {
                color: colors.nbMuted
              }]}>{summaryRow.sub}</Text>
                </View>
              </View>;
        })}
        </NbCard>
      </HardShadow>
    </View>;
}

// ===== MAIN FUNCTION =====

/**
 * Renders one trainer onboarding step body for NewUserSetupScreen (step number is 1–10).
 * @param {object} props — step, onboarding data, invite/payout/pro callbacks from parent wizard
 */
export default function TrainerOnboardingStep(props) {
  const {
    step,
    data,
    setData,
    onToggleField,
    onUploadCert,
    certUploading,
    inviteCode,
    generatingCode,
    onCopyInvite,
    onShareInvite,
    onEditReviewStep,
    onReviewGoLive,
    onReviewSaveLater,
    onStartFace,
    faceCapturing,
    payoutEmail,
    onPayoutSkip,
    onPayoutComplete,
    identitySubmitted,
    isDark,
    trainerPlanId,
    setTrainerPlanId,
    onProSkip,
    displayName
  } = props;

  // 1. Profile (specialties + years).
  if (step === 1) {
    return <ProfileStep data={data} setData={setData} onToggleSpecialty={value => onToggleField('specialties', value, true)} />;
  }

  // 2. Credentials.
  if (step === 2) {
    return <CredentialsStep data={data} setData={setData} onToggleCert={value => onToggleField('certifications', value, true)} onUploadCert={onUploadCert} certUploading={certUploading} />;
  }

  // 3. Rates + session format.
  if (step === 3) {
    return <RatesStep data={data} setData={setData} />;
  }

  // 4. Invite code.
  if (step === 4) {
    return <InviteStep inviteCode={inviteCode} generatingCode={generatingCode} onCopy={onCopyInvite} onShare={onShareInvite} />;
  }

  // 5. Review before marketplace.
  if (step === 5) {
    return <ReviewStep data={data} inviteCode={inviteCode} onEditStep={onEditReviewStep} onGoLive={onReviewGoLive} onSaveLater={onReviewSaveLater} />;
  }

  // 6. Availability + best times.
  if (step === 6) {
    return <AvailabilityStep data={data} setData={setData} />;
  }

  // 7. Name / location / face verification.
  if (step === ONBOARDING_STEP_ALMOST_DONE) {
    return <AlmostDoneStep data={data} setData={setData} onStartFace={onStartFace} faceCapturing={faceCapturing} faceSubmitted={Boolean(data.faceVerificationPhotoURL)} />;
  }

  // 8. Payouts.
  if (step === TRAINER_PAYOUT_STEP) {
    return <TrainerPayoutSetupStep email={payoutEmail} isDark={isDark} onSkip={onPayoutSkip} onComplete={onPayoutComplete} designLaw identitySubmitted={Boolean(identitySubmitted)} />;
  }

  // 9. Pro offer.
  if (step === TRAINER_PRO_STEP) {
    return <TrainerProOfferStep isDark={isDark} selectedPlanId={trainerPlanId} onSelectPlan={setTrainerPlanId} designLaw onSkip={onProSkip} />;
  }

  // 10. Live / complete hero.
  if (step === TRAINER_COMPLETE_STEP) {
    return <CompleteStep data={data} inviteCode={inviteCode} userName={displayName} />;
  }
  return null;
}

// PLUMBING — skip unless debugging

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    paddingBottom: spacing.sm
  },
  heroCard: {
    marginBottom: 0
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  h1: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4
  },
  sub: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 4
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  counter: {
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums']
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8
  },
  specChip: {
    minHeight: 44
  },
  // Manipulate here: specialty pill padding — keep min touch 44
  specPill: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
    alignItems: 'center'
  },
  specPillText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13
  },
  stepperCard: {
    paddingVertical: 12
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepperVal: {
    fontSize: 40,
    fontWeight: '900',
    minWidth: 48,
    textAlign: 'center',
    fontVariant: ['tabular-nums']
  },
  expBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: nb.borderWidth
  },
  expBadgeText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12
  },
  textArea: {
    minHeight: 96,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 12,
    fontSize: 15,
    fontWeight: '600',
    textAlignVertical: 'top'
  },
  singleInput: {
    minHeight: 52,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4
  },
  certDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  certTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  certMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000'
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17
  },
  rateHero: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbHero,
    padding: 16,
    gap: 8
  },
  rateEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1
  },
  rateBig: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1
  },
  rateUnit: {
    fontSize: 16,
    fontWeight: '700'
  },
  segRow: {
    flexDirection: 'row',
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden'
  },
  segCell: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8
  },
  segText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center'
  },
  packRow: {
    paddingVertical: 12,
    gap: 2
  },
  packTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  packSub: {
    fontSize: 12,
    fontWeight: '600'
  },
  packPrice: {
    position: 'absolute',
    right: 0,
    top: 14,
    fontSize: 16,
    fontWeight: '900'
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  previewSub: {
    fontSize: 12,
    fontWeight: '600'
  },
  previewFrom: {
    fontSize: 13,
    fontWeight: '700'
  },
  codeHero: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbHero,
    padding: 16,
    alignItems: 'stretch'
  },
  codeEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 8
  },
  codeText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    fontVariant: ['tabular-nums']
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 10
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '800'
  },
  timelineSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '900'
  },
  reviewPct: {
    fontSize: 32,
    fontWeight: '900'
  },
  reviewBar: {
    height: 10,
    borderRadius: 6,
    marginTop: 10
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  summarySub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  formatGrid: {
    flexDirection: 'row',
    gap: 10
  },
  formatTile: {
    flex: 1,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    minHeight: 120,
    shadowOffset: {
      width: 3,
      height: 3
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3
  },
  formatTick: {
    position: 'absolute',
    top: 8,
    right: 8
  },
  formatIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  formatLabel: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center'
  },
  faceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  // PNG 09 verification submitted: striped/soft frame with oval face guide
  facePreviewFrame: {
    height: 220,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbHero,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center'
  },
  faceOvalGuide: {
    width: 140,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderStyle: 'dashed',
    backgroundColor: 'transparent'
  },
  tagPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  tagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000'
  },
  liveHero: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbHero,
    padding: 20,
    gap: 6
  },
  liveTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6
  },
  liveBody: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    opacity: 0.92
  },
  checkDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
