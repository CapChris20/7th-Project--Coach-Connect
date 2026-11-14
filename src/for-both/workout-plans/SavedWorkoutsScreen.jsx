// Design Law saved plans library (workouts PNG 17/18) — trainer Tools → Workout plans + client library.
// Flow: load plans from Firestore → normalize → search/filter → list rows or empty state.
// Layout paints; default export wires data. Delete confirm = NbSheet (PNG 18).

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbButton from '../../look-and-feel/NbButton';
import HardShadow from '../../look-and-feel/HardShadow';
import NbPill from '../../look-and-feel/NbPill';
import NbSheet from '../../look-and-feel/NbSheet';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import { borderRadius, gradients, nb, spacing } from '../../look-and-feel/colorPalette';
import { db } from '../../app-start/cloudConnection';
import {
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { fetchClientWorkoutPlansForLibrary } from '../../workouts/exercise-videos/loadSavedWorkoutPlans';

// ===== NAMED CONSTANTS =====

// Icon-chip gradient rotation (Design Law — small accents only)
const ICON_GRADS_BRAND = (gradients.brand && gradients.brand.colors) || ['#FF6B9D', '#FB923C'];
const ICON_GRADS_ENERGY = (gradients.energy && gradients.energy.colors) || ['#FBBF24', '#EF4444'];
const ICON_GRADS_WATER = (gradients.water && gradients.water.colors) || ['#60A5FA', '#818CF8'];
const ICON_GRADS = [
  ICON_GRADS_BRAND,
  ICON_GRADS_ENERGY,
  ICON_GRADS_WATER,
  ['#A78BFA', '#E879F9'],
  ['#FDBA74', '#C4B5FD'],
];

const DAYS_PER_WEEK_DEFAULT = 4;
const EXERCISES_PER_DAY_FALLBACK = 6;
const MIN_EXERCISE_COUNT_FALLBACK = 8;
const DEFAULT_TOTAL_WEEKS = 8;
const DEFAULT_DAYS_PER_WEEK = 3;
const DEFAULT_SESSION_MINUTES = 45;
const TRAINING_DAYS_LENGTH = 7;
const MAX_MUSCLE_TAG_LENGTH = 28;
const MAX_MUSCLE_TAGS = 8;
const WEEKDAY_SHORT_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SHELL_BOTTOM_PAD_EXTRA = 24;
const CLIENT_NAME_FALLBACK = 'Client';
const PLAN_NAME_FALLBACK = 'Plan';
const USERS_COLLECTION = 'users';
const WORKOUT_PLANS_SUBCOLLECTION = 'workoutPlans';
const WORKOUT_PLANS_TOP_COLLECTION = 'workoutPlans';
const SOURCE_USERS_SUBCOLLECTION = 'usersSubcollection';
const SOURCE_WORKOUT_PLAN_CURRENT = 'workoutPlanCurrent';
const SOURCE_MANUAL_BUILDER = 'manualBuilder';
const PLAN_KIND_MANUAL = 'manual';

const GOAL_COLOR_MAP = {
  strength: 'purple',
  hypertrophy: 'purple',
  muscle: 'purple',
  cardio: 'cyan',
  endurance: 'cyan',
  hiit: 'orange',
  fat: 'orange',
  weight: 'orange',
  flexibility: 'green',
  mobility: 'green',
  recovery: 'green',
};

// ===== HELPER FUNCTIONS =====

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  return maybeFunction(...args);
}

function errorMessageOrFallback(errorObject, fallbackText) {
  if (errorObject && errorObject.message) return errorObject.message;
  return fallbackText;
}

function noticeTitle(notice) {
  if (!notice) return '';
  return notice.title || '';
}

function noticeMessage(notice) {
  if (!notice) return undefined;
  return notice.message;
}

function noticeConfirmLabel(notice) {
  if (!notice) return 'OK';
  return notice.confirmLabel || 'OK';
}

function noticeCancelLabel(notice) {
  if (!notice) return undefined;
  return notice.cancelLabel;
}

function noticeOnConfirm(notice) {
  if (!notice) return undefined;
  return notice.onConfirm;
}

function planRawSource(plan) {
  if (!plan || !plan._raw) return null;
  return plan._raw.source;
}

function planRawPlanKind(plan) {
  if (!plan || !plan._raw) return null;
  return plan._raw.planKind;
}

function planIsAssignedOnRaw(plan) {
  if (!plan || !plan._raw) return false;
  return !!plan._raw.assigned;
}


/**
 * Who this library belongs to — prop wins, else route params.
 * @param {object|undefined} clientProp
 * @param {object|undefined} route
 */
function readLibraryClientIdentity(clientProp, route) {
  const routeParams = route && route.params ? route.params : {};
  const clientFromProp = clientProp || {};
  const clientId = clientFromProp.id || routeParams.clientId;
  const clientName =
    clientFromProp.name || routeParams.clientName || CLIENT_NAME_FALLBACK;
  return { clientId, clientName };
}

// vocab: nbTheme maps Design Law tokens into the legacy `theme.*` keys list chrome still expects
function nbTheme(colors) {
  return {
    bg: colors.nbBackground,
    surface: colors.nbSurface,
    card: colors.nbSurface,
    border: colors.nbBorder,
    text: colors.nbInk,
    textMuted: colors.nbMuted,
    textSecondary: colors.nbMuted,
    fill: colors.nbFill,
    onFill: colors.nbOnFill,
    soft: colors.nbSoft,
  };
}

function dateFromFirestoreOrRaw(raw) {
  if (!raw) return null;
  // vocab: Firestore Timestamp has .toDate()
  if (typeof raw.toDate === 'function') return raw.toDate();
  if (raw instanceof Date) return raw;
  return new Date(raw);
}

