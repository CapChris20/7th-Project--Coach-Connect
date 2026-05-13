import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../shared/ui/ThemeContext';
import { db } from '../../app/config';
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
import { listManualWorkoutPlansForTrainer, deleteManualWorkoutPlan } from '../services/manualWorkoutPlanService';

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

/** Rules / index issues — show empty library, not raw Firestore text. */
function isBenignWorkoutPlansLoadError(e) {
  if (!e) return false;
  const code = e.code;
  if (code === 'permission-denied' || code === 'failed-precondition') return true;
  const m = String(e.message || '').toLowerCase();
  if (m.includes('missing or insufficient permissions')) return true;
  return false;
}

const EMPTY_CHECK_COLORS = ['#FF6B9D', '#64D2FF', '#F97316', '#C084FC'];

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
    const results = [];
    let fatalError = null;

    const pushSnapDocs = (snap, source) => {
      snap?.forEach?.((d) => results.push({ id: d.id, ...d.data(), _source: source }));
    };

    try {
      try {
        const colRef = collection(db, 'users', clientId, 'workoutPlans');
        const snap = await getDocs(query(colRef, orderBy('generatedAt', 'desc')));
        pushSnapDocs(snap, 'usersSubcollection');
      } catch (e) {
        if (!isBenignWorkoutPlansLoadError(e)) fatalError = fatalError || e;
      }

      if (!results.length) {
        try {
          const singleRef = doc(db, 'users', clientId, 'workoutPlan', 'current');
          const singleSnap = await getDoc(singleRef);
          if (singleSnap.exists()) {
            results.push({
              id: singleSnap.id,
              ...singleSnap.data(),
              _singleDoc: true,
              _path: ['users', clientId, 'workoutPlan', 'current'],
            });
          }
        } catch (e) {
          if (!isBenignWorkoutPlansLoadError(e)) fatalError = fatalError || e;
        }
      }

      if (!results.length) {
        try {
          const globalRef = collection(db, 'workoutPlans');
          const snap = await getDocs(
            query(globalRef, where('clientId', '==', clientId), orderBy('generatedAt', 'desc')),
          );
          pushSnapDocs(snap, 'global');
        } catch (e) {
          if (!isBenignWorkoutPlansLoadError(e)) fatalError = fatalError || e;
        }
      }

      setPlans(results);
      setError(results.length > 0 ? null : fatalError ? String(fatalError.message || fatalError) : null);
    } catch (e) {
      if (isBenignWorkoutPlansLoadError(e)) {
        setPlans([]);
        setError(null);
      } else {
        setPlans([]);
        setError(String(e?.message || e || 'Failed to load workout plans'));
      }
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
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
    : (item.title || item.name || 'Workout Plan');
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
// HEADER COMPONENT
// ============================================================================
const Header = ({ isDark, onBack }) => {
  const theme = THEME[isDark ? 'dark' : 'light'];

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: isDark ? 'rgba(10,10,15,0.97)' : 'rgba(249,250,251,0.97)',
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={styles.headerContent}>
        {/* Back button */}
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.6}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </TouchableOpacity>

        {/* Logo */}
        <View style={styles.logoSection}>
          <LinearGradient
            colors={['#FF6B9D', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBadge}
          >
            <Text style={styles.logoText}>C</Text>
          </LinearGradient>
          <Text style={[styles.logoLabel, { color: theme.text }]}>CoachConnect</Text>
        </View>

        {/* Spacer to balance back button */}
        <View style={{ width: 40 }} />
      </View>
    </View>
  );
};

