// Trainer inbox of “a client wants to work with you” — Design Law screen 11/12 (trainer-home).
// Flow: pendingRequestCount → expand card → vitals from message payload or users/{clientUid} → accept/reject.
// Used by trainer shell (TrainerMainScreen). Firebase projectId stays anatrox-auth (cloudConnection only).

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { auth, db } from '../../app-start/cloudConnection';
import { doc, getDoc } from 'firebase/firestore';
import { pendingRequestCount } from './pendingRequestCount';
import TrainerListingPopup from '../home/TrainerListingPopup';
import NbCard from '../../look-and-feel/NbCard';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbButton from '../../look-and-feel/NbButton';
import NbSegmented from '../../look-and-feel/NbSegmented';
import HardShadow from '../../look-and-feel/HardShadow';
import { gradients, nb, borderRadius } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const UNKNOWN_INITIAL = '?';
const INITIALS_MAX_CHARS = 2;
// Manipulate here: scroll clearance above shell bottom nav
const LIST_BOTTOM_INSET = 32;
const SEGMENT_DETAILS = 'details';
const SEGMENT_MESSAGE = 'message';
const SEGMENT_ITEMS = [
  { id: SEGMENT_DETAILS, label: 'Request details' },
  { id: SEGMENT_MESSAGE, label: 'Message' },
];

// Design Law kv labels → message doc fields (loadPendingTraineeRequests / alertTrainer metadata).
const VITAL_LABELS = ['Age', 'Weight', 'Height'];

const DETAIL_FIELD_SPECS = [
  { label: 'Age', keys: ['clientAge', 'age'] },
  { label: 'Weight', keys: ['clientWeight', 'weight'] },
  { label: 'Height', keys: ['clientHeight', 'height'] },
  { label: 'Equipment', keys: ['clientEquipment'] },
  { label: 'Injuries', keys: ['clientLimitations', 'clientInjuries', 'injuries'] },
];

// ===== HELPER FUNCTIONS =====

function clientInitials(clientName) {
  return (clientName || UNKNOWN_INITIAL)
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .substring(0, INITIALS_MAX_CHARS);
}

/** vocab: snake_case onboarding values → Title Case for display chips */
function formatDisplayValue(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') return String(value);
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function firstDefinedField(item, keys) {
  for (const key of keys) {
    const raw = item[key];
    if (raw != null && raw !== '') return raw;
  }
  return null;
}

/** Experience · times · place — only segments that exist on the request object (never invented). */
function requestSubtitleLine(item) {
  const parts = [];
  const experience = formatDisplayValue(item.clientExperienceLevel);
  if (experience) parts.push(experience);
  const times = firstDefinedField(item, ['clientPreferredTimes', 'preferredTimes', 'trainingTimes']);
  if (times) parts.push(formatDisplayValue(String(times)));
  const place = firstDefinedField(item, ['clientTrainingLocation', 'trainingLocation', 'workoutLocation']);
  if (place) parts.push(formatDisplayValue(String(place)));
  return parts.length ? parts.join(' · ') : '—';
}

function buildDetailRows(item) {
  const rows = [];
  for (const spec of DETAIL_FIELD_SPECS) {
    const raw = firstDefinedField(item, spec.keys);
    if (raw == null || raw === '') continue;
    let value;
    if (spec.label === 'Height') {
      value = formatHeightForKv(raw);
    } else if (spec.label === 'Weight') {
      value = formatWeightForKv(raw);
    } else {
      value = formatDisplayValue(String(raw));
    }
    if (value) rows.push({ label: spec.label, value });
  }
  return rows;
}

/** True when Age, Weight, or Height is still missing on the merged request object. */
function requestMissingAnyVital(item) {
  if (!item) return false;
  for (const label of VITAL_LABELS) {
    const spec = DETAIL_FIELD_SPECS.find((row) => row.label === label);
    if (!spec) continue;
    if (firstDefinedField(item, spec.keys) == null) return true;
  }
  return false;
}

/**
 * vocab: Firestore Timestamp exposes toDate(); strings and numbers are also accepted.
 * Manipulate here: max plausible age for birthDate-derived values.
 */
function ageFromBirthDate(birthDate) {
  if (birthDate == null || birthDate === '') return null;
  let dateValue;
  if (typeof birthDate?.toDate === 'function') dateValue = birthDate.toDate();
  else if (birthDate instanceof Date) dateValue = birthDate;
  else if (typeof birthDate === 'number') dateValue = new Date(birthDate);
  else if (typeof birthDate === 'string') dateValue = new Date(birthDate);
  else return null;
  if (Number.isNaN(dateValue.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - dateValue.getFullYear();
  const monthDelta = today.getMonth() - dateValue.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dateValue.getDate())) years -= 1;
  if (!Number.isFinite(years) || years < 1 || years > 120) return null;
  return years;
}

function formatWeightForKv(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) return `${raw} lbs`;
  const text = String(raw).trim();
  return text ? formatDisplayValue(text) : '';
}

