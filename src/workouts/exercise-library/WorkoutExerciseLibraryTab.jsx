/**
 * Workout Exercise Library Tab
 *
 * Purpose: Workout Exercise Library Tab — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/workouts
 * Key exports: WorkoutExerciseLibraryTab
 *
 * @file-header
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useYouTubeAPI, getExerciseLibraryJourneyHint } from './useYouTubeAPI';
import { YouTubeIframeExercisePlayer } from './VideoPlayerModal';
import ExerciseSection from '../components/ExerciseSection';
import ExerciseCard from './ExerciseCard';
import ShortsCard from './ShortsCard';

const { width: SCREEN_W } = Dimensions.get('window');
const GUTTER = 20;
const SAVED_KEY = '@coachconnect_exercise_library_saved';
/** Aurora rim — hot pink → dark orange (matches home hero + user prefs) */
const LIBRARY_RIM = ['#FF6B9D', '#C2410C'];
const SEARCH_FIELD_BORDER_GRADIENT = LIBRARY_RIM;
const SECTION_GRADIENT = {
  primary: ['#FF6B9D', '#C084FC'],
  goals: ['#C2410C', '#FF6B9D'],
  form: ['#06B6D4', '#C2410C'],
  shorts: ['#F97316', '#FF6B9D'],
  search: LIBRARY_RIM,
};
const FILTER_ACTIVE_GRADIENT = LIBRARY_RIM;
const TRANS_MS = 260;
const CARD_GAP = 12;

function twoColCardWidth() {
  const w = Dimensions.get('window')?.width || SCREEN_W || 390;
  const usable = Math.max(280, w - GUTTER * 2);
  return Math.floor((usable - CARD_GAP) / 2);
}

const COLORS_DARK = {
  background: '#0A0A0F',
  surface: '#1A1A24',
  card: '#1E1E28',
  border: '#3A3A45',
  text: '#FFFFFF',
  textMuted: '#A6A6A6',
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#64D2FF',
  orange: '#F97316',
};

const COLORS_LIGHT = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  card: '#FFFFFF',
  border: '#E5E5E5',
  text: '#0A0A0F',
  textMuted: '#666666',
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#64D2FF',
  orange: '#F97316',
};

const DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'];
const EQUIPMENT_LIST = ['Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine'];
const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Forearms',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
];

const MUSCLE_KEYWORDS = [
  { label: 'Chest', re: /\b(chest|pec|bench|push.?up|fly)\b/i },
  { label: 'Back', re: /\b(back|lat|row|pull.?up|deadlift)\b/i },
  { label: 'Shoulders', re: /\b(shoulder|delt|ohp|press overhead)\b/i },
  { label: 'Biceps', re: /\b(bicep|curl)\b/i },
  { label: 'Triceps', re: /\b(tricep|skull|extension arm)\b/i },
  { label: 'Forearms', re: /\b(forearm|grip|wrist)\b/i },
  { label: 'Quads', re: /\b(quad|squat|leg press|lunge)\b/i },
  { label: 'Hamstrings', re: /\b(hamstring|rdl|leg curl)\b/i },
  { label: 'Glutes', re: /\b(glute|hip thrust)\b/i },
  { label: 'Calves', re: /\b(calf|calves)\b/i },
  { label: 'Core', re: /\b(core|ab|plank|crunch)\b/i },
];

