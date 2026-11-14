// Design Law trainer profile (marketplace-new PNG 11–14) — decision layout, trial block, pinned CTA.
// Flow: normalize trainer → header card → about / empty bio → specialties → stats → what you get → trial → footer.
// Used by SearchTrainersScreen (embedded) and as a standalone modal. `embedded` skips Modal chrome.
//
// vocab: hasCustomBio = false when normalize fell back to the default empty-bio copy
// vocab: HardShadow = solid offset shadow under 3px outlines; never green verified/online

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import {
  getTrainerPrice,
  gradGradient,
  normalizeTrainer,
  formatSessionLabel,
  trainerFirstName,
} from './trainerFilters';
import { trainerPhotoUri } from '../../helpers/trainerProfilePhoto';
import {
  blockUser,
  submitContentReport,
  confirmBlockUser,
  ReportOrBlockSheet,
  REPORT_TYPES,
} from '../../block-and-report';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbButton from '../../look-and-feel/NbButton';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import NbIconChip from '../../look-and-feel/NbIconChip';
import HardShadow from '../../look-and-feel/HardShadow';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellTopPad } from '../../navigation/bottomMenuSpacing';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const CONNECTED_VARIANT = 'connected';
const DEFAULT_TRAINER_NAME = 'Trainer';
const NO_BIO_TITLE = 'No bio yet.';
const NO_BIO_BODY =
  'This coach is setting up their profile. Message them to learn more about their coaching style.';
const RATE_ON_REQUEST = 'Rate on request';
const SCROLL_BOTTOM_PAD = 28;
const FOOTER_PAD = 12;
const SAFETY_SHEET_MIN_BOTTOM = 16;
const MODAL_TOP_MIN_INSET = 8;
const INK_ON_GRADIENT = '#0A0A0A';
const TRIAL_MUTED_DARK = 'rgba(10,10,10,0.55)';
const TRIAL_MUTED_LIGHT = 'rgba(255,255,255,0.55)';

// Manipulate here: benefit rows under “What you get” (icons + copy only — not Firebase fields).
const FEATURES = [
  { label: 'Custom workouts', icon: 'clipboard-outline', gradientIndex: 0 },
  { label: 'Direct messaging', icon: 'person-outline', gradientIndex: 3 },
  { label: 'Progress tracking', icon: 'stats-chart-outline', gradientIndex: 1 },
  { label: 'Session booking', icon: 'calendar-outline', gradientIndex: 4 },
];

// ===== HELPER FUNCTIONS =====

function signedInUidFromAuth() {
  const auth = getAuth();
  if (!auth) {
    return undefined;
  }
  if (!auth.currentUser) {
    return undefined;
  }
  return auth.currentUser.uid;
}

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  maybeFunction(...args);
}


/**
 * Marketplace cards store the uid on the projection, the raw doc, or the original trainer object.
 * @param {object} display
 * @param {object} trainer
 * @returns {string|null}
 */
function trainerUidFromDisplay(display, trainer) {
  if (display && display.uid) {
    return display.uid;
  }
  if (display && display.id) {
    return display.id;
  }
  if (display && display._firebase && display._firebase.uid) {
    return display._firebase.uid;
  }
  if (trainer && trainer.uid) {
    return trainer.uid;
  }
  if (trainer && trainer.id) {
    return trainer.id;
  }
  return null;
}

/**
 * Pull name, photo, price, and uid from the Design Law display projection.
 * @param {object} display
 * @param {object} trainer
 */
