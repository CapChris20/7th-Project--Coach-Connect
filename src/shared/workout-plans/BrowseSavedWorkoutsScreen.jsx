/**
 * AIWorkout Plans Screen
 *
 * Purpose: UI screen or component: AIWorkout Plans Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: BrowseSavedWorkoutsScreen
 *
 * @file-header
 */
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../shared-ui/ThemeContext';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import { db } from '../../app-start/config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { fetchClientWorkoutPlansForLibrary } from '../../workouts/exercise-library/clientWorkoutPlansLibrary';

// ============================================================================
// COLOR SYSTEM
// ============================================================================
const FOCUS_COLORS = {
  pink:   { start: '#FF6B9D', end: '#C084FC' },
  purple: { start: '#C084FC', end: '#7C3AED' },
  cyan:   { start: '#06B6D4', end: '#3B82F6' },
  orange: { start: '#F97316', end: '#FF6B9D' },
  green:  { start: '#10B981', end: '#06B6D4' },
  gray:   { start: '#6B7280', end: '#1F2937' },
};

const THEME = {
  dark: {
    bg: '#0A0A0F',
    surface: '#13131A',
    card: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.55)',
    textSecondary: 'rgba(255,255,255,0.35)',
  },
  light: {
    bg: '#F9FAFB',
    surface: '#FFFFFF',
    card: 'rgba(0,0,0,0.02)',
    border: 'rgba(0,0,0,0.08)',
    text: '#0A0A0F',
    textMuted: 'rgba(0,0,0,0.55)',
    textSecondary: 'rgba(0,0,0,0.35)',
  },
};

/** design-system.md — card rims & CTAs (dark pink → dark orange), not cyan/purple rainbow */
const WARM_BORDER_GRADIENT = ['#BE185D', '#C2410C'];
const WARM_CTA_GRADIENT = ['#BE185D', '#C2410C'];
const WARM_ACCENT = '#FF6B9D';

const EMPTY_CHECK_COLORS = ['#FF6B9D', '#F97316', '#BE185D', '#C2410C'];

// ============================================================================
// FIRESTORE HOOK
// ============================================================================
function useClientWorkoutPlans(clientId) {
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
      const { plans: loaded, error: loadError } = await fetchClientWorkoutPlansForLibrary(clientId);
      setPlans(loaded);
      setError(loadError);
    } catch (e) {
      setPlans([]);
      setError(String(e?.message || e || 'Failed to load workout plans'));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  return { plans, loading, error, reload: load };
}

// ============================================================================
// DATA NORMALIZER  –  maps raw Firestore shape → UI shape
// ============================================================================
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

