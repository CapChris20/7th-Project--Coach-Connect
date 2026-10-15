// Full trainer profile: photo, stats, about, specialties, price, and Message / Connect / Report.
// Flow: normalize the trainer → paint the sheet → Connect or Message, or report/block from the safety menu.
// Used by SearchTrainersScreen (embedded) and as a standalone modal. `embedded` skips the Modal chrome.

import React from 'react';
import {
  Alert,
  Image,
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
  BRAND,
  getTheme,
  gradGradient,
  trainerFirstName,
  getTrainerPrice,
  normalizeTrainer,
  MP_FONT,
} from './trainerFilters';
import {
  GlassCard,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  ColorText,
} from './FindTrainerPieces';
import { trainerPhotoUri } from '../../helpers/trainerProfilePhoto';
import {
  blockUser,
  submitContentReport,
  showSafetyPeerMenu,
  showReportReasonPicker,
  confirmBlockUser,
  REPORT_TYPES,
} from '../../block-and-report';

// ===== NAMED CONSTANTS =====

const CONNECTED_VARIANT = 'connected';
const DEFAULT_MODE = 'Remote';
const DEFAULT_BIO = 'No bio yet.';
const DEFAULT_RESPONDS = 'within 2 hours';
const DEFAULT_TRAINER_NAME = 'Trainer';
const DEFAULT_TRIAL_DAYS = 5;
const SCROLL_BOTTOM_PAD = 28;
const FOOTER_PAD = 12;
const SPECIALTY_TILE_COLORS = [BRAND.pink, BRAND.orange, BRAND.cyan, BRAND.purple];

const FEATURES = [
  { label: 'Custom workouts', icon: 'barbell-outline', color: BRAND.pink },
  { label: 'Direct messaging', icon: 'chatbubbles-outline', color: BRAND.purple },
  { label: 'Progress tracking', icon: 'trending-up-outline', color: BRAND.cyan },
  { label: 'Session booking', icon: 'calendar-outline', color: BRAND.orange },
];

// ===== HELPER FUNCTIONS =====

function InfoPill({ icon, label, theme, active }) {
  return (
    <View
      style={[
        styles.infoPill,
        active
          ? { borderColor: `${BRAND.orange}66`, backgroundColor: `${BRAND.pink}28` }
          : { borderColor: `${BRAND.purple}55`, backgroundColor: `${BRAND.purple}12` },
      ]}
    >
      <Ionicons name={icon} size={12} color={active ? BRAND.cyan : BRAND.purple} />
      <Text style={[styles.infoPillText, { color: theme.foreground }]}>{label}</Text>
    </View>
  );
}

/**
 * Marketplace cards store the uid on the projection, the raw doc, or the original trainer object.
 * @param {object} display
 * @param {object} trainer
 * @returns {string|null}
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

/**
 * @param {object} display
 * @param {object} trainer
 */
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

/**
 * @param {string} reporterUid
 * @param {string} trainerUid
 * @param {string} trainerName
 * @param {string} reasonId
 */
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

/**
 * @param {string} reporterUid
 * @param {string} trainerUid
 * @param {string} trainerName
 * @param {Function} [onClose]
 */
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
 * Safety menu: pick Report (reason list) or Block (hold-to-confirm).
 * You cannot report your own listing.
 * @param {string} trainerUid
 * @param {string} trainerName
 * @param {Function} [onClose]
 */
function openReportOrBlockMenu(trainerUid, trainerName, onClose) {
  const signedInUid = getAuth()?.currentUser?.uid;
  if (!signedInUid || !trainerUid || signedInUid === trainerUid) {
    Alert.alert('Report', 'You can’t report this profile.');
    return;
  }

  showSafetyPeerMenu({
    peerName: trainerName,
    onReport: () => {
      showReportReasonPicker({
        onPick: (reasonId) => sendTrainerProfileReport(signedInUid, trainerUid, trainerName, reasonId),
      });
    },
    onBlock: () => {
      confirmBlockUser({
        peerName: trainerName,
        onConfirm: () => blockThisTrainer(signedInUid, trainerUid, trainerName, onClose),
      });
    },
  });
}

function specialtyTileColor(index) {
  return SPECIALTY_TILE_COLORS[index % SPECIALTY_TILE_COLORS.length];
}

function profileFooterBackground(embedded, isDark, theme) {
  if (embedded) return 'transparent';
  if (isDark) return theme.card;
  return theme.background;
}

// ===== MAIN FUNCTION =====