function readProfileFields(display, trainer) {
  let fullName = display.name;
  if (!fullName) {
    fullName = display.displayName;
  }
  const firstName = trainerFirstName(fullName);
  let firebaseDoc = display._firebase;
  if (!firebaseDoc) {
    firebaseDoc = display;
  }
  let photoUri = display.photoURL;
  if (!photoUri) {
    photoUri = trainerPhotoUri(firebaseDoc);
  }
  let price = getTrainerPrice(firebaseDoc);
  if (price == null) {
    price = display.price;
  }
  let showPrice = false;
  if (price != null && Number(price) > 0) {
    showPrice = true;
  }
  let trainerName = fullName;
  if (!trainerName) {
    trainerName = DEFAULT_TRAINER_NAME;
  }
  return {
    firstName,
    avatarColors: gradGradient(display.grad),
    photoUri,
    price,
    showPrice,
    trainerUid: trainerUidFromDisplay(display, trainer),
    trainerName,
  };
}

function buildPrimaryCtaLabel(hasBio, isConnected) {
  if (!hasBio) {
    return 'Send message';
  }
  if (isConnected) {
    return 'Message';
  }
  return 'Start your free trial';
}

function footerBottomPadding(embedded, insets, shellNavClearance) {
  if (embedded) {
    return Math.max(FOOTER_PAD, shellNavClearance);
  }
  return FOOTER_PAD + insets.bottom;
}

function trialMutedForTheme(isDark) {
  // On nbFill: light theme = white wash; dark theme flips fill so muted must follow on-fill ink
  if (isDark) {
    return TRIAL_MUTED_DARK;
  }
  return TRIAL_MUTED_LIGHT;
}

function yearsCoachingLabel(years) {
  if (years > 0) {
    return String(years);
  }
  return '—';
}

function canReportThisProfile(signedInUid, trainerUid) {
  if (!signedInUid) {
    return false;
  }
  if (!trainerUid) {
    return false;
  }
  if (signedInUid === trainerUid) {
    return false;
  }
  return true;
}

async function sendTrainerProfileReport(
  reporterUid,
  trainerUid,
  trainerName,
  reasonId,
  alsoBlock,
  onClose,
  showNotice,
) {
  try {
    await submitContentReport({
      reporterId: reporterUid,
      type: REPORT_TYPES.TRAINER_PROFILE,
      targetUid: String(trainerUid),
      reason: reasonId,
      targetDisplayName: trainerName,
    });
    if (alsoBlock) {
      await blockUser(reporterUid, String(trainerUid), { displayName: trainerName });
      callIfFunction(showNotice, 
        'Reported and blocked',
        `${trainerName} is blocked. Unblock anytime in Settings → Blocked users.`,
        { onConfirm: () => callIfFunction(onClose) },
      );
      return;
    }
    callIfFunction(showNotice, 'Report sent', 'Thanks — we’ll review this trainer listing.');
  } catch (error) {
    let failMessage = 'Try again.';
    if (error && error.message) {
      failMessage = error.message;
    }
    callIfFunction(showNotice, 'Report failed', failMessage);
  }
}

async function blockThisTrainer(reporterUid, trainerUid, trainerName, onClose, showNotice) {
  try {
    await blockUser(reporterUid, String(trainerUid), { displayName: trainerName });
    callIfFunction(showNotice, 
      'Blocked',
      `${trainerName} is blocked. Unblock anytime in Settings → Blocked users.`,
      { onConfirm: () => callIfFunction(onClose) },
    );
  } catch (error) {
    let failMessage = 'Try again.';
    if (error && error.message) {
      failMessage = error.message;
    }
    callIfFunction(showNotice, 'Block failed', failMessage);
  }
}

/**
 * Design Law report/block sheet (PNG 23/24) — replaces Alert chrome for the … menu.
 */