function formatDate(raw) {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : raw instanceof Date ? raw : new Date(raw);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "MAY 5, 2026" for history card headers */
function formatCreatedUpper(raw) {
  if (!raw) return '';
  const d = raw?.toDate ? raw.toDate() : raw instanceof Date ? raw : new Date(raw);
  if (!d || isNaN(d.getTime())) return '';
  return d
    .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    .toUpperCase();
}

function deriveExerciseCount(item) {
  const explicit = item?.totalExerciseCount ?? item?.exerciseCount ?? item?.exerciseTotal;
  if (typeof explicit === 'number' && explicit > 0) return explicit;
  const sp = item?.structuredPlan;
  const days = sp?.days || sp?.sessions || (Array.isArray(sp?.weeks) ? sp.weeks.flatMap((w) => w?.days || []) : null);
  if (Array.isArray(days)) {
    let c = 0;
    for (const d of days) {
      if (d?.isRest || d?.rest) continue;
      const ex = d?.exercises || d?.mainWorkouts || d?.main_workouts || [];
      if (Array.isArray(ex)) c += ex.length;
    }
    if (c > 0) return c;
  }
  const dpw = Number(item?.daysPerWeek) || 4;
  return Math.max(8, dpw * 6);
}

function deriveMuscleTags(item, displayFocus) {
  const tags = [];
  const push = (s) => {
    const t = String(s || '').trim();
    if (t && !tags.includes(t) && t.length < 28) tags.push(t);
  };

  const sp = item?.structuredPlan;
  const days = sp?.days || (Array.isArray(sp?.weeks) ? sp.weeks.flatMap((w) => w?.days || []) : null);
  if (Array.isArray(days)) {
    for (const d of days) {
      push(d?.focus);
      push(d?.label);
      push(d?.name);
      const mus = d?.muscleGroups || d?.muscles || d?.targets;
      if (Array.isArray(mus)) mus.forEach((m) => push(typeof m === 'string' ? m : m?.name || m?.label));
    }
  }
  const pm = item?.primaryMuscles || item?.muscleGroups || item?.muscles;
  if (Array.isArray(pm)) pm.forEach((m) => push(typeof m === 'string' ? m : m?.name));
  else if (typeof pm === 'string') pm.split(/[,/]/).forEach((s) => push(s));

  if (tags.length === 0 && displayFocus) {
    displayFocus.split(/[,/•]/).forEach((s) => push(s));
  }
  if (tags.length === 0) push('Full body');
  return tags.slice(0, 8);
}

function normalizePlan(item) {
  // Derive status: prefer explicit field, else infer from assigned flag
  const status = item.status || (item.assigned ? 'active' : 'paused');

  const isManual = item.source === 'manualBuilder' || item.planKind === 'manual';

  // Pick a gradient colour key
  const goalKey = Object.keys(GOAL_COLOR_MAP).find((k) =>
    (item.goal || item.focus || item.type || item.category || '').toLowerCase().includes(k),
  );
  const focusColor = item.focusColor || GOAL_COLOR_MAP[goalKey] || 'pink';

  const totalWeeks = isManual
    ? (item.durationWeeks || item.totalWeeks || item.weeks || 8)
    : (item.totalWeeks || item.weeks || item.durationWeeks || 8);
  const weeksCompleted = item.weeksCompleted || item.currentWeek || 0;
  const daysPerWeek =
    isManual && typeof item.daysPerWeek === 'number'
      ? item.daysPerWeek
      : item.daysPerWeek || 3;
  const sessionMinutes = item.sessionMinutes || item.sessionLength || 45;

  // Build a 7-day boolean array from stored field or infer from daysPerWeek
  const trainingDays =
    Array.isArray(item.trainingDays) && item.trainingDays.length === 7
      ? item.trainingDays
      : Array.from({ length: 7 }, (_, i) => i < daysPerWeek);

  const displayName = isManual
    ? (item.title || item.name || item.planName || 'Custom plan')
    : (item.title || item.name || item.planTitle || (item.rawPlan || item.planText ? 'Workout plan' : 'Workout Plan'));
  const displayFocus = isManual
    ? String(item.category || item.focus || 'Custom plan').trim()
    : (item.focus || item.goal || item.type || 'Training');

  return {
    // UI fields
    id:              item.id,
    name:            displayName,
    status,
    focusColor,
    focus:           displayFocus,
    totalWeeks,
    weeksCompleted,
    daysPerWeek,
    sessionMinutes,
    createdAt:       formatDate(item.generatedAt || item.createdAt),
    createdUpper:    formatCreatedUpper(item.generatedAt || item.createdAt),
    exerciseCount:   deriveExerciseCount(item),
    muscleTags:      deriveMuscleTags(item, displayFocus),
    trainingDays,
    // Firestore bookkeeping (needed for write ops below)
    _source:         item._source,
    _singleDoc:      item._singleDoc,
    _path:           item._path,
    assigned:        item.assigned,
    // Pass through so renderPlan can still use original fields if needed
    _raw:            item,
  };
}

// ============================================================================
// LIBRARY HERO — matches client library screenshots
// ============================================================================
function LibraryHeroSummary({ isDark, totalPlans }) {
  const theme = THEME[isDark ? 'dark' : 'light'];
  const innerBg = isDark ? '#121218' : '#FFFFFF';

  return (
    <LinearGradient
      colors={WARM_BORDER_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.libraryHeroBorder}
    >
      <View style={[styles.libraryHeroInner, { backgroundColor: innerBg }]}>
        <Text style={[styles.libraryHeroTitle, { color: theme.text }]}>
          Your Workout{' '}
          <Text style={{ fontWeight: '900', color: '#BE185D' }}>Lib</Text>
          <Text style={{ fontWeight: '900', color: '#C2410C' }}>rary</Text>
        </Text>
        <Text style={[styles.libraryHeroKicker, { color: theme.textMuted }]}>SAVED PLANS</Text>
        <LinearGradient
          colors={WARM_BORDER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.libraryHeroAccentLine}
        />
        <Text style={[styles.libraryHeroCount, { color: WARM_ACCENT }]}>{totalPlans}</Text>
        <Text style={[styles.libraryHeroFooter, { color: theme.textSecondary }]}>PLANS CRAFTED WITH COACH CONNECT</Text>
      </View>
    </LinearGradient>
  );
}

// ============================================================================
// METRIC CARD
// ============================================================================
const MetricCard = ({ icon, iconLib, label, value, isDark }) => {
  const theme = THEME[isDark ? 'dark' : 'light'];
  const IconComp = iconLib === 'mci' ? MaterialCommunityIcons : Ionicons;
  return (
    <View style={[styles.metricCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <IconComp name={icon} size={14} color={theme.textMuted} />
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
};

// ============================================================================
// PROGRESS RING (visual-only — no SVG dependency)
// ============================================================================
const ProgressRing = ({ progress, isDark }) => {
  const theme = THEME[isDark ? 'dark' : 'light'];
  const pct = Math.round(progress);
  return (
    <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: 'rgba(255,107,157,0.25)', justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 3, borderColor: '#FF6B9D', justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,107,157,0.06)' : 'rgba(255,107,157,0.04)' }}>
        <Text style={{ fontSize: 16, fontWeight: '900', color: theme.text }}>{pct}%</Text>
      </View>
    </View>
  );
};

// ============================================================================
// FEATURED PLAN CARD
// ============================================================================
const FeaturedPlanCard = ({ plan, isDark, onContinue, onViewDetails, onOptions }) => {
  const theme  = THEME[isDark ? 'dark' : 'light'];
  const colors = FOCUS_COLORS[plan.focusColor] || FOCUS_COLORS.pink;
  const progress  = plan.totalWeeks > 0 ? Math.round((plan.weeksCompleted / plan.totalWeeks) * 100) : 0;

  return (
    <LinearGradient
      colors={WARM_BORDER_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.featuredBorder]}
    >
      <View style={[styles.featuredCard, { backgroundColor: theme.surface }]}>
        <View style={styles.featuredContent}>
          {/* Badges row */}
          <View style={styles.featuredBadges}>
            <LinearGradient
              colors={WARM_CTA_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.focusBadge}
            >
              <Ionicons name="sparkles" size={11} color="#FFF" />
              <Text style={styles.focusLabel}>{plan.focus}</Text>
            </LinearGradient>
            <StatusBadge status={plan.status} />
            {onOptions && (
              <TouchableOpacity onPress={onOptions} hitSlop={10} style={{ marginLeft: 'auto' }}>
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Title + progress row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
            <View style={{ flex: 1, paddingRight: 14 }}>
              <Text style={[styles.featuredTitle, { color: theme.text }]} numberOfLines={2}>
                {plan.name}
              </Text>
              <Text style={[styles.featuredSubtitle, { color: theme.textMuted }]}>
                {plan.createdAt ? `${plan.createdAt} · ` : ''}Week {plan.weeksCompleted} of {plan.totalWeeks}
              </Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <ProgressRing progress={progress} isDark={isDark} />
            </View>
          </View>

          {/* Compact metrics row */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {[
              { icon: 'calendar-outline', val: `${plan.totalWeeks} wks` },
              { icon: 'barbell-outline', val: `${plan.daysPerWeek} days/wk` },
              { icon: 'time-outline', val: `${plan.sessionMinutes}m/session` },
            ].map((m) => (
              <View key={m.icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card }}>
                <Ionicons name={m.icon} size={13} color={theme.textMuted} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textMuted }}>{m.val}</Text>
              </View>
            ))}
          </View>

          {/* Week dots */}
          <View style={{ marginTop: 14 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 1, color: theme.textMuted, marginBottom: 8 }}>THIS WEEK</Text>
            <View style={styles.weekDots}>
              {plan.trainingDays.map((isTraining, i) => (
                <View
                  key={i}
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor: isTraining ? '#BE185D' : 'transparent',
                      borderColor: isTraining ? '#BE185D' : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.weekDayLabel, { color: isTraining ? '#FFF' : theme.textMuted }]}>
                    {['M','T','W','T','F','S','S'][i]}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Single CTA */}
          <View style={{ marginTop: 16 }}>
            <LinearGradient
              colors={WARM_CTA_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              <TouchableOpacity style={styles.primaryButton} onPress={onContinue} activeOpacity={0.8}>
                <MaterialCommunityIcons name="play-circle" size={16} color="#FFF" />
                <Text style={styles.primaryButtonLabel}>Continue Today</Text>
                <Ionicons name="chevron-forward" size={14} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
};

// ============================================================================
// STATUS BADGE (shared)
// ============================================================================
const STATUS_STYLES = {
  active:    { bg: 'rgba(34,197,94,0.2)',   border: '#22c55e',  text: '#22c55e'  },
  completed: { bg: 'rgba(6,182,212,0.2)',   border: '#06B6D4',  text: '#06B6D4'  },
  paused:    { bg: 'rgba(245,158,11,0.2)',  border: '#F59E0B',  text: '#F59E0B'  },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.paused;
  return (
    <View style={[styles.statusBadge, { backgroundColor: s.bg, borderColor: s.border }]}>
      <Text style={[styles.statusLabel, { color: s.text }]}>{status?.toUpperCase()}</Text>
    </View>
  );
};

// ============================================================================
// PLAN CARD — history / library list
// ============================================================================
const STAT_PILL_ICONS = ['calendar-outline', 'repeat-outline', 'barbell-outline'];

const HistoryPlanCard = ({ plan, isDark, onPress, onOptions }) => {
  const theme = THEME[isDark ? 'dark' : 'light'];
  const muscles = plan.muscleTags || [];
  const maxShow = 4;
  const focusLabel = String(plan.focus || 'Training').trim();
  const focusLower = focusLabel.toLowerCase();
  const muscleList = muscles.filter((m) => String(m).trim().toLowerCase() !== focusLower);
  const shown = muscleList.slice(0, maxShow);
  const extra = Math.max(0, muscleList.length - maxShow);
  const statLine = [
    `${plan.totalWeeks} weeks`,
    `${plan.daysPerWeek} days/wk`,
    `${plan.exerciseCount ?? '—'} exercises`,
  ];

  return (
    <View
      style={[
        styles.historyCard,
        {
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.border,
        },
      ]}
    >
        <View style={styles.historyCardTop}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.historyCardTitle, { color: theme.text }]} numberOfLines={2}>
              {plan.name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4 }}>
            {onOptions ? (
              <TouchableOpacity onPress={onOptions} hitSlop={10} style={styles.historyCardIconHit}>
                <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={onPress}
              accessibilityLabel="Quick open plan"
              style={[
                styles.historyIconBtn,
                {
                  backgroundColor: isDark ? 'rgba(255,107,157,0.18)' : 'rgba(255,107,157,0.12)',
                  borderColor: 'rgba(255,107,157,0.45)',
                },
              ]}
            >
              <Ionicons name="barbell" size={20} color="#FF6B9D" />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={[styles.historyCardCreated, { color: theme.textMuted }]}>
          CREATED {plan.createdUpper || plan.createdAt || '—'}
        </Text>

        <View style={styles.historyStatRow}>
          {statLine.map((text, idx) => (
            <View
              key={text}
              style={[
                styles.historyStatPillInner,
                {
                  flex: 1,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(10,10,15,0.03)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(190,24,93,0.15)',
                },
              ]}
            >
              <Ionicons name={STAT_PILL_ICONS[idx] || 'ellipse-outline'} size={15} color={WARM_ACCENT} />
              <Text style={[styles.historyStatText, { color: theme.text }]} numberOfLines={1}>
                {text}
              </Text>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.historyDivider,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.08)' },
          ]}
        />

        <View style={styles.historyMuscleRow}>
          <View
            style={[
              styles.historyFocusChipInner,
              {
                backgroundColor: isDark ? 'rgba(190,24,93,0.14)' : 'rgba(255,107,157,0.1)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(190,24,93,0.35)' : 'rgba(190,24,93,0.22)',
              },
            ]}
          >
            <Ionicons name="sparkles" size={14} color={WARM_ACCENT} />
            <Text style={[styles.historyFocusChipText, { color: theme.text }]} numberOfLines={1}>
              {focusLabel}
            </Text>
          </View>
          {shown.map((m) => (
            <View
              key={m}
              style={[
                styles.historyMuscleChipInner,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(10,10,15,0.03)',
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={[styles.historyMuscleDot, { backgroundColor: WARM_ACCENT }]} />
              <Text style={[styles.historyMuscleText, { color: isDark ? 'rgba(255,255,255,0.82)' : 'rgba(10,10,15,0.75)' }]} numberOfLines={1}>
                {m}
              </Text>
            </View>
          ))}
          {extra > 0 ? (
            <View
              style={[
                styles.historyMoreChip,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(10,10,15,0.12)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                },
              ]}
            >
              <Text style={[styles.historyMuscleText, { color: theme.text }]}>+{extra}</Text>
            </View>
          ) : null}
        </View>

        <LinearGradient
          colors={WARM_CTA_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.historyOpenBtnGrad}
        >
          <TouchableOpacity
            style={styles.historyOpenBtnTouch}
            onPress={onPress}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Open workout plan"
          >
            <Ionicons name="document-text-outline" size={21} color="#FFFFFF" />
            <Text style={styles.historyOpenBtnLabel}>Open workout plan</Text>
            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>
    </View>
  );
};

// ============================================================================
// EMPTY STATES — gradient hero (matches session / marketplace polish)
// ============================================================================
function PlansLibraryEmptyHero({
  isDark,
  clientName,
  clientId,
  viewerRole,
  onGenerateWorkout,
  onBuildCustom,
  message,
  compact,
}) {
  const theme = THEME[isDark ? 'dark' : 'light'];
  const innerBg = isDark ? '#0A0A0F' : '#F8F9FC';
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)';
  /** Clients build their own plans from the generator CTA. */
  const showCta =
    !compact && viewerRole === 'client' && typeof onGenerateWorkout === 'function' && !!clientId;
  const showTrainerCustom =
    !compact && viewerRole === 'trainer' && typeof onBuildCustom === 'function' && !!clientId;

  if (compact) {
    return (
      <View style={[styles.emptyFilterCard, { borderColor: theme.border, backgroundColor: theme.card }]}>
        <LinearGradient
          colors={WARM_CTA_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyFilterIcon}
        >
          <Ionicons name="layers-outline" size={26} color="#FFFFFF" />
        </LinearGradient>
        <Text style={[styles.emptyFilterTitle, { color: theme.text }]}>{message || 'Nothing here yet'}</Text>
        <Text style={[styles.emptyFilterSub, { color: theme.textMuted }]}>Try a different search or add a new plan.</Text>
      </View>
    );
  }

  const bullets =
    viewerRole === 'trainer'
      ? [
          'Saved plans land here with progress, focus tags, and week layout.',
          'Use Custom builder for exercise-by-exercise plans, or generate AI blocks from the client dashboard.',
          'Assign, pause, or remove plans anytime from the ··· menu on a card.',
        ]
      : [
          'Saved plans land here with progress, focus tags, and week layout.',
          'Use Build a plan to draft a block in the generator—it syncs to this library.',
          'Your coach can also add plans; you will see them here when they do.',
        ];

  return (
    <View style={styles.emptyHeroOuter}>
      <View
        style={[
          styles.emptyHeroInner,
          {
            backgroundColor: innerBg,
            borderWidth: 1,
            borderColor: theme.border,
            borderBottomWidth: 4,
            borderBottomColor: '#f59e0b',
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: isDark ? 0.35 : 0.12,
                shadowRadius: 12,
              },
              android: { elevation: 5 },
            }),
          },
        ]}
      >
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'transparent' }]}
            pointerEvents="none"
          />
          <View style={styles.emptyHeroContent}>
            <Text style={[styles.emptyHeroKicker, { color: labelColor }]}>WORKOUT LIBRARY</Text>
            <Text style={[styles.emptyHeroTitle, { color: theme.text }]}>No plans yet</Text>
            <Text style={[styles.emptyHeroSub, { color: theme.textMuted }]}>
              {viewerRole === 'trainer'
                ? `${clientName} does not have any saved workout plans here yet. Open Workout Plans from Quick Actions on their dashboard to generate one—it will appear in this library.`
                : 'You do not have any saved workout plans yet. Tap Build a plan to draft one in the generator, or wait for your coach to add one.'}
            </Text>
            <View style={styles.emptyHeroBullets}>
              {bullets.map((line, i) => (
                <View key={line} style={styles.emptyHeroRow}>
                  <Ionicons name="checkmark-circle" size={18} color={EMPTY_CHECK_COLORS[i % EMPTY_CHECK_COLORS.length]} />
                  <Text style={[styles.emptyHeroBullet, { color: theme.text }]}>{line}</Text>
                </View>
              ))}
            </View>
            {showTrainerCustom ? (
              <LinearGradient
                colors={WARM_CTA_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.emptyHeroCtaGrad, { marginTop: 8 }]}
              >
                <TouchableOpacity
                  style={styles.emptyHeroCtaTouch}
                  activeOpacity={0.88}
                  onPress={() => onBuildCustom({ id: clientId, name: clientName })}
                  accessibilityRole="button"
                  accessibilityLabel="Build custom workout plan"
                >
                  <Ionicons name="construct-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyHeroCtaText}>Build custom plan</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>
            ) : null}
            {showCta ? (
              <LinearGradient
                colors={WARM_CTA_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.emptyHeroCtaGrad, { marginTop: showTrainerCustom ? 12 : 8 }]}
              >
                <TouchableOpacity
                  style={styles.emptyHeroCtaTouch}
                  activeOpacity={0.88}
                  onPress={() => onGenerateWorkout({ id: clientId, name: clientName })}
                  accessibilityRole="button"
                  accessibilityLabel="Build workout plan"
                >
                  <Ionicons name="barbell-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.emptyHeroCtaText}>Build a plan</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </LinearGradient>
            ) : null}
          </View>
      </View>
    </View>
  );
}