/** Map users/{id}.height objects, strings, or inch totals — never invent a value. */
function formatHeightForKv(raw) {
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw) && raw.feet != null) {
    const inch = Number(raw.inches) || 0;
    return `${raw.feet}'${inch}"`;
  }
  const totalInches = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(totalInches) && totalInches >= 36 && totalInches <= 96) {
    const total = Math.round(totalInches);
    return `${Math.floor(total / 12)}'${total % 12}"`;
  }
  const text = typeof raw === 'string' ? raw.trim() : '';
  return text ? formatDisplayValue(text) : '';
}

/**
 * Only copy fields that exist on the Firestore user doc — used to enrich the request card.
 * @param {object} userData
 * @returns {object}
 */
function vitalsOverlayFromUserDoc(userData) {
  const overlay = {};
  if (!userData || typeof userData !== 'object') return overlay;

  const ageRaw = userData.age;
  if (ageRaw != null && ageRaw !== '') overlay.age = ageRaw;
  else {
    const derived = ageFromBirthDate(userData.birthDate);
    if (derived != null) overlay.age = derived;
  }

  if (userData.weight != null && userData.weight !== '') overlay.weight = userData.weight;
  if (userData.height != null && userData.height !== '') overlay.height = userData.height;
  return overlay;
}

function mergeRequestWithProfileOverlay(item, overlayByUid) {
  if (!item?.clientUid) return item;
  const overlay = overlayByUid[item.clientUid];
  if (!overlay || !Object.keys(overlay).length) return item;
  return { ...item, ...overlay };
}

function waitingPillLabel(count) {
  return `${count} waiting`;
}

// ===== SUBCOMPONENTS =====

function DesignLawBackButton({ onPress, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbIconChip}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={({ pressed }) => [
          styles.backSquare,
          {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
      </Pressable>
    </HardShadow>
  );
}

function WaitingPill({ count, colors }) {
  if (count < 1) return null;
  return (
    <LinearGradient
      colors={gradients.brand.colors}
      start={gradients.brand.start}
      end={gradients.brand.end}
      style={[styles.waitingPill, { borderColor: colors.nbBorder }]}
    >
      <Text style={[styles.waitingPillText, { color: colors.nbInk }]}>{waitingPillLabel(count)}</Text>
    </LinearGradient>
  );
}

function RequestsHeader({ colors, requestCount, onBack }) {
  return (
    <View style={styles.headerRow}>
      <DesignLawBackButton onPress={onBack} colors={colors} />
      <Text style={[styles.headerTitle, { color: colors.nbInk }]} numberOfLines={1}>
        New requests
      </Text>
      <WaitingPill count={requestCount} colors={colors} />
    </View>
  );
}

function PayoutNudgeCard({ colors, onOpenPayout }) {
  if (!onOpenPayout) return null;
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.blockGap}>
      <NbCard noShadow style={styles.payoutCard}>
        <Text style={[styles.payoutCopy, { color: colors.nbInk }]} numberOfLines={3}>
          Complete payout setup to accept clients
        </Text>
        <NbButton variant="fill" sm onPress={onOpenPayout} style={styles.payoutBtn}>
          Set up
        </NbButton>
      </NbCard>
    </HardShadow>
  );
}