function SafetySheet({ visible, trainerName, onClose, onReport, onBlock }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!visible) {
    return null;
  }
  const sheetPaddingBottom = Math.max(insets.bottom, SAFETY_SHEET_MIN_BOTTOM);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.safetyRoot}>
        <Pressable style={styles.scrim} onPress={onClose} />
        <View
          style={[
            styles.safetySheet,
            {
              backgroundColor: colors.nbSurface,
              borderColor: colors.nbBorder,
              paddingBottom: sheetPaddingBottom,
            },
          ]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.nbBorder }]} />
          </View>
          <Text style={[styles.safetyTitle, { color: colors.nbInk }]}>{trainerName}</Text>
          <Pressable
            onPress={onReport}
            style={[styles.safetyRow, { borderBottomColor: colors.nbBorder }]}
          >
            <View style={styles.safetyCopy}>
              <Text style={[styles.safetyRowTitle, { color: colors.nbInk }]}>Report</Text>
              <Text style={[styles.safetyRowSub, { color: colors.nbMuted }]}>
                Spam, inappropriate content, harassment
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.nbInk} />
          </Pressable>
          <Pressable onPress={onBlock} style={styles.safetyRowLast}>
            <View style={styles.safetyCopy}>
              <Text style={[styles.safetyRowTitle, { color: colors.nbInk }]}>Block</Text>
              <Text style={[styles.safetyRowSub, { color: colors.nbMuted }]}>
                They cannot message you
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.nbInk} />
          </Pressable>
          <NbButton variant="plain" onPress={onClose}>
            Cancel
          </NbButton>
        </View>
      </View>
    </Modal>
  );
}

function SectionLabel({ children, colors }) {
  return <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{children}</Text>;
}

function AvailablePill({ available, colors }) {
  let label = 'Waitlist';
  if (available) {
    label = 'Available';
  }
  if (!available) {
    return (
      <HardShadow offset={nb.shadowOffsetSmall} radius={999}>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          <Text style={[styles.statusText, { color: colors.nbInk }]}>{label}</Text>
        </View>
      </HardShadow>
    );
  }
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={999}>
      <LinearGradient
        colors={accentGradients[0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.statusPill, { borderColor: colors.nbBorder }]}
      >
        <Text style={[styles.statusText, { color: INK_ON_GRADIENT }]}>{label}</Text>
      </LinearGradient>
    </HardShadow>
  );
}

function SpecialtyChip({ label, index, colors }) {
  const rampIndex = index % accentGradients.length;
  const ramp = accentGradients[rampIndex];
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={999}>
      <LinearGradient
        colors={ramp}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.specChip, { borderColor: colors.nbBorder }]}
      >
        <Text style={[styles.specChipText, { color: INK_ON_GRADIENT }]}>{label}</Text>
      </LinearGradient>
    </HardShadow>
  );
}

function StatCard({ label, value, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.statCardWrap}>
      <View
        style={[
          styles.statCard,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <Text style={[styles.statLabel, { color: colors.nbMuted }]}>{label}</Text>
        <Text style={[styles.statValue, { color: colors.nbInk }]}>{value}</Text>
      </View>
    </HardShadow>
  );
}

function FeatureRow({ feature, colors, isLast }) {
  let rowBorderStyle = null;
  if (!isLast) {
    rowBorderStyle = {
      borderBottomWidth: nb.borderWidthDivider,
      borderBottomColor: colors.nbBorder,
    };
  }
  return (
    <View style={[styles.featureRow, rowBorderStyle]}>
      <NbIconChip index={feature.gradientIndex} size={36}>
        <Ionicons name={feature.icon} size={18} color={INK_ON_GRADIENT} />
      </NbIconChip>
      <Text style={[styles.featureLabel, { color: colors.nbInk }]}>{feature.label}</Text>
    </View>
  );
}

function HeaderIconButton({ icon, onPress, colors, label }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          styles.headerSq,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <Ionicons name={icon} size={20} color={colors.nbInk} />
      </Pressable>
    </HardShadow>
  );
}