// ============================================================================
// TRAINER — compact builder card (bottom of library)
// ============================================================================
function TrainerBuilderFooterCard({ isDark, clientName, onGenerateWorkout, onBuildCustom, theme, clientId }) {
  if (!clientId) return null;
  const innerBg = isDark ? '#121218' : '#FFFFFF';

  return (
    <View style={styles.trainerBuilderFooterWrap}>
      <LinearGradient colors={WARM_BORDER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trainerBuilderFooterBorder}>
        <View style={[styles.trainerBuilderFooterInner, { backgroundColor: innerBg }]}>
          <View style={styles.trainerBuilderFooterTop}>
            <View style={[styles.trainerBuilderFooterIcon, { backgroundColor: isDark ? 'rgba(255,107,157,0.18)' : 'rgba(255,107,157,0.12)' }]}>
              <Ionicons name="barbell-outline" size={20} color="#FF6B9D" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.trainerBuilderFooterTitle, { color: theme.text }]}>Workout Plan Builder</Text>
              <Text style={[styles.trainerBuilderFooterSub, { color: theme.textMuted }]} numberOfLines={1}>
                Build for {clientName}
              </Text>
            </View>
          </View>
          <View style={styles.trainerBuilderFooterActions}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => onGenerateWorkout?.({ id: clientId, name: clientName })}
              style={[styles.trainerBuilderFooterBtn, { backgroundColor: isDark ? 'rgba(255,107,157,0.22)' : 'rgba(255,107,157,0.14)' }]}
            >
              <Ionicons name="sparkles-outline" size={15} color="#FF6B9D" />
              <Text style={[styles.trainerBuilderFooterBtnText, { color: theme.text }]}>AI plan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => onBuildCustom?.({ id: clientId, name: clientName })}
              style={[styles.trainerBuilderFooterBtn, { backgroundColor: isDark ? 'rgba(249,115,22,0.18)' : 'rgba(249,115,22,0.12)' }]}
            >
              <Ionicons name="construct-outline" size={15} color="#F97316" />
              <Text style={[styles.trainerBuilderFooterBtnText, { color: theme.text }]}>Custom</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