function formatDate(raw) {
  const parsedDate = dateFromFirestoreOrRaw(raw);
  if (!parsedDate) return '';
  if (isNaN(parsedDate.getTime())) return '';
  return parsedDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "MAY 5, 2026" for history card headers */
function formatCreatedUpper(raw) {
  const parsedDate = dateFromFirestoreOrRaw(raw);
  if (!parsedDate) return '';
  if (isNaN(parsedDate.getTime())) return '';
  return parsedDate
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    .toUpperCase();
}

function daysFromWeeksArray(weeks) {
  const allDays = [];
  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex += 1) {
    const week = weeks[weekIndex];
    const weekDays = week && week.days ? week.days : [];
    for (let dayIndex = 0; dayIndex < weekDays.length; dayIndex += 1) {
      allDays.push(weekDays[dayIndex]);
    }
  }
  return allDays;
}

function structuredPlanDays(structuredPlan) {
  if (!structuredPlan) return null;
  if (structuredPlan.days) return structuredPlan.days;
  if (structuredPlan.sessions) return structuredPlan.sessions;
  if (Array.isArray(structuredPlan.weeks)) {
    return daysFromWeeksArray(structuredPlan.weeks);
  }
  return null;
}

function exerciseCountFromDays(days) {
  let exerciseCount = 0;
  for (const day of days) {
    if (!day) continue;
    if (day.isRest || day.rest) continue;
    const exercises = day.exercises || day.mainWorkouts || day.main_workouts || [];
    if (!Array.isArray(exercises)) continue;
    exerciseCount += exercises.length;
  }
  return exerciseCount;
}

function explicitExerciseCountOnItem(item) {
  if (!item) return null;
  if (item.totalExerciseCount != null) return item.totalExerciseCount;
  if (item.exerciseCount != null) return item.exerciseCount;
  return item.exerciseTotal;
}

function countedExercisesFromStructuredPlan(item) {
  const structuredPlan = item ? item.structuredPlan : null;
  const days = structuredPlanDays(structuredPlan);
  if (!Array.isArray(days)) return 0;
  return exerciseCountFromDays(days);
}

function deriveExerciseCount(item) {
  const explicit = explicitExerciseCountOnItem(item);
  if (typeof explicit === 'number' && explicit > 0) return explicit;

  const counted = countedExercisesFromStructuredPlan(item);
  if (counted > 0) return counted;

  const daysPerWeek = Number(item && item.daysPerWeek) || DAYS_PER_WEEK_DEFAULT;
  return Math.max(MIN_EXERCISE_COUNT_FALLBACK, daysPerWeek * EXERCISES_PER_DAY_FALLBACK);
}

function pushUniqueTag(tags, rawLabel) {
  const label = String(rawLabel || '').trim();
  if (!label) return;
  if (tags.includes(label)) return;
  if (label.length >= MAX_MUSCLE_TAG_LENGTH) return;
  tags.push(label);
}

function muscleLabelFromEntry(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry) return undefined;
  return entry.name || entry.label;
}

function collectTagsFromDays(days, tags) {
  if (!Array.isArray(days)) return;
  for (const day of days) {
    if (!day) continue;
    pushUniqueTag(tags, day.focus);
    pushUniqueTag(tags, day.label);
    pushUniqueTag(tags, day.name);
    const muscleGroups = day.muscleGroups || day.muscles || day.targets;
    if (!Array.isArray(muscleGroups)) continue;
    for (const muscle of muscleGroups) {
      pushUniqueTag(tags, muscleLabelFromEntry(muscle));
    }
  }
}

function collectTagsFromPrimaryMuscles(item, tags) {
  if (!item) return;
  const primaryMuscles = item.primaryMuscles || item.muscleGroups || item.muscles;
  if (Array.isArray(primaryMuscles)) {
    for (const muscle of primaryMuscles) {
      pushUniqueTag(tags, muscleLabelFromEntry(muscle));
    }
    return;
  }
  if (typeof primaryMuscles === 'string') {
    for (const chunk of primaryMuscles.split(/[,/]/)) {
      pushUniqueTag(tags, chunk);
    }
  }
}

function deriveMuscleTags(item, displayFocus) {
  const tags = [];
  const structuredPlan = item ? item.structuredPlan : null;
  const days = structuredPlanDays(structuredPlan);
  collectTagsFromDays(days, tags);
  collectTagsFromPrimaryMuscles(item, tags);

  if (tags.length === 0 && displayFocus) {
    for (const chunk of displayFocus.split(/[,/•]/)) {
      pushUniqueTag(tags, chunk);
    }
  }
  if (tags.length === 0) pushUniqueTag(tags, 'Full body');
  return tags.slice(0, MAX_MUSCLE_TAGS);
}

function planIsManual(item) {
  if (!item) return false;
  return item.source === SOURCE_MANUAL_BUILDER || item.planKind === PLAN_KIND_MANUAL;
}

function focusColorForPlan(item) {
  const goalText = (item.goal || item.focus || item.type || item.category || '').toLowerCase();
  const goalKeyword = Object.keys(GOAL_COLOR_MAP).find((keyword) =>
    goalText.includes(keyword),
  );
  return item.focusColor || GOAL_COLOR_MAP[goalKeyword] || 'pink';
}

function displayNameForPlan(item, isManual) {
  if (isManual) {
    return item.title || item.name || item.planName || 'Custom plan';
  }
  if (item.title || item.name || item.planTitle) {
    return item.title || item.name || item.planTitle;
  }
  if (item.rawPlan || item.planText) return 'Workout plan';
  return 'Workout Plan';
}

function displayFocusForPlan(item, isManual) {
  if (isManual) {
    return String(item.category || item.focus || 'Custom plan').trim();
  }
  return item.focus || item.goal || item.type || 'Training';
}