function HeroCard({ colors, display, fields }) {
  const trainerDisplayName = display.name || display.displayName;
  const locationLabel = display.location || '—';
  let verifiedPrefix = '';
  if (display.verified) {
    verifiedPrefix = 'Verified · ';
  }
  const isAvailable = display.available !== false;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <NbAvatar source={fields.photoUri} initials={display.initials} size={56} />
        <View style={styles.heroCopy}>
          <Text style={[styles.heroName, { color: colors.nbInk }]} numberOfLines={1}>
            {trainerDisplayName}
          </Text>
          <View style={styles.heroMetaRow}>
            {display.verified ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.nbMuted} />
            ) : null}
            <Text style={[styles.heroMeta, { color: colors.nbMuted }]} numberOfLines={1}>
              {verifiedPrefix}
              {locationLabel}
            </Text>
          </View>
        </View>
        <AvailablePill available={isAvailable} colors={colors} />
      </View>
    </HardShadow>
  );
}

function AboutOrEmptyBio({ colors, display, hasBio, handleMessage, requesting }) {
  if (hasBio) {
    return (
      <View style={styles.block}>
        <SectionLabel colors={colors}>ABOUT</SectionLabel>
        <Text style={[styles.aboutText, { color: colors.nbInk }]}>{display.bio}</Text>
      </View>
    );
  }

  let messageDisabled = false;
  if (requesting || !handleMessage) {
    messageDisabled = true;
  }
  return (
    <View style={[styles.emptyBio, { borderColor: colors.nbBorder }]}>
      <Text style={[styles.emptyBioTitle, { color: colors.nbInk }]}>{NO_BIO_TITLE}</Text>
      <Text style={[styles.emptyBioBody, { color: colors.nbMuted }]}>{NO_BIO_BODY}</Text>
      <NbButton
        variant="fill"
        onPress={() => callIfFunction(handleMessage, display)}
        disabled={messageDisabled}
      >
        Send message
      </NbButton>
    </View>
  );
}


function buildSpecialtyChipElements(specialties, colors) {
  const chips = [];
  for (let index = 0; index < specialties.length; index += 1) {
    const spec = specialties[index];
    chips.push(
      <SpecialtyChip key={spec} label={spec} index={index} colors={colors} />,
    );
  }
  return chips;
}

function SpecialtiesBlock({ colors, display }) {
  let specialties = display.specialties;
  if (!specialties) {
    specialties = [];
  }
  return (
    <View style={styles.block}>
      <SectionLabel colors={colors}>SPECIALTIES</SectionLabel>
      <View style={styles.specRow}>
        {buildSpecialtyChipElements(specialties, colors)}
      </View>
    </View>
  );
}

function buildFeatureRowElements(colors) {
  const rows = [];
  const lastFeatureIndex = FEATURES.length - 1;
  for (let index = 0; index < FEATURES.length; index += 1) {
    const feature = FEATURES[index];
    const isLast = index === lastFeatureIndex;
    rows.push(
      <FeatureRow
        key={feature.label}
        feature={feature}
        colors={colors}
        isLast={isLast}
      />,
    );
  }
  return rows;
}

function WhatYouGetBlock({ colors }) {
  return (
    <View style={styles.block}>
      <SectionLabel colors={colors}>WHAT YOU GET</SectionLabel>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.featureCard,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          {buildFeatureRowElements(colors)}
        </View>
      </HardShadow>
    </View>
  );
}

function TrialCard({ colors, fields, trialMuted }) {
  return (
    <View
      style={[styles.trialCard, { backgroundColor: colors.nbFill, borderColor: colors.nbBorder }]}
    >
      <Text style={[styles.trialEyebrow, { color: accentGradients[0][1] }]}>
        FREE TRIAL PERIOD: 3–5 DAYS
      </Text>
      <Text style={[styles.trialBody, { color: colors.nbOnFill }]}>
        Try the coaching first. You pay after your trial.
      </Text>
      <Text style={[styles.trialAfterLabel, { color: trialMuted }]}>AFTER YOUR TRIAL</Text>
      <Text style={[styles.trialPrice, { color: colors.nbOnFill }]}>
        ${fields.price}
        <Text style={styles.trialPriceUnit}>/month</Text>
      </Text>
    </View>
  );
}

