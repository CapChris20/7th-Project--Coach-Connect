// Design Law trainer onboarding — parts 1 + 2 (screens/trainer-setup + trainer-setup-part-2 PNGs).
// Flow: Profile → Credentials → Rates → Invite → Review → Availability → Almost done → Payouts → Pro → Live.
// Used by NewUserSetupScreen when role === 'trainer'. Firestore field names unchanged.
//
// Priority: PNG > DESIGN-SYSTEM > mockups/trainer-setup*.html

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NbSlider from '../look-and-feel/NbSlider';
import NbCard from '../look-and-feel/NbCard';
import NbButton from '../look-and-feel/NbButton';
import NbChip from '../look-and-feel/NbChip';
import HardShadow from '../look-and-feel/HardShadow';
import {
  accentGradients,
  borderRadius,
  nb,
  spacing,
} from '../look-and-feel/colorPalette';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getOnboardingIconSource } from '../for-both/setup-icons/onboardingIconRegistry';
import {
  certificationStatusLabel,
  certificationStatusDetail,
} from '../for-both/online-connection/checkTrainerCertificate';
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

const LOTTIE_SPECIALTIES = require('../assets/animations/app-flows/specialties');
const LOTTIE_CERTS = require('../assets/animations/app-flows/certifications');
const LOTTIE_RATES = require('../assets/animations/app-flows/rates');
const LOTTIE_INVITE = require('../assets/animations/app-flows/invite-code');

const SPECIALTY_OPTIONS = [
  { value: 'strength', label: 'Strength' },
  { value: 'weight_loss', label: 'Fat loss' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'bodybuilding', label: 'Hypertrophy' },
  { value: 'powerlifting', label: 'Powerlifting' },
  { value: 'boxing', label: 'Boxing' },
  { value: 'postnatal', label: 'Postnatal' },
  { value: 'senior', label: 'Senior fitness' },
  { value: 'rehabilitation', label: 'Return from injury' },
  { value: 'athletic', label: 'Sports prep' },
  { value: 'nutrition', label: 'Nutrition coaching' },
  { value: 'calisthenics', label: 'Calisthenics' },
];

const CERT_OPTIONS = [
  { value: 'NASM-CPT', label: 'NASM Certified Personal Trainer', org: 'NASM' },
  { value: 'ACE', label: 'ACE Certified Personal Trainer', org: 'ACE' },
  { value: 'ISSA', label: 'ISSA Certified', org: 'ISSA' },
  { value: 'ACSM', label: 'ACSM Certified', org: 'ACSM' },
  { value: 'NSCA-CPT', label: 'NSCA-CPT', org: 'NSCA' },
  { value: 'Other', label: 'Other certification', org: 'Other' },
  { value: 'None', label: 'No formal certification', org: null },
];

const SESSION_FORMAT_OPTIONS = [
  { value: 'In-person', label: 'In person', iconKey: 'gym' },
  { value: 'Remote', label: 'Online', iconKey: 'remote' },
  { value: 'Both', label: 'Both', iconKey: 'both' },
];

const TIME_CHIPS = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'weekends', label: 'Weekends' },
];

const CHAPTER_BY_STEP = {
  1: { chapter: 1, fraction: 0.4, label: 'PROFILE', n: 1, heroTime: 'About 4 minutes' },
  2: { chapter: 1, fraction: 0.75, label: 'PROFILE', n: 2 },
  3: { chapter: 2, fraction: 0.45, label: 'PROOF', n: 3 },
  4: { chapter: 2, fraction: 0.8, label: 'PROOF', n: 4 },
  5: { chapter: 2, fraction: 1, label: 'PROOF', n: 5 },
  6: { chapter: 3, fraction: 0.35, label: 'BUSINESS', n: 5 },
  7: { chapter: 3, fraction: 0.55, label: 'BUSINESS', n: 6 },
  8: { chapter: 3, fraction: 0.75, label: 'BUSINESS', n: 7 },
  9: { chapter: 3, fraction: 0.95, label: 'BUSINESS', n: 8 },
  10: { chapter: 3, fraction: 1, label: 'BUSINESS', n: 8, done: true },
};

const SCREEN_TITLES = {
  1: 'Set up your profile',
  2: 'Credentials',
  3: 'Your rates',
  4: 'Your trainer code',
  5: 'Review',
  6: 'Availability',
  7: 'Almost done',
  8: 'Payouts',
  9: 'Coach Connect Pro',
  10: 'You are live',
};

// ===== HELPER FUNCTIONS =====

export function getTrainerScreenTitle(step) {
  return SCREEN_TITLES[step] || 'Setup';
}