function DetailKvRows({ rows, colors }) {
  if (!rows.length) {
    return (
      <Text style={[styles.emptyDetailsHint, { color: colors.nbMuted }]}>
        No vitals on this request yet — check the message tab.
      </Text>
    );
  }
  return (
    <View>
      {rows.map((row, index) => (
        <View
          key={row.label}
          style={[
            styles.kvRow,
            index < rows.length - 1 && {
              borderBottomWidth: nb.borderWidthDivider,
              borderBottomColor: colors.nbBorder,
            },
          ]}
        >
          <Text style={[styles.kvLabel, { color: colors.nbMuted }]}>{row.label}</Text>
          <Text style={[styles.kvValue, { color: colors.nbInk }]} numberOfLines={2}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ExpandedRequestCard({
  item,
  colors,
  segment,
  onSegmentChange,
  onReject,
  onAccept,
}) {
  const detailRows = useMemo(() => buildDetailRows(item), [item]);
  const goalLabel = formatDisplayValue(item.clientGoals);

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.blockGap}>
      <NbCard noShadow style={styles.expandedCard}>
        <View style={styles.expandedHead}>
          <NbAvatar initials={clientInitials(item.clientName)} size={48} />
          <View style={styles.expandedHeadText}>
            <Text style={[styles.requestName, { color: colors.nbInk }]} numberOfLines={1}>
              {item.clientName}
            </Text>
            <Text style={[styles.requestSubtitle, { color: colors.nbMuted }]} numberOfLines={2}>
              {requestSubtitleLine(item)}
            </Text>
          </View>
          {goalLabel ? (
            <LinearGradient
              colors={gradients.brand.colors}
              start={gradients.brand.start}
              end={gradients.brand.end}
              style={[styles.goalPill, { borderColor: colors.nbBorder }]}
            >
              <Text style={[styles.goalPillText, { color: colors.nbInk }]} numberOfLines={1}>
                {goalLabel}
              </Text>
            </LinearGradient>
          ) : null}
        </View>

        <NbSegmented
          segments={SEGMENT_ITEMS}
          selected={segment}
          onSelect={onSegmentChange}
          style={styles.segmented}
        />

        {segment === SEGMENT_DETAILS ? (
          <DetailKvRows rows={detailRows} colors={colors} />
        ) : (
          <View
            style={[
              styles.messageNote,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip },
            ]}
          >
            <Text style={[styles.messageBody, { color: colors.nbInk }]}>
              {item.message?.trim() ? item.message : 'No message provided.'}
            </Text>
          </View>
        )}

        <View style={styles.actionRow}>
          <NbButton variant="ghost" onPress={onReject} style={styles.actionReject}>
            Reject
          </NbButton>
          <NbButton variant="fill" onPress={onAccept} style={styles.actionAccept}>
            Accept client
          </NbButton>
        </View>
      </NbCard>
    </HardShadow>
  );
}

function CollapsedRequestCard({ item, colors, onPress }) {
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.blockGap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
      >
        <NbCard noShadow style={styles.collapsedCard}>
          <NbAvatar initials={clientInitials(item.clientName)} size={44} />
          <View style={styles.collapsedText}>
            <Text style={[styles.requestName, { color: colors.nbInk }]} numberOfLines={1}>
              {item.clientName}
            </Text>
            <Text style={[styles.requestSubtitle, { color: colors.nbMuted }]} numberOfLines={2}>
              {requestSubtitleLine(item)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.nbInk} />
        </NbCard>
      </Pressable>
    </HardShadow>
  );
}

function LoadingRequests({ colors }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.nbInk} />
      <Text style={[styles.loadingText, { color: colors.nbMuted }]}>Loading requests…</Text>
    </View>
  );
}

function RequestsError({ error, colors, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
      <NbButton variant="fill" onPress={onRetry}>
        Retry
      </NbButton>
    </View>
  );
}