function InvestmentCard({ colors, fields }) {
  let investmentValue = RATE_ON_REQUEST;
  if (fields.showPrice) {
    investmentValue = `$${fields.price}/month`;
  }
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View
        style={[
          styles.investCard,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <SectionLabel colors={colors}>INVESTMENT</SectionLabel>
        <Text style={[styles.investValue, { color: colors.nbInk }]}>{investmentValue}</Text>
      </View>
    </HardShadow>
  );
}

function TrainerProfileScrollBody({
  colors,
  display,
  fields,
  hasBio,
  handleMessage,
  requesting,
  yearsLabel,
  formatLabel,
  trialMuted,
}) {
  const showTrialCard = hasBio && fields.showPrice;

  return (
    <>
      <HeroCard colors={colors} display={display} fields={fields} />

      <AboutOrEmptyBio
        colors={colors}
        display={display}
        hasBio={hasBio}
        handleMessage={handleMessage}
        requesting={requesting}
      />

      {hasBio ? <SpecialtiesBlock colors={colors} display={display} /> : null}

      {hasBio ? (
        <View style={styles.statRow}>
          <StatCard label="YEARS COACHING" value={yearsLabel} colors={colors} />
          <StatCard label="FORMAT" value={formatLabel} colors={colors} />
        </View>
      ) : null}

      {hasBio ? <WhatYouGetBlock colors={colors} /> : null}

      {showTrialCard ? (
        <TrialCard colors={colors} fields={fields} trialMuted={trialMuted} />
      ) : null}

      {!hasBio ? <InvestmentCard colors={colors} fields={fields} /> : null}
    </>
  );
}

function ProfileFooter({
  colors,
  fields,
  embedded,
  insets,
  shellNavClearance,
  requesting,
  primaryCtaLabel,
  onPrimaryCta,
}) {
  const paddingBottom = footerBottomPadding(embedded, insets, shellNavClearance);

  return (
    <View
      style={[
        styles.profileFooter,
        {
          borderTopColor: colors.nbBorder,
          backgroundColor: colors.nbSurface,
          paddingBottom,
        },
      ]}
    >
      {fields.showPrice ? (
        <View style={styles.footerPrice}>
          <Text style={[styles.footerPriceStrong, { color: colors.nbInk }]}>
            ${fields.price}
          </Text>
          <Text style={[styles.footerPriceUnit, { color: colors.nbMuted }]}>per month</Text>
        </View>
      ) : (
        <View style={styles.footerPrice}>
          <Text style={[styles.footerPriceStrong, { color: colors.nbInk }]} numberOfLines={1}>
            {RATE_ON_REQUEST}
          </Text>
        </View>
      )}
      <View style={styles.footerCta}>
        <NbButton variant="fill" onPress={onPrimaryCta} disabled={requesting}>
          {primaryCtaLabel}
        </NbButton>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Trainer profile sheet. `embedded` paints inside SearchTrainersScreen; otherwise it is a Modal.
 * @param {{
 *   trainer: object,
 *   visible: boolean,
 *   onClose: Function,
 *   onConnect?: Function,
 *   onRequest?: Function,
 *   isDark?: boolean,
 *   requesting?: boolean,
 *   variant?: string,
 *   onMessage?: Function,
 *   embedded?: boolean,
 *   shellBottomInset?: number,
 * }} props
 */
export function TrainerProfileSheet({
  trainer,
  visible,
  onClose,
  onConnect,
  onRequest,
  requesting = false,
  variant = 'marketplace',
  onMessage,
  embedded = false,
  /** Extra bottom inset when a shell bottom nav overlays this sheet (0 when nav is hidden). */
  shellBottomInset = 0,
}) {
  // Hook order frozen: theme → insets → safety/report/notice state → shell top pad
  // 1. Theme + layout insets + sheet state for report/block flows.
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message, extras = {}) => setNotice({ title, message, ...extras });
  const trialMuted = trialMutedForTheme(isDark);
  // vocab: useShellTopPad clears the status bar when this sheet is embedded in the shell
  const shellTopPad = useShellTopPad(spacing.sm);

  const shouldHide = !trainer || (!embedded && !visible) || (embedded && !visible);
  if (shouldHide) {
    return null;
  }
  // 2. Normalize Firestore → Design Law card fields and wire CTA handlers.
  let trainerSource = trainer;
  if (trainer && trainer._firebase) {
    trainerSource = trainer._firebase;
  }
  const display = normalizeTrainer(trainerSource, 0);
  const isConnected = variant === CONNECTED_VARIANT;
  const fields = readProfileFields(display, trainer);
  const handleMessage = onMessage;
  let handleConnect = onConnect;
  if (!handleConnect) {
    handleConnect = onRequest;
  }
  let shellNavClearance = 0;
  if (embedded) {
    shellNavClearance = Math.max(0, shellBottomInset);
  }
  const hasBio = display.hasCustomBio === true;
  const formatLabel = formatSessionLabel(display.mode);
  const yearsLabel = yearsCoachingLabel(display.years);
  const primaryCtaLabel = buildPrimaryCtaLabel(hasBio, isConnected);
  let rootBackground = colors.nbBackground;
  if (embedded) {
    rootBackground = 'transparent';
  }
  let headerPaddingTop = Math.max(insets.top, MODAL_TOP_MIN_INSET) + spacing.sm;
  if (embedded) {
    headerPaddingTop = shellTopPad;
  }

  const openSafety = () => {
    const signedInUid = signedInUidFromAuth();
    if (!canReportThisProfile(signedInUid, fields.trainerUid)) {
      showNotice('Report', 'You can’t report this profile.');
      return;
    }
    setSafetyOpen(true);
  };

  const onSafetyReport = () => {
    setSafetyOpen(false);
    setReportOpen(true);
  };

  const onSubmitReport = async ({ reasonId, alsoBlock }) => {
    setReportBusy(true);
    try {
      await sendTrainerProfileReport(
        signedInUidFromAuth(),
        fields.trainerUid,
        fields.trainerName,
        reasonId,
        alsoBlock,
        onClose,
        showNotice,
      );
      setReportOpen(false);
    } finally {
      setReportBusy(false);
    }
  };

  const onSafetyBlock = () => {
    setSafetyOpen(false);
    confirmBlockUser({
      peerName: fields.trainerName,
      presentNotice: showNotice,
      onConfirm: () =>
        blockThisTrainer(
          signedInUidFromAuth(),
          fields.trainerUid,
          fields.trainerName,
          onClose,
          showNotice,
        ),
    });
  };

  // 3. Primary CTA: empty bio / connected → message; marketplace with bio → start trial (connect).
  const onPrimaryCta = () => {
    if (requesting) return;
    if (!hasBio || isConnected) {
      callIfFunction(handleMessage, display);
      return;
    }
    callIfFunction(handleConnect, display);
  };

  const closeReportSheet = () => {
    if (reportBusy) return;
    setReportOpen(false);
  };

  // 4. Build footer + body, then return embedded View or Modal chrome.
  const footer = (
    <ProfileFooter
      colors={colors}
      fields={fields}
      embedded={embedded}
      insets={insets}
      shellNavClearance={shellNavClearance}
      requesting={requesting}
      primaryCtaLabel={primaryCtaLabel}
      onPrimaryCta={onPrimaryCta}
    />
  );

  const body = (
    <View
      style={[
        styles.root,
        embedded ? styles.rootEmbedded : null,
        { backgroundColor: rootBackground },
      ]}
    >
      {/* PNG 11 header: back + title + more — always owned here (embedded or modal) */}
      <View style={[styles.modalTop, { paddingTop: headerPaddingTop }]}>
        <HeaderIconButton
          icon="chevron-back"
          onPress={onClose}
          colors={colors}
          label="Go back"
        />
        <Text style={[styles.modalTitle, { color: colors.nbInk }]} numberOfLines={1}>
          Trainer profile
        </Text>
        <HeaderIconButton
          icon="ellipsis-horizontal"
          onPress={openSafety}
          colors={colors}
          label="More options"
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: SCROLL_BOTTOM_PAD }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <TrainerProfileScrollBody
          colors={colors}
          display={display}
          fields={fields}
          hasBio={hasBio}
          handleMessage={handleMessage}
          requesting={requesting}
          yearsLabel={yearsLabel}
          formatLabel={formatLabel}
          trialMuted={trialMuted}
        />
      </ScrollView>

      {/* PNG 13 empty-bio: primary Send message lives in the dashed card — no pinned price bar */}
      {hasBio ? footer : null}

      <ReportOrBlockSheet
        visible={reportOpen}
        onClose={closeReportSheet}
        onSubmit={onSubmitReport}
        peerName={fields.trainerName}
        busy={reportBusy}
      />
      <SafetySheet
        visible={safetyOpen}
        trainerName={fields.trainerName}
        onClose={() => setSafetyOpen(false)}
        onReport={onSafetyReport}
        onBlock={onSafetyBlock}
      />
      <NbNoticeSheet
        visible={!!notice}
        onClose={() => setNotice(null)}
        title={(notice && notice.title) || ''}
        message={notice && notice.message}
        confirmLabel={(notice && notice.confirmLabel) || 'OK'}
        cancelLabel={notice && notice.cancelLabel}
        onConfirm={notice && notice.onConfirm}
        destructive={!!(notice && notice.destructive)}
      />
    </View>
  );

  if (embedded) {

    return body;

  }
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalShell, { backgroundColor: colors.nbBackground }]}>{body}</View>
    </Modal>
  );
}

