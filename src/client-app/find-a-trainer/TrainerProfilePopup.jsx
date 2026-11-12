// Design Law trainer profile (marketplace-new PNG 11–14) — decision layout, trial block, pinned CTA.
// Flow: normalize trainer → header card → about / empty bio → specialties → stats → what you get → trial → footer.
// Used by SearchTrainersScreen (embedded) and as a standalone modal. `embedded` skips Modal chrome.
//
// vocab: hasCustomBio = false when normalize fell back to the default empty-bio copy
// vocab: HardShadow = solid offset shadow under 3px outlines; never green verified/online

import React, { useState } from 'react';
import {
  Alert,
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
  showReportReasonPicker,
  confirmBlockUser,
  REPORT_TYPES,
} from '../../block-and-report';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbButton from '../../look-and-feel/NbButton';
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

// Manipulate here: benefit rows under “What you get” (icons + copy only — not Firebase fields).
const FEATURES = [
  { label: 'Custom workouts', icon: 'clipboard-outline', gradientIndex: 0 },
  { label: 'Direct messaging', icon: 'person-outline', gradientIndex: 3 },
  { label: 'Progress tracking', icon: 'stats-chart-outline', gradientIndex: 1 },
  { label: 'Session booking', icon: 'calendar-outline', gradientIndex: 4 },
];

// ===== HELPER FUNCTIONS =====

/**
 * Marketplace cards store the uid on the projection, the raw doc, or the original trainer object.
 */
function trainerUidFromDisplay(display, trainer) {
  return (
    display?.uid ||
    display?.id ||
    display?._firebase?.uid ||
    trainer?.uid ||
    trainer?.id ||
    null
  );
}

function readProfileFields(display, trainer) {
  const firstName = trainerFirstName(display.name || display.displayName);
  const photoUri = display.photoURL || trainerPhotoUri(display._firebase || display);
  const price = getTrainerPrice(display._firebase || display) ?? display.price;
  const showPrice = price != null && Number(price) > 0;
  return {
    firstName,
    avatarColors: gradGradient(display.grad),
    photoUri,
    price,
    showPrice,
    trainerUid: trainerUidFromDisplay(display, trainer),
    trainerName: display.name || display.displayName || DEFAULT_TRAINER_NAME,
  };
}

async function sendTrainerProfileReport(reporterUid, trainerUid, trainerName, reasonId) {
  try {
    await submitContentReport({
      reporterId: reporterUid,
      type: REPORT_TYPES.TRAINER_PROFILE,
      targetUid: String(trainerUid),
      reason: reasonId,
      targetDisplayName: trainerName,
    });
    Alert.alert('Report sent', 'Thanks — we’ll review this trainer listing.');
  } catch (error) {
    Alert.alert('Report failed', error?.message || 'Try again.');
  }
}

async function blockThisTrainer(reporterUid, trainerUid, trainerName, onClose) {
  try {
    await blockUser(reporterUid, String(trainerUid), { displayName: trainerName });
    Alert.alert('Blocked', `${trainerName} is blocked. Unblock anytime in Settings → Blocked users.`);
    onClose?.();
  } catch (error) {
    Alert.alert('Block failed', error?.message || 'Try again.');
  }
}

/**
 * Design Law report/block sheet (PNG 23/24) — replaces Alert chrome for the … menu.
 */
function SafetySheet({ visible, trainerName, onClose, onReport, onBlock }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (!visible) return null;
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
              paddingBottom: Math.max(insets.bottom, 16),
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
  const label = available ? 'Available' : 'Waitlist';
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
        <Text style={[styles.statusText, { color: '#0A0A0A' }]}>{label}</Text>
      </LinearGradient>
    </HardShadow>
  );
}