/**
 * Trainer profile sheet. `embedded` paints inside SearchTrainersScreen; otherwise it is a Modal.
 * vocab: useSafeAreaInsets pads the footer above the home indicator when this is a full-screen modal.
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
  isDark = true,
  requesting = false,
  variant = 'marketplace',
  onMessage,
  embedded = false,
  /** Extra bottom inset when a shell bottom nav overlays this sheet (0 when nav is hidden). */
  shellBottomInset = 0,
}) {
  const insets = useSafeAreaInsets();
  if (!trainer || (!embedded && !visible)) return null;
  if (embedded && !visible) return null;

  const display = normalizeTrainer(trainer?._firebase || trainer, 0);
  const theme = getTheme(isDark);
  const isConnected = variant === CONNECTED_VARIANT;
  const fields = readProfileFields(display, trainer);
  const handleMessage = onMessage;
  const handleConnect = onConnect || onRequest;
  const shellNavClearance = embedded ? Math.max(0, shellBottomInset) : 0;
  // Footer is in-flow under the scroll view — only the footer needs shell clearance.
  const scrollBottomPad = SCROLL_BOTTOM_PAD;

  const footer = (
    <View
      style={[
        styles.profileFooter,
        {
          borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border,
          backgroundColor: profileFooterBackground(embedded, isDark, theme),
          paddingBottom: embedded ? Math.max(FOOTER_PAD, shellNavClearance) : FOOTER_PAD + insets.bottom,
        },
      ]}
    >
      <View style={styles.footerActionsRow}>
        {isConnected && typeof handleMessage === 'function' ? (
          <PrimaryButton onPress={handleMessage} style={{ flex: 1 }} disabled={requesting} icon="chatbubble-outline">
            Message
          </PrimaryButton>
        ) : (
          <>
            <SecondaryButton
              onPress={() => handleMessage?.(display)}
              style={{ flex: 1 }}
              textColor={theme.foreground}
              disabled={requesting || !handleMessage}
              icon="chatbubble-outline"
              isDark={isDark}
            >
              Message
            </SecondaryButton>
            <PrimaryButton
              onPress={() => !requesting && handleConnect?.(display)}
              style={{ flex: 1.15 }}
              disabled={requesting}
              icon="flash-outline"
            >
              Connect with {fields.firstName}
            </PrimaryButton>
          </>
        )}
      </View>
      <SecondaryButton
        onPress={() => openReportOrBlockMenu(fields.trainerUid, fields.trainerName, onClose)}
        style={{ width: '100%' }}
        textColor={theme.mutedForeground}
        icon="flag-outline"
        isDark={isDark}
      >
        Report or block
      </SecondaryButton>
    </View>
  );

  const body = (
    <View
      style={[
        styles.root,
        embedded ? styles.rootEmbedded : null,
        {
          backgroundColor: embedded ? 'transparent' : theme.background,
        },
      ]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHero}>
          {fields.photoUri ? (
            <LinearGradient colors={fields.avatarColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
              <Image source={{ uri: fields.photoUri }} style={styles.avatarXlImg} />
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={fields.avatarColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarBox}
            >
              <Text style={styles.avatarXlText}>{display.initials}</Text>
            </LinearGradient>
          )}

          <Text style={[styles.profileName, { color: theme.foreground }]}>
            {display.name || display.displayName}
          </Text>

          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={14} color={theme.mutedForeground} />
            <Text style={{ color: theme.mutedForeground, fontSize: 14, fontWeight: '500' }}>
              {display.location || '—'}  •  {display.mode || DEFAULT_MODE}
            </Text>
          </View>

          <View style={[styles.pillWrap, { marginTop: 14 }]}>
            {isConnected ? (
              <InfoPill icon="checkmark-circle" label="Your coach" theme={theme} active />
            ) : null}
            {display.verified === true ? (
              <InfoPill icon="shield-checkmark" label="Verified" theme={theme} active />
            ) : null}
            <InfoPill
              icon="time-outline"
              label={`Responds ${display.responds || DEFAULT_RESPONDS}`}
              theme={theme}
            />
          </View>
        </View>

        <View style={styles.statRow}>
          <GlassCard isDark={isDark} style={styles.statCardWrap} contentStyle={styles.statCard}>
            <Text style={[styles.statVal, { color: BRAND.purple }]}>{display.years || '—'}</Text>
            <Text style={[styles.statLabel, { color: theme.mutedForeground }]}>Years coaching</Text>
          </GlassCard>
          <GlassCard isDark={isDark} style={styles.statCardWrap} contentStyle={styles.statCard}>
            <Text style={[styles.statVal, { color: BRAND.cyan }]}>{(display.specialties || []).length}</Text>
            <Text style={[styles.statLabel, { color: theme.mutedForeground }]}>Specialties</Text>
          </GlassCard>
        </View>

        <GlassCard t={theme} isDark={isDark}>
          <SectionLabel>About</SectionLabel>
          <Text style={{ color: theme.foreground, lineHeight: 22, marginTop: 10, fontSize: 15, fontWeight: '500' }}>
            {display.bio || DEFAULT_BIO}
          </Text>
        </GlassCard>

        <GlassCard t={theme} isDark={isDark}>
          <SectionLabel>Specialties</SectionLabel>
          <View style={styles.specGrid}>
            {(display.specialties || []).map((spec, index) => {
              const tileColor = specialtyTileColor(index);
              return (
                <View key={spec} style={[styles.specTile, { borderColor: theme.border, backgroundColor: theme.muted }]}>
                  <LinearGradient colors={[tileColor, `${tileColor}88`]} style={styles.specIcon}>
                    <Ionicons name="fitness-outline" size={18} color="#fff" />
                  </LinearGradient>
                  <Text style={{ color: theme.foreground, fontWeight: '700', fontSize: 13 }}>{spec}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard t={theme} isDark={isDark}>
          <SectionLabel>What you get</SectionLabel>
          <View style={styles.specGrid}>
            {FEATURES.map((feature) => (
              <View key={feature.label} style={[styles.specTile, { borderColor: theme.border, backgroundColor: theme.muted }]}>
                <LinearGradient colors={[feature.color, `${feature.color}99`]} style={styles.specIcon}>
                  <Ionicons name={feature.icon} size={18} color="#fff" />
                </LinearGradient>
                <Text style={{ color: theme.foreground, fontWeight: '700', fontSize: 13 }}>{feature.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {fields.showPrice ? (
          <GlassCard t={theme} isDark={isDark}>
            <SectionLabel>Investment</SectionLabel>
            <View style={styles.priceRow}>
              <ColorText style={styles.priceGradient}>${fields.price}</ColorText>
              <Text style={{ color: theme.mutedForeground, fontSize: 17, fontWeight: '600' }}>/mo</Text>
            </View>
            <Text style={{ color: theme.mutedForeground, marginTop: 10, lineHeight: 21, fontSize: 14 }}>
              Personalized programming, weekly check-ins, unlimited messaging.
            </Text>
            <LinearGradient
              colors={[`${BRAND.pink}33`, `${BRAND.purple}22`]}
              style={[styles.trialBox, { borderColor: `${BRAND.purple}55` }]}
            >
              <Text style={{ color: theme.foreground, fontWeight: '800', textAlign: 'center', fontSize: 14 }}>
                FREE {display.trialDays ?? DEFAULT_TRIAL_DAYS}-day trial · no card required
              </Text>
            </LinearGradient>
          </GlassCard>
        ) : null}
      </ScrollView>

      {footer}
    </View>
  );

  if (embedded) return body;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalShell, { backgroundColor: theme.background }]}>
        <View style={styles.profileTop}>
          <Pressable onPress={onClose} style={[styles.modalBackBtn, { borderColor: theme.border }]}>
            <Ionicons name="chevron-back" size={22} color={theme.foreground} />
          </Pressable>
        </View>
        {body}
      </View>
    </Modal>
  );
}

export default TrainerProfileSheet;

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootEmbedded: { flex: 1, minHeight: 0 },
  modalShell: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 14, paddingTop: 4 },
  profileTop: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 },
  modalBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHero: { alignItems: 'center', paddingBottom: 8, paddingTop: 0 },
  avatarBox: {
    width: 112,
    height: 112,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 118,
    height: 118,
    borderRadius: 30,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarXlImg: { width: 112, height: 112, borderRadius: 27 },
  avatarXlText: { color: '#fff', fontSize: 38, fontWeight: '800' },
  profileName: {
    fontSize: 30,
    fontFamily: MP_FONT.displayBold,
    marginTop: 18,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  infoPillText: { fontSize: 11, fontWeight: '700' },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  statCardWrap: { flex: 1, marginBottom: 0 },
  statCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  statVal: { fontSize: 34, fontFamily: MP_FONT.displayBold, marginBottom: 4, textAlign: 'center' },
  statLabel: { fontSize: 12, fontFamily: MP_FONT.bodySemi, textAlign: 'center' },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  specTile: {
    width: '47%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  specIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, gap: 4 },
  priceGradient: { fontSize: 42, fontFamily: MP_FONT.displayBold },
  trialBox: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 14 },
  profileFooter: {
    flexDirection: 'column',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    marginTop: 'auto',
    marginHorizontal: 0,
  },
  footerActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
});