function trainingDaysForPlan(item, daysPerWeek) {
  const stored = item.trainingDays;
  if (Array.isArray(stored) && stored.length === TRAINING_DAYS_LENGTH) {
    return stored;
  }
  return Array.from({ length: TRAINING_DAYS_LENGTH }, (_, dayIndex) => dayIndex < daysPerWeek);
}

/**
 * Map one raw Firestore plan doc into the UI row shape list chrome expects.
 * Flow: 1. status  2. focus color  3. weeks/days  4. display fields  5. return row + _raw
 */
function normalizePlan(item) {
  // 1. Active vs paused — explicit status wins, else infer from assigned flag
  const status = item.status || (item.assigned ? 'active' : 'paused');
  const isManual = planIsManual(item);

  // 2. Focus chip color from goal keywords (falls back to pink)
  const focusColor = focusColorForPlan(item);

  const totalWeeks = isManual
    ? (item.durationWeeks || item.totalWeeks || item.weeks || DEFAULT_TOTAL_WEEKS)
    : (item.totalWeeks || item.weeks || item.durationWeeks || DEFAULT_TOTAL_WEEKS);
  const weeksCompleted = item.weeksCompleted || item.currentWeek || 0;
  const daysPerWeek =
    isManual && typeof item.daysPerWeek === 'number'
      ? item.daysPerWeek
      : item.daysPerWeek || DEFAULT_DAYS_PER_WEEK;
  const sessionMinutes = item.sessionMinutes || item.sessionLength || DEFAULT_SESSION_MINUTES;

  // 3. Build a 7-day boolean array from stored field or infer from daysPerWeek
  const trainingDays = trainingDaysForPlan(item, daysPerWeek);

  // 4. Display name + focus line
  const displayName = displayNameForPlan(item, isManual);
  const displayFocus = displayFocusForPlan(item, isManual);

  // 5. UI row + Firestore bookkeeping for write/delete paths
  return {
    id: item.id,
    name: displayName,
    status,
    focusColor,
    focus: displayFocus,
    totalWeeks,
    weeksCompleted,
    daysPerWeek,
    sessionMinutes,
    createdAt: formatDate(item.generatedAt || item.createdAt),
    createdUpper: formatCreatedUpper(item.generatedAt || item.createdAt),
    exerciseCount: deriveExerciseCount(item),
    muscleTags: deriveMuscleTags(item, displayFocus),
    trainingDays,
    _source: item._source,
    _singleDoc: item._singleDoc,
    _path: item._path,
    assigned: item.assigned,
    _raw: item,
  };
}

function normalizePlanList(rawPlans) {
  const plans = [];
  for (let index = 0; index < rawPlans.length; index += 1) {
    plans.push(normalizePlan(rawPlans[index]));
  }
  return plans;
}

/** Client-side search — name, focus line, or muscle tag text. */
function filterPlansByLibraryQuery(plans, libraryQuery) {
  const queryText = libraryQuery.trim().toLowerCase();
  if (!queryText) return plans;

  return plans.filter((plan) => {
    const nameMatch = String(plan.name || '').toLowerCase().includes(queryText);
    const focusMatch = String(plan.focus || '').toLowerCase().includes(queryText);
    const tagMatch = (plan.muscleTags || []).some((tag) =>
      String(tag).toLowerCase().includes(queryText),
    );
    return nameMatch || focusMatch || tagMatch;
  });
}

function planRowMetaLine(plan) {
  const createdLabel = plan.createdAt || '—';
  const isManual =
    planRawSource(plan) === SOURCE_MANUAL_BUILDER || planRawPlanKind(plan) === PLAN_KIND_MANUAL;
  if (isManual) return `Custom · ${createdLabel}`;
  return `Built by AI · ${createdLabel}`;
}

function statusBadgeLabel(status) {
  if (status === 'completed') return 'Done';
  if (status === 'paused') return 'Paused';
  return String(status || 'Plan');
}

function emptyHeroTitle(compact, message) {
  if (compact) return message || 'Nothing here yet';
  return 'No plans yet';
}

function emptyHeroSubtitle(compact, viewerRole, clientName) {
  if (compact) return 'Try a different search or add a new plan.';
  if (viewerRole === 'trainer') {
    return `${clientName} has no saved plans yet. Build a custom plan or generate with AI.`;
  }
  return 'Tap Build a plan to draft one, or wait for your coach to add one.';
}

function emptyFilterMessage(libraryQuery) {
  if (libraryQuery.trim()) return 'No matching plans';
  return 'No plans yet';
}

function deleteSheetMetaLine(planPendingDelete) {
  if (!planPendingDelete) return '';
  const planName = planPendingDelete.name || PLAN_NAME_FALLBACK;
  if (!planPendingDelete.focus) return planName;
  return `${planName} · ${planPendingDelete.focus}`;
}

function assignToggleLabel(planPendingOptions) {
  if (planIsAssignedOnRaw(planPendingOptions)) return 'Unassign from client';
  return 'Assign to client';
}

function planCountKicker(totalPlans) {
  if (totalPlans === 1) return '1 plan';
  return `${totalPlans} plans`;
}

/**
 * Load Firestore library rows for this client (trainer-scoped when trainerId set).
 * vocab: useCallback/useEffect = React hooks; reload = re-run load
 */
function useClientWorkoutPlans(clientId, trainerId) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!clientId || !db) {
      setPlans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { plans: loaded, error: loadError } = await fetchClientWorkoutPlansForLibrary(
        clientId,
        { trainerId: trainerId || null },
      );
      setPlans(loaded);
      setError(loadError);
    } catch (loadFailure) {
      setPlans([]);
      setError(String(errorMessageOrFallback(loadFailure, loadFailure || 'Failed to load workout plans')));
    } finally {
      setLoading(false);
    }
  }, [clientId, trainerId]);

  useEffect(() => {
    load();
  }, [load]);

  return { plans, loading, error, reload: load };
}

