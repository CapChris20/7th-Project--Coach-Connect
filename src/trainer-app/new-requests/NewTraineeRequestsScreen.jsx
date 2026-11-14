// Trainer inbox — “a client wants to work with you” (Design Law trainer-home 11/12).
// Flow: pendingRequestCount → expand card → vitals from message or users/{clientUid} → accept/reject popup.
// Used by TrainerMainScreen shell. Firebase projectId stays anatrox-auth (cloudConnection only).
// Read order: constants → display helpers → subcomponents → main screen → PLUMBING vitals → styles.

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

// Manipulate here: max plausible age when deriving from birthDate.
const MAX_PLAUSIBLE_AGE_YEARS = 120;
const MIN_PLAUSIBLE_AGE_YEARS = 1;
const HEIGHT_INCHES_MIN = 36;
const HEIGHT_INCHES_MAX = 96;
const INCHES_PER_FOOT = 12;

const EMPTY_MESSAGE_COPY = 'No message provided.';
const EMPTY_DETAILS_HINT =
  'No vitals on this request yet — check the message tab.';
const EMPTY_SUBTITLE = '—';

// ===== HELPER FUNCTIONS =====

/**
 * First letters of the client name for NbAvatar (max two chars).
 * @param {string} clientName
 * @returns {string}
 */
function clientInitials(clientName) {
  const nameOrFallback = clientName || UNKNOWN_INITIAL;
  const letters = nameOrFallback
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return letters.substring(0, INITIALS_MAX_CHARS);
}

/**
 * vocab: snake_case onboarding values → Title Case for display chips.
 * @param {*} value
 * @returns {string}
 */
function formatDisplayValue(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string') return String(value);

  const words = value.split('_');
  const titledWords = words.map((word) => {
    const firstLetter = word.charAt(0).toUpperCase();
    const restOfWord = word.slice(1);
    return firstLetter + restOfWord;
  });
  return titledWords.join(' ');
}

/**
 * First non-empty field among alternate keys on a request row.
 * Message docs and profile overlays use different letterings for the same fact.
 * @param {object} requestItem
 * @param {string[]} fieldKeys
 * @returns {*|null}
 */
function firstNonEmptyRequestField(requestItem, fieldKeys) {
  for (const fieldKey of fieldKeys) {
    const fieldValue = requestItem[fieldKey];
    if (fieldValue != null && fieldValue !== '') return fieldValue;
  }
  return null;
}

/**
 * Experience · times · place — only segments that exist on the request (never invented).
 * @param {object} requestItem
 * @returns {string}
 */
function requestSubtitleLine(requestItem) {
  const subtitleParts = [];

  const experience = formatDisplayValue(requestItem.clientExperienceLevel);
  if (experience) subtitleParts.push(experience);

  const preferredTimes = firstNonEmptyRequestField(requestItem, [
    'clientPreferredTimes',
    'preferredTimes',
    'trainingTimes',
  ]);
  if (preferredTimes) {
    subtitleParts.push(formatDisplayValue(String(preferredTimes)));
  }

  const trainingPlace = firstNonEmptyRequestField(requestItem, [
    'clientTrainingLocation',
    'trainingLocation',
    'workoutLocation',
  ]);
  if (trainingPlace) {
    subtitleParts.push(formatDisplayValue(String(trainingPlace)));
  }

  if (subtitleParts.length === 0) return EMPTY_SUBTITLE;
  return subtitleParts.join(' · ');
}

/**
 * Format one detail-row value by label (Height / Weight get special display).
 * @param {string} label
 * @param {*} rawValue
 * @returns {string}
 */
function formatDetailFieldValue(label, rawValue) {
  if (label === 'Height') return formatHeightForKv(rawValue);
  if (label === 'Weight') return formatWeightForKv(rawValue);
  return formatDisplayValue(String(rawValue));
}

/**
 * Build Age / Weight / Height / Equipment / Injuries rows for the details tab.
 * @param {object} requestItem
 * @returns {Array<{ label: string, value: string }>}
 */