/** Three chapter bars + “CHAPTER N OF 3 · LABEL” meta (matches client + part-2 PNGs). */
export function getTrainerChapterMeta(step) {
  const meta = CHAPTER_BY_STEP[step] || CHAPTER_BY_STEP[1];
  return {
    chapter: meta.chapter,
    of: 3,
    fraction: meta.fraction,
    label: meta.label,
    heroTime: meta.heroTime || null,
    stepLabel: meta.done
      ? `${TRAINER_BUSINESS_STEP_COUNT} / ${TRAINER_BUSINESS_STEP_COUNT}`
      : meta.chapter === 3
        ? `${meta.n} / ${TRAINER_BUSINESS_STEP_COUNT}`
        : `${meta.n} / 5`,
    done: !!meta.done,
  };
}

/** Map Design Law stepper years to existing bucket keys. */
export function yearsBucketFromStepper(n) {
  const v = Math.max(0, Math.round(n));
  if (v < 1) return 'less_than_1';
  if (v <= 2) return '1_2';
  if (v <= 5) return '3_5';
  if (v <= 10) return '6_10';
  return '10_plus';
}

export function stepperFromYearsBucket(bucket) {
  switch (bucket) {
    case 'less_than_1':
      return 0;
    case '1_2':
      return 2;
    case '3_5':
      return 4;
    case '6_10':
      return 7;
    case '10_plus':
      return 12;
    default:
      return 4;
  }
}

function yearsBadgeLabel(n) {
  if (n >= 8) return 'Experienced';
  if (n >= 4) return 'Seasoned';
  if (n >= 1) return 'Growing';
  return 'New coach';
}

export function withTrainerSliderDefaults(data) {
  const perSession =
    data?.pricing?.perSession != null ? data.pricing.perSession : RATE_DEFAULT;
  return {
    ...data,
    pricing: { ...(data.pricing || {}), perSession },
  };
}

export function validateTrainerOnboardingStep(step, data) {
  switch (step) {
    case 1:
      return (
        Array.isArray(data.specialties) &&
        data.specialties.length > 0 &&
        data.yearsExperience != null
      );
    case 2:
      return Array.isArray(data.certifications) && data.certifications.length > 0;
    case 3:
      return (
        data?.pricing?.perSession != null &&
        data?.pricing?.perSession >= RATE_MIN &&
        !!data.sessionType
      );
    case 4:
      return true;
    case 5:
      return true;
    case 6:
      return !!data.trainerAvailabilityStatus && !!data.sessionType;
    case 7:
      return !!(String(data.name || '').trim() && String(data.location || '').trim());
    case 8:
    case 9:
    case 10:
      return true;
    default:
      return false;
  }
}

function specialtyLabels(data) {
  const map = Object.fromEntries(SPECIALTY_OPTIONS.map((o) => [o.value, o.label]));
  return (data.specialties || []).slice(0, 3).map((v) => map[v] || v).join(', ');
}