function EmptyInboxCard({ colors }) {
  return (
    <View style={styles.emptyWrap}>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <NbCard noShadow style={styles.emptyCard}>
          <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>You are all caught up</Text>
          <Text style={[styles.emptySub, { color: colors.nbMuted }]}>
            Connection requests and other client asks show up here — not in Messages. New requests also surface on
            trainer home.
          </Text>
        </NbCard>
      </HardShadow>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Trainer pending-request inbox (Design Law). Accept/reject logic stays in TrainerListingPopup.
 * @param {object} props
 * @param {Function} [props.onOpenPayout] — when set, show payout nudge card (parent decides if payout incomplete)
 */
export default function NewTraineeRequestsScreen({
  onClose,
  onClientAdded,
  embedInLayout,
  onOpenPayout,
}) {
  const { colors } = useTheme();
  const listBottomPad = useShellBottomNavInset(LIST_BOTTOM_INSET);
  const trainerUid = auth.currentUser?.uid;
  const { requests, loading, error, refresh } = pendingRequestCount(trainerUid);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [segmentByRequestId, setSegmentByRequestId] = useState({});
  /** Cached vitals from users/{clientUid} — only keys that exist on the profile doc. */
  const [vitalsByClientUid, setVitalsByClientUid] = useState({});
  const vitalsFetchStartedRef = useRef(new Set());

  useEffect(() => {
    if (!requests.length) {
      setExpandedId(null);
      return;
    }
    setExpandedId((prev) => (prev && requests.some((r) => r.id === prev) ? prev : requests[0].id));
  }, [requests]);

  // When the expanded request lacks vitals, one-shot read users/{clientUid} (loadPendingTraineeRequests.clientUid).
  useEffect(() => {
    if (!expandedId || !db) return undefined;
    const item = requests.find((row) => row.id === expandedId);
    if (!item?.clientUid) return undefined;

    const merged = mergeRequestWithProfileOverlay(item, vitalsByClientUid);
    if (!requestMissingAnyVital(merged)) return undefined;
    if (vitalsFetchStartedRef.current.has(item.clientUid)) return undefined;

    vitalsFetchStartedRef.current.add(item.clientUid);
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', item.clientUid));
        if (cancelled) return;
        if (!snap.exists()) return;
        const overlay = vitalsOverlayFromUserDoc(snap.data());
        if (!Object.keys(overlay).length) return;
        setVitalsByClientUid((prev) => ({ ...prev, [item.clientUid]: overlay }));
      } catch (fetchError) {
        vitalsFetchStartedRef.current.delete(item.clientUid);
        if (__DEV__) console.warn('NewTraineeRequestsScreen vitals fetch:', fetchError?.message || fetchError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [expandedId, requests, vitalsByClientUid]);

  const syncListWithParent = useCallback(async () => {
    setSelectedRequest(null);
    await refresh();
    await onClientAdded?.();
  }, [refresh, onClientAdded]);

  const handleClientAdded = async () => {
    await syncListWithParent();
  };

  const getSegment = useCallback(
    (requestId) => segmentByRequestId[requestId] || SEGMENT_DETAILS,
    [segmentByRequestId],
  );

  const setSegmentFor = useCallback((requestId, segment) => {
    setSegmentByRequestId((prev) => ({ ...prev, [requestId]: segment }));
  }, []);

  const openListingPopup = useCallback((request) => {
    setSelectedRequest(request);
  }, []);

  const shellStyle = [styles.container, { backgroundColor: colors.nbBackground }];

  const body = (
    <>
      <RequestsHeader colors={colors} requestCount={requests.length} onBack={onClose} />
      {loading ? (
        <LoadingRequests colors={colors} />
      ) : error ? (
        <RequestsError error={error} colors={colors} onRetry={refresh} />
      ) : requests.length === 0 ? (
        <EmptyInboxCard colors={colors} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: listBottomPad }]}
          showsVerticalScrollIndicator={false}
          {...FORM_SCROLL_PROPS}
        >
          <PayoutNudgeCard colors={colors} onOpenPayout={onOpenPayout} />
          {requests.map((item) => {
            const isExpanded = item.id === expandedId;
            const displayItem = mergeRequestWithProfileOverlay(item, vitalsByClientUid);
            if (isExpanded) {
              return (
                <ExpandedRequestCard
                  key={item.id}
                  item={displayItem}
                  colors={colors}
                  segment={getSegment(item.id)}
                  onSegmentChange={(seg) => setSegmentFor(item.id, seg)}
                  onReject={() => openListingPopup(item)}
                  onAccept={() => openListingPopup(item)}
                />
              );
            }
            return (
              <CollapsedRequestCard
                key={item.id}
                item={displayItem}
                colors={colors}
                onPress={() => setExpandedId(item.id)}
              />
            );
          })}
        </ScrollView>
      )}
      <TrainerListingPopup
        visible={!!selectedRequest}
        clientRequest={selectedRequest}
        trainerUid={trainerUid}
        onClose={() => setSelectedRequest(null)}
        onClientAdded={handleClientAdded}
        onRequestRejected={syncListWithParent}
      />
    </>
  );

  if (embedInLayout) {
    return <View style={[shellStyle, { flex: 1 }]}>{body}</View>;
  }

  return (
    <SafeAreaView style={shellStyle} edges={SHELL_SAFE_AREA_EDGES}>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: nb.screenGutter,
    paddingTop: 8,
    paddingBottom: nb.blockGap,
  },
  backSquare: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbIconChip,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  waitingPill: {
    borderWidth: nb.borderWidthPill,
    borderRadius: borderRadius.round,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  waitingPillText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: nb.screenGutter,
  },
  blockGap: {
    marginBottom: nb.blockGap,
  },
  payoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: nb.cardPadding,
  },
  payoutCopy: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  payoutBtn: {
    flexShrink: 0,
  },
  expandedCard: {
    padding: nb.cardPadding,
    gap: 12,
  },
  expandedHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expandedHeadText: {
    flex: 1,
    minWidth: 0,
  },
  goalPill: {
    maxWidth: 132,
    borderWidth: nb.borderWidthPill,
    borderRadius: borderRadius.round,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  goalPillText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    fontWeight: '800',
  },
  requestName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    fontWeight: '700',
  },
  requestSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  segmented: {
    marginTop: 4,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: nb.minTouchTarget,
    paddingVertical: 8,
    gap: 12,
  },
  kvLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  kvValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyDetailsHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 8,
  },
  messageNote: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbChip,
    padding: 12,
    minHeight: 72,
  },
  messageBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionReject: {
    flex: 1,
  },
  actionAccept: {
    flex: 1.4,
  },
  collapsedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 64,
  },
  collapsedText: {
    flex: 1,
    minWidth: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: nb.screenGutter,
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: nb.screenGutter,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
});