async function writeAssignedFlagOnFirestore(plan, nextAssigned, clientId) {
  const raw = plan._raw;
  if (raw._singleDoc && raw._path) {
    await setDoc(doc(db, ...raw._path), { assigned: nextAssigned }, { merge: true });
    return;
  }
  if (raw._source === SOURCE_USERS_SUBCOLLECTION || raw._source === SOURCE_WORKOUT_PLAN_CURRENT) {
    await setDoc(
      doc(db, USERS_COLLECTION, clientId, WORKOUT_PLANS_SUBCOLLECTION, plan.id),
      { assigned: nextAssigned },
      { merge: true },
    );
    return;
  }
  await setDoc(
    doc(db, WORKOUT_PLANS_TOP_COLLECTION, plan.id),
    { assigned: nextAssigned },
    { merge: true },
  );
}

async function deletePlanDocumentsOnFirestore(plan, clientId) {
  const raw = plan._raw;
  if (raw._singleDoc && raw._path) {
    await deleteDoc(doc(db, ...raw._path));
    return;
  }
  if (raw._source === SOURCE_USERS_SUBCOLLECTION || raw._source === SOURCE_WORKOUT_PLAN_CURRENT) {
    if (raw._singleDoc && raw._path) {
      await deleteDoc(doc(db, ...raw._path));
    }
    if (!plan.id) return;
    try {
      await deleteDoc(
        doc(db, USERS_COLLECTION, clientId, WORKOUT_PLANS_SUBCOLLECTION, plan.id),
      );
    } catch {
      // Subcollection row may already be gone.
    }
    return;
  }
  await deleteDoc(doc(db, WORKOUT_PLANS_TOP_COLLECTION, plan.id));
}

// ===== LAYOUT CHROME (pure — no Firestore hooks) =====

function LibraryHeroSummary({ theme, totalPlans }) {
  const kickerText = planCountKicker(totalPlans);
  return (
    <View style={styles.libraryHeroPlain}>
      <Text style={[styles.libraryHeroTitle, { color: theme.text }]}>Saved plans</Text>
      <Text style={[styles.libraryHeroKicker, { color: theme.textMuted }]}>{kickerText}</Text>
    </View>
  );
}

/** Active / Trainer pills — Design Law soft or brand gradient, never green. */
function StatusBadge({ status }) {
  if (status === 'active') {
    return <NbPill variant="brand">Active</NbPill>;
  }
  const label = statusBadgeLabel(status);
  return <NbPill variant="plain">{label}</NbPill>;
}

/**
 * One list row inside the Saved plans card (PNG 17).
 * vocab: iconGrad = small accent only — never on the whole row.
 */
function HistoryPlanCard({ plan, theme, onPress, onOptions, index = 0 }) {
  const iconChipGradient = ICON_GRADS[index % ICON_GRADS.length];
  const isManual =
    planRawSource(plan) === SOURCE_MANUAL_BUILDER || planRawPlanKind(plan) === PLAN_KIND_MANUAL;
  const metaLine = planRowMetaLine(plan);
  const showActiveBadge = plan.status === 'active';
  const showTrainerPill = isManual && plan.status !== 'active';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.planRow}>
      <LinearGradient
        colors={iconChipGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.planIconChip, { borderColor: theme.border }]}
      >
        <Ionicons name="barbell-outline" size={22} color="#0A0A0A" />
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.historyCardTitle, { color: theme.text }]} numberOfLines={1}>
          {plan.name}
        </Text>
        <Text style={[styles.historyCardCreated, { color: theme.textMuted }]} numberOfLines={1}>
          {metaLine}
        </Text>
      </View>
      {showActiveBadge ? <StatusBadge status="active" /> : null}
      {showTrainerPill ? <NbPill variant="plain">Trainer</NbPill> : null}
      {onOptions ? (
        <TouchableOpacity onPress={onOptions} hitSlop={10} style={styles.historyCardIconHit}>
          <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

function PlansLibraryEmptyHero({
  theme,
  clientName,
  clientId,
  viewerRole,
  onGenerateWorkout,
  onBuildCustom,
  message,
  compact,
}) {
  const showCta =
    !compact && viewerRole === 'client' && typeof onGenerateWorkout === 'function' && !!clientId;
  const showTrainerCustom =
    !compact && viewerRole === 'trainer' && typeof onBuildCustom === 'function' && !!clientId;
  const titleText = emptyHeroTitle(compact, message);
  const subtitleText = emptyHeroSubtitle(compact, viewerRole, clientName);

  return (
    <View
      style={[
        styles.emptyFilterCard,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
          borderStyle: 'dashed',
          borderWidth: nb.borderWidth,
        },
      ]}
    >
      <View style={[styles.emptyFilterIcon, { backgroundColor: theme.soft, borderColor: theme.border }]}>
        <Ionicons name="layers-outline" size={26} color={theme.text} />
      </View>
      <Text style={[styles.emptyFilterTitle, { color: theme.text }]}>{titleText}</Text>
      <Text style={[styles.emptyFilterSub, { color: theme.textMuted }]}>{subtitleText}</Text>
      {showTrainerCustom ? (
        <View style={{ marginTop: 12, width: '100%' }}>
          <NbButton variant="fill" onPress={() => onBuildCustom({ id: clientId, name: clientName })}>
            Build custom plan
          </NbButton>
        </View>
      ) : null}
      {showCta ? (
        <View style={{ marginTop: 10, width: '100%' }}>
          <NbButton variant="fill" onPress={() => onGenerateWorkout({ id: clientId, name: clientName })}>
            Build a plan
          </NbButton>
        </View>
      ) : null}
    </View>
  );
}

/** Trainer footer — Build custom / AI plan as NbButtons (PNG-adjacent Tools actions). */
function TrainerBuilderFooterCard({ clientName, onGenerateWorkout, onBuildCustom, theme, clientId }) {
  if (!clientId) return null;

  return (
    <View style={styles.trainerBuilderFooterWrap}>
      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
        <View
          style={[
            styles.trainerBuilderFooterInner,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              borderWidth: nb.borderWidth,
            },
          ]}
        >
          <Text style={[styles.trainerBuilderFooterTitle, { color: theme.text }]}>
            Build for {clientName}
          </Text>
          <Text style={[styles.trainerBuilderFooterSub, { color: theme.textMuted }]}>
            Custom builder or AI plan
          </Text>
          <View style={{ gap: 10, marginTop: 12 }}>
            <NbButton
              variant="fill"
              onPress={() => callIfFunction(onBuildCustom, { id: clientId, name: clientName })}
            >
              Build custom plan
            </NbButton>
            <NbButton
              variant="ghost"
              onPress={() => callIfFunction(onGenerateWorkout, { id: clientId, name: clientName })}
            >
              Generate AI plan
            </NbButton>
          </View>
        </View>
      </HardShadow>
    </View>
  );
}