// ============================================================================
// FILTER CHIPS
// ============================================================================
const FilterChips = ({ value, onChange, counts, isDark }) => {
  const theme = THEME[isDark ? 'dark' : 'light'];
  const filters = [
    { key: 'all',       label: 'All'       },
    { key: 'active',    label: 'Active'    },
    { key: 'completed', label: 'Completed' },
    { key: 'paused',    label: 'Paused'    },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterContent}
    >
      {filters.map((f) => {
        const active = value === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            onPress={() => onChange(f.key)}
            activeOpacity={0.6}
            style={[
              styles.filterChip,
              {
                backgroundColor: active ? '#FF6B9D' : 'transparent',
                borderColor:     active ? '#FF6B9D' : theme.border,
              },
            ]}
          >
            <Text style={[styles.filterLabel, { color: active ? '#FFF' : theme.textMuted }]}>
              {f.label} ({counts[f.key] ?? 0})
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

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
  return (
    <View style={styles.progressRingWrap}>
      <View style={[styles.progressRingOuter, { borderColor: 'rgba(255,107,157,0.25)' }]}>
        <View style={[styles.progressRingInner, { borderColor: '#FF6B9D' }]}>
          <Text style={[styles.progressValue, { color: theme.text }]}>{Math.round(progress)}%</Text>
          <Text style={[styles.progressLabel, { color: theme.textMuted }]}>Complete</Text>
        </View>
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
  const progress  = plan.totalWeeks > 0 ? (plan.weeksCompleted / plan.totalWeeks) * 100 : 0;
  const weeksLeft = plan.totalWeeks - plan.weeksCompleted;

  return (
    <LinearGradient
      colors={[colors.start, colors.end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.featuredBorder]}
    >
      <View style={[styles.featuredCard, { backgroundColor: theme.surface }]}>
        {/* Ambient glow */}
        <View style={[styles.featuredGlow, { backgroundColor: colors.start }]} />

        <View style={styles.featuredContent}>
          {/* Badges row */}
          <View style={styles.featuredBadges}>
            <LinearGradient
              colors={[colors.start, colors.end]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.focusBadge}
            >
              <MaterialCommunityIcons name="sparkles" size={11} color="#FFF" />
              <Text style={styles.focusLabel}>{plan.focus}</Text>
            </LinearGradient>

            <StatusBadge status={plan.status} />

            <Text style={[styles.featuredTag, { color: theme.textSecondary }]}>Featured</Text>

            {/* Options button (trainer-only actions) */}
            {onOptions && (
              <TouchableOpacity onPress={onOptions} hitSlop={10} style={{ marginLeft: 'auto' }}>
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Title */}
          <View style={styles.featuredTitleSection}>
            <Text style={[styles.featuredTitle, { color: theme.text }]} numberOfLines={2}>
              {plan.name}
            </Text>
            <Text style={[styles.featuredSubtitle, { color: theme.textMuted }]}>
              {plan.createdAt ? `Created ${plan.createdAt} · ` : ''}Week {plan.weeksCompleted} of {plan.totalWeeks}
            </Text>
          </View>

          {/* Metrics */}
          <View style={styles.metricsGrid}>
            <MetricCard icon="calendar-outline" label="Weeks"       value={plan.totalWeeks}           isDark={isDark} />
            <MetricCard icon="barbell-outline"  label="Days/wk"     value={plan.daysPerWeek}           isDark={isDark} />
            <MetricCard icon="time-outline"     label="Per session" value={`${plan.sessionMinutes}m`}  isDark={isDark} />
          </View>

          {/* Week dots */}
          <View style={styles.weekSection}>
            <Text style={[styles.weekLabel, { color: theme.textSecondary }]}>THIS WEEK</Text>
            <View style={styles.weekDots}>
              {plan.trainingDays.map((isTraining, i) => (
                <View
                  key={i}
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor: isTraining ? colors.start : 'transparent',
                      borderColor: isTraining ? colors.start : theme.border,
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

          {/* Action buttons */}
          <View style={styles.featuredActions}>
            <LinearGradient
              colors={[colors.start, colors.end]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryButtonGradient}
            >
              <TouchableOpacity style={styles.primaryButton} onPress={onContinue} activeOpacity={0.8}>
                <MaterialCommunityIcons name="play-circle" size={16} color="#FFF" />
                <Text style={styles.primaryButtonLabel}>Continue Today</Text>
                <Ionicons name="chevron-forward" size={14} color="#FFF" />
              </TouchableOpacity>
            </LinearGradient>

            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={onViewDetails}
              activeOpacity={0.6}
            >
              <Text style={[styles.secondaryButtonLabel, { color: theme.text }]}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress ring */}
        <View style={styles.progressRingSection}>
          <ProgressRing progress={progress} isDark={isDark} />
          <View style={[styles.weeksLeftCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.weeksLeftValue, { color: theme.text }]}>{weeksLeft}</Text>
            <Text style={[styles.weeksLeftLabel, { color: theme.textSecondary }]}>Weeks left</Text>
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
// PLAN CARD (non-featured)
// ============================================================================
const PlanCard = ({ plan, isDark, onPress, onOptions }) => {
  const theme  = THEME[isDark ? 'dark' : 'light'];
  const colors = FOCUS_COLORS[plan.focusColor] || FOCUS_COLORS.pink;

  return (
    <LinearGradient
      colors={[colors.start, colors.end]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.planCardBorder}
    >
      <TouchableOpacity
        style={[styles.planCard, { backgroundColor: theme.surface }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.planCardHeader}>
          <LinearGradient
            colors={[colors.start, colors.end]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.focusBadgeSmall}
          >
            <Text style={styles.focusLabelSmall}>{plan.focus}</Text>
          </LinearGradient>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatusBadge status={plan.status} />
            {onOptions && (
              <TouchableOpacity onPress={onOptions} hitSlop={10}>
                <Ionicons name="ellipsis-horizontal" size={16} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={[styles.planCardName, { color: theme.text }]} numberOfLines={1}>
          {plan.name}
        </Text>
        <Text style={[styles.planCardSubtitle, { color: theme.textMuted }]}>
          {plan.createdAt ? `${plan.createdAt} · ` : ''}Week {plan.weeksCompleted}/{plan.totalWeeks}
        </Text>

        <View style={styles.planCardMetrics}>
          {[`${plan.totalWeeks}w`, `${plan.daysPerWeek}d/wk`, `${plan.sessionMinutes}m`].map((pill) => (
            <View key={pill} style={[styles.planCardMetricPill, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.planCardMetricText, { color: theme.textMuted }]}>{pill}</Text>
            </View>
          ))}
        </View>

        <View style={styles.planCardActions}>
          <TouchableOpacity
            style={[styles.planCardButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={onPress}
            activeOpacity={0.6}
          >
            <Text style={[styles.planCardButtonLabel, { color: theme.textMuted }]}>View</Text>
          </TouchableOpacity>
          <LinearGradient
            colors={[colors.start, colors.end]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.planCardButtonGradient}
          >
            <TouchableOpacity style={styles.planCardButtonPrimary} onPress={onPress} activeOpacity={0.8}>
              <Text style={styles.planCardButtonPrimaryLabel}>Continue</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </LinearGradient>
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
          colors={['#FF6B9D', '#C084FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyFilterIcon}
        >
          <Ionicons name="layers-outline" size={26} color="#FFFFFF" />
        </LinearGradient>
        <Text style={[styles.emptyFilterTitle, { color: theme.text }]}>{message || 'Nothing here yet'}</Text>
        <Text style={[styles.emptyFilterSub, { color: theme.textMuted }]}>Try another filter or add a new plan.</Text>
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
                colors={['#FF6B9D', '#F97316']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
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
                colors={['#FF6B9D', '#C084FC']}
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
// MAIN SCREEN
// ============================================================================
export default function AIWorkoutPlansScreen({
  route,
  navigation,
  client: clientProp,
  onBack,
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

  const [filter, setFilter] = useState('all');
  const { plans: rawPlans, loading, error, reload } = useClientWorkoutPlans(clientId);

  const [templatesModal, setTemplatesModal] = useState(false);
  const [manualTemplates, setManualTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const loadManualTemplates = useCallback(async () => {
    if (!trainerId || !db) return;
    setTemplatesLoading(true);
    try {
      const rows = await listManualWorkoutPlansForTrainer(trainerId);
      setManualTemplates(rows || []);
    } catch (e) {
      Alert.alert('Could not load templates', e?.message || 'Unknown error');
    } finally {
      setTemplatesLoading(false);
    }
  }, [trainerId]);

  // Normalize all Firestore docs into UI-friendly shape
  const plans = useMemo(() => rawPlans.map(normalizePlan), [rawPlans]);

  // ── Featured: first active plan with progress, else first plan ──────────
  const featured = useMemo(
    () => plans.find((p) => p.status === 'active' && p.weeksCompleted > 0) ?? plans[0],
    [plans],
  );

  const others = useMemo(
    () => (featured ? plans.filter((p) => p.id !== featured.id) : plans),
    [featured, plans],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return others;
    return others.filter((p) => p.status === filter);
  }, [filter, others]);

  const counts = useMemo(() => ({
    all:       others.length,
    active:    others.filter((p) => p.status === 'active').length,
    completed: others.filter((p) => p.status === 'completed').length,
    paused:    others.filter((p) => p.status === 'paused').length,
  }), [others]);

  // ── Firestore write operations (unchanged logic) ─────────────────────────
  const handleToggleAssigned = useCallback(async (plan) => {
    if (!db || !clientId || !plan?.id) return;
    try {
      const raw = plan._raw;
      const nextAssigned = !raw.assigned;
      if (raw._singleDoc && raw._path) {
        await setDoc(doc(db, ...raw._path), { assigned: nextAssigned }, { merge: true });
      } else if (raw._source === 'usersSubcollection') {
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
            } else if (raw._source === 'usersSubcollection') {
              await deleteDoc(doc(db, 'users', clientId, 'workoutPlans', plan.id));
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
  const handleView = (plan) => onViewPlan ? onViewPlan(plan._raw) : navigation?.navigate('WorkoutDetail', { planId: plan.id });

  const hasPlans = plans.length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header isDark={isDark} onBack={handleBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={{ backgroundColor: theme.bg }}
      >
        {/* Page title */}
        <View style={styles.pageTitleSection}>
          <Text style={[styles.pageLabel, { color: theme.textSecondary }]}>LIBRARY</Text>
          <Text style={[styles.pageTitle,  { color: theme.text }]}>
            {clientName ? `${clientName}'s plans` : 'Your plans'}
          </Text>
        </View>

        {viewerRole === 'trainer' && trainerId && clientId ? (
          <View style={styles.trainerActionsRow}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => onBuildCustom?.({ id: clientId, name: clientName })}
              style={[styles.trainerChip, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <Ionicons name="construct-outline" size={16} color={theme.text} />
              <Text style={[styles.trainerChipLabel, { color: theme.text }]}>Custom builder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                setTemplatesModal(true);
                loadManualTemplates();
              }}
              style={[styles.trainerChip, { borderColor: theme.border, backgroundColor: theme.card }]}
            >
              <Ionicons name="folder-open-outline" size={16} color={theme.text} />
              <Text style={[styles.trainerChipLabel, { color: theme.text }]}>My templates</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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
                  <LinearGradient colors={['#FF6B9D', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.retryGrad}>
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
            {/* Featured */}
            {featured && (
              <View style={styles.featuredSection}>
                <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
                  CURRENTLY TRAINING
                </Text>
                <FeaturedPlanCard
                  plan={featured}
                  isDark={isDark}
                  onContinue={() => handleView(featured)}
                  onViewDetails={() => handleView(featured)}
                  onOptions={viewerRole === 'trainer' ? () => showPlanOptions(featured) : null}
                />
              </View>
            )}

            {/* Filter + grid */}
            {others.length > 0 && (
              <View style={styles.plansSection}>
                <FilterChips value={filter} onChange={setFilter} counts={counts} isDark={isDark} />

                {filtered.length === 0 ? (
                  <PlansLibraryEmptyHero
                    compact
                    isDark={isDark}
                    clientName={clientName}
                    clientId={clientId}
                    viewerRole={viewerRole}
                    message={`No ${filter} plans`}
                  />
                ) : (
                  <View style={styles.plansList}>
                    {filtered.map((plan) => (
                      <PlanCard
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
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={templatesModal} animationType="slide" transparent onRequestClose={() => setTemplatesModal(false)}>
        <View style={styles.templatesModalBackdrop}>
          <View style={[styles.templatesModalCard, { backgroundColor: theme.surface }]}>
            <View style={styles.templatesModalHeader}>
              <Text style={[styles.templatesModalTitle, { color: theme.text }]}>Custom plans</Text>
              <TouchableOpacity onPress={() => setTemplatesModal(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            {templatesLoading ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color="#FF6B9D" />
            ) : (
              <FlatList
                data={manualTemplates}
                keyExtractor={(item) => item.id}
                style={{ maxHeight: 420 }}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={{ color: theme.textMuted, paddingVertical: 16 }}>No saved custom plans yet.</Text>
                }
                renderItem={({ item }) => (
                  <View style={[styles.templateRow, { borderBottomColor: theme.border }]}>
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        onEditManualPlan?.(item.id);
                        setTemplatesModal(false);
                      }}
                    >
                      <Text style={[styles.templateTitle, { color: theme.text }]}>{item.planName || item.title}</Text>
                      <Text style={[styles.templateSub, { color: theme.textMuted }]}>
                        {(item.category || '').trim()}
                        {item.duration ? ` · ${item.duration}` : ''}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('Delete plan', 'Remove this template and unassign all linked clients?', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              const r = await deleteManualWorkoutPlan(trainerId, item.id);
                              if (!r.success) Alert.alert('Error', r.error || 'Could not delete');
                              else loadManualTemplates();
                            },
                          },
                        ]);
                      }}
                      hitSlop={10}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF6B9D" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Header
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    height: 56,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  logoText:  { fontSize: 14, fontWeight: '700', color: '#FFF' },
  logoLabel: { fontSize: 16, fontWeight: '700' },

  // Page title
  pageTitleSection: { paddingHorizontal: 16, marginTop: 20, marginBottom: 8 },
  trainerActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  trainerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
  },
  trainerChipLabel: { fontSize: 13, fontWeight: '700' },
  templatesModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  templatesModalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '78%',
  },
  templatesModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templatesModalTitle: { fontSize: 18, fontWeight: '800' },
  templateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  templateTitle: { fontSize: 16, fontWeight: '700' },
  templateSub: { fontSize: 12, marginTop: 2 },
  pageLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 4 },
  pageTitle: { fontSize: 28, fontWeight: '700' },

  // Sections
  featuredSection: { paddingHorizontal: 16, marginBottom: 32 },
  plansSection:    { paddingHorizontal: 16 },
  sectionLabel:    { fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },

  // Filter chips
  filterScroll:  { marginBottom: 20, marginHorizontal: -16 },
  filterContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  filterChip:    { borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, borderWidth: 1 },
  filterLabel:   { fontSize: 12, fontWeight: '600' },

  // Featured card
  featuredBorder:  { borderRadius: 16, padding: 2, marginBottom: 4 },
  featuredCard:    { padding: 20, borderRadius: 14, overflow: 'hidden' },
  featuredGlow:    { position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: 100, opacity: 0.12 },
  featuredContent: { gap: 16 },
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
  plansList: { gap: 12, marginTop: 4 },

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