/** Lowercase blob from onboarding — drives which journey filter pills appear. */
function extractOnboardingCorpus(onboardingData) {
  if (!onboardingData || typeof onboardingData !== 'object') return '';
  const parts = [];
  const add = (v) => {
    if (v == null || v === '') return;
    if (Array.isArray(v)) {
      v.forEach((x) => add(x));
      return;
    }
    parts.push(String(v));
  };
  add(onboardingData.goal);
  add(onboardingData.primaryGoal);
  add(onboardingData.situationDescription);
  add(onboardingData.fitnessLevel);
  add(onboardingData.experience);
  add(onboardingData.frequency);
  add(onboardingData.daysPerWeek);
  add(onboardingData.workoutsPerWeek);
  add(onboardingData.trainingEnvironment);
  add(onboardingData.equipmentAccess);
  add(onboardingData.equipment);
  add(onboardingData.availableEquipment);
  add(onboardingData.limitations);
  add(onboardingData.personalInfo);
  add(onboardingData.exercisesDislike);
  add(onboardingData.injuries);
  add(onboardingData.goals);
  return parts.join(' ').replace(/_/g, ' ').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Goal / split keyword pills only when onboarding copy implies them.
 * `re` filters video rows when a pill is selected (unchanged behavior).
 */
function buildJourneyKeywordPillsFromCorpus(corpusRaw) {
  const c = String(corpusRaw || '').trim();
  if (!c) return [];

  const GOAL_META = [
    {
      id: 'body_recomp',
      label: 'Body Recomp',
      type: 'kw',
      includeIf: /\b(body\s*recomp|recomposition|recomp\b|maingain|lean\s*bulk|body\s*recomposition)\b/,
      re: /\b(body\s*)?recomp(ositions?)?\b|\bmaingain\b|\brecomp\b/i,
    },
    {
      id: 'skinny_fat',
      label: 'Skinny-Fat',
      type: 'kw',
      includeIf: /\b(skinny[\s-]?fat|thin[\s-]?fat|skinnyfat)\b/,
      re: /\bskinny[-\s]?fat\b|\bthin\s*fat\b/i,
    },
    {
      id: 'bulking',
      label: 'Bulking',
      type: 'kw',
      includeIf: /\b(bulk|bulking|mass\s*gain|caloric\s*surplus|surplus|weight\s*gain|gain\s*weight|size\b)\b/,
      re: /\bbulk(?:ing)?\b|\bmass\s*gain\b/i,
    },
    {
      id: 'cutting',
      label: 'Cutting',
      type: 'kw',
      includeIf: /\b(cut\b|cutting|shred|shredded|caloric\s*deficit|deficit\b|lean\s*out|get\s*lean)\b/,
      re: /\bcut(?:ting)?\b|\bshred\b/i,
    },
    {
      id: 'fat_loss',
      label: 'Fat Loss',
      type: 'kw',
      includeIf: /\b(fat\s*loss|lose\s*(weight|fat)|weight\s*loss|burn\s*fat|drop\s*(weight|lbs)|shed|slim)\b/,
      re: /\bfat\s*loss\b|\bweight\s*loss\b|\bcutting\b/i,
    },
    {
      id: 'muscle_gain',
      label: 'Muscle Gain',
      type: 'kw',
      includeIf: /\b(muscle\s*gain|build(ing)?\s*muscle|hypertrophy|get\s*bigger|more\s*musc|gain\s*musc|strength\s*&\s*size)\b/,
      re: /\bmuscle\b|\bhypertrophy\b|\bstrength\b/i,
    },
  ];

  const STYLE_META = [
    {
      id: 'full_body',
      label: 'Full Body',
      type: 'kw',
      includeIf: /\bfull\s*body\b/,
      re: /\bfull\s*body\b/i,
    },
    {
      id: 'upper_body',
      label: 'Upper Body',
      type: 'kw',
      includeIf: /\bupper\s*body\b/,
      re: /\bupper\s*body\b/i,
    },
    {
      id: 'lower_body',
      label: 'Lower Body',
      type: 'kw',
      includeIf: /\blower\s*body\b/,
      re: /\blower\s*body\b/i,
    },
    {
      id: 'ppl',
      label: 'Push Pull Legs',
      type: 'kw',
      includeIf: /\b(ppl|push[\s-]?pull[\s-]?legs)\b/,
      re: /\b(push\s*pull|ppl|legs\s*day)\b/i,
    },
    {
      id: 'hiit',
      label: 'HIIT',
      type: 'kw',
      includeIf: /\bhiit\b|\bhigh[\s-]?intensity\b|\binterval\s*training\b/,
      re: /\bhiit\b|\binterval\b/i,
    },
    {
      id: 'strength',
      label: 'Strength',
      type: 'kw',
      includeIf: /\bstrength\b|\bpowerlifting\b|\b5x5\b|\b1rm\b|\bmax\s*strength\b/,
      re: /\bstrength\b|\bpower\b/i,
    },
    {
      id: 'cardio',
      label: 'Cardio',
      type: 'kw',
      includeIf: /\bcardio\b|\bcycling\b|\brunning\b|\bconditioning\b|\bendurance\b|\bzone\s*2\b/,
      re: /\bcardio\b|\bconditioning\b/i,
    },
    {
      id: 'functional',
      label: 'Functional',
      type: 'kw',
      includeIf: /\bfunctional\b|\bathletic\b|\bcrossfit\b|\bmovement\b/,
      re: /\bfunctional\b/i,
    },
  ];

  const out = [];
  for (const row of GOAL_META) {
    if (!row.includeIf.test(c)) continue;
    if (row.id === 'muscle_gain' && out.some((p) => p.id === 'bulking')) continue;
    if (row.id === 'fat_loss' && out.some((p) => p.id === 'cutting')) continue;
    const { includeIf, ...pill } = row;
    out.push(pill);
  }
  for (const row of STYLE_META) {
    if (!row.includeIf.test(c)) continue;
    const { includeIf, ...pill } = row;
    out.push(pill);
  }
  return out;
}

function buildUtilityKeywordPills() {
  const add = (id, label, type, re) => ({ id, label, type, re });
  return [
    add('dur_5_15', '5-15 min', 'dur', null),
    add('dur_15_30', '15-30 min', 'dur', null),
    add('dur_30_plus', '30+ min', 'dur', null),
    add('lvl_beginner', 'Beginner', 'lvl', null),
    add('lvl_intermediate', 'Intermediate', 'lvl', null),
    add('lvl_advanced', 'Advanced', 'lvl', null),
  ];
}

const BADGE_COLORS = ['pink', 'purple', 'cyan', 'orange'];

function mapFitnessToDifficulty(level) {
  const s = String(level || '').toLowerCase();
  if (s.includes('begin')) return 'Beginner';
  if (s.includes('adv')) return 'Advanced';
  return 'Intermediate';
}

function inferMusclesFromText(title, forcedMuscle) {
  if (forcedMuscle) {
    return [{ label: forcedMuscle, color: BADGE_COLORS[0] }];
  }
  const t = String(title || '');
  const found = [];
  for (const m of MUSCLE_KEYWORDS) {
    if (m.re.test(t)) {
      found.push({ label: m.label, color: BADGE_COLORS[found.length % BADGE_COLORS.length] });
      if (found.length >= 3) break;
    }
  }
  if (found.length === 0) {
    return [{ label: 'Full body', color: 'purple' }];
  }
  return found;
}

function defaultFormTips() {
  return [
    'Brace your core before each rep.',
    'Move through a controlled range; avoid bouncing.',
    'Stop if you feel sharp pain or joint discomfort.',
  ];
}

function mapItemToExercise(item, idx, { defaultDifficulty, forcedMuscle }) {
  const difficulty = defaultDifficulty || 'Intermediate';
  const sets = difficulty === 'Advanced' ? 5 : difficulty === 'Beginner' ? 3 : 4;
  const reps = difficulty === 'Advanced' ? '4–6' : difficulty === 'Beginner' ? '10–15' : '8–12';
  const muscles = inferMusclesFromText(item.title, forcedMuscle);
  const desc =
    item.description?.trim()?.slice(0, 360) ||
    'Form and technique demonstration from search results.';
  const durationSeconds = typeof item?.durationSeconds === 'number' ? item.durationSeconds : undefined;
  const durationMinutes = durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : undefined;
  return {
    id: `yt_${item.videoId}_${idx}`,
    name: item.title.replace(/\s+/g, ' ').trim(),
    muscles,
    sets,
    reps,
    difficulty,
    durationSeconds,
    durationMinutes,
    videoId: item.videoId,
    channel: item.channel,
    description: desc,
    formTips: defaultFormTips(),
    variations: [],
  };
}

function exercisesToGridVideos(exercises) {
  return (exercises || []).map((e) => ({
    id: e.videoId,
    title: e.name,
    channel: e.channel,
    exercise: e.name,
    exerciseRef: e,
  }));
}

/**
 * Exercise Library panel for the Workout screen Library tab.
 * Uses YouTube Data API (env key) for thumbnails/metadata; no hardcoded video IDs.
 */
export default function WorkoutExerciseLibraryTab({ isDark, onThemeToggle, onboardingData }) {
  const COLORS = isDark ? COLORS_DARK : COLORS_LIGHT;
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeDifficulty, setActiveDifficulty] = useState(null);
  const [activeEquipment, setActiveEquipment] = useState(null);
  const [activeMuscle, setActiveMuscle] = useState(null);
  const [selectedKeywords, setSelectedKeywords] = useState(() => new Set());
  const [saved, setSaved] = useState(() => new Set());
  const [activeExercise, setActiveExercise] = useState(null);
  const [playerMode, setPlayerMode] = useState('embedded');
  const [thumbTier, setThumbTier] = useState({});

  useEffect(() => {
    if (activeExercise) setPlayerMode('embedded');
  }, [activeExercise?.id]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 320);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_KEY);
        if (!alive || !raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setSaved(new Set(arr));
      } catch (_) {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persistSaved = useCallback(async (nextSet) => {
    try {
      await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...nextSet]));
    } catch (_) {
      /* ignore */
    }
  }, []);

  const toggleSave = useCallback(
    (id) => {
      setSaved((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persistSaved(next);
        return next;
      });
    },
    [persistSaved],
  );

  const defaultDifficulty = useMemo(() => {
    const fromFilter = activeDifficulty;
    if (fromFilter) return fromFilter;
    return mapFitnessToDifficulty(onboardingData?.fitnessLevel);
  }, [activeDifficulty, onboardingData?.fitnessLevel]);

  const onboardingCorpusKey = useMemo(
    () => extractOnboardingCorpus(onboardingData),
    [
      onboardingData?.goal,
      onboardingData?.primaryGoal,
      onboardingData?.situationDescription,
      onboardingData?.fitnessLevel,
      onboardingData?.experience,
      onboardingData?.frequency,
      onboardingData?.daysPerWeek,
      onboardingData?.workoutsPerWeek,
      onboardingData?.trainingEnvironment,
      onboardingData?.equipmentAccess,
      onboardingData?.equipment,
      onboardingData?.availableEquipment,
      onboardingData?.limitations,
      onboardingData?.personalInfo,
      onboardingData?.exercisesDislike,
      onboardingData?.injuries,
      onboardingData?.goals,
    ],
  );

  // --- Keyword pills: journey/style from onboarding corpus; duration + level always ---
  const keywordPills = useMemo(() => {
    const journey = buildJourneyKeywordPillsFromCorpus(onboardingCorpusKey);
    return [...journey, ...buildUtilityKeywordPills()];
  }, [onboardingCorpusKey]);

  useEffect(() => {
    const valid = new Set(keywordPills.map((p) => p.id));
    setSelectedKeywords((prev) => {
      let changed = false;
      const next = new Set();
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id);
        else changed = true;
      });
      return changed ? next : prev;
    });
  }, [keywordPills]);

  // Pills should behave like typing the same keywords in the search bar.
  // When pills are selected and the user hasn't typed a query, we generate a query string.
  const pillsQuery = useMemo(() => {
    if (String(debouncedQuery || '').trim()) return '';
    if (!selectedKeywords || selectedKeywords.size === 0) return '';
    const selected = keywordPills.filter((p) => selectedKeywords.has(p.id));
    // Only keyword/style/goal pills contribute to search text; duration/level remain local filters.
    const parts = selected
      .filter((p) => p.type === 'kw')
      .map((p) => String(p.label || '').trim())
      .filter(Boolean);
    const unique = [...new Set(parts)];
    return unique.join(' ').trim();
  }, [debouncedQuery, keywordPills, selectedKeywords]);

  const effectiveQuery = useMemo(() => {
    const typed = String(debouncedQuery || '').trim();
    if (typed) return typed;
    return pillsQuery;
  }, [debouncedQuery, pillsQuery]);

  const showRecommended = !String(effectiveQuery || '').trim();

  const {
    items: recommendedItems,
    shorts: recommendedShorts,
    loading: recommendedLoading,
    error: recommendedError,
    debugInfo: recommendedDebugInfo,
  } = useYouTubeAPI({
    mode: 'recommended',
    onboardingData,
    enabled: showRecommended,
  });

  const {
    items: searchItems,
    shorts: searchShorts,
    loading: searchLoading,
    error: searchError,
    debugInfo: searchDebugInfo,
  } = useYouTubeAPI({
    mode: 'search',
    debouncedQuery: effectiveQuery,
    muscleGroup: activeMuscle,
    equipmentHint: activeEquipment,
    difficultyHint: activeDifficulty,
    onboardingData,
    enabled: !showRecommended,
  });

  const items = showRecommended ? recommendedItems : searchItems;
  const shortsItems = showRecommended ? recommendedShorts : searchShorts;
  const error = showRecommended ? recommendedError : searchError;

  const exercises = useMemo(() => {
    return (items || []).map((it, i) => mapItemToExercise(it, i, { defaultDifficulty, forcedMuscle: activeMuscle }));
  }, [items, defaultDifficulty, activeMuscle]);

  const shortExercises = useMemo(() => {
    return (shortsItems || []).map((it, i) =>
      mapItemToExercise(it, i, { defaultDifficulty: 'Shorts', forcedMuscle: activeMuscle }),
    );
  }, [shortsItems, activeMuscle, defaultDifficulty]);

  const toggleKeyword = useCallback((id) => {
    setSelectedKeywords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clearKeywords = useCallback(() => setSelectedKeywords(new Set()), []);

  const applyKeywordFilters = useCallback(
    (list) => {
      const sel = selectedKeywords;
      if (!sel || sel.size === 0) return list;

      const selected = keywordPills.filter((p) => sel.has(p.id));
      return (list || []).filter((ex) => {
        const t = `${ex?.name || ''} ${ex?.channel || ''}`.toLowerCase();
        for (const p of selected) {
          if (p.type === 'lvl') {
            // Soft: if difficulty is missing/unreliable, don't nuke results.
            const d = String(ex?.difficulty || '').toLowerCase();
            if (d && d !== p.label.toLowerCase()) return false;
          } else if (p.type === 'dur') {
            const m = typeof ex?.durationMinutes === 'number' ? ex.durationMinutes : null;
            // Soft: if duration missing, keep the result (YouTube doesn't always provide it).
            if (!m) continue;
            if (p.id === 'dur_5_15' && !(m >= 5 && m <= 15)) return false;
            if (p.id === 'dur_15_30' && !(m > 15 && m <= 30)) return false;
            if (p.id === 'dur_30_plus' && !(m > 30)) return false;
          } else if (p.re) {
            if (!p.re.test(t)) return false;
          }
        }
        return true;
      });
    },
    [keywordPills, selectedKeywords],
  );

  const filteredExercises = useMemo(() => applyKeywordFilters(exercises), [applyKeywordFilters, exercises]);
  const filteredShorts = useMemo(() => applyKeywordFilters(shortExercises), [applyKeywordFilters, shortExercises]);

  const recommendedCarouselExercises = useMemo(() => exercises.slice(0, 5), [exercises]);
  const goalsGridVideos = useMemo(() => exercisesToGridVideos(exercises.slice(5, 14)), [exercises]);
  const formGridVideos = useMemo(() => exercisesToGridVideos(exercises.slice(14, 23)), [exercises]);
  const searchGridVideos = useMemo(() => exercisesToGridVideos(exercises), [exercises]);

  const journeyHint = useMemo(() => getExerciseLibraryJourneyHint(onboardingData), [onboardingData]);

  const cardW = useMemo(() => twoColCardWidth(), []);
  const listKey = useMemo(() => `twoCol_${cardW}`, [cardW]);

  const recommendedForYou = useMemo(() => filteredExercises.slice(0, 8), [filteredExercises]);
  const basedOnGoals = useMemo(() => filteredExercises.slice(8, 16), [filteredExercises]);
  const formFundamentals = useMemo(() => {
    const want = (filteredExercises || []).filter((e) => /\b(form|technique|tutorial|cue|cues|how to)\b/i.test(String(e?.name || '')));
    const picked = want.slice(0, 8);
    if (picked.length >= 4) return picked;
    return filteredExercises.slice(16, 24);
  }, [filteredExercises]);

  return (
    <View style={[styles.root, { backgroundColor: COLORS.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={styles.flex}
        stickyHeaderIndices={[1]}
      >
        <View style={styles.headerBlock}>
          <Text style={[styles.kicker, { color: COLORS.textMuted }]}>CoachConnect</Text>
          <Text style={[styles.title, { color: COLORS.text }]}>Exercise Library</Text>
          <Text style={[styles.headerSub, { color: COLORS.textMuted }]}>
            Technique videos tailored to your goals
          </Text>
        </View>

        <View
          style={[
            styles.stickyHeader,
            { backgroundColor: COLORS.background },
          ]}
        >
          <View style={{ paddingHorizontal: GUTTER, paddingBottom: 10 }}>
            <LinearGradient
              colors={SEARCH_FIELD_BORDER_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.searchGrad}
            >
              <View style={[styles.searchInner, { backgroundColor: COLORS.card }]}>
                <Ionicons name="search" size={16} color={COLORS.textMuted} />
                <TextInput
                  style={[styles.searchInput, { color: COLORS.text }]}
                  placeholder="Search goals, exercises, muscles, equipment"
                  placeholderTextColor={COLORS.textMuted}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  spellCheck={false}
                  autoCapitalize="none"
                />
              </View>
            </LinearGradient>
          </View>

          <View style={styles.filtersPad}>
            <View style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.filterLabel, { color: COLORS.textMuted }]}>Filters</Text>
                {selectedKeywords.size ? (
                  <TouchableOpacity activeOpacity={0.85} onPress={clearKeywords}>
                    <Text style={{ color: COLORS.pink, fontWeight: '900' }}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={keywordPills}
                keyExtractor={(p) => p.id}
                contentContainerStyle={styles.filterList}
                renderItem={({ item }) => {
                  const isActive = selectedKeywords.has(item.id);
                  return (
                    <TouchableOpacity onPress={() => toggleKeyword(item.id)} activeOpacity={0.88}>
                      {isActive ? (
                        <LinearGradient
                          colors={FILTER_ACTIVE_GRADIENT}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.filterPillGrad}
                        >
                          <Text style={styles.filterPillTextActive}>{item.label}</Text>
                        </LinearGradient>
                      ) : (
                        <View
                          style={[
                            styles.filterPillIdle,
                            {
                              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                            },
                          ]}
                        >
                          <Text style={[styles.filterPillText, { color: COLORS.text }]}>{item.label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.banner}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.orange} />
            <Text style={[styles.bannerText, { color: COLORS.textMuted }]}>{String(error)}</Text>
          </View>
        ) : null}

        {showRecommended ? (
          <>
            {selectedKeywords.size ? (
              <>
            <ExerciseSection
                  title="Filtered Results"
                  subtitle={`Showing ${filteredExercises.length} long-form video${filteredExercises.length === 1 ? '' : 's'} for your selected filters`}
                  accentGradient={SECTION_GRADIENT.primary}
                  style={{ marginTop: 6 }}
              colors={COLORS}
              isDark={isDark}
                >
                  <FlatList
                    key={`${listKey}_filtered`}
                    data={filteredExercises}
                    keyExtractor={(it) => it.id}
                    numColumns={2}
                    scrollEnabled={false}
                    columnWrapperStyle={{
                      width: cardW * 2 + CARD_GAP,
                      alignSelf: 'center',
                      justifyContent: 'space-between',
                      marginBottom: CARD_GAP,
                    }}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
                    renderItem={({ item }) => (
                      <View style={{ width: cardW }}>
                        <ExerciseCard
                          exercise={item}
                          colors={COLORS}
                          accentGradient={SECTION_GRADIENT.primary}
                          accentPlacement="left"
                          saved={saved.has(item.id)}
                          onToggleSave={() => toggleSave(item.id)}
                          onPress={() => setActiveExercise(item)}
                        />
                      </View>
                    )}
                  />
                </ExerciseSection>

                {filteredShorts.length ? (
                  <ExerciseSection
                    title="YouTube Shorts"
                    subtitle={`Showing ${filteredShorts.length} short${filteredShorts.length === 1 ? '' : 's'} (kept separate)`}
                    accentGradient={SECTION_GRADIENT.shorts}
                    style={{ marginTop: 0 }}
                    colors={COLORS}
                    isDark={isDark}
                  >
                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      data={filteredShorts}
                      keyExtractor={(it) => `short_${it.id}`}
                      contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                      renderItem={({ item }) => (
                        <ShortsCard
                          item={item}
                          width={110}
                          accentGradient={SECTION_GRADIENT.shorts}
                          isDark={isDark}
                          saved={saved.has(item.id)}
                          onToggleSave={() => toggleSave(item.id)}
                          onPress={() => setActiveExercise(item)}
                        />
                      )}
                    />
                  </ExerciseSection>
                ) : null}
              </>
            ) : null}

            {selectedKeywords.size ? null : (
              <>
                <ExerciseSection
                  title="Recommended for you"
                  subtitle="Tailored to your onboarding goals and journey"
                  accentGradient={SECTION_GRADIENT.primary}
                  style={{ marginTop: 6 }}
                  colors={COLORS}
                  isDark={isDark}
                >
                  {recommendedLoading ? (
                    <View style={styles.sectionHeaderRow}>
                      <ActivityIndicator size="small" color={COLORS.pink} />
                    </View>
                  ) : null}

                  {!recommendedLoading && !recommendedError && exercises.length === 0 ? (
                    <LinearGradient colors={LIBRARY_RIM} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyRim}>
                      <View style={[styles.emptyState, { backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF', marginHorizontal: 0 }]}>
                        <Ionicons name="cloud-offline-outline" size={24} color={COLORS.pink} />
                        <Text style={[styles.emptyTitle, { color: COLORS.text }]}>No videos loaded</Text>
                        <Text style={[styles.emptyBody, { color: COLORS.textMuted }]}>
                          Sign in and ensure your YouTube API key is configured, then reload.
                        </Text>
                      </View>
                    </LinearGradient>
                  ) : null}

                  <FlatList
                    key={listKey}
                    data={recommendedForYou}
                    keyExtractor={(it) => it.id}
                    numColumns={2}
                    scrollEnabled={false}
                    columnWrapperStyle={{
                      width: cardW * 2 + CARD_GAP,
                      alignSelf: 'center',
                      justifyContent: 'space-between',
                      marginBottom: CARD_GAP,
                    }}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
                    renderItem={({ item }) => (
                      <View style={{ width: cardW }}>
                        <ExerciseCard
                          exercise={item}
                          colors={COLORS}
                          accentGradient={SECTION_GRADIENT.primary}
                          accentPlacement="left"
                          saved={saved.has(item.id)}
                          onToggleSave={() => toggleSave(item.id)}
                          onPress={() => setActiveExercise(item)}
                        />
                      </View>
                    )}
                  />
                </ExerciseSection>

                <ExerciseSection
                  title="YouTube Shorts"
                  subtitle="Quick demos — separated from long-form"
                          accentGradient={SECTION_GRADIENT.shorts}
                  style={{ marginTop: 0 }}
                  colors={COLORS}
                  isDark={isDark}
                >
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={filteredShorts}
                    keyExtractor={(it) => `short_${it.id}`}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                    renderItem={({ item }) => (
                      <ShortsCard
                        item={item}
                        width={110}
                        accentGradient={SECTION_GRADIENT.shorts}
                        isDark={isDark}
                        saved={saved.has(item.id)}
                        onToggleSave={() => toggleSave(item.id)}
                        onPress={() => setActiveExercise(item)}
                      />
                    )}
                  />
                </ExerciseSection>

                <ExerciseSection
                  title="Based on Your Goals"
                  subtitle={journeyHint || 'Pulled from your journey text and goals'}
                  accentGradient={SECTION_GRADIENT.goals}
                  colors={COLORS}
                  isDark={isDark}
                >
                  <FlatList
                    key={`${listKey}_goals`}
                    data={basedOnGoals}
                    keyExtractor={(it) => it.id}
                    numColumns={2}
                    scrollEnabled={false}
                    columnWrapperStyle={{
                      width: cardW * 2 + CARD_GAP,
                      alignSelf: 'center',
                      justifyContent: 'space-between',
                      marginBottom: CARD_GAP,
                    }}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
                    renderItem={({ item }) => (
                      <View style={{ width: cardW }}>
                        <ExerciseCard
                          exercise={item}
                          colors={COLORS}
                          accentGradient={SECTION_GRADIENT.goals}
                          accentPlacement="bottom"
                          saved={saved.has(item.id)}
                          onToggleSave={() => toggleSave(item.id)}
                          onPress={() => setActiveExercise(item)}
                        />
                      </View>
                    )}
                  />
                </ExerciseSection>

                <ExerciseSection
                  title="Form Fundamentals"
                  subtitle="Technique and cueing"
                  accentGradient={SECTION_GRADIENT.form}
                  colors={COLORS}
                  isDark={isDark}
                >
                  <FlatList
                    key={`${listKey}_form`}
                    data={formFundamentals}
                    keyExtractor={(it) => it.id}
                    numColumns={2}
                    scrollEnabled={false}
                    columnWrapperStyle={{
                      width: cardW * 2 + CARD_GAP,
                      alignSelf: 'center',
                      justifyContent: 'space-between',
                      marginBottom: CARD_GAP,
                    }}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
                    renderItem={({ item }) => (
                      <View style={{ width: cardW }}>
                        <ExerciseCard
                          exercise={item}
                          colors={COLORS}
                          accentGradient={SECTION_GRADIENT.form}
                          accentPlacement="left"
                          saved={saved.has(item.id)}
                          onToggleSave={() => toggleSave(item.id)}
                          onPress={() => setActiveExercise(item)}
                        />
                      </View>
                    )}
                  />
                </ExerciseSection>
              </>
            )}
          </>
        ) : (
          <ExerciseSection
            title={`${effectiveQuery || 'Search'} results`}
            subtitle={searchGridVideos.length ? `${searchGridVideos.length} video${searchGridVideos.length === 1 ? '' : 's'} found` : 'No results yet'}
            accentGradient={SECTION_GRADIENT.search}
            style={{ marginTop: 6 }}
            colors={COLORS}
            isDark={isDark}
          >
            {searchLoading ? (
              <View style={styles.sectionHeaderRow}>
                <ActivityIndicator size="small" color={COLORS.pink} />
              </View>
            ) : null}
            {!searchLoading && !searchGridVideos.length ? (
              <LinearGradient colors={LIBRARY_RIM} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.emptyRim}>
                <View style={[styles.emptyState, { backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF', marginHorizontal: 0 }]}>
                  <Ionicons name="search-outline" size={24} color={COLORS.pink} />
                  <Text style={[styles.emptyTitle, { color: COLORS.text }]}>No exercises found</Text>
                  <Text style={[styles.emptyBody, { color: COLORS.textMuted }]}>
                    Try a broader query or clear filters.
                  </Text>
                </View>
              </LinearGradient>
            ) : (
              <>
              <FlatList
                key={`${listKey}_search`}
                data={filteredExercises}
                keyExtractor={(it) => it.id}
                numColumns={2}
                scrollEnabled={false}
                columnWrapperStyle={{
                  width: cardW * 2 + CARD_GAP,
                  alignSelf: 'center',
                  justifyContent: 'space-between',
                  marginBottom: CARD_GAP,
                }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
                renderItem={({ item }) => (
                  <View style={{ width: cardW }}>
                    <ExerciseCard
                      exercise={item}
                      colors={COLORS}
                      accentGradient={SECTION_GRADIENT.primary}
                      accentPlacement="left"
                      saved={saved.has(item.id)}
                      onToggleSave={() => toggleSave(item.id)}
                      onPress={() => setActiveExercise(item)}
                    />
                  </View>
                )}
              />
              {filteredShorts.length ? (
                <ExerciseSection
                  title="YouTube Shorts"
                  subtitle="Quick demos — separated from long-form"
                          accentGradient={SECTION_GRADIENT.shorts}
                  colors={COLORS}
                  isDark={isDark}
                >
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={filteredShorts}
                    keyExtractor={(it) => `short_${it.id}`}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
                    renderItem={({ item }) => (
                      <ShortsCard
                        item={item}
                        width={110}
                        accentGradient={SECTION_GRADIENT.shorts}
                        isDark={isDark}
                        saved={saved.has(item.id)}
                        onToggleSave={() => toggleSave(item.id)}
                        onPress={() => setActiveExercise(item)}
                      />
                    )}
                  />
                </ExerciseSection>
              ) : null}
              </>
            )}
          </ExerciseSection>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {activeExercise ? (
        <ExerciseDetailModal
          exercise={activeExercise}
          onClose={() => {
            setPlayerMode('embedded');
            setActiveExercise(null);
          }}
          colors={COLORS}
          playerMode={playerMode}
          onPlayerModeChange={setPlayerMode}
        />
      ) : null}
    </View>
  );
}

function FilterRow({ label, items, active, onSelect, variant, colors }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.filterLabel, { color: colors.textMuted }]}>{label}</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => {
          const isActive = active === item;
          if (variant === 'primary') {
            return (
              <TouchableOpacity onPress={() => onSelect(isActive ? null : item)} activeOpacity={0.88}>
                {isActive ? (
                  <LinearGradient
                    colors={[colors.purple, colors.pink, colors.orange]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.filterPillGrad}
                  >
                    <Text style={styles.filterPillTextActive}>{item}</Text>
                  </LinearGradient>
                ) : (
                  <View style={[styles.filterPillIdle, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.filterPillText, { color: colors.text }]}>{item}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }
          return (
            <TouchableOpacity
              onPress={() => onSelect(isActive ? null : item)}
              activeOpacity={0.88}
              style={[
                styles.filterPillSecondary,
                {
                  borderColor: isActive ? colors.cyan : colors.border,
                  backgroundColor: isActive ? `${colors.cyan}22` : 'transparent',
                },
              ]}
            >
              <Text style={[styles.filterPillTextSm, { color: isActive ? colors.cyan : colors.textMuted }]}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function VideoTile({ video, onOpen, colors, thumbTier, onThumbError }) {
  const scale = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const animateTo = (down) => {
    setPressed(down);
    Animated.timing(scale, {
      toValue: down ? 1.04 : 1,
      duration: TRANS_MS,
      useNativeDriver: true,
    }).start();
  };

  const uri =
    thumbTier === 'default'
      ? `https://i.ytimg.com/vi/${video.id}/default.jpg`
      : `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;

  return (
    <Pressable
      onPress={onOpen}
      onPressIn={() => animateTo(true)}
      onPressOut={() => animateTo(false)}
      style={[styles.tilePress, { width: '100%' }]}
    >
      <View
        style={[
          styles.tileAnim,
          {
            shadowColor: colors.purple,
            shadowOpacity: pressed ? 0.38 : 0.14,
            shadowRadius: pressed ? 14 : 5,
            shadowOffset: { width: 0, height: 4 },
            elevation: Platform.OS === 'android' ? (pressed ? 12 : 5) : 0,
          },
        ]}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <LinearGradient
            colors={[colors.purple, colors.orange, colors.cyan]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tileGrad}
          >
            <View style={[styles.tileInner, { backgroundColor: colors.surface }]}>
            <Image
              source={{ uri }}
              style={styles.tileImg}
              contentFit="cover"
              transition={TRANS_MS}
              cachePolicy="memory-disk"
              onError={onThumbError}
            />
            <LinearGradient colors={['transparent', `${colors.text}B3`]} style={StyleSheet.absoluteFill} />
            {pressed ? (
              <LinearGradient
                colors={[`${colors.pink}55`, 'transparent', `${colors.cyan}40`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <View style={styles.playCenter} pointerEvents="none">
              <View style={[styles.playCircle, pressed && { transform: [{ scale: 1.08 }] }]}>
                <Ionicons name="play" size={14} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.tileLabels}>
              <Text style={styles.tileTitle} numberOfLines={1}>
                {video.exercise}
              </Text>
              <Text style={styles.tileSub} numberOfLines={1}>
                {video.channel}
              </Text>
            </View>
          </View>
        </LinearGradient>
        </Animated.View>
      </View>
    </Pressable>
  );
}

function DetailSection({ colors, isDark, icon, title, children }) {
  const innerBg = isDark ? '#0A0A0F' : '#FFFFFF';
  return (
    <LinearGradient colors={LIBRARY_RIM} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mdlSectionRim}>
      <View style={[styles.mdlSection, { backgroundColor: innerBg }]}>
        <LinearGradient
          colors={isDark ? ['rgba(255,107,157,0.10)', 'rgba(194,65,12,0.05)', 'transparent'] : ['rgba(255,107,157,0.06)', 'rgba(194,65,12,0.04)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          style={[StyleSheet.absoluteFillObject, { borderRadius: 13 }]}
        />
        <View style={styles.mdlSectionHeader}>
          <LinearGradient colors={LIBRARY_RIM} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mdlSectionIconGrad}>
            <Ionicons name={icon} size={14} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.mdlSectionTitle, { color: colors.textMuted }]}>{title}</Text>
        </View>
        {children}
      </View>
    </LinearGradient>
  );
}

function ExerciseDetailModal({ exercise, onClose, colors, playerMode, onPlayerModeChange }) {
  const embedW = Math.floor(SCREEN_W - 36);
  const embedH = Math.max(230, Math.round((embedW * 9) / 16));
  const fsPlayerH = Math.max(
    260,
    Dimensions.get('window').height - (Platform.OS === 'ios' ? 112 : 96),
  );
  const isDark = colors.background === COLORS_DARK.background;
  const innerBg = isDark ? '#0A0A0F' : '#FFFFFF';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        {playerMode === 'fullscreen' ? (
          <View style={[styles.fsLayer, { backgroundColor: colors.background }]}>
            <View style={styles.fsHeader}>
              <TouchableOpacity onPress={() => onPlayerModeChange('embedded')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="chevron-down" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.fsTitle, { color: colors.text }]} numberOfLines={1}>
                {exercise.name}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.fsWeb, { backgroundColor: '#000', justifyContent: 'center' }]}>
              <YouTubeIframeExercisePlayer
                videoId={exercise.videoId}
                width={Dimensions.get('window').width}
                height={fsPlayerH}
                play
              />
            </View>
          </View>
        ) : (
          <View style={[styles.mdlSheet, { backgroundColor: colors.background }]}>
            <LinearGradient
              colors={[`${colors.pink}18`, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.8 }}
              style={styles.mdlHeroGrad}
            >
              <View style={styles.mdlTopRow}>
                <TouchableOpacity onPress={onClose} style={[styles.mdlBackBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]} hitSlop={10}>
                  <Ionicons name="arrow-back" size={20} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.modeRow}>
                  <TouchableOpacity onPress={() => onPlayerModeChange('embedded')} activeOpacity={0.88}>
                    {playerMode === 'embedded' ? (
                      <LinearGradient colors={LIBRARY_RIM} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modeChipActive}>
                        <Ionicons name="play-circle-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.modeChipTextActive}>Inline</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.modeChip, { borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }]}>
                        <Ionicons name="play-circle-outline" size={14} color={colors.textMuted} />
                        <Text style={[styles.modeChipText, { color: colors.textMuted }]}>Inline</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onPlayerModeChange('fullscreen')} activeOpacity={0.88}>
                    {playerMode === 'fullscreen' ? (
                      <LinearGradient colors={['#06B6D4', '#C2410C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.modeChipActive}>
                        <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                        <Text style={styles.modeChipTextActive}>Theater</Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.modeChip, { borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }]}>
                        <Ionicons name="expand-outline" size={14} color={colors.textMuted} />
                        <Text style={[styles.modeChipText, { color: colors.textMuted }]}>Theater</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.mdlKicker, { color: colors.textMuted }]}>
                {exercise.channel || 'Exercise Library'}
              </Text>
              <Text style={[styles.mdlTitle, { color: colors.text }]} numberOfLines={2}>
                {exercise.name}
              </Text>

              <View style={[styles.mdlMusclePills, { marginTop: 10 }]}>
                {exercise.muscles.map((m) => (
                  <View
                    key={m.label}
                    style={[styles.mdlPill, { backgroundColor: `${colors[m.color]}20`, borderColor: `${colors[m.color]}55` }]}
                  >
                    <View style={[styles.mdlPillDot, { backgroundColor: colors[m.color] }]} />
                    <Text style={[styles.mdlPillText, { color: colors[m.color] }]}>{m.label}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mdlScroll}>
              <LinearGradient colors={LIBRARY_RIM} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mdlPlayerRim}>
                <View style={[styles.mdlPlayerWrap, { backgroundColor: '#000' }]}>
                  <YouTubeIframeExercisePlayer
                    videoId={exercise.videoId}
                    width={embedW}
                    height={embedH}
                    play
                  />
                </View>
              </LinearGradient>

              {!!exercise.description && (
                <DetailSection colors={colors} isDark={isDark} icon="document-text-outline" title="ABOUT">
                  <Text style={[styles.mdlBody, { color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.72)' }]}>
                    {exercise.description}
                  </Text>
                </DetailSection>
              )}

              {exercise.formTips?.length > 0 && (
                <DetailSection colors={colors} isDark={isDark} icon="checkmark-circle-outline" title="FORM TIPS">
                  {exercise.formTips.map((tip, idx) => (
                    <View key={idx} style={styles.mdlTipRow}>
                      <Text style={[styles.mdlTipIdx, { color: colors.pink }]}>{String(idx + 1).padStart(2, '0')}</Text>
                      <Text style={[styles.mdlTipText, { color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.72)' }]}>{tip}</Text>
                    </View>
                  ))}
                </DetailSection>
              )}

              {exercise.variations?.length > 0 && (
                <DetailSection colors={colors} isDark={isDark} icon="shuffle-outline" title="VARIATIONS">
                  {exercise.variations.map((v, idx) => (
                    <View key={idx} style={styles.mdlTipRow}>
                      <Ionicons name="arrow-forward" size={12} color={colors.orange} style={{ marginTop: 3 }} />
                      <Text style={[styles.mdlTipText, { color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.72)' }]}>{v}</Text>
                    </View>
                  ))}
                </DetailSection>
              )}

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const CARD_W = Math.min(280, SCREEN_W * 0.72);

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  stickyHeader: {
    paddingTop: 2,
    zIndex: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  carouselCard: { width: '100%', maxWidth: 200, alignSelf: 'flex-start' },
  headerBlock: { paddingHorizontal: GUTTER, paddingTop: 16, paddingBottom: 12 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '900', marginTop: 6, letterSpacing: -0.6 },
  headerSub: { fontSize: 13, fontWeight: '600', marginTop: 8, lineHeight: 18 },
  themeBtn: { height: 44, width: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  searchGrad: {
    borderRadius: 22,
    padding: 1.5,
    ...Platform.select({
      ios: { shadowColor: '#FF6B9D', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
    }),
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 20.5,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  filtersPad: { paddingHorizontal: GUTTER, paddingBottom: 6 },
  filterLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  filterList: { gap: 8, paddingRight: 12, paddingBottom: 2 },
  filterPillGrad: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  filterPillIdle: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 13, fontWeight: '600' },
  filterPillTextActive: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  filterPillSecondary: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  filterPillTextSm: { fontSize: 11, fontWeight: '600' },
  banner: {
    marginHorizontal: GUTTER,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  bannerText: { flex: 1, fontSize: 12, lineHeight: 18 },
  emptyState: {
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 18,
    borderRadius: 16.5,
    gap: 8,
    alignItems: 'center',
  },
  emptyRim: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 18,
    padding: 1.5,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyBody: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionSub: { fontSize: 11, marginTop: 4 },
  cardOuter: { width: CARD_W },
  cardGrad: { borderRadius: 24, padding: 1.5 },
  cardBlur: { borderRadius: 22, overflow: 'hidden', padding: 14, gap: 12 },
  thumbWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  channelBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  channelBadgeText: { fontSize: 10, fontWeight: '600', color: '#FFFFFF' },
  cardTitle: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 2 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 11 },
  gridCount: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  tilePress: { marginBottom: 10 },
  tileAnim: { borderRadius: 12 },
  tileGrad: { borderRadius: 12, padding: 1, flex: 1 },
  tileInner: { position: 'relative', borderRadius: 11, overflow: 'hidden', aspectRatio: 16 / 9 },
  tileImg: { ...StyleSheet.absoluteFillObject },
  playCenter: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  playCircle: {
    height: 36,
    width: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileLabels: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 6 },
  tileTitle: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
  tileSub: { fontSize: 8, color: 'rgba(255,255,255,0.72)' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', position: 'relative' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  fsLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    flexDirection: 'column',
    paddingTop: Platform.OS === 'ios' ? 44 : 28,
  },
  fsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 10 : 8,
    paddingBottom: 8,
    gap: 8,
  },
  fsTitle: { flex: 1, fontSize: 15, fontWeight: '700' },
  fsWeb: { flex: 1, backgroundColor: '#000' },

  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  modeChipActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modeChipText: { fontSize: 11, fontWeight: '700' },
  modeChipTextActive: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  mdlSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  mdlHeroGrad: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
  },
  mdlTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  mdlBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mdlKicker: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  mdlTitle: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  mdlMusclePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  mdlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  mdlPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  mdlPillText: { fontSize: 11, fontWeight: '600' },

  mdlScroll: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 20,
  },
  mdlPlayerRim: {
    borderRadius: 18,
    padding: 1.5,
    marginBottom: 16,
  },
  mdlPlayerWrap: {
    borderRadius: 16.5,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  mdlSectionRim: {
    borderRadius: 16,
    padding: 1.5,
    marginBottom: 12,
  },
  mdlSection: {
    borderRadius: 14.5,
    padding: 14,
    gap: 10,
    overflow: 'hidden',
  },
  mdlSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  mdlSectionIconGrad: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mdlSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  mdlBody: { fontSize: 14, lineHeight: 22, fontWeight: '500' },
  mdlTipRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  mdlTipIdx: {
    fontSize: 13,
    fontWeight: '800',
    minWidth: 22,
  },
  mdlTipText: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '500' },
});