function formatInviteDisplay(code) {
  if (!code) return 'COACH-····';
  return `COACH-${String(code).replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

function packageRows(rate) {
  const base = Number(rate) || RATE_DEFAULT;
  const four = Math.round(base * 4 * 0.95);
  const twelve = Math.round(base * 12 * 0.88);
  return [
    { title: 'Single session', sub: 'Pay as you go', price: base },
    { title: '4-session pack', sub: '5% off, one month', price: four },
    { title: '12-session pack', sub: '12% off, one quarter', price: twelve },
  ];
}

function SectionLabel({ text, right, colors }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{text}</Text>
      {right || null}
    </View>
  );
}

function HeroWithLottie({ title, subtitle, lottie, colors }) {
  return (
    <HardShadow>
      <NbCard style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.h1, { color: colors.nbInk }]}>{title}</Text>
            {subtitle ? <Text style={[styles.sub, { color: colors.nbMuted }]}>{subtitle}</Text> : null}
          </View>
          {lottie ? (
            <LottieView source={lottie} autoPlay loop style={{ width: 88, height: 88 }} />
          ) : null}
        </View>
      </NbCard>
    </HardShadow>
  );
}

function FormatTile({ option, selected, onPress, colors }) {
  const src = getOnboardingIconSource(option.iconKey);
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.formatTile,
        {
          borderColor: colors.nbBorder,
          backgroundColor: selected ? colors.nbFill : colors.nbSurface,
          shadowColor: colors.nbShadow,
        },
      ]}
    >
      {selected ? (
        <Ionicons name="checkmark" size={16} color={colors.nbOnFill} style={styles.formatTick} />
      ) : null}
      <View style={[styles.formatIcon, { borderColor: colors.nbBorder }]}>
        <LinearGradient colors={accentGradients[2]} style={StyleSheet.absoluteFillObject} />
        {src ? <Image source={src} style={{ width: 28, height: 28 }} resizeMode="contain" /> : null}
      </View>
      <Text style={[styles.formatLabel, { color: selected ? colors.nbOnFill : colors.nbInk }]}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );
}

// ===== STEP SCREENS =====

function ProfileStep({ data, setData, onToggleSpecialty }) {
  const { colors } = useTheme();
  const years = stepperFromYearsBucket(data.yearsExperience);
  const selected = data.specialties || [];

  const toggleSpec = (value) => {
    if (selected.includes(value)) {
      onToggleSpecialty(value, true);
      return;
    }
    if (selected.length >= SPECIALTY_MAX) return;
    onToggleSpecialty(value, true);
  };

  return (
    <View style={styles.stack}>
      <HeroWithLottie
        title="What do you coach best?"
        subtitle="Clients filter by these. Your first three count most."
        lottie={LOTTIE_SPECIALTIES}
        colors={colors}
      />

      <SectionLabel
        text="SPECIALTIES"
        colors={colors}
        right={
          <Text style={[styles.counter, { color: colors.nbMuted }]}>
            {`${Math.min(selected.length, SPECIALTY_MAX)} OF ${SPECIALTY_MAX}`}
          </Text>
        }
      />
      <View style={styles.chipGrid}>
        {SPECIALTY_OPTIONS.map((opt) => {
          const on = selected.includes(opt.value);
          return (
            <NbChip
              key={opt.value}
              selected={on}
              onPress={() => toggleSpec(opt.value)}
              style={styles.specChip}
            >
              {on ? `${opt.label} ✓` : opt.label}
            </NbChip>
          );
        })}
      </View>

      <SectionLabel text="YEARS COACHING" colors={colors} />
      <HardShadow>
        <NbCard style={styles.stepperCard}>
          <View style={styles.stepperRow}>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() =>
                setData((prev) => ({
                  ...prev,
                  yearsExperience: yearsBucketFromStepper(Math.max(0, years - 1)),
                }))
              }
              style={[styles.stepBtn, { borderColor: colors.nbBorder }]}
            >
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.nbInk }}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.stepperVal, { color: colors.nbInk }]}>{years}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() =>
                setData((prev) => ({
                  ...prev,
                  yearsExperience: yearsBucketFromStepper(Math.min(25, years + 1)),
                }))
              }
              style={[styles.stepBtn, { borderColor: colors.nbBorder }]}
            >
              <Text style={{ fontSize: 22, fontWeight: '900', color: colors.nbInk }}>+</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <LinearGradient colors={accentGradients[2]} style={styles.expBadge}>
              <Text style={styles.expBadgeText}>{yearsBadgeLabel(years)}</Text>
            </LinearGradient>
          </View>
        </NbCard>
      </HardShadow>

      <SectionLabel text="YOUR COACHING PHILOSOPHY" colors={colors} />
      <TextInput
        value={data.trainingPhilosophy || ''}
        onChangeText={(text) =>
          setData((prev) => ({ ...prev, trainingPhilosophy: text.slice(0, PHILOSOPHY_MAX) }))
        }
        placeholder="Strong first, pretty second. I build programs around the lifts you can repeat for years."
        placeholderTextColor={colors.nbMuted}
        multiline
        style={[
          styles.textArea,
          { borderColor: colors.nbBorder, color: colors.nbInk, backgroundColor: colors.nbSurface },
        ]}
      />
    </View>
  );
}

function CredentialsStep({
  data,
  setData,
  onToggleCert,
  onUploadCert,
  certUploading,
}) {
  const { colors } = useTheme();
  const status = data.certificationVerificationStatus;
  const selected = data.certifications || [];

  return (
    <View style={styles.stack}>
      <HeroWithLottie
        title="Show what you hold"
        subtitle="Clients see a badge next to each verified one."
        lottie={LOTTIE_CERTS}
        colors={colors}
      />
      <SectionLabel
        text="YOUR CERTIFICATIONS"
        colors={colors}
        right={
          <Text style={[styles.counter, { color: colors.nbMuted }]}>
            {`${Math.min(selected.filter((c) => c !== 'None').length, 3)} OF 3 VERIFIED`}
          </Text>
        }
      />
      <HardShadow>
        <NbCard style={{ paddingVertical: 4 }}>
          {CERT_OPTIONS.filter((c) => c.value !== 'None').slice(0, 3).map((cert, index) => {
            const on = selected.includes(cert.value);
            const rowStatus = on ? (status === 'verified' ? 'Verified' : 'In review') : null;
            return (
              <View
                key={cert.value}
                style={[
                  styles.certRow,
                  index > 0 ? { borderTopWidth: nb.borderWidth, borderTopColor: colors.nbBorder } : null,
                ]}
              >
                <View
                  style={[
                    styles.certDot,
                    {
                      borderColor: colors.nbBorder,
                      backgroundColor: on ? colors.nbFill : colors.nbSurface,
                    },
                  ]}
                >
                  {on ? <Ionicons name="checkmark" size={14} color={colors.nbOnFill} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.certTitle, { color: colors.nbInk }]}>{cert.label}</Text>
                  <Text style={[styles.certMeta, { color: colors.nbMuted }]}>
                    {cert.org ? `${cert.org} · —` : ''}
                  </Text>
                </View>
                {rowStatus ? (
                  <LinearGradient colors={accentGradients[1]} style={styles.statusPill}>
                    <Text style={styles.statusPillText}>{rowStatus}</Text>
                  </LinearGradient>
                ) : null}
              </View>
            );
          })}
        </NbCard>
      </HardShadow>

      <View style={styles.chipGrid}>
        {CERT_OPTIONS.map((cert) => (
          <NbChip
            key={cert.value}
            selected={selected.includes(cert.value)}
            onPress={() => onToggleCert(cert.value, true)}
            style={styles.specChip}
          >
            {cert.label}
          </NbChip>
        ))}
      </View>

      {selected.includes('Other') ? (
        <TextInput
          value={data.certificationOther || ''}
          onChangeText={(text) => setData((prev) => ({ ...prev, certificationOther: text }))}
          placeholder="e.g. Precision Nutrition Level 1"
          placeholderTextColor={colors.nbMuted}
          style={[
            styles.singleInput,
            { borderColor: colors.nbBorder, color: colors.nbInk, backgroundColor: colors.nbSurface },
          ]}
        />
      ) : null}

      <NbButton variant="plain" onPress={onUploadCert} disabled={certUploading}>
        {certUploading ? 'Uploading…' : '+ Add a certification'}
      </NbButton>
      {certificationStatusLabel(status) ? (
        <Text style={[styles.hint, { color: colors.nbMuted }]}>
          {certificationStatusDetail(status) ||
            'Reviews usually take one to two days. You can start taking clients while a credential is in review.'}
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.nbMuted }]}>
          Reviews usually take one to two days. You can start taking clients while a credential is in review.
        </Text>
      )}
    </View>
  );
}

function RatesStep({ data, setData }) {
  const { colors } = useTheme();
  const rate = data?.pricing?.perSession ?? RATE_DEFAULT;
  const packs = packageRows(rate);
  const sessionType = data.sessionType || 'Both';

  const initials =
    String(data.name || 'YO')
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'YO';

  return (
    <View style={styles.stack}>
      <HardShadow>
        <View style={[styles.rateHero, { borderColor: colors.nbBorder, backgroundColor: colors.nbFill }]}>
          <Text style={[styles.rateEyebrow, { color: colors.nbMuted }]}>PER ONE-HOUR SESSION</Text>
          <Text style={[styles.rateBig, { color: colors.nbOnFill }]}>
            ${rate}
            <Text style={styles.rateUnit}> / session</Text>
          </Text>
          <NbSlider
            value={rate}
            min={RATE_MIN}
            max={RATE_MAX}
            colors={accentGradients[0]}
            onChange={(v) =>
              setData((prev) => ({
                ...prev,
                pricing: { ...(prev.pricing || {}), perSession: v },
              }))
            }
          />
        </View>
      </HardShadow>

      <SectionLabel text="HOW YOU TRAIN" colors={colors} />
      <View style={[styles.segRow, { borderColor: colors.nbBorder }]}>
        {SESSION_FORMAT_OPTIONS.map((opt, index) => {
          const on = sessionType === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setData((prev) => ({ ...prev, sessionType: opt.value }))}
              style={[
                styles.segCell,
                on ? { backgroundColor: colors.nbFill } : { backgroundColor: colors.nbSurface },
                index > 0 ? { borderLeftWidth: nb.borderWidth, borderLeftColor: colors.nbBorder } : null,
              ]}
            >
              <Text style={[styles.segText, { color: on ? colors.nbOnFill : colors.nbInk }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionLabel text="PACKAGES" colors={colors} />
      <HardShadow>
        <NbCard>
          {packs.map((row, idx) => (
            <View
              key={row.title}
              style={[
                styles.packRow,
                idx > 0 ? { borderTopWidth: nb.borderWidth, borderTopColor: colors.nbBorder } : null,
              ]}
            >
              <Text style={[styles.packTitle, { color: colors.nbInk }]}>{row.title}</Text>
              <Text style={[styles.packSub, { color: colors.nbMuted }]}>{row.sub}</Text>
              <Text style={[styles.packPrice, { color: colors.nbInk }]}>${row.price}</Text>
            </View>
          ))}
        </NbCard>
      </HardShadow>

      <SectionLabel text="PREVIEW" colors={colors} />
      <HardShadow>
        <NbCard style={styles.previewCard}>
          <LinearGradient colors={accentGradients[3]} style={styles.previewAvatar}>
            <Text style={{ fontWeight: '900', color: colors.nbInk }}>{initials}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewTitle, { color: colors.nbInk }]}>You, as clients see you</Text>
            <Text style={[styles.previewSub, { color: colors.nbMuted }]}>{specialtyLabels(data) || 'Your specialties'}</Text>
          </View>
          <Text style={[styles.previewFrom, { color: colors.nbInk }]}>
            from <Text style={{ fontWeight: '900' }}>${Math.round(rate * 0.88)}</Text>
          </Text>
        </NbCard>
      </HardShadow>
    </View>
  );
}

function InviteStep({ inviteCode, generatingCode, onCopy, onShare }) {
  const { colors } = useTheme();
  const display = formatInviteDisplay(inviteCode);

  return (
    <View style={styles.stack}>
      <HardShadow>
        <View style={[styles.codeHero, { borderColor: colors.nbBorder, backgroundColor: colors.nbFill }]}>
          <Text style={[styles.codeEyebrow, { color: colors.nbMuted }]}>SHARE THIS WITH CURRENT CLIENTS</Text>
          {generatingCode ? (
            <ActivityIndicator color={colors.nbOnFill} />
          ) : (
            <Text style={[styles.codeText, { color: colors.nbOnFill }]}>{display}</Text>
          )}
          <NbButton variant="plain" onPress={onCopy} disabled={!inviteCode} style={{ marginTop: 12 }}>
            Copy code
          </NbButton>
        </View>
      </HardShadow>

      <HeroWithLottie
        title="Anyone who enters it is linked to you."
        subtitle="You approve them before they see your plans."
        lottie={LOTTIE_INVITE}
        colors={colors}
      />

      <SectionLabel text="HOW IT WORKS" colors={colors} />
      {[
        { n: 1, title: 'You send the code', sub: 'By text, email or in person' },
        { n: 2, title: 'They enter it in the app', sub: 'Under Find a trainer, Have a code' },
        { n: 3, title: 'You approve the request', sub: 'It lands in your Today timeline' },
      ].map((step) => (
        <View key={step.n} style={styles.timelineRow}>
          <View style={[styles.timelineDot, { borderColor: colors.nbBorder, backgroundColor: step.n === 1 ? colors.nbFill : colors.nbSurface }]}>
            <Text style={{ fontWeight: '900', color: step.n === 1 ? colors.nbOnFill : colors.nbInk }}>{step.n}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.timelineTitle, { color: colors.nbInk }]}>{step.title}</Text>
            <Text style={[styles.timelineSub, { color: colors.nbMuted }]}>{step.sub}</Text>
          </View>
        </View>
      ))}

      <SectionLabel text="SEND IT" colors={colors} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <NbButton variant="plain" onPress={onShare} disabled={!inviteCode} style={{ flex: 1 }}>
          Message
        </NbButton>
        <NbButton variant="plain" onPress={onCopy} disabled={!inviteCode} style={{ flex: 1 }}>
          Copy link
        </NbButton>
      </View>
    </View>
  );
}

function ReviewStep({ data, inviteCode, onEditStep, onGoLive, onSaveLater }) {
  const { colors } = useTheme();
  const rate = data?.pricing?.perSession ?? RATE_DEFAULT;
  const rows = [
    {
      key: 'specialties',
      title: 'Specialties',
      sub: `${specialtyLabels(data) || '—'} · ${stepperFromYearsBucket(data.yearsExperience)} years`,
      gradient: accentGradients[0],
      icon: 'barbell',
    },
    {
      key: 'credentials',
      title: 'Credentials',
      sub: `${(data.certifications || []).filter((c) => c !== 'None').length} selected`,
      gradient: accentGradients[2],
      icon: 'time',
    },
    {
      key: 'rates',
      title: 'Rates',
      sub: `$${rate} per session · 3 packages`,
      gradient: accentGradients[1],
      icon: 'rates',
    },
    {
      key: 'invite',
      title: 'Invite code',
      sub: formatInviteDisplay(inviteCode),
      gradient: accentGradients[3],
      icon: 'invite',
    },
  ];

  const stepForKey = { specialties: 1, credentials: 2, rates: 3, invite: 4 };

  return (
    <View style={styles.stack}>
      <HardShadow>
        <NbCard>
          <View style={styles.reviewTop}>
            <Text style={[styles.reviewTitle, { color: colors.nbInk }]}>Profile complete</Text>
            <Text style={[styles.reviewPct, { color: colors.nbInk }]}>100%</Text>
          </View>
          <LinearGradient colors={accentGradients[0]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.reviewBar} />
          <Text style={[styles.hint, { color: colors.nbMuted, marginTop: 8 }]}>
            One credential may still be in review. It does not block going live.
          </Text>
        </NbCard>
      </HardShadow>

      <HardShadow>
        <NbCard style={{ paddingVertical: 0 }}>
          {rows.map((row, idx) => (
            <TouchableOpacity
              key={row.key}
              onPress={() => onEditStep?.(stepForKey[row.key])}
              style={[
                styles.summaryRow,
                idx > 0 ? { borderTopWidth: nb.borderWidth, borderTopColor: colors.nbBorder } : null,
              ]}
            >
              <LinearGradient colors={row.gradient} style={styles.summaryIcon}>
                <Ionicons name="ellipse" size={8} color={colors.nbInk} />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryTitle, { color: colors.nbInk }]}>{row.title}</Text>
                <Text style={[styles.summarySub, { color: colors.nbMuted }]}>{row.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
            </TouchableOpacity>
          ))}
        </NbCard>
      </HardShadow>

      <NbButton variant="fill" onPress={onGoLive}>
        Go live in the marketplace
      </NbButton>
      <NbButton variant="plain" onPress={onSaveLater}>
        Save and finish later
      </NbButton>
    </View>
  );
}

function AvailabilityStep({ data, setData }) {
  const { colors } = useTheme();
  const [times, setTimes] = useState([]);

  const toggleTime = (id) => {
    setTimes((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  return (
    <View style={styles.stack}>
      <HeroWithLottie
        title="How can clients book you?"
        subtitle="Set how clients can book with you."
        lottie={LOTTIE_RATES}
        colors={colors}
      />

      <SectionLabel text="AVAILABILITY" colors={colors} />
      <View style={[styles.segRow, { borderColor: colors.nbBorder }]}>
        {[
          { id: 'available', label: 'Available now' },
          { id: 'waitlist', label: 'Waitlist' },
        ].map((opt, index) => {
          const on = data.trainerAvailabilityStatus === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setData((prev) => ({ ...prev, trainerAvailabilityStatus: opt.id }))}
              style={[
                styles.segCell,
                on ? { backgroundColor: colors.nbFill } : { backgroundColor: colors.nbSurface },
                index > 0 ? { borderLeftWidth: nb.borderWidth, borderLeftColor: colors.nbBorder } : null,
              ]}
            >
              <Text style={[styles.segText, { color: on ? colors.nbOnFill : colors.nbInk }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: colors.nbMuted }]}>
        Waitlist shows a badge on your card and still lets clients request you.
      </Text>

      <SectionLabel text="SESSION FORMAT" colors={colors} />
      <View style={styles.formatGrid}>
        {SESSION_FORMAT_OPTIONS.map((opt) => (
          <FormatTile
            key={opt.value}
            option={opt}
            selected={data.sessionType === opt.value}
            onPress={() => setData((prev) => ({ ...prev, sessionType: opt.value }))}
            colors={colors}
          />
        ))}
      </View>

      <SectionLabel text="BEST TIMES FOR SESSIONS · optional" colors={colors} />
      <View style={styles.chipGrid}>
        {TIME_CHIPS.map((chip) => (
          <NbChip
            key={chip.id}
            selected={times.includes(chip.id)}
            onPress={() => toggleTime(chip.id)}
            style={styles.specChip}
          >
            {chip.label}
          </NbChip>
        ))}
      </View>
    </View>
  );
}

function AlmostDoneStep({
  data,
  setData,
  onStartFace,
  faceCapturing,
  faceSubmitted,
}) {
  const { colors } = useTheme();
  const initials =
    String(data.name || 'JR')
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'JR';

  return (
    <View style={styles.stack}>
      <Text style={[styles.h1, { color: colors.nbInk }]}>A few last details</Text>
      <Text style={[styles.sub, { color: colors.nbMuted, marginBottom: spacing.md }]}>
        A few last details for your profile.
      </Text>

      <SectionLabel text="FULL NAME" colors={colors} />
      <TextInput
        value={data.name || ''}
        onChangeText={(text) => setData((prev) => ({ ...prev, name: text }))}
        style={[
          styles.singleInput,
          { borderColor: colors.nbBorder, color: colors.nbInk, backgroundColor: colors.nbSurface },
        ]}
      />

      <SectionLabel text="CITY, STATE" colors={colors} />
      <TextInput
        value={data.location || ''}
        onChangeText={(text) => setData((prev) => ({ ...prev, location: text }))}
        style={[
          styles.singleInput,
          { borderColor: colors.nbBorder, color: colors.nbInk, backgroundColor: colors.nbSurface },
        ]}
      />

      <SectionLabel text="MARKETPLACE BLURB" colors={colors} />
      <TextInput
        value={data.trainerProfileBio || ''}
        onChangeText={(text) => setData((prev) => ({ ...prev, trainerProfileBio: text.slice(0, 250) }))}
        multiline
        style={[
          styles.textArea,
          { borderColor: colors.nbBorder, color: colors.nbInk, backgroundColor: colors.nbSurface },
        ]}
      />

      <SectionLabel text="HOW YOUR CARD LOOKS" colors={colors} />
      <HardShadow>
        <NbCard>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <LinearGradient colors={accentGradients[0]} style={styles.previewAvatar}>
              <Text style={{ fontWeight: '900', color: colors.nbInk }}>{initials}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[styles.previewTitle, { color: colors.nbInk }]}>{data.name || 'Your name'}</Text>
              <Text style={[styles.previewSub, { color: colors.nbMuted }]}>{data.location || 'City, ST'}</Text>
              <Text style={[styles.previewSub, { color: colors.nbInk, marginTop: 6 }]}>
                {data.trainerProfileBio || data.trainingPhilosophy || 'Your blurb'}
              </Text>
              <View style={[styles.chipGrid, { marginTop: 8 }]}>
                {(data.specialties || []).slice(0, 3).map((spec, i) => (
                  <LinearGradient key={spec} colors={accentGradients[i % accentGradients.length]} style={styles.tagPill}>
                    <Text style={styles.tagText}>
                      {SPECIALTY_OPTIONS.find((o) => o.value === spec)?.label || spec}
                    </Text>
                  </LinearGradient>
                ))}
              </View>
            </View>
          </View>
        </NbCard>
      </HardShadow>

      <HardShadow>
        <NbCard style={styles.faceCard}>
          <LinearGradient colors={accentGradients[2]} style={styles.summaryIcon}>
            <Ionicons name="scan-outline" size={18} color={colors.nbInk} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryTitle, { color: colors.nbInk }]}>
              {faceSubmitted ? 'Identity Verification submitted' : 'Identity verification (Face ID)'}
            </Text>
            <Text style={[styles.summarySub, { color: colors.nbMuted }]}>
              {faceSubmitted ? 'In review — you can keep going.' : 'Takes 30 seconds. Reviewed by a person.'}
            </Text>
          </View>
          <NbButton variant="plain" onPress={onStartFace} disabled={faceCapturing}>
            {faceSubmitted ? 'Done' : 'Start'}
          </NbButton>
        </NbCard>
      </HardShadow>
    </View>
  );
}

function CompleteStep({ data, inviteCode, userName }) {
  const { colors } = useTheme();
  const rate = data?.pricing?.perSession ?? RATE_DEFAULT;
  const displayName = String(userName || data.name || 'Coach').split(' ')[0];

  const rows = [
    { title: 'Profile and rates', sub: `$${rate} per session · ${data.sessionType || 'Both'}` },
    {
      title: 'Credentials',
      sub: `${(data.certifications || []).filter((c) => c !== 'None').length} selected`,
    },
  { title: 'Identity', sub: data.faceVerificationPhotoURL ? 'In review' : 'Not submitted' },
    { title: 'Payouts', sub: 'Set up in Settings anytime' },
    { title: 'Invite code', sub: formatInviteDisplay(inviteCode) },
  ];

  return (
    <View style={styles.stack}>
      <HardShadow>
        <View style={[styles.liveHero, { borderColor: colors.nbBorder, backgroundColor: colors.nbFill }]}>
          <Text style={[styles.codeEyebrow, { color: colors.nbMuted }]}>SETUP COMPLETE</Text>
          <Text style={[styles.liveTitle, { color: colors.nbOnFill }]}>{`Welcome, ${displayName}.`}</Text>
          <Text style={[styles.liveBody, { color: colors.nbOnFill }]}>
            Your profile is in the marketplace and your invite code is ready.
          </Text>
        </View>
      </HardShadow>

      <HardShadow>
        <NbCard style={{ paddingVertical: 0 }}>
          {rows.map((row, idx) => (
            <View
              key={row.title}
              style={[
                styles.summaryRow,
                idx > 0 ? { borderTopWidth: nb.borderWidth, borderTopColor: colors.nbBorder } : null,
              ]}
            >
              <View style={[styles.checkDot, { borderColor: colors.nbBorder, backgroundColor: colors.nbFill }]}>
                <Ionicons name="checkmark" size={14} color={colors.nbOnFill} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.summaryTitle, { color: colors.nbInk }]}>{row.title}</Text>
                <Text style={[styles.summarySub, { color: colors.nbMuted }]}>{row.sub}</Text>
              </View>
            </View>
          ))}
        </NbCard>
      </HardShadow>
    </View>
  );
}

// ===== MAIN EXPORT =====

export default function DesignLawTrainerOnboardingStep({
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
  displayName,
}) {
  switch (step) {
    case 1:
      return (
        <ProfileStep
          data={data}
          setData={setData}
          onToggleSpecialty={(value) => onToggleField('specialties', value, true)}
        />
      );
    case 2:
      return (
        <CredentialsStep
          data={data}
          setData={setData}
          onToggleCert={(value) => onToggleField('certifications', value, true)}
          onUploadCert={onUploadCert}
          certUploading={certUploading}
        />
      );
    case 3:
      return <RatesStep data={data} setData={setData} />;
    case 4:
      return (
        <InviteStep
          inviteCode={inviteCode}
          generatingCode={generatingCode}
          onCopy={onCopyInvite}
          onShare={onShareInvite}
        />
      );
    case 5:
      return (
        <ReviewStep
          data={data}
          inviteCode={inviteCode}
          onEditStep={onEditReviewStep}
          onGoLive={onReviewGoLive}
          onSaveLater={onReviewSaveLater}
        />
      );
    case 6:
      return <AvailabilityStep data={data} setData={setData} />;
    case 7:
      return (
        <AlmostDoneStep
          data={data}
          setData={setData}
          onStartFace={onStartFace}
          faceCapturing={faceCapturing}
          faceSubmitted={!!data.faceVerificationPhotoURL}
        />
      );
    case 8:
      return (
        <TrainerPayoutSetupStep
          email={payoutEmail}
          isDark={isDark}
          onSkip={onPayoutSkip}
          onComplete={onPayoutComplete}
          designLaw
          identitySubmitted={!!identitySubmitted}
        />
      );
    case 9:
      return (
        <TrainerProOfferStep
          isDark={isDark}
          selectedPlanId={trainerPlanId}
          onSelectPlan={setTrainerPlanId}
          designLaw
          onSkip={onProSkip}
        />
      );
    case 10:
      return <CompleteStep data={data} inviteCode={inviteCode} userName={displayName} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  heroCard: {
    marginBottom: 0,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  h1: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sub: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 4,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  counter: {
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specChip: {
    minHeight: 44,
  },
  stepperCard: {
    paddingVertical: 12,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperVal: {
    fontSize: 40,
    fontWeight: '900',
    minWidth: 48,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  expBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  expBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
  },
  textArea: {
    minHeight: 96,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 12,
    fontSize: 15,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  singleInput: {
    minHeight: 52,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  certRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  certDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  certMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  hint: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  rateHero: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbHero,
    padding: 16,
    gap: 8,
  },
  rateEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  rateBig: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  rateUnit: {
    fontSize: 16,
    fontWeight: '700',
  },
  segRow: {
    flexDirection: 'row',
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
  },
  segCell: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  segText: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  packRow: {
    paddingVertical: 12,
    gap: 2,
  },
  packTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  packSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  packPrice: {
    position: 'absolute',
    right: 0,
    top: 14,
    fontSize: 16,
    fontWeight: '900',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  previewSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  previewFrom: {
    fontSize: 13,
    fontWeight: '700',
  },
  codeHero: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbHero,
    padding: 16,
    alignItems: 'stretch',
  },
  codeEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  codeText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  timelineSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  reviewTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '900',
  },
  reviewPct: {
    fontSize: 32,
    fontWeight: '900',
  },
  reviewBar: {
    height: 10,
    borderRadius: 6,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  summarySub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  formatGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  formatTile: {
    flex: 1,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    minHeight: 120,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  formatTick: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  formatIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatLabel: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  faceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tagPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  liveHero: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbHero,
    padding: 20,
    gap: 6,
  },
  liveTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  liveBody: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
    opacity: 0.92,
  },
  checkDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