export default TrainerProfileSheet;

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootEmbedded: { flex: 1, minHeight: 0 },
  modalShell: { flex: 1 },
  modalTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    letterSpacing: -0.3,
  },
  headerSq: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: nb.screenGutter || spacing.md,
    gap: 16,
    paddingTop: 4,
  },
  heroCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
  heroName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMeta: {
    flexShrink: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  statusPill: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  block: { gap: 4 },
  aboutText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  emptyBio: {
    borderWidth: nb.borderWidth,
    borderStyle: 'dashed',
    borderRadius: borderRadius.nbCard,
    padding: 16,
    gap: 10,
  },
  emptyBioTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
  },
  emptyBioBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  specChip: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specChipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
  },
  statRow: { flexDirection: 'row', gap: 10 },
  statCardWrap: { flex: 1 },
  statCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    minHeight: 84,
    justifyContent: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1,
  },
  statValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
  },
  featureCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  featureLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  trialCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
    gap: 8,
  },
  trialEyebrow: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  trialBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  trialAfterLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 6,
  },
  trialPrice: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
  },
  trialPriceUnit: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  investCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
  },
  investValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
  },
  profileFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
    borderTopWidth: nb.borderWidth,
  },
  footerPrice: { minWidth: 72 },
  footerPriceStrong: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
  },
  footerPriceUnit: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  footerCta: { flex: 1 },
  safetyRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  safetySheet: {
    borderTopLeftRadius: borderRadius.nbSheet,
    borderTopRightRadius: borderRadius.nbSheet,
    borderWidth: nb.borderWidth,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    gap: 8,
  },
  handleWrap: { alignItems: 'center', paddingBottom: 4 },
  handle: { width: 44, height: 5, borderRadius: 999 },
  safetyTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    marginBottom: 4,
  },
  safetyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: nb.borderWidthDivider,
    minHeight: 64,
  },
  safetyRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    minHeight: 64,
  },
  safetyCopy: { flex: 1, minWidth: 0, gap: 2 },
  safetyRowTitle: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 },
  safetyRowSub: { fontFamily: 'Inter_400Regular', fontSize: 13 },
});