function buildPlanListRowElements(plansFilteredBySearch, theme, handleView, showPlanOptions, viewerRole) {
  const rows = [];
  for (let index = 0; index < plansFilteredBySearch.length; index += 1) {
    const plan = plansFilteredBySearch[index];
    const showDivider = index > 0;
    let optionsHandler = null;
    if (viewerRole === 'trainer') {
      optionsHandler = () => showPlanOptions(plan);
    }
    rows.push(
      <View key={plan.id}>
        {showDivider ? (
          <View style={[styles.planRowDivider, { backgroundColor: theme.border }]} />
        ) : null}
        <HistoryPlanCard
          plan={plan}
          theme={theme}
          index={index}
          onPress={() => handleView(plan)}
          onOptions={optionsHandler}
        />
      </View>,
    );
  }
  return rows;
}

function PlansListCard({
  theme,
  plansFilteredBySearch,
  handleView,
  showPlanOptions,
  viewerRole,
}) {
  const rowElements = buildPlanListRowElements(
    plansFilteredBySearch,
    theme,
    handleView,
    showPlanOptions,
    viewerRole,
  );
  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
      <View
        style={[
          styles.plansListCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: nb.borderWidth,
          },
        ]}
      >
        {rowElements}
      </View>
    </HardShadow>
  );
}

function SavedWorkoutsScreenLayout({
  theme,
  embedInLayout,
  shellBottomPad,
  handleBack,
  onProfilePress,
  onSettingsPress,
  loading,
  error,
  reload,
  hasPlans,
  clientName,
  clientId,
  viewerRole,
  onGenerateWorkout,
  onBuildCustom,
  plans,
  libraryQuery,
  setLibraryQuery,
  plansFilteredBySearch,
  handleView,
  showPlanOptions,
  isTrainerView,
  trainerId,
}) {
  const ScreenRoot = embedInLayout ? View : SafeAreaView;
  const showHeader = !embedInLayout;
  const showLoadingBlock = !!loading;
  const showErrorBlock = !!error && !loading;
  const showEmptyLibrary = !loading && !error && !hasPlans;
  const showPlansLibrary = !loading && !error && hasPlans;
  const searchReturnedNothing = plansFilteredBySearch.length === 0;
  const showTrainerFooter = isTrainerView && trainerId && clientId;
  const scrollTopPad = embedInLayout ? { paddingTop: 4 } : null;
  const emptySearchMessage = emptyFilterMessage(libraryQuery);

  return (
    <ScreenRoot
      style={[styles.container, { backgroundColor: theme.bg }]}
      {...(embedInLayout ? {} : { edges: SHELL_SAFE_AREA_EDGES })}
    >
      {showHeader ? (
        <TopHeader
          title=""
          skipTopSafeInset
          onBack={handleBack}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: shellBottomPad },
          scrollTopPad,
        ]}
        style={{ backgroundColor: theme.bg }}
        keyboardShouldPersistTaps="handled"
      >
        {showLoadingBlock ? (
          <View style={styles.centeredFeedback}>
            <ActivityIndicator size="large" color={theme.fill} />
            <Text style={[styles.feedbackText, { color: theme.textMuted }]}>Loading plans…</Text>
          </View>
        ) : null}

        {showErrorBlock ? (
          <View style={{ paddingHorizontal: 16 }}>
            <View
              style={[
                styles.loadErrorInner,
                {
                  backgroundColor: theme.surface,
                  borderWidth: nb.borderWidth,
                  borderColor: theme.border,
                },
              ]}
            >
              <Ionicons name="cloud-offline-outline" size={32} color={theme.text} />
              <Text style={[styles.loadErrorTitle, { color: theme.text }]}>Could not load plans</Text>
              <Text style={[styles.loadErrorText, { color: theme.textMuted }]}>{error}</Text>
              <View style={{ marginTop: 12, width: '100%' }}>
                <NbButton variant="fill" onPress={reload}>
                  Retry
                </NbButton>
              </View>
            </View>
          </View>
        ) : null}

        {showEmptyLibrary ? (
          <View style={{ paddingHorizontal: 16 }}>
            <LibraryHeroSummary theme={theme} totalPlans={0} />
            <PlansLibraryEmptyHero
              theme={theme}
              clientName={clientName}
              clientId={clientId}
              viewerRole={viewerRole}
              onGenerateWorkout={onGenerateWorkout}
              onBuildCustom={onBuildCustom}
            />
          </View>
        ) : null}

        {showPlansLibrary ? (
          <>
            <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
              <LibraryHeroSummary theme={theme} totalPlans={plans.length} />
            </View>

            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <View
                style={[
                  styles.librarySearchInner,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.border,
                    borderWidth: nb.borderWidth,
                    borderRadius: borderRadius.nbInput,
                  },
                ]}
              >
                <Ionicons name="search-outline" size={22} color={theme.textMuted} />
                <TextInput
                  value={libraryQuery}
                  onChangeText={setLibraryQuery}
                  placeholder="Search your plans"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.librarySearchInput, { color: theme.text }]}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={[styles.plansSection, { marginTop: 12, paddingHorizontal: 16 }]}>
              {searchReturnedNothing ? (
                <PlansLibraryEmptyHero
                  compact
                  theme={theme}
                  clientName={clientName}
                  clientId={clientId}
                  viewerRole={viewerRole}
                  message={emptySearchMessage}
                />
              ) : (
                <PlansListCard
                  theme={theme}
                  plansFilteredBySearch={plansFilteredBySearch}
                  handleView={handleView}
                  showPlanOptions={showPlanOptions}
                  viewerRole={viewerRole}
                />
              )}
            </View>
          </>
        ) : null}

        {showTrainerFooter ? (
          <TrainerBuilderFooterCard
            theme={theme}
            clientId={clientId}
            clientName={clientName}
            onGenerateWorkout={onGenerateWorkout}
            onBuildCustom={onBuildCustom}
          />
        ) : null}
      </ScrollView>
    </ScreenRoot>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Saved plans library screen — load, search, open, assign/delete via NbSheets.
 * Flow: 1. theme/shell  2. client ids  3. UI state  4. load+normalize  5. search  6. paint
 */