function buildDetailRows(requestItem) {
  const detailRows = [];
  for (const fieldSpec of DETAIL_FIELD_SPECS) {
    const rawValue = firstNonEmptyRequestField(requestItem, fieldSpec.keys);
    if (rawValue == null || rawValue === '') continue;

    const displayValue = formatDetailFieldValue(fieldSpec.label, rawValue);
    if (displayValue) {
      detailRows.push({ label: fieldSpec.label, value: displayValue });
    }
  }
  return detailRows;
}

/**
 * True when Age, Weight, or Height is still missing on the merged request object.
 * @param {object|null} requestItem
 * @returns {boolean}
 */
function requestMissingAnyVital(requestItem) {
  if (!requestItem) return false;

  for (const vitalLabel of VITAL_LABELS) {
    const fieldSpec = DETAIL_FIELD_SPECS.find((row) => row.label === vitalLabel);
    if (!fieldSpec) continue;
    const vitalValue = firstNonEmptyRequestField(requestItem, fieldSpec.keys);
    if (vitalValue == null) return true;
  }
  return false;
}

/**
 * Overlay profile vitals onto a request row without inventing fields.
 * @param {object} requestItem
 * @param {object} overlayByUid
 * @returns {object}
 */
function mergeRequestWithProfileOverlay(requestItem, overlayByUid) {
  if (!requestItem?.clientUid) return requestItem;
  const overlay = overlayByUid[requestItem.clientUid];
  if (!overlay || !Object.keys(overlay).length) return requestItem;
  return { ...requestItem, ...overlay };
}

/**
 * @param {number} count
 * @returns {string}
 */
function waitingPillLabel(count) {
  return `${count} waiting`;
}

/**
 * Keep expandedId on a row that still exists; otherwise default to the first request.
 * @param {string|null} previousExpandedId
 * @param {Array} requestList
 * @returns {string|null}
 */
function nextExpandedIdAfterListChange(previousExpandedId, requestList) {
  if (!requestList.length) return null;
  const stillInList =
    previousExpandedId &&
    requestList.some((requestRow) => requestRow.id === previousExpandedId);
  if (stillInList) return previousExpandedId;
  return requestList[0].id;
}

// ===== SUBCOMPONENTS =====

function RequestsBackButton({ onPress, colors }) {
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

  const pillLabel = waitingPillLabel(count);
  return (
    <LinearGradient
      colors={gradients.brand.colors}
      start={gradients.brand.start}
      end={gradients.brand.end}
      style={[styles.waitingPill, { borderColor: colors.nbBorder }]}
    >
      <Text style={[styles.waitingPillText, { color: colors.nbInk }]}>{pillLabel}</Text>
    </LinearGradient>
  );
}