// ============================================================================
// MAIN SCREEN
// ============================================================================
export default function BrowseSavedWorkoutsScreen({
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
  const { isDark } = useTheme();
  const theme = THEME[isDark ? 'dark' : 'light'];

  const clientId   = clientProp?.id   || route?.params?.clientId;
  const clientName = clientProp?.name || route?.params?.clientName || 'Client';

  const [libraryQuery, setLibraryQuery] = useState('');
  const { plans: rawPlans, loading, error, reload } = useClientWorkoutPlans(clientId);

  // Normalize all Firestore docs into UI-friendly shape
  const plans = useMemo(() => rawPlans.map(normalizePlan), [rawPlans]);

  const plansFilteredBySearch = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter((p) => {
      if (String(p.name || '').toLowerCase().includes(q)) return true;
      if (String(p.focus || '').toLowerCase().includes(q)) return true;
      if ((p.muscleTags || []).some((t) => String(t).toLowerCase().includes(q))) return true;
      return false;
    });
  }, [plans, libraryQuery]);

  // ── Firestore write operations (unchanged logic) ─────────────────────────
  const handleToggleAssigned = useCallback(async (plan) => {
    if (!db || !clientId || !plan?.id) return;
    try {
      const raw = plan._raw;
      const nextAssigned = !raw.assigned;
      if (raw._singleDoc && raw._path) {
        await setDoc(doc(db, ...raw._path), { assigned: nextAssigned }, { merge: true });
      } else if (raw._source === 'usersSubcollection' || raw._source === 'workoutPlanCurrent') {
        await setDoc(doc(db, 'users', clientId, 'workoutPlans', plan.id), { assigned: nextAssigned }, { merge: true });
      } else {
        await setDoc(doc(db, 'workoutPlans', plan.id), { assigned: nextAssigned }, { merge: true });
      }
      reload();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not update plan.');
    }
  }, [clientId, reload]);

  const handleDeletePlan = useCallback((plan) => {
    if (!db || !clientId || !plan?.id) return;
    Alert.alert('Delete plan', 'Are you sure you want to delete this workout plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const raw = plan._raw;
            if (raw._singleDoc && raw._path) {
              await deleteDoc(doc(db, ...raw._path));
            } else if (raw._source === 'usersSubcollection' || raw._source === 'workoutPlanCurrent') {
              if (raw._singleDoc && raw._path) {
                await deleteDoc(doc(db, ...raw._path));
              }
              if (plan.id) {
                try {
                  await deleteDoc(doc(db, 'users', clientId, 'workoutPlans', plan.id));
                } catch (_) {}
              }
            } else {
              await deleteDoc(doc(db, 'workoutPlans', plan.id));
            }
            reload();
          } catch (e) {
            Alert.alert('Error', e?.message || 'Could not delete plan.');
          }
        },
      },
    ]);
  }, [clientId, reload]);

  const showPlanOptions = useCallback((plan) => {
    if (viewerRole !== 'trainer') return;
    const raw = plan._raw;
    Alert.alert('Plan options', '', [
      {
        text: raw.assigned ? 'Unassign from client' : 'Assign to client',
        onPress: () => handleToggleAssigned(plan),
      },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeletePlan(plan) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [viewerRole, handleToggleAssigned, handleDeletePlan]);

  const handleBack = () => (onBack ? onBack() : navigation?.goBack());
  const handleView = (plan) => {
    if (onViewPlan) {
      onViewPlan(plan._raw);
      return;
    }
    if (typeof navigation?.navigate === 'function') {
      navigation.navigate('WorkoutDetail', { planId: plan.id });
    }
  };

  const hasPlans = plans.length > 0;
  const isTrainerView = viewerRole === 'trainer';
  const ScreenRoot = embedInLayout ? View : SafeAreaView;

  return (
    <ScreenRoot style={[styles.container, { backgroundColor: theme.bg }]}>
      {!embedInLayout ? (
        <CoachConnectHeader
          title=""
          skipTopSafeInset
          onBack={handleBack}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, embedInLayout && { paddingTop: 4 }]}
        style={{ backgroundColor: theme.bg }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Loading */}
        {loading && (
          <View style={styles.centeredFeedback}>
            <ActivityIndicator size="large" color="#FF6B9D" />
            <Text style={[styles.feedbackText, { color: theme.textMuted }]}>Loading plans…</Text>
          </View>
        )}

        {/* Error — real failures only (not Firestore permission noise) */}
        {error && !loading && (
          <View style={{ paddingHorizontal: 16 }}>
            <View
              style={[
                styles.loadErrorInner,
                {
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.border,
                  borderLeftWidth: 4,
                  borderLeftColor: '#ef4444',
                },
              ]}
            >
                <Ionicons name="cloud-offline-outline" size={32} color="#FB923C" />
                <Text style={[styles.loadErrorTitle, { color: theme.text }]}>Could not load plans</Text>
                <Text style={[styles.loadErrorText, { color: theme.textMuted }]}>{error}</Text>
                <TouchableOpacity onPress={reload} activeOpacity={0.88} style={styles.loadErrorRetry}>
                  <LinearGradient colors={WARM_CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.retryGrad}>
                    <Text style={styles.retryGradLabel}>Retry</Text>
                  </LinearGradient>
                </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Empty library */}
        {!loading && !error && !hasPlans && (
          <View style={{ paddingHorizontal: 16 }}>
            <PlansLibraryEmptyHero
              isDark={isDark}
              clientName={clientName}
              clientId={clientId}
              viewerRole={viewerRole}
              onGenerateWorkout={onGenerateWorkout}
              onBuildCustom={onBuildCustom}
            />
          </View>
        )}

        {/* Plans */}
        {!loading && !error && hasPlans && (
          <>
            <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
              <LibraryHeroSummary isDark={isDark} totalPlans={plans.length} />
            </View>

            <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <LinearGradient
                colors={WARM_BORDER_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.librarySearchBorder}
              >
                <View style={[styles.librarySearchInner, { backgroundColor: theme.surface }]}>
                  <Ionicons name="search-outline" size={22} color={theme.textMuted} />
                  <TextInput
                    value={libraryQuery}
                    onChangeText={setLibraryQuery}
                    placeholder="Search plans or muscle groups"
                    placeholderTextColor={theme.textMuted}
                    style={[styles.librarySearchInput, { color: theme.text }]}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
              </LinearGradient>
            </View>

            <View style={[styles.plansSection, { marginTop: 6 }]}>
              {plansFilteredBySearch.length === 0 ? (
                <PlansLibraryEmptyHero
                  compact
                  isDark={isDark}
                  clientName={clientName}
                  clientId={clientId}
                  viewerRole={viewerRole}
                  message={libraryQuery.trim() ? 'No matching plans' : 'No plans yet'}
                />
              ) : (
                <View style={styles.plansList}>
                  {plansFilteredBySearch.map((plan) => (
                    <HistoryPlanCard
                      key={plan.id}
                      plan={plan}
                      isDark={isDark}
                      onPress={() => handleView(plan)}
                      onOptions={viewerRole === 'trainer' ? () => showPlanOptions(plan) : null}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}

        {isTrainerView && trainerId && clientId ? (
          <TrainerBuilderFooterCard
            isDark={isDark}
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

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  trainerBuilderFooterWrap: { paddingHorizontal: 16, marginTop: 20 },
  trainerBuilderFooterBorder: { borderRadius: 14, padding: 1.5 },
  trainerBuilderFooterInner: { borderRadius: 12.5, padding: 12, gap: 10 },
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
  libraryHeroTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', lineHeight: 28 },
  libraryHeroKicker: { fontSize: 12, fontWeight: '800', letterSpacing: 2.2, marginTop: 12 },
  libraryHeroAccentLine: { width: 56, height: 3, borderRadius: 2, marginTop: 10 },
  libraryHeroCount: { fontSize: 56, fontWeight: '900', color: '#FF6B9D', marginTop: 14, letterSpacing: -2 },
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
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
    borderWidth: 1,
  },
  historyOpenBtnGrad: {
    borderRadius: 14,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#FF6B9D',
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

  // Page title (legacy — unused in main library flow; kept for reference)
  pageTitleSection: { paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  pageLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '700' },

  // Sections
  featuredSection: { paddingHorizontal: 16, marginBottom: 32 },
  plansSection:    { paddingHorizontal: 16 },
  sectionLabel:    { fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 12 },

  // Featured card
  featuredBorder:  { borderRadius: 24, padding: 2, marginBottom: 4 },
  featuredCard:    { padding: 20, borderRadius: 22, overflow: 'hidden' },
  featuredGlow:    { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, opacity: 0.12 },
  featuredContent: {},
  featuredBadges:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  featuredTag:     { fontSize: 10, fontWeight: '600' },
  featuredTitleSection: { gap: 6 },
  featuredTitle:   { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  featuredSubtitle:{ fontSize: 13 },
  featuredActions: { gap: 10 },

  // Focus badge
  focusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 11, borderRadius: 20 },
  focusLabel: { fontSize: 11, fontWeight: '700', color: '#FFF', letterSpacing: 0.4 },

  // Status badge
  statusBadge:  { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1 },
  statusLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  // Metrics
  metricsGrid: { flexDirection: 'row', gap: 10 },
  metricCard:  { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, gap: 5 },
  metricValue: { fontSize: 17, fontWeight: '700' },
  metricLabel: { fontSize: 10, fontWeight: '600', letterSpacing: 0.8 },

  // Week dots
  weekSection:  { gap: 8 },
  weekLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  weekDots:     { flexDirection: 'row', gap: 5 },
  weekDot:      { flex: 1, height: 34, borderRadius: 8, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  weekDayLabel: { fontSize: 10, fontWeight: '700' },

  // Primary / secondary buttons
  primaryButtonGradient: { borderRadius: 20 },
  primaryButton:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 16 },
  primaryButtonLabel: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  secondaryButton:    { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  secondaryButtonLabel: { fontSize: 14, fontWeight: '600' },

  // Progress ring
  progressRingSection: { alignItems: 'center', gap: 12, marginTop: 16 },
  progressRingWrap:    { alignItems: 'center', justifyContent: 'center' },
  progressRingOuter:   { width: 130, height: 130, borderRadius: 65, borderWidth: 8, justifyContent: 'center', alignItems: 'center' },
  progressRingInner:   { width: 110, height: 110, borderRadius: 55, borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  progressValue:       { fontSize: 28, fontWeight: '700' },
  progressLabel:       { fontSize: 11, fontWeight: '600', letterSpacing: 0.8, marginTop: 2 },
  weeksLeftCard:       { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  weeksLeftValue:      { fontSize: 22, fontWeight: '700' },
  weeksLeftLabel:      { fontSize: 10, fontWeight: '600', letterSpacing: 0.8, marginTop: 2 },

  // Plan card
  planCardBorder:       { borderRadius: 12, padding: 1, marginBottom: 0 },
  planCard:             { padding: 16, borderRadius: 11, gap: 8 },
  planCardHeader:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  focusBadgeSmall:      { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 16 },
  focusLabelSmall:      { fontSize: 10, fontWeight: '700', color: '#FFF' },
  planCardName:         { fontSize: 16, fontWeight: '700' },
  planCardSubtitle:     { fontSize: 12 },
  planCardMetrics:      { flexDirection: 'row', gap: 8 },
  planCardMetricPill:   { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1 },
  planCardMetricText:   { fontSize: 11, fontWeight: '600' },
  planCardActions:      { flexDirection: 'row', gap: 8, marginTop: 4 },
  planCardButton:       { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  planCardButtonLabel:  { fontSize: 12, fontWeight: '600' },
  planCardButtonGradient: { flex: 1, borderRadius: 12 },
  planCardButtonPrimary: { paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  planCardButtonPrimaryLabel: { fontSize: 12, fontWeight: '700', color: '#FFF' },

  // Plans list
  plansList: { gap: 16, marginTop: 8 },

  // Empty state
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
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  emptyFilterIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyFilterTitle: { fontSize: 17, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  emptyFilterSub: { fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18 },

  loadErrorInner: { borderRadius: 18, padding: 22, alignItems: 'center', gap: 10, marginTop: 8 },
  loadErrorTitle: { fontSize: 18, fontWeight: '800' },
  loadErrorText: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  loadErrorRetry: { marginTop: 6, borderRadius: 999, overflow: 'hidden' },
  retryGrad: { paddingVertical: 12, paddingHorizontal: 28, borderRadius: 999 },
  retryGradLabel: { color: '#FFFFFF', fontWeight: '800', fontSize: 15, textAlign: 'center' },

  // Feedback
  centeredFeedback:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  feedbackText:      { marginTop: 10, fontSize: 14 },
  errorText:         { color: '#F97373', textAlign: 'center', marginBottom: 8 },
  retryButton:       { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FF6B9D' },
  retryButtonLabel:  { color: '#FFFFFF', fontWeight: '600' },
});