export default function SavedWorkoutsScreen({
  route,
  navigation,
  client: clientProp,
  embedInLayout = false,
  onBack,
  onProfilePress,
  onSettingsPress,
  onViewPlan,
  onGenerateWorkout,
  onBuildCustom,
  onEditManualPlan,
  trainerId,
  viewerRole = 'trainer',
}) {
  // 1. Theme + shell spacing for scroll content above bottom nav
  // vocab: useTheme = Design Law light/dark color bag
  const { colors } = useTheme();
  const theme = useMemo(() => nbTheme(colors), [colors]);
  // vocab: useShellBottomNavInset = pad so list clears the bottom tab bar
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_PAD_EXTRA);

  // 2. Who is this library for?
  const libraryClient = readLibraryClientIdentity(clientProp, route);
  const clientId = libraryClient.clientId;
  const clientName = libraryClient.clientName;

  // 3. Local UI state: search box + NbSheet confirm targets + notice sheet
  const [libraryQuery, setLibraryQuery] = useState('');
  // vocab: planPendingDelete = plan waiting on PNG 18 NbSheet confirm (null = sheet closed)
  const [planPendingDelete, setPlanPendingDelete] = useState(null);
  const [planPendingOptions, setPlanPendingOptions] = useState(null);
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message, extras = {}) => setNotice({ title, message, ...extras });

  // 4. Load Firestore library rows for this client (trainer-scoped when trainerId set)
  const { plans: rawPlans, loading, error, reload } = useClientWorkoutPlans(clientId, trainerId);
  const plans = useMemo(() => normalizePlanList(rawPlans), [rawPlans]);

  // 5. Client-side search — name, focus line, or muscle tag text
  const plansFilteredBySearch = useMemo(
    () => filterPlansByLibraryQuery(plans, libraryQuery),
    [plans, libraryQuery],
  );

  // Firestore writes — assign toggle and delete across legacy path shapes
  const writeAssignedFlag = useCallback(
    async (plan, nextAssigned) => {
      await writeAssignedFlagOnFirestore(plan, nextAssigned, clientId);
    },
    [clientId],
  );

  const deletePlanDocuments = useCallback(
    async (plan) => {
      await deletePlanDocumentsOnFirestore(plan, clientId);
    },
    [clientId],
  );

  const handleToggleAssigned = useCallback(
    async (plan) => {
      if (!db || !clientId || !plan || !plan.id) return;
      try {
        await writeAssignedFlag(plan, !plan._raw.assigned);
        reload();
      } catch (writeError) {
        showNotice('Error', errorMessageOrFallback(writeError, 'Could not update plan.'));
      }
    },
    [clientId, reload, writeAssignedFlag],
  );

  const confirmDeletePlan = useCallback(
    async (plan) => {
      try {
        await deletePlanDocuments(plan);
        setPlanPendingDelete(null);
        reload();
      } catch (deleteError) {
        showNotice('Error', errorMessageOrFallback(deleteError, 'Could not delete plan.'));
      }
    },
    [deletePlanDocuments, reload],
  );

  // PNG 18: open Design Law delete sheet instead of native Alert
  const handleDeletePlan = useCallback(
    (plan) => {
      if (!db || !clientId || !plan || !plan.id) return;
      setPlanPendingDelete(plan);
    },
    [clientId],
  );

  const showPlanOptions = useCallback(
    (plan) => {
      if (viewerRole !== 'trainer') return;
      setPlanPendingOptions(plan);
    },
    [viewerRole],
  );

  const deleteSheetMeta = deleteSheetMetaLine(planPendingDelete);
  const optionsAssignLabel = assignToggleLabel(planPendingOptions);

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (navigation && typeof navigation.goBack === 'function') {
      navigation.goBack();
    }
  };

  const handleView = (plan) => {
    if (onViewPlan) {
      onViewPlan(plan._raw);
      return;
    }
    if (navigation && typeof navigation.navigate === 'function') {
      navigation.navigate('WorkoutDetail', { planId: plan.id });
    }
  };

  const hasPlans = plans.length > 0;
  const isTrainerView = viewerRole === 'trainer';
  const deleteSheetVisible = !!planPendingDelete;
  const optionsSheetVisible = !!planPendingOptions;
  const noticeSheetVisible = !!notice;

  // 6. Paint scrollable library + trainer sheets (delete confirm PNG 18, options, notices)
  return (
    <>
      <SavedWorkoutsScreenLayout
        theme={theme}
        embedInLayout={embedInLayout}
        shellBottomPad={shellBottomPad}
        handleBack={handleBack}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
        loading={loading}
        error={error}
        reload={reload}
        hasPlans={hasPlans}
        clientName={clientName}
        clientId={clientId}
        viewerRole={viewerRole}
        onGenerateWorkout={onGenerateWorkout}
        onBuildCustom={onBuildCustom}
        plans={plans}
        libraryQuery={libraryQuery}
        setLibraryQuery={setLibraryQuery}
        plansFilteredBySearch={plansFilteredBySearch}
        handleView={handleView}
        showPlanOptions={showPlanOptions}
        isTrainerView={isTrainerView}
        trainerId={trainerId}
      />

      {/* PNG 18 delete confirm sheet */}
      <NbSheet
        visible={deleteSheetVisible}
        onClose={() => setPlanPendingDelete(null)}
        title="Delete plan"
      >
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: 14 }}>
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
              borderWidth: nb.borderWidth,
              borderColor: colors.nbBorder,
              backgroundColor: colors.nbSurfaceChip,
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '900', color: colors.nbInk }}>
              Cannot be undone
            </Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.nbMuted, lineHeight: 22 }}>
            Are you sure you want to delete this workout plan?
          </Text>
          {planPendingDelete ? (
            <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall}>
              <View
                style={{
                  borderWidth: nb.borderWidth,
                  borderColor: colors.nbBorder,
                  borderRadius: borderRadius.nbCard,
                  backgroundColor: colors.nbSurface,
                  padding: 14,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: '900', color: colors.nbInk }}>
                  {planPendingDelete.name || PLAN_NAME_FALLBACK}
                </Text>
                {deleteSheetMeta ? (
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: colors.nbMuted,
                      marginTop: 4,
                    }}
                  >
                    {deleteSheetMeta}
                  </Text>
                ) : null}
              </View>
            </HardShadow>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <NbButton
              variant="plain"
              onPress={() => setPlanPendingDelete(null)}
              style={{ flex: 1 }}
            >
              Keep it
            </NbButton>
            <NbButton
              variant="fill"
              onPress={() => {
                if (planPendingDelete) void confirmDeletePlan(planPendingDelete);
              }}
              style={{ flex: 1 }}
            >
              Delete plan
            </NbButton>
          </View>
        </View>
      </NbSheet>

      <NbSheet
        visible={optionsSheetVisible}
        onClose={() => setPlanPendingOptions(null)}
        title="Plan options"
      >
        <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: 10 }}>
          <NbButton
            variant="fill"
            onPress={() => {
              const plan = planPendingOptions;
              setPlanPendingOptions(null);
              if (plan) void handleToggleAssigned(plan);
            }}
          >
            {optionsAssignLabel}
          </NbButton>
          <NbButton
            variant="plain"
            onPress={() => {
              const plan = planPendingOptions;
              setPlanPendingOptions(null);
              if (plan) handleDeletePlan(plan);
            }}
          >
            Delete plan
          </NbButton>
          <NbButton variant="ghost" onPress={() => setPlanPendingOptions(null)}>
            Cancel
          </NbButton>
        </View>
      </NbSheet>

      <NbNoticeSheet
        visible={noticeSheetVisible}
        onClose={() => setNotice(null)}
        title={noticeTitle(notice)}
        message={noticeMessage(notice)}
        confirmLabel={noticeConfirmLabel(notice)}
        cancelLabel={noticeCancelLabel(notice)}
        onConfirm={noticeOnConfirm(notice)}
      />
    </>
  );
}