function SpecialtyChip({ label, index, colors }) {
  const ramp = accentGradients[index % accentGradients.length];
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={999}>
      <LinearGradient
        colors={ramp}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.specChip, { borderColor: colors.nbBorder }]}
      >
        <Text style={[styles.specChipText, { color: '#0A0A0A' }]}>{label}</Text>
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
  return (
    <View
      style={[
        styles.featureRow,
        !isLast && { borderBottomWidth: nb.borderWidthDivider, borderBottomColor: colors.nbBorder },
      ]}
    >
      <NbIconChip index={feature.gradientIndex} size={36}>
        <Ionicons name={feature.icon} size={18} color="#0A0A0A" />
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
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [safetyOpen, setSafetyOpen] = useState(false);
  // On nbFill: light theme = white wash; dark theme flips fill so muted must follow on-fill ink
  const trialMuted = isDark ? 'rgba(10,10,10,0.55)' : 'rgba(255,255,255,0.55)';
  // vocab: useShellTopPad clears the status bar when this sheet is embedded in the shell
  const shellTopPad = useShellTopPad(spacing.sm);
  if (!trainer || (!embedded && !visible)) return null;
  if (embedded && !visible) return null;

  const display = normalizeTrainer(trainer?._firebase || trainer, 0);
  const isConnected = variant === CONNECTED_VARIANT;
  const fields = readProfileFields(display, trainer);
  const handleMessage = onMessage;
  const handleConnect = onConnect || onRequest;
  const shellNavClearance = embedded ? Math.max(0, shellBottomInset) : 0;
  const hasBio = display.hasCustomBio === true;
  const formatLabel = formatSessionLabel(display.mode);
  const yearsLabel = display.years > 0 ? String(display.years) : '—';

  const openSafety = () => {
    const signedInUid = getAuth()?.currentUser?.uid;
    if (!signedInUid || !fields.trainerUid || signedInUid === fields.trainerUid) {
      Alert.alert('Report', 'You can’t report this profile.');
      return;
    }
    setSafetyOpen(true);
  };

  const onSafetyReport = () => {
    setSafetyOpen(false);
    showReportReasonPicker({
      onPick: (reasonId) =>
        sendTrainerProfileReport(
          getAuth()?.currentUser?.uid,
          fields.trainerUid,
          fields.trainerName,
          reasonId,
        ),
    });
  };

  const onSafetyBlock = () => {
    setSafetyOpen(false);
    confirmBlockUser({
      peerName: fields.trainerName,
      onConfirm: () =>
        blockThisTrainer(
          getAuth()?.currentUser?.uid,
          fields.trainerUid,
          fields.trainerName,
          onClose,
        ),
    });
  };

  const primaryCtaLabel = !hasBio
    ? 'Send message'
    : isConnected
      ? 'Message'
      : 'Start your free trial';

  const onPrimaryCta = () => {
    if (requesting) return;
    if (!hasBio || isConnected) {
      handleMessage?.(display);
      return;
    }
    handleConnect?.(display);
  };

  const footer = (
    <View
      style={[
        styles.profileFooter,
        {
          borderTopColor: colors.nbBorder,
          backgroundColor: colors.nbSurface,
          paddingBottom: embedded
            ? Math.max(FOOTER_PAD, shellNavClearance)
            : FOOTER_PAD + insets.bottom,
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

  const body = (
    <View
      style={[
        styles.root,
        embedded ? styles.rootEmbedded : null,
        { backgroundColor: embedded ? 'transparent' : colors.nbBackground },
      ]}
    >
      {/* PNG 11 header: back + title + more — always owned here (embedded or modal) */}
      <View
        style={[
          styles.modalTop,
          { paddingTop: embedded ? shellTopPad : Math.max(insets.top, 8) + spacing.sm },
        ]}
      >
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
        {/* Profile header card — avatar + name + verified/location + Available */}
        <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
          <View
            style={[
              styles.heroCard,
              { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
            ]}
          >
            <NbAvatar
              source={fields.photoUri}
              initials={display.initials}
              size={56}
            />
            <View style={styles.heroCopy}>
              <Text style={[styles.heroName, { color: colors.nbInk }]} numberOfLines={1}>
                {display.name || display.displayName}
              </Text>
              <View style={styles.heroMetaRow}>
                {display.verified ? (
                  <Ionicons name="checkmark-circle" size={14} color={colors.nbMuted} />
                ) : null}
                <Text style={[styles.heroMeta, { color: colors.nbMuted }]} numberOfLines={1}>
                  {display.verified ? 'Verified · ' : ''}
                  {display.location || '—'}
                </Text>
              </View>
            </View>
            <AvailablePill available={display.available !== false} colors={colors} />
          </View>
        </HardShadow>

        {hasBio ? (
          <View style={styles.block}>
            <SectionLabel colors={colors}>ABOUT</SectionLabel>
            <Text style={[styles.aboutText, { color: colors.nbInk }]}>{display.bio}</Text>
          </View>
        ) : (
          <View style={[styles.emptyBio, { borderColor: colors.nbBorder }]}>
            <Text style={[styles.emptyBioTitle, { color: colors.nbInk }]}>{NO_BIO_TITLE}</Text>
            <Text style={[styles.emptyBioBody, { color: colors.nbMuted }]}>{NO_BIO_BODY}</Text>
            <NbButton
              variant="fill"
              onPress={() => handleMessage?.(display)}
              disabled={requesting || !handleMessage}
            >
              Send message
            </NbButton>
          </View>
        )}

        {hasBio ? (
          <View style={styles.block}>
            <SectionLabel colors={colors}>SPECIALTIES</SectionLabel>
            <View style={styles.specRow}>
              {(display.specialties || []).map((spec, index) => (
                <SpecialtyChip key={spec} label={spec} index={index} colors={colors} />
              ))}
            </View>
          </View>
        ) : null}

        {hasBio ? (
          <View style={styles.statRow}>
            <StatCard label="YEARS COACHING" value={yearsLabel} colors={colors} />
            <StatCard label="FORMAT" value={formatLabel} colors={colors} />
          </View>
        ) : null}

        {hasBio ? (
          <View style={styles.block}>
            <SectionLabel colors={colors}>WHAT YOU GET</SectionLabel>
            <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
              <View
                style={[
                  styles.featureCard,
                  { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                ]}
              >
                {FEATURES.map((feature, index) => (
                  <FeatureRow
                    key={feature.label}
                    feature={feature}
                    colors={colors}
                    isLast={index === FEATURES.length - 1}
                  />
                ))}
              </View>
            </HardShadow>
          </View>
        ) : null}

        {hasBio && fields.showPrice ? (
          <View
            style={[
              styles.trialCard,
              { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
            ]}
          >
            <Text style={[styles.trialEyebrow, { color: accentGradients[0][1] }]}>
              FREE TRIAL PERIOD: 3–5 DAYS
            </Text>
            <Text style={[styles.trialBody, { color: colors.nbOnFill }]}>
              Try the coaching first. You pay after your trial.
            </Text>
            <Text style={[styles.trialAfterLabel, { color: trialMuted }]}>
              AFTER YOUR TRIAL
            </Text>
            <Text style={[styles.trialPrice, { color: colors.nbOnFill }]}>
              ${fields.price}
              <Text style={styles.trialPriceUnit}>/month</Text>
            </Text>
          </View>
        ) : null}

        {!hasBio ? (
          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
            <View
              style={[
                styles.investCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <SectionLabel colors={colors}>INVESTMENT</SectionLabel>
              <Text style={[styles.investValue, { color: colors.nbInk }]}>
                {fields.showPrice ? `$${fields.price}/month` : RATE_ON_REQUEST}
              </Text>
            </View>
          </HardShadow>
        ) : null}
      </ScrollView>

      {/* PNG 13 empty-bio: primary Send message lives in the dashed card — no pinned price bar */}
      {hasBio ? footer : null}

      <SafetySheet
        visible={safetyOpen}
        trainerName={fields.trainerName}
        onClose={() => setSafetyOpen(false)}
        onReport={onSafetyReport}
        onBlock={onSafetyBlock}
      />
    </View>
  );

  if (embedded) return body;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalShell, { backgroundColor: colors.nbBackground }]}>{body}</View>
    </Modal>
  );
}

export default TrainerProfileSheet;

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