function RequestsHeader({ colors, requestCount, onBack }) {
  return (
    <View style={styles.headerRow}>
      <RequestsBackButton onPress={onBack} colors={colors} />
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
        {EMPTY_DETAILS_HINT}
      </Text>
    );
  }

  return (
    <View>
      {rows.map((row, rowIndex) => {
        const isLastRow = rowIndex >= rows.length - 1;
        const rowBorderStyle = isLastRow
          ? null
          : {
              borderBottomWidth: nb.borderWidthDivider,
              borderBottomColor: colors.nbBorder,
            };
        return (
          <View key={row.label} style={[styles.kvRow, rowBorderStyle]}>
            <Text style={[styles.kvLabel, { color: colors.nbMuted }]}>{row.label}</Text>
            <Text style={[styles.kvValue, { color: colors.nbInk }]} numberOfLines={2}>
              {row.value}
            </Text>
          </View>
        );
      })}
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
  // Named locals above JSX — decisions before paint.
  const detailRows = useMemo(() => buildDetailRows(item), [item]);
  const goalLabel = formatDisplayValue(item.clientGoals);
  const avatarInitials = clientInitials(item.clientName);
  const subtitleText = requestSubtitleLine(item);
  const showingDetails = segment === SEGMENT_DETAILS;
  const messageBodyText = item.message?.trim() ? item.message : EMPTY_MESSAGE_COPY;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.blockGap}>
      <NbCard noShadow style={styles.expandedCard}>
        <View style={styles.expandedHead}>
          <NbAvatar initials={avatarInitials} size={48} />
          <View style={styles.expandedHeadText}>
            <Text style={[styles.requestName, { color: colors.nbInk }]} numberOfLines={1}>
              {item.clientName}
            </Text>
            <Text style={[styles.requestSubtitle, { color: colors.nbMuted }]} numberOfLines={2}>
              {subtitleText}
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

        {showingDetails ? (
          <DetailKvRows rows={detailRows} colors={colors} />
        ) : (
          <View
            style={[
              styles.messageNote,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip },
            ]}
          >
            <Text style={[styles.messageBody, { color: colors.nbInk }]}>
              {messageBodyText}
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
  const avatarInitials = clientInitials(item.clientName);
  const subtitleText = requestSubtitleLine(item);

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.blockGap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
      >
        <NbCard noShadow style={styles.collapsedCard}>
          <NbAvatar initials={avatarInitials} size={44} />
          <View style={styles.collapsedText}>
            <Text style={[styles.requestName, { color: colors.nbInk }]} numberOfLines={1}>
              {item.clientName}
            </Text>
            <Text style={[styles.requestSubtitle, { color: colors.nbMuted }]} numberOfLines={2}>
              {subtitleText}
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

/**
 * One row in the inbox list — expanded or collapsed. Keeps the map callback shallow.
 */
function RequestListRow({
  requestRow,
  isExpanded,
  displayItem,
  colors,
  segment,
  onSegmentChange,
  onOpenPopup,
  onExpand,
}) {
  if (isExpanded) {
    return (
      <ExpandedRequestCard
        key={requestRow.id}
        item={displayItem}
        colors={colors}
        segment={segment}
        onSegmentChange={onSegmentChange}
        onReject={onOpenPopup}
        onAccept={onOpenPopup}
      />
    );
  }

  return (
    <CollapsedRequestCard
      key={requestRow.id}
      item={displayItem}
      colors={colors}
      onPress={onExpand}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Trainer “New requests” inbox screen.
 * Flow: 1. theme + pending list  2. expand/segment/vitals state  3. sync expandedId
 *       4. backfill missing vitals  5. accept/reject sync  6. paint list + popup
 */
export default function NewTraineeRequestsScreen({
  onClose,
  onClientAdded,
  embedInLayout,
  onOpenPayout,
}) {
  // 1. Theme, shell inset, and live pending list from pendingRequestCount (hook order frozen).
  const { colors } = useTheme();
  const listBottomPad = useShellBottomNavInset(LIST_BOTTOM_INSET);
  const trainerUid = auth.currentUser?.uid;
  const { requests, loading, error, refresh } = pendingRequestCount(trainerUid);

  // 2. Local UI state — expanded row, detail/message segment, profile vitals cache.
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [segmentByRequestId, setSegmentByRequestId] = useState({});
  const [vitalsByClientUid, setVitalsByClientUid] = useState({});
  // vocab: useRef Set = “uids we already kicked off a fetch for” (survives re-renders without re-fetch).
  const vitalsFetchStartedRef = useRef(new Set());

  // 3. Keep expandedId pointing at a row that still exists (or default to first).
  useEffect(() => {
    if (!requests.length) {
      setExpandedId(null);
      return;
    }
    setExpandedId((previousExpandedId) =>
      nextExpandedIdAfterListChange(previousExpandedId, requests),
    );
  }, [requests]);

  // 4. One-shot users/{clientUid} when message payload is missing Age/Weight/Height.
  useEffect(() => {
    if (!expandedId || !db) return undefined;

    const expandedRequest = requests.find((requestRow) => requestRow.id === expandedId);
    if (!expandedRequest?.clientUid) return undefined;

    const mergedForDisplay = mergeRequestWithProfileOverlay(expandedRequest, vitalsByClientUid);
    if (!requestMissingAnyVital(mergedForDisplay)) return undefined;
    if (vitalsFetchStartedRef.current.has(expandedRequest.clientUid)) return undefined;

    vitalsFetchStartedRef.current.add(expandedRequest.clientUid);
    let effectCancelled = false;

    (async () => {
      try {
        // vocab: getDoc = one-shot Firestore read of users/{clientUid}.
        const userSnap = await getDoc(doc(db, 'users', expandedRequest.clientUid));
        if (effectCancelled) return;
        if (!userSnap.exists()) return;

        const overlay = vitalsOverlayFromUserDoc(userSnap.data());
        if (!Object.keys(overlay).length) return;

        setVitalsByClientUid((previous) => ({
          ...previous,
          [expandedRequest.clientUid]: overlay,
        }));
      } catch (fetchError) {
        vitalsFetchStartedRef.current.delete(expandedRequest.clientUid);
        if (__DEV__) {
          console.warn(
            'NewTraineeRequestsScreen vitals fetch:',
            fetchError?.message || fetchError,
          );
        }
      }
    })();

    return () => {
      effectCancelled = true;
    };
  }, [expandedId, requests, vitalsByClientUid]);

  // 5. After accept/reject — refresh list and tell parent (TrainerMainScreen clients tab).
  const syncListWithParent = useCallback(async () => {
    setSelectedRequest(null);
    await refresh();
    await onClientAdded?.();
  }, [refresh, onClientAdded]);

  const handleClientAdded = async () => {
    // 1. Close popup + refresh inbox + notify parent.
    await syncListWithParent();
  };

  const readSegmentForRequest = useCallback(
    (requestId) => segmentByRequestId[requestId] || SEGMENT_DETAILS,
    [segmentByRequestId],
  );

  const saveSegmentForRequest = useCallback((requestId, segmentChoice) => {
    setSegmentByRequestId((previous) => ({ ...previous, [requestId]: segmentChoice }));
  }, []);

  const openListingPopup = useCallback((request) => {
    setSelectedRequest(request);
  }, []);

  // 6. Header + list + accept/reject popup (body is shared by SafeArea and embedded layouts).
  const shellStyle = [styles.container, { backgroundColor: colors.nbBackground }];
  const showLoading = loading;
  const showError = !loading && !!error;
  const showEmpty = !loading && !error && requests.length === 0;
  const showList = !loading && !error && requests.length > 0;
  const popupIsVisible = !!selectedRequest;

  const requestRows = requests.map((requestRow) => {
    const isExpanded = requestRow.id === expandedId;
    const displayItem = mergeRequestWithProfileOverlay(requestRow, vitalsByClientUid);
    return (
      <RequestListRow
        key={requestRow.id}
        requestRow={requestRow}
        isExpanded={isExpanded}
        displayItem={displayItem}
        colors={colors}
        segment={readSegmentForRequest(requestRow.id)}
        onSegmentChange={(segmentChoice) => saveSegmentForRequest(requestRow.id, segmentChoice)}
        onOpenPopup={() => openListingPopup(requestRow)}
        onExpand={() => setExpandedId(requestRow.id)}
      />
    );
  });

  // Name the inbox body before JSX — early returns keep nesting flat (no else-if chain).
  let mainContent = null;
  if (showLoading) {
    mainContent = <LoadingRequests colors={colors} />;
  }
  if (showError) {
    mainContent = <RequestsError error={error} colors={colors} onRetry={refresh} />;
  }
  if (showEmpty) {
    mainContent = <EmptyInboxCard colors={colors} />;
  }
  if (showList) {
    mainContent = (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: listBottomPad }]}
        showsVerticalScrollIndicator={false}
        {...FORM_SCROLL_PROPS}
      >
        <PayoutNudgeCard colors={colors} onOpenPayout={onOpenPayout} />
        {requestRows}
      </ScrollView>
    );
  }

  const body = (
    <>
      <RequestsHeader colors={colors} requestCount={requests.length} onBack={onClose} />
      {mainContent}
      <TrainerListingPopup
        visible={popupIsVisible}
        clientRequest={selectedRequest}
        trainerUid={trainerUid}
        onClose={() => setSelectedRequest(null)}
        onClientAdded={handleClientAdded}
        onRequestRejected={syncListWithParent}
      />
    </>
  );

  // 7. Embedded in trainer shell vs standalone SafeArea screen.
  if (embedInLayout) {
    return <View style={[shellStyle, { flex: 1 }]}>{body}</View>;
  }

  return (
    <SafeAreaView style={shellStyle} edges={SHELL_SAFE_AREA_EDGES}>
      {body}
    </SafeAreaView>
  );
}

