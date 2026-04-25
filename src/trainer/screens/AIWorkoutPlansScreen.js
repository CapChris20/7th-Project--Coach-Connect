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

// ============================================================================
// FIRESTORE HOOK (unchanged from original)
// ============================================================================
function useClientWorkoutPlans(clientId) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!clientId || !db) return;
    setLoading(true);
    setError(null);
    try {
      const results = [];

      // Primary: users/{clientId}/workoutPlans (collection)
      const colRef = collection(db, 'users', clientId, 'workoutPlans');
      try {
        const snap = await getDocs(query(colRef, orderBy('generatedAt', 'desc')));
        snap.forEach((d) => results.push({ id: d.id, ...d.data(), _source: 'usersSubcollection' }));
      } catch (e) {
        // ignore if collection missing
      }

      // Fallback: users/{clientId}/workoutPlan single doc
      if (!results.length) {
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
      }

      // Fallback: global workoutPlans with clientId
      if (!results.length) {
        const globalRef = collection(db, 'workoutPlans');
        const snap = await getDocs(
          query(globalRef, where('clientId', '==', clientId), orderBy('generatedAt', 'desc')),
        );
        snap.forEach((d) => results.push({ id: d.id, ...d.data(), _source: 'global' }));
      }

      setPlans(results);
    } catch (e) {
      setError(e?.message || 'Failed to load workout plans');
      setPlans([]);
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

  // Pick a gradient colour key
  const goalKey = Object.keys(GOAL_COLOR_MAP).find((k) =>
    (item.goal || item.focus || item.type || '').toLowerCase().includes(k),
  );
  const focusColor = item.focusColor || GOAL_COLOR_MAP[goalKey] || 'pink';

  const totalWeeks     = item.totalWeeks     || item.weeks         || item.durationWeeks || 8;
  const weeksCompleted = item.weeksCompleted || item.currentWeek   || 0;
  const daysPerWeek    = item.daysPerWeek    || item.daysPerWeek   || 3;
  const sessionMinutes = item.sessionMinutes || item.sessionLength || 45;

  // Build a 7-day boolean array from stored field or infer from daysPerWeek
  const trainingDays =
    Array.isArray(item.trainingDays) && item.trainingDays.length === 7
      ? item.trainingDays
      : Array.from({ length: 7 }, (_, i) => i < daysPerWeek);

  return {
    // UI fields
    id:              item.id,
    name:            item.title || item.name || 'Workout Plan',
    status,
    focusColor,
    focus:           item.focus || item.goal || item.type || 'Training',
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
// EMPTY STATE
// ============================================================================
const EmptyState = ({ isDark, message }) => {
  const theme = THEME[isDark ? 'dark' : 'light'];
  return (
    <View style={[styles.emptyState, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <LinearGradient
        colors={['#FF6B9D', '#C084FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.emptyStateIcon}
      >
        <MaterialCommunityIcons name="sparkles" size={28} color="#FFF" />
      </LinearGradient>
      <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No plans yet</Text>
      <Text style={[styles.emptyStateText, { color: theme.textMuted }]}>
        {message || 'Generate a workout plan from the AI generator.'}
      </Text>
    </View>
  );
};

// ============================================================================
// MAIN SCREEN
// ============================================================================
export default function AIWorkoutPlansScreen({
  route,
  navigation,
  client: clientProp,
  onBack,
  onViewPlan,
  viewerRole = 'trainer',
}) {
  const { isDark } = useTheme();
  const theme = THEME[isDark ? 'dark' : 'light'];

  const clientId   = clientProp?.id   || route?.params?.clientId;
  const clientName = clientProp?.name || route?.params?.clientName || 'Client';

  const [filter, setFilter] = useState('all');
  const { plans: rawPlans, loading, error, reload } = useClientWorkoutPlans(clientId);

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

        {/* Loading */}
        {loading && (
          <View style={styles.centeredFeedback}>
            <ActivityIndicator size="large" color="#FF6B9D" />
            <Text style={[styles.feedbackText, { color: theme.textMuted }]}>Loading plans…</Text>
          </View>
        )}

        {/* Error */}
        {error && !loading && (
          <View style={styles.centeredFeedback}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={reload} style={styles.retryButton}>
              <Text style={styles.retryButtonLabel}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty */}
        {!loading && !error && !hasPlans && (
          <View style={{ paddingHorizontal: 16 }}>
            <EmptyState isDark={isDark} />
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
                  <EmptyState isDark={isDark} message={`No ${filter} plans.`} />
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
  pageTitleSection: { paddingHorizontal: 16, marginTop: 20, marginBottom: 24 },
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
  emptyState:        { borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', paddingVertical: 40, paddingHorizontal: 24, alignItems: 'center', gap: 12 },
  emptyStateIcon:    { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  emptyStateTitle:   { fontSize: 20, fontWeight: '700' },
  emptyStateText:    { fontSize: 13, textAlign: 'center' },

  // Feedback
  centeredFeedback:  { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  feedbackText:      { marginTop: 10, fontSize: 14 },
  errorText:         { color: '#F97373', textAlign: 'center', marginBottom: 8 },
  retryButton:       { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FF6B9D' },
  retryButtonLabel:  { color: '#FFFFFF', fontWeight: '600' },
});