// ===== PLUMBING — skip unless debugging =====
// WEEKDAY_SHORT_LABELS kept for Design Law weekday-dot parity (list chrome may re-use).
void WEEKDAY_SHORT_LABELS;

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 0 },

  libraryHeroPlain: { marginBottom: 4 },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: nb.minTouchTarget,
  },
  planIconChip: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.nbIconChip || 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plansListCard: {
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
  },
  planRowDivider: { height: nb.borderWidthDivider, width: '100%' },
  trainerBuilderFooterWrap: { paddingHorizontal: 16, marginTop: 20 },
  trainerBuilderFooterInner: { borderRadius: borderRadius.nbCard, padding: 14 },
  trainerBuilderFooterTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trainerBuilderFooterIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerBuilderFooterTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  trainerBuilderFooterSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  trainerBuilderFooterActions: { flexDirection: 'row', gap: 8 },
  trainerBuilderFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  trainerBuilderFooterBtnText: { fontSize: 12, fontWeight: '800' },

  libraryHeroBorder: { borderRadius: 20, padding: 2 },
  libraryHeroInner: { borderRadius: 18, paddingHorizontal: 20, paddingVertical: 22, alignItems: 'center' },
  libraryHeroTitle: { fontSize: 25, fontWeight: '900', letterSpacing: -0.6, lineHeight: 30 },
  libraryHeroKicker: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  libraryHeroAccentLine: { width: 56, height: 3, borderRadius: 2, marginTop: 10 },
  libraryHeroCount: { fontSize: 56, fontWeight: '900', color: '#0A0A0A', marginTop: 14, letterSpacing: -2 },
  libraryHeroFooter: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginTop: 10, textAlign: 'center' },

  librarySearchBorder: { borderRadius: 16, padding: 2 },
  librarySearchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  librarySearchInput: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 0 },

  historyCardBorder: { borderRadius: 16, padding: 1.5, marginBottom: 0 },
  historyCard: { borderRadius: 15, padding: 16, gap: 12 },
  historyCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  historyCardTitle: { fontSize: 19, fontWeight: '800', lineHeight: 24 },
  historyCardIconHit: { padding: 4 },
  historyIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyCardCreated: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6 },
  historyStatRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyStatPillGrad: { borderRadius: 14, padding: 1.5, flexGrow: 1, flexBasis: 0, minWidth: 0 },
  historyStatPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12.5,
    borderWidth: 2.5,
    flexShrink: 1,
  },
  historyStatText: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  historyDivider: { height: StyleSheet.hairlineWidth, width: '100%', marginTop: 4, marginBottom: 4 },
  historyDividerGrad: { height: 2, width: '100%', borderRadius: 1, marginTop: 2, marginBottom: 2 },
  historyMuscleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  historyFocusChipBorder: { borderRadius: 999, padding: 1.5, maxWidth: '100%' },
  historyFocusChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  historyFocusChipText: { fontSize: 13, fontWeight: '800', flexShrink: 1 },
  historyMuscleChipGrad: { borderRadius: 999, padding: 1 },
  historyMuscleChipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 2.5,
    maxWidth: 160,
  },
  historyMuscleDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#06B6D4',
  },
  historyMuscleText: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  historyMoreChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 2.5,
  },
  historyOpenBtnGrad: {
    borderRadius: 14,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#0A0A0A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 6,
  },
  historyOpenBtnTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  historyOpenBtnLabel: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.2 },

  pageTitleSection: { paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  pageLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '700' },

  featuredSection: { paddingHorizontal: 16, marginBottom: 32 },
  plansSection: { paddingHorizontal: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 12 },

  featuredBorder: { borderRadius: 24, padding: 2, marginBottom: 4 },
  featuredCard: { padding: 20, borderRadius: 22, overflow: 'hidden' },
  featuredGlow: { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, opacity: 0.12 },
  featuredContent: {},
  featuredBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  featuredTag: { fontSize: 10, fontWeight: '600' },
  featuredTitleSection: { gap: 6 },
  featuredTitle: { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  featuredSubtitle: { fontSize: 13 },
  featuredActions: { gap: 10 },

  focusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 20 },
  focusLabel: { fontSize: 11, fontWeight: '700', color: '#FFF', letterSpacing: 0.4 },

  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1 },
  statusLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  metricsGrid: { flexDirection: 'row', gap: 10 },
  metricCard: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 2.5, gap: 5 },
  metricValue: { fontSize: 17, fontWeight: '700' },
  metricLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },

  weekSection: { gap: 8 },
  weekLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  weekDots: { flexDirection: 'row', gap: 5 },
  weekDot: { flex: 1, height: 34, borderRadius: 8, borderWidth: 2.5, justifyContent: 'center', alignItems: 'center' },
  weekDayLabel: { fontSize: 10, fontWeight: '700' },

  primaryButtonGradient: { borderRadius: 20 },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  primaryButtonLabel: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, borderWidth: 2.5, alignItems: 'center' },
  secondaryButtonLabel: { fontSize: 14, fontWeight: '600' },

  progressRingSection: { alignItems: 'center', gap: 12, marginTop: 16 },
  progressRingWrap: { alignItems: 'center', justifyContent: 'center' },
  progressRingOuter: { width: 130, height: 130, borderRadius: 65, borderWidth: 8, justifyContent: 'center', alignItems: 'center' },
  progressRingInner: { width: 110, height: 110, borderRadius: 55, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  progressValue: { fontSize: 28, fontWeight: '700' },
  progressLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 2 },
  weeksLeftCard: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, borderWidth: 2.5, alignItems: 'center' },
  weeksLeftValue: { fontSize: 22, fontWeight: '700' },
  weeksLeftLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginTop: 2 },

  planCardBorder: { borderRadius: 12, padding: 1, marginBottom: 0 },
  planCard: { padding: 16, borderRadius: 11, gap: 8 },
  planCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  focusBadgeSmall: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 16 },
  focusLabelSmall: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  planCardName: { fontSize: 16, fontWeight: '700' },
  planCardSubtitle: { fontSize: 12 },
  planCardMetrics: { flexDirection: 'row', gap: 8 },
  planCardMetricPill: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  planCardMetricText: { fontSize: 11, fontWeight: '600' },
  planCardActions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  planCardButton: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 2.5, alignItems: 'center' },
  planCardButtonLabel: { fontSize: 12, fontWeight: '600' },
  planCardButtonGradient: { flex: 1, borderRadius: 12 },
  planCardButtonPrimary: { paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  planCardButtonPrimaryLabel: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  plansList: { gap: 16, marginTop: 8 },

  emptyHeroOuter: { marginTop: 8, marginBottom: 8 },
  emptyHeroInner: { borderRadius: 22, overflow: 'hidden' },
  emptyHeroContent: { padding: 20, gap: 12, zIndex: 1 },
  emptyHeroKicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  emptyHeroTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, lineHeight: 32 },
  emptyHeroSub: { fontSize: 14, fontWeight: '600', lineHeight: 21 },
  emptyHeroBullets: { gap: 8, marginTop: 4 },
  emptyHeroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  emptyHeroBullet: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 19 },
  emptyHeroCtaGrad: { borderRadius: 16, overflow: 'hidden' },
  emptyHeroCtaTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  emptyHeroCtaText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.2 },
  emptyFilterCard: {
    borderRadius: 20,
    borderWidth: 2.5,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyFilterIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: nb.borderWidth,
    marginBottom: 12,
  },
  emptyFilterTitle: { fontSize: 17, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  emptyFilterSub: { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18 },

  loadErrorInner: { borderRadius: 18, padding: 22, alignItems: 'center', gap: 10, marginTop: 8 },
  loadErrorTitle: { fontSize: 18, fontWeight: '800' },
  loadErrorText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  loadErrorRetry: { marginTop: 6, borderRadius: 999, overflow: 'hidden' },
  retryGrad: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 999 },
  retryGradLabel: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, textAlign: 'center' },

  centeredFeedback: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  feedbackText: { marginTop: 10, fontSize: 14 },
  errorText: { color: '#F97373', textAlign: 'center', marginBottom: 8 },
  retryButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#0A0A0A' },
  retryButtonLabel: { color: '#FFFFFF', fontWeight: '600' },
});