// ===== PLUMBING — skip unless debugging vitals backfill =====

/**
 * vocab: Firestore Timestamp exposes toDate(); strings and numbers also accepted for birthDate.
 * @param {*} birthDate
 * @returns {Date|null}
 */
function dateFromBirthDateValue(birthDate) {
  if (birthDate == null || birthDate === '') return null;
  if (typeof birthDate?.toDate === 'function') return birthDate.toDate();
  if (birthDate instanceof Date) return birthDate;
  if (typeof birthDate === 'number') return new Date(birthDate);
  if (typeof birthDate === 'string') return new Date(birthDate);
  return null;
}

/**
 * Whole years from a birthDate field (Firestore Timestamp, Date, number, or string).
 * @param {*} birthDate
 * @returns {number|null}
 */
function ageFromBirthDate(birthDate) {
  const dateValue = dateFromBirthDateValue(birthDate);
  if (!dateValue || Number.isNaN(dateValue.getTime())) return null;

  const today = new Date();
  let years = today.getFullYear() - dateValue.getFullYear();
  const monthDelta = today.getMonth() - dateValue.getMonth();
  const birthdayNotYetThisYear =
    monthDelta < 0 || (monthDelta === 0 && today.getDate() < dateValue.getDate());
  if (birthdayNotYetThisYear) years -= 1;

  const ageIsPlausible =
    Number.isFinite(years) &&
    years >= MIN_PLAUSIBLE_AGE_YEARS &&
    years <= MAX_PLAUSIBLE_AGE_YEARS;
  if (!ageIsPlausible) return null;
  return years;
}

function formatWeightForKv(weightValue) {
  if (weightValue == null || weightValue === '') return '';
  if (typeof weightValue === 'number' && Number.isFinite(weightValue)) {
    return `${weightValue} lbs`;
  }
  const text = String(weightValue).trim();
  if (!text) return '';
  return formatDisplayValue(text);
}

/**
 * Height as feet'inches" when we can parse inches or a { feet, inches } object.
 * @param {*} heightValue
 * @returns {string}
 */
function formatHeightForKv(heightValue) {
  if (heightValue == null || heightValue === '') return '';

  const isFeetInchesObject =
    typeof heightValue === 'object' &&
    heightValue !== null &&
    !Array.isArray(heightValue) &&
    heightValue.feet != null;
  if (isFeetInchesObject) {
    const inchPart = Number(heightValue.inches) || 0;
    return `${heightValue.feet}'${inchPart}"`;
  }

  const totalInches =
    typeof heightValue === 'number'
      ? heightValue
      : Number(String(heightValue).replace(/[^0-9.]/g, ''));
  const inchesArePlausible =
    Number.isFinite(totalInches) &&
    totalInches >= HEIGHT_INCHES_MIN &&
    totalInches <= HEIGHT_INCHES_MAX;
  if (inchesArePlausible) {
    const rounded = Math.round(totalInches);
    const feetPart = Math.floor(rounded / INCHES_PER_FOOT);
    const leftoverInches = rounded % INCHES_PER_FOOT;
    return `${feetPart}'${leftoverInches}"`;
  }

  const text = typeof heightValue === 'string' ? heightValue.trim() : '';
  if (!text) return '';
  return formatDisplayValue(text);
}

/**
 * Pull age/weight/height from users/{uid} for overlay when the request message omitted them.
 * Field letters on the overlay match DETAIL_FIELD_SPECS keys (age, weight, height).
 * @param {object} userData
 * @returns {object}
 */
function vitalsOverlayFromUserDoc(userData) {
  const overlay = {};
  if (!userData || typeof userData !== 'object') return overlay;

  const ageOnProfile = userData.age;
  if (ageOnProfile != null && ageOnProfile !== '') {
    overlay.age = ageOnProfile;
  } else {
    const ageFromBirth = ageFromBirthDate(userData.birthDate);
    if (ageFromBirth != null) overlay.age = ageFromBirth;
  }

  if (userData.weight != null && userData.weight !== '') {
    overlay.weight = userData.weight;
  }
  if (userData.height != null && userData.height !== '') {
    overlay.height = userData.height;
  }
  return overlay;
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
