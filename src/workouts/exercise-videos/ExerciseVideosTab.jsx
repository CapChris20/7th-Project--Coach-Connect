// Workout Videos tab — Design Law library (search, journey carousel, filter pills, avoid sheet).
// Flow: debounce search → YouTube fetch → SPLIT/MUSCLE/EQUIPMENT filters → detail player / avoid NbSheet.
// Used by: CreateWorkoutPlanScreen Library tab; MyWorkoutPlanScreen Videos tab when wired.
// Persistence: `@coachconnect_exercise_library_saved`, Firestore `likedExercises`, `exercisesDislike`.

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../app-start/cloudConnection';
import { findExerciseVideos } from './findExerciseVideos';
import { YouTubeIframeExercisePlayer } from './VideoPlayer';
import ExerciseCard from './ExerciseCard';
import ShortVideoCard from './ShortVideoCard';
import DislikedExercisesPicker from './DislikedExercisesPicker';
import { useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';
import NbSheet from '../../look-and-feel/NbSheet';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

const {
  width: SCREEN_W
} = Dimensions.get('window');
const GUTTER = nb.screenGutter;
const SAVED_KEY = '@coachconnect_exercise_library_saved';

// Manipulate here: bottom padding under the library list (above shell nav)
const SHELL_NAV_INSET_EXTRA = 24;
// Manipulate here: how long to wait after typing before searching YouTube
const SEARCH_DEBOUNCE_MS = 320;
const SECONDS_PER_MINUTE = 60;
const MAX_DESCRIPTION_CHARS = 360;
const MAX_MUSCLE_BADGES = 3;
const MAX_LIKED_EXERCISES_STORED = 80;
const JOURNEY_CAROUSEL_COUNT = 5;
const CARD_GAP = 12;
const FALLBACK_SCREEN_WIDTH = 390;
const MIN_USABLE_GRID_WIDTH = 280;
const JOURNEY_CARD_WIDTH = 132;
const SPLIT_OPTIONS = ['Push Pull Legs', 'Upper Body', 'Lower Body', 'Full Body'];
const EQUIPMENT_LIST = ['Barbell', 'Dumbbell', 'Bodyweight', 'Cable', 'Machine'];
const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core'];
const MUSCLE_KEYWORDS = [{
  label: 'Chest',
  titlePattern: /\b(chest|pec|bench|push.?up|fly)\b/i
}, {
  label: 'Back',
  titlePattern: /\b(back|lat|row|pull.?up|deadlift)\b/i
}, {
  label: 'Shoulders',
  titlePattern: /\b(shoulder|delt|ohp|press overhead)\b/i
}, {
  label: 'Biceps',
  titlePattern: /\b(bicep|curl)\b/i
}, {
  label: 'Triceps',
  titlePattern: /\b(tricep|skull|extension arm)\b/i
}, {
  label: 'Forearms',
  titlePattern: /\b(forearm|grip|wrist)\b/i
}, {
  label: 'Quads',
  titlePattern: /\b(quad|squat|leg press|lunge)\b/i
}, {
  label: 'Hamstrings',
  titlePattern: /\b(hamstring|rdl|leg curl)\b/i
}, {
  label: 'Glutes',
  titlePattern: /\b(glute|hip thrust)\b/i
}, {
  label: 'Calves',
  titlePattern: /\b(calf|calves)\b/i
}, {
  label: 'Core',
  titlePattern: /\b(core|ab|plank|crunch)\b/i
}];
const NOTICE_TITLE = 'Stop if you feel sharp pain or joint discomfort.';
const NOTICE_BODY = 'Form and technique demonstrations from search results. Thumbnails here are samples.';
const BANNED_ICON = require('../../assets/icons/handoff/banned.png');
// Manipulate here: YouTube player letterbox behind the iframe (not a theme token)
const PLAYER_LETTERBOX_BLACK = '#000';

// ===== HELPER FUNCTIONS =====

/**
 * Fill filter chip — selected = nbFill / onFill + HardShadow (PNG / mockup).
 * Idle chips stay flat surface + 3px border (no shadow, no green / purple).
 * @param {{ label: string, selected: boolean, onPress: () => void }} props
 */
function FilterChip({
  label,
  selected,
  onPress
}) {
  const {
    colors
  } = useTheme();
  const chip = <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{
    selected
  }} style={[styles.filterChip, {
    backgroundColor: selected ? colors.nbFill : colors.nbSurfaceChip || colors.nbSurface,
    borderColor: colors.nbBorder,
    minHeight: nb.minTouchTarget
  }]}>
      <Text style={[styles.filterChipText, {
      color: selected ? colors.nbOnFill : colors.nbInk
    }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>;

  // vocab: HardShadow only when selected — matches mockup `.chip[aria-pressed=true]`
  if (!selected) return <View style={styles.chipShadow}>{chip}</View>;
  return <HardShadow radius={999} offset={nb.shadowOffsetSmall} style={styles.chipShadow}>
      {chip}
    </HardShadow>;
}
function FilterGroup({
  label,
  children
}) {
  const {
    colors
  } = useTheme();
  return <View style={styles.filterGroup}>
      <Text style={[styles.filterGroupLabel, {
      color: colors.nbMuted
    }]}>{label}</Text>
      <View style={styles.filterChipRow}>{children}</View>
    </View>;
}

// ===== MAIN FUNCTION =====

/**
 * Exercise library panel for the Workout Videos tab.
 * Flow: debounced search → YouTube rows → filter chips → grid / journey carousel → detail player.
 * @param {object} props
 * @param {object} [props.onboardingData] drives recommendations + initial avoid list
 * @param {(next: string) => void} [props.onExercisesDislikeChange] optional parent sync for exercisesDislike
 */
export default function ExerciseVideosTab({
  isDark: _legacyIsDark,
  onThemeToggle: _legacyThemeToggle,
  onboardingData,
  onExercisesDislikeChange
}) {
  void _legacyIsDark;
  void _legacyThemeToggle;
  const {
    colors
  } = useTheme();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET_EXTRA);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeSplit, setActiveSplit] = useState(null);
  const [activeEquipment, setActiveEquipment] = useState(null);
  const [activeMuscle, setActiveMuscle] = useState(null);
  const [saved, setSaved] = useState(() => new Set());
  const [activeExercise, setActiveExercise] = useState(null);
  const [playerMode, setPlayerMode] = useState('embedded');
  const [avoidOpen, setAvoidOpen] = useState(false);
  const [avoidDraft, setAvoidDraft] = useState(() => String((onboardingData == null ? void 0 : onboardingData.exercisesDislike) || ''));
  // Local mirror so the sheet still works when the parent does not pass onboardingData
  const [persistedDislikes, setPersistedDislikes] = useState(() => String((onboardingData == null ? void 0 : onboardingData.exercisesDislike) || ''));
  const [avoidSaving, setAvoidSaving] = useState(false);
  useEffect(() => {
    if (activeExercise) setPlayerMode('embedded');
  }, [activeExercise == null ? void 0 : activeExercise.id]);
  useEffect(() => {
    const fromProps = String((onboardingData == null ? void 0 : onboardingData.exercisesDislike) || '');
    if (fromProps) {
      setAvoidDraft(fromProps);
      setPersistedDislikes(fromProps);
      return undefined;
    }
    // Load profile avoid list when opened from MyWorkoutPlanScreen without onboarding props
    let alive = true;
    (async _optObj => {
      const uid = (_optObj = auth == null ? void 0 : auth.currentUser) == null ? void 0 : _optObj.uid;
      if (!uid || !db) return;
      try {
        var _optObj2;
        const snap = await getDoc(doc(db, 'users', uid));
        if (!alive) return;
        const stored = String(((_optObj2 = snap.data()) == null ? void 0 : _optObj2.exercisesDislike) || '');
        setPersistedDislikes(stored);
        setAvoidDraft(stored);
      } catch (_) {
        /* offline / missing doc */
      }
    })();
    return () => {
      alive = false;
    };
  }, [onboardingData == null ? void 0 : onboardingData.exercisesDislike]);
  useEffect(() => {
    // Manipulate here: SEARCH_DEBOUNCE_MS — lower = faster search, higher = fewer YouTube calls
    const debounceTimer = setTimeout(() => setDebouncedQuery(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceTimer);
  }, [query]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_KEY);
        if (!alive || !raw) return;
        const savedIdList = JSON.parse(raw);
        if (Array.isArray(savedIdList)) setSaved(new Set(savedIdList));
      } catch (_) {
        /* ignore corrupt cache */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const persistSaved = useCallback(async nextSet => {
    try {
      await AsyncStorage.setItem(SAVED_KEY, JSON.stringify([...nextSet]));
    } catch (_) {
      /* ignore */
    }
  }, []);
  const persistLikedExercisesToFirestore = useCallback(async (exercise, isLiked) => {
    var _optObj3;
    const uid = (_optObj3 = auth == null ? void 0 : auth.currentUser) == null ? void 0 : _optObj3.uid;
    if (!uid || !db || !exercise) return;
    try {
      var _optObj4;
      const refUser = doc(db, 'users', uid);
      const snap = await getDoc(refUser);
      const previousLikes = Array.isArray((_optObj4 = snap.data()) == null ? void 0 : _optObj4.likedExercises) ? [...snap.data().likedExercises] : [];
      const exerciseName = String(exercise.title || exercise.name || '').trim();
      const exerciseId = String(exercise.id || exerciseName).trim();
      let nextLikedExercises;
      if (isLiked) {
        const likeEntry = {
          id: exerciseId,
          name: exerciseName,
          likedAt: new Date().toISOString()
        };
        const withoutDuplicate = previousLikes.filter(likedRow => {
          const sameId = String((likedRow == null ? void 0 : likedRow.id) || (likedRow == null ? void 0 : likedRow.name)) === exerciseId;
          const sameName = String(likedRow == null ? void 0 : likedRow.name) === exerciseName;
          return !sameId && !sameName;
        });
        nextLikedExercises = [likeEntry, ...withoutDuplicate].slice(0, MAX_LIKED_EXERCISES_STORED);
      } else {
        nextLikedExercises = previousLikes.filter(likedRow => {
          const sameId = String((likedRow == null ? void 0 : likedRow.id) || '') === exerciseId;
          const sameName = String((likedRow == null ? void 0 : likedRow.name) || '') === exerciseName;
          return !sameId && !sameName;
        });
      }
      await setDoc(refUser, {
        likedExercises: nextLikedExercises,
        updatedAt: serverTimestamp()
      }, {
        merge: true
      });
    } catch (e) {
      if (__DEV__) console.warn('likedExercises save:', (e == null ? void 0 : e.message) || e);
    }
  }, []);
  const toggleSave = useCallback(exerciseOrId => {
    const id = typeof exerciseOrId === 'string' ? exerciseOrId : exerciseOrId == null ? void 0 : exerciseOrId.id;
    if (!id) return;
    setSaved(prev => {
      const next = new Set(prev);
      const willLike = !next.has(id);
      if (willLike) next.add(id);else next.delete(id);
      persistSaved(next);
      if (typeof exerciseOrId === 'object') {
        void persistLikedExercisesToFirestore(exerciseOrId, willLike);
      }
      return next;
    });
  }, [persistSaved, persistLikedExercisesToFirestore]);
  const defaultDifficulty = useMemo(() => difficultyLabelFromOnboardingFitness(onboardingData == null ? void 0 : onboardingData.fitnessLevel), [onboardingData == null ? void 0 : onboardingData.fitnessLevel]);

  // Filters act like typing the same words into search when the field is empty.
  const filtersQuery = useMemo(() => {
    if (String(debouncedQuery || '').trim()) return '';
    const parts = [activeSplit, activeMuscle, activeEquipment].filter(Boolean);
    return parts.join(' ').trim();
  }, [debouncedQuery, activeSplit, activeMuscle, activeEquipment]);
  const effectiveQuery = useMemo(() => {
    const typed = String(debouncedQuery || '').trim();
    if (typed) return typed;
    return filtersQuery;
  }, [debouncedQuery, filtersQuery]);
  const showRecommended = !String(effectiveQuery || '').trim();

  // Journey carousel always uses recommended feed (PNG: stays under filters).
  const {
    items: recommendedItems,
    loading: recommendedLoading,
    error: recommendedError
  } = findExerciseVideos({
    mode: 'recommended',
    onboardingData,
    enabled: true
  });
  const {
    items: searchItems,
    loading: searchLoading,
    error: searchError
  } = findExerciseVideos({
    mode: 'search',
    debouncedQuery: effectiveQuery,
    muscleGroup: activeMuscle,
    equipmentHint: activeEquipment,
    difficultyHint: null,
    onboardingData,
    enabled: !showRecommended
  });
  const libraryItems = showRecommended ? recommendedItems : searchItems;
  const loading = showRecommended ? recommendedLoading : searchLoading;
  const error = showRecommended ? recommendedError : searchError || recommendedError;
  const journeyExercises = useMemo(() => (recommendedItems || []).slice(0, JOURNEY_CAROUSEL_COUNT).map((youtubeHit, index) => buildExerciseFromYouTubeHit(youtubeHit, index, {
    defaultDifficulty,
    forcedMuscle: null,
    forcedEquipment: null
  })), [recommendedItems, defaultDifficulty]);

  // Results grid follows search / filter query (PNG browse library).
  const resultsExercises = useMemo(() => {
    const mapped = (libraryItems || []).map((youtubeHit, index) => buildExerciseFromYouTubeHit(youtubeHit, index, {
      defaultDifficulty,
      forcedMuscle: activeMuscle,
      forcedEquipment: activeEquipment
    }));
    if (!showRecommended) return mapped;
    // Idle recommended: skip the journey slice so the grid does not duplicate the carousel.
    return mapped.slice(JOURNEY_CAROUSEL_COUNT);
  }, [libraryItems, defaultDifficulty, activeMuscle, activeEquipment, showRecommended]);
  const resultsTitle = activeMuscle || (effectiveQuery ? 'Results' : 'Library');
  const resultsCountLabel = `${resultsExercises.length} result${resultsExercises.length === 1 ? '' : 's'}`;
  const cardW = useMemo(() => widthForOneTwoColumnCard(), []);
  const listKey = useMemo(() => `twoCol_${cardW}_${activeMuscle || 'all'}_${activeEquipment || 'all'}`, [cardW, activeMuscle, activeEquipment]);
  const openAvoidSheet = () => {
    setAvoidDraft(String(persistedDislikes || avoidDraft || ''));
    setAvoidOpen(true);
  };
  const cancelAvoidSheet = () => {
    setAvoidDraft(String(persistedDislikes || ''));
    setAvoidOpen(false);
  };
  const saveAvoidSheet = async () => {
    // 1. Lock sheet actions while we write
    setAvoidSaving(true);
    try {
      var _optObj5;
      // 2. Normalize the comma-separated avoid list
      const trimmedAvoidList = String(avoidDraft || '').trim();
      // 3. Mirror locally and notify parent onboarding sync
      setPersistedDislikes(trimmedAvoidList);
      onExercisesDislikeChange == null ? void 0 : onExercisesDislikeChange(trimmedAvoidList);
      // 4. Merge onto the signed-in user profile when Firebase is up
      const uid = (_optObj5 = auth == null ? void 0 : auth.currentUser) == null ? void 0 : _optObj5.uid;
      if (uid && db) {
        await setDoc(doc(db, 'users', uid), {
          exercisesDislike: trimmedAvoidList,
          updatedAt: serverTimestamp()
        }, {
          merge: true
        });
      }
      // 5. Close sheet on success
      setAvoidOpen(false);
    } catch (e) {
      if (__DEV__) console.warn('exercisesDislike save:', (e == null ? void 0 : e.message) || e);
    } finally {
      setAvoidSaving(false);
    }
  };
  const toggleSplit = label => setActiveSplit(prev => prev === label ? null : label);
  const toggleMuscle = label => setActiveMuscle(prev => prev === label ? null : label);
  const toggleEquipment = label => setActiveEquipment(prev => prev === label ? null : label);

  // Silence unused toggleSave for now — likes still persist when detail opens with bookmark later
  void toggleSave;
  void saved;

  // Name the screen decisions before JSX (Variation 3 — no nested ternaries in the tree).
  const rootBackgroundStyle = [styles.root, {
    backgroundColor: colors.nbBackground
  }];
  const scrollContentStyle = {
    paddingBottom: shellNavInset,
    paddingTop: 8
  };
  const showJourneyLoading = recommendedLoading && showRecommended && !journeyExercises.length;
  const showResultsLoading = loading;
  const showResultsEmpty = !loading && !resultsExercises.length;
  const avoidSaveButtonLabel = avoidSaving ? 'Saving' : 'Save';
  const searchFieldColors = {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder
  };
  const columnWrapperStyle = {
    width: cardW * 2 + CARD_GAP,
    alignSelf: 'center',
    justifyContent: 'space-between',
    marginBottom: CARD_GAP
  };
  return <View style={rootBackgroundStyle}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.flex} contentContainerStyle={scrollContentStyle}>
        {/* Search — PNG: "Search the exercise library" */}
        <View style={styles.padX}>
          <HardShadow radius={borderRadius.nbInput} offset={nb.shadowOffsetSmall}>
            <View style={[styles.searchField, searchFieldColors]}>
              <TextInput style={[styles.searchInput, {
              color: colors.nbInk
            }]} placeholder="Search the exercise library" placeholderTextColor={colors.nbMuted} value={query} onChangeText={setQuery} autoCorrect={false} spellCheck={false} autoCapitalize="none" accessibilityLabel="Search exercises" />
            </View>
          </HardShadow>
        </View>

        {error ? <View style={[styles.banner, {
        borderColor: colors.nbBorder
      }]}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.nbInk} />
            <Text style={[styles.bannerText, {
          color: colors.nbMuted
        }]}>{String(error)}</Text>
          </View> : null}

        {/* Pulled from your journey */}
        <View style={[styles.section, styles.padX]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, {
            color: colors.nbInk
          }]}>
              Pulled from your journey
            </Text>
            <Text style={[styles.sectionMeta, {
            color: colors.nbMuted
          }]}>Based on your goals</Text>
          </View>
        </View>
        {showJourneyLoading ? <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.nbFill} />
          </View> : <FlatList horizontal showsHorizontalScrollIndicator={false} data={journeyExercises} keyExtractor={journeyExercise => `journey_${journeyExercise.id}`} contentContainerStyle={styles.journeyList} renderItem={({
        item
      }) => <ShortVideoCard item={item} width={JOURNEY_CARD_WIDTH} onPress={() => setActiveExercise(item)} />} ListEmptyComponent={<Text style={[styles.emptyInline, {
        color: colors.nbMuted
      }]}>
                Sign in and load recommendations to fill this row.
              </Text>} />}

        {/* Browse the library — SPLIT / MUSCLE / EQUIPMENT */}
        <View style={[styles.section, styles.padX]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, {
            color: colors.nbInk
          }]}>Browse the library</Text>
          </View>

          <FilterGroup label="Split">
            {SPLIT_OPTIONS.map(label => <FilterChip key={label} label={label} selected={activeSplit === label} onPress={() => toggleSplit(label)} />)}
          </FilterGroup>

          <FilterGroup label="Muscle">
            {MUSCLE_GROUPS.map(label => <FilterChip key={label} label={label} selected={activeMuscle === label} onPress={() => toggleMuscle(label)} />)}
          </FilterGroup>

          <FilterGroup label="Equipment">
            {EQUIPMENT_LIST.map(label => <FilterChip key={label} label={label} selected={activeEquipment === label} onPress={() => toggleEquipment(label)} />)}
          </FilterGroup>
        </View>

        {/* Results grid */}
        <View style={[styles.section, styles.padX]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, {
            color: colors.nbInk
          }]}>{resultsTitle}</Text>
            <Text style={[styles.sectionMeta, {
            color: colors.nbMuted
          }]}>{resultsCountLabel}</Text>
          </View>

          {showResultsLoading ? <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.nbFill} />
            </View> : null}

          {showResultsEmpty ? <View style={[styles.emptyBox, {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface
        }]}>
              <Text style={[styles.emptyTitle, {
            color: colors.nbInk
          }]}>No exercises found</Text>
              <Text style={[styles.emptyBody, {
            color: colors.nbMuted
          }]}>
                Try a broader query or clear filters.
              </Text>
            </View> : <FlatList key={listKey} data={resultsExercises} keyExtractor={exerciseRow => exerciseRow.id} numColumns={2} scrollEnabled={false} columnWrapperStyle={columnWrapperStyle} renderItem={({
          item
        }) => <View style={{
          width: cardW
        }}>
                  <ExerciseCard exercise={item} onPress={() => setActiveExercise(item)} />
                </View>} />}
        </View>

        {/* Notice (mockup `.note2`) + avoid CTA with gradient icon chip accent */}
        <View style={[styles.section, styles.padX, {
        gap: 14
      }]}>
          <View style={[styles.notice, {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSoft
        }]}>
            <Text style={[styles.noticeTitle, {
            color: colors.nbInk
          }]}>{NOTICE_TITLE}</Text>
            <Text style={[styles.noticeBody, {
            color: colors.nbMuted
          }]}>{NOTICE_BODY}</Text>
          </View>

          <HardShadow radius={borderRadius.nbButton} offset={nb.shadowOffset}>
            <Pressable onPress={openAvoidSheet} accessibilityRole="button" accessibilityLabel="Exercises I want to avoid" style={[styles.avoidBtn, {
            backgroundColor: colors.nbSurface,
            borderColor: colors.nbBorder,
            minHeight: nb.buttonMinHeight
          }]}>
              {/* Small accent only — NbIconChip gradient (44), not a card rim */}
              <NbIconChip source={BANNED_ICON} index={0} size={44} style={{
              borderColor: colors.nbBorder
            }} />
              <Text style={[styles.avoidBtnText, {
              color: colors.nbInk
            }]}>
                Exercises I want to avoid
              </Text>
            </Pressable>
          </HardShadow>
        </View>
      </ScrollView>

      {activeExercise ? <ExerciseDetailModal exercise={activeExercise} onClose={() => {
      setPlayerMode('embedded');
      setActiveExercise(null);
    }} playerMode={playerMode} onPlayerModeChange={setPlayerMode} /> : null}

      {/* Exercises to avoid — PNG 07/08 */}
      <NbSheet visible={avoidOpen} onClose={cancelAvoidSheet}>
        <Text style={[styles.sheetTitle, {
        color: colors.nbInk
      }]}>Exercises to avoid</Text>
        <Text style={[styles.sheetSub, {
        color: colors.nbMuted
      }]}>
          Plans built for you will skip these.
        </Text>
        <DislikedExercisesPicker value={avoidDraft} onChange={setAvoidDraft} intent="dislike" layout="sheet" showHint={false} showSearch={false} showOtherField={false} />
        <View style={styles.sheetActions}>
          <View style={styles.sheetActionFlex}>
            <NbButton variant="ghost" onPress={cancelAvoidSheet} disabled={avoidSaving} style={styles.sheetBtnFill}>
              Cancel
            </NbButton>
          </View>
          <View style={[styles.sheetActionFlex, {
          flex: 1.4
        }]}>
            <NbButton variant="fill" onPress={saveAvoidSheet} disabled={avoidSaving} style={styles.sheetBtnFill}>
              {avoidSaveButtonLabel}
            </NbButton>
          </View>
        </View>
      </NbSheet>
    </View>;
}
function ExerciseDetailModal({
  exercise,
  onClose,
  playerMode,
  onPlayerModeChange
}) {
  var _optObj6;
  const {
    colors
  } = useTheme();
  // Manipulate here: embed inset from screen edges / 16:9 player height floor
  const EMBED_HORIZONTAL_INSET = 36;
  const EMBED_MIN_HEIGHT = 230;
  const THEATER_MIN_HEIGHT = 260;
  const THEATER_TOP_CHROME_IOS = 112;
  const THEATER_TOP_CHROME_ANDROID = 96;
  const embedWidth = Math.floor(SCREEN_W - EMBED_HORIZONTAL_INSET);
  const embedHeight = Math.max(EMBED_MIN_HEIGHT, Math.round(embedWidth * 9 / 16));
  const theaterChromeHeight = Platform.OS === 'ios' ? THEATER_TOP_CHROME_IOS : THEATER_TOP_CHROME_ANDROID;
  const theaterPlayerHeight = Math.max(THEATER_MIN_HEIGHT, Dimensions.get('window').height - theaterChromeHeight);
  const showTheaterPlayer = playerMode === 'fullscreen';
  const channelLabel = exercise.channel || 'Exercise Library';
  const hasDescription = Boolean(exercise.description);
  const hasFormTips = (((_optObj6 = exercise.formTips) == null ? void 0 : _optObj6.length) || 0) > 0;
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />

        {showTheaterPlayer ? <View style={[styles.fsLayer, {
        backgroundColor: colors.nbBackground
      }]}>
            <View style={styles.fsHeader}>
              <Pressable onPress={() => onPlayerModeChange('embedded')} hitSlop={10} accessibilityLabel="Exit theater">
                <Ionicons name="chevron-down" size={28} color={colors.nbInk} />
              </Pressable>
              <Text style={[styles.fsTitle, {
            color: colors.nbInk
          }]} numberOfLines={1}>
                {exercise.name}
              </Text>
              <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.nbInk} />
              </Pressable>
            </View>
            <View style={[styles.fsWeb, {
          backgroundColor: PLAYER_LETTERBOX_BLACK,
          justifyContent: 'center'
        }]}>
              <YouTubeIframeExercisePlayer videoId={exercise.videoId} width={Dimensions.get('window').width} height={theaterPlayerHeight} play />
            </View>
          </View> : <View style={[styles.mdlSheet, {
        backgroundColor: colors.nbSurface,
        borderColor: colors.nbBorder
      }]}>
            <View style={styles.mdlTopRow}>
              <HardShadow radius={borderRadius.nbIconChip} offset={nb.shadowOffsetSmall}>
                <Pressable onPress={onClose} style={[styles.mdlBackBtn, {
              backgroundColor: colors.nbSurface,
              borderColor: colors.nbBorder
            }]} hitSlop={10} accessibilityLabel="Back">
                  <Ionicons name="arrow-back" size={20} color={colors.nbInk} />
                </Pressable>
              </HardShadow>
              <View style={styles.modeRow}>
                <FilterChip label="Inline" selected={playerMode === 'embedded'} onPress={() => onPlayerModeChange('embedded')} />
                <FilterChip label="Theater" selected={playerMode === 'fullscreen'} onPress={() => onPlayerModeChange('fullscreen')} />
              </View>
            </View>

            <Text style={[styles.mdlKicker, {
          color: colors.nbMuted
        }]}>
              {channelLabel}
            </Text>
            <Text style={[styles.mdlTitle, {
          color: colors.nbInk
        }]} numberOfLines={2}>
              {exercise.name}
            </Text>

            <View style={styles.mdlMusclePills}>
              {(exercise.muscles || []).map(muscleBadge => <View key={muscleBadge.label} style={[styles.mdlPill, {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface
          }]}>
                  <Text style={[styles.mdlPillText, {
              color: colors.nbInk
            }]}>
                    {muscleBadge.label}
                  </Text>
                </View>)}
              {exercise.equipment ? <View style={[styles.mdlPill, {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface
          }]}>
                  <Text style={[styles.mdlPillText, {
              color: colors.nbInk
            }]}>
                    {exercise.equipment}
                  </Text>
                </View> : null}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mdlScroll}>
              <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall}>
                <View style={[styles.mdlPlayerWrap, {
              borderColor: colors.nbBorder,
              backgroundColor: PLAYER_LETTERBOX_BLACK
            }]}>
                  <YouTubeIframeExercisePlayer videoId={exercise.videoId} width={embedWidth} height={embedHeight} play />
                </View>
              </HardShadow>

              {hasDescription ? <View style={[styles.mdlSection, {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbBackground
          }]}>
                  <Text style={[styles.mdlSectionTitle, {
              color: colors.nbMuted
            }]}>ABOUT</Text>
                  <Text style={[styles.mdlBody, {
              color: colors.nbInk
            }]}>{exercise.description}</Text>
                </View> : null}

              {hasFormTips ? <View style={[styles.mdlSection, {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbBackground
          }]}>
                  <Text style={[styles.mdlSectionTitle, {
              color: colors.nbMuted
            }]}>FORM TIPS</Text>
                  {exercise.formTips.map((tip, tipIndex) => <View key={tipIndex} style={styles.mdlTipRow}>
                      <Text style={[styles.mdlTipIdx, {
                color: colors.nbInk
              }]}>
                        {String(tipIndex + 1).padStart(2, '0')}
                      </Text>
                      <Text style={[styles.mdlTipText, {
                color: colors.nbInk
              }]}>{tip}</Text>
                    </View>)}
                </View> : null}

              <View style={{
            height: 32
          }} />
            </ScrollView>
          </View>}
      </View>
    </Modal>;
}

// ===== PLUMBING — skip unless debugging =====

function widthForOneTwoColumnCard() {
  var _optObj7;
  const windowWidth = ((_optObj7 = Dimensions.get('window')) == null ? void 0 : _optObj7.width) || SCREEN_W || FALLBACK_SCREEN_WIDTH;
  const usableWidth = Math.max(MIN_USABLE_GRID_WIDTH, windowWidth - GUTTER * 2);
  return Math.floor((usableWidth - CARD_GAP) / 2);
}
function difficultyLabelFromOnboardingFitness(fitnessLevel) {
  const levelLower = String(fitnessLevel || '').toLowerCase();
  if (levelLower.includes('begin')) return 'Beginner';
  if (levelLower.includes('adv')) return 'Advanced';
  return 'Intermediate';
}
function muscleBadgesFromTitleText(titleText) {
  const badges = [];
  for (const muscleRule of MUSCLE_KEYWORDS) {
    if (!muscleRule.titlePattern.test(titleText)) continue;
    badges.push({
      label: muscleRule.label
    });
    if (badges.length >= MAX_MUSCLE_BADGES) break;
  }
  return badges;
}
function muscleBadgesForExercise(title, forcedMuscle) {
  if (forcedMuscle) return [{
    label: forcedMuscle
  }];
  const fromTitle = muscleBadgesFromTitleText(String(title || ''));
  if (fromTitle.length === 0) return [{
    label: 'Full body'
  }];
  return fromTitle;
}
function equipmentLabelFromTitle(title, forcedEquipment) {
  if (forcedEquipment) return forcedEquipment;
  const titleText = String(title || '');
  for (const equipmentName of EQUIPMENT_LIST) {
    const wordBoundaryPattern = new RegExp(`\\b${equipmentName}\\b`, 'i');
    if (wordBoundaryPattern.test(titleText)) return equipmentName;
  }
  return null;
}
function defaultExerciseFormTips() {
  return ['Brace your core before each rep.', 'Move through a controlled range; avoid bouncing.', 'Stop if you feel sharp pain or joint discomfort.'];
}
function setCountForDifficulty(difficulty) {
  if (difficulty === 'Advanced') return 5;
  if (difficulty === 'Beginner') return 3;
  return 4;
}
function repRangeForDifficulty(difficulty) {
  if (difficulty === 'Advanced') return '4–6';
  if (difficulty === 'Beginner') return '10–15';
  return '8–12';
}
function buildExerciseFromYouTubeHit(youtubeHit, listIndex, {
  defaultDifficulty,
  forcedMuscle,
  forcedEquipment
}) {
  var _optFn, _optObj8, _optFn2, _optObj9;
  const difficulty = defaultDifficulty || 'Intermediate';
  const muscles = muscleBadgesForExercise(youtubeHit.title, forcedMuscle);
  const equipment = equipmentLabelFromTitle(youtubeHit.title, forcedEquipment);
  const trimmedDescription = ((_optFn = (_optObj8 = (_optFn2 = (_optObj9 = youtubeHit.description) == null ? void 0 : _optObj9.trim) == null ? void 0 : _optFn2()) == null ? void 0 : _optObj8.slice) == null ? void 0 : _optFn(0, MAX_DESCRIPTION_CHARS)) || 'Form and technique demonstration from search results.';
  const durationSeconds = typeof (youtubeHit == null ? void 0 : youtubeHit.durationSeconds) === 'number' ? youtubeHit.durationSeconds : undefined;
  let durationMinutes;
  if (durationSeconds) {
    durationMinutes = Math.max(1, Math.round(durationSeconds / SECONDS_PER_MINUTE));
  }
  const cleanedTitle = youtubeHit.title.replace(/\s+/g, ' ').trim();
  return {
    id: `yt_${youtubeHit.videoId}_${listIndex}`,
    name: cleanedTitle,
    muscles,
    equipment,
    sets: setCountForDifficulty(difficulty),
    reps: repRangeForDifficulty(difficulty),
    difficulty,
    durationSeconds,
    durationMinutes,
    videoId: youtubeHit.videoId,
    channel: youtubeHit.channel,
    description: trimmedDescription,
    formTips: defaultExerciseFormTips(),
    variations: []
  };
}
const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  flex: {
    flex: 1
  },
  padX: {
    paddingHorizontal: GUTTER
  },
  section: {
    marginTop: 24
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12
  },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    flexShrink: 1
  },
  sectionMeta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12
  },
  searchField: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14
  },
  searchInput: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 12
  },
  journeyList: {
    paddingHorizontal: GUTTER,
    gap: 12,
    paddingBottom: 4
  },
  filterGroup: {
    marginBottom: 14
  },
  filterGroupLabel: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8
  },
  filterChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  chipShadow: {
    marginBottom: 2
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterChipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14
  },
  banner: {
    marginHorizontal: GUTTER,
    marginTop: 12,
    padding: 12,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18
  },
  loadingRow: {
    paddingVertical: 16,
    alignItems: 'center'
  },
  emptyInline: {
    fontSize: 13,
    paddingVertical: 8,
    paddingRight: 40
  },
  emptyBox: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 18,
    gap: 6,
    alignItems: 'center'
  },
  emptyTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16
  },
  emptyBody: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18
  },
  // Mockup `.note2` — soft fill, solid 3px, corner accent 2 / 14 / 14 / 14
  notice: {
    borderWidth: nb.borderWidth,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6
  },
  noticeTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    lineHeight: 20
  },
  noticeBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18
  },
  avoidBtn: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbButton,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16
  },
  avoidBtnText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16
  },
  sheetTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    marginBottom: 4
  },
  sheetSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginBottom: 16
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 8
  },
  sheetActionFlex: {
    flex: 1
  },
  sheetBtnFill: {
    width: '100%'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    position: 'relative'
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)'
  },
  fsLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    flexDirection: 'column',
    paddingTop: Platform.OS === 'ios' ? 44 : 28
  },
  fsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 10 : 8,
    paddingBottom: 8,
    gap: 8
  },
  fsTitle: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  fsWeb: {
    flex: 1,
    backgroundColor: PLAYER_LETTERBOX_BLACK
  },
  mdlSheet: {
    borderTopLeftRadius: borderRadius.nbSheet,
    borderTopRightRadius: borderRadius.nbSheet,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    maxHeight: '92%',
    overflow: 'hidden',
    paddingTop: 16,
    paddingHorizontal: 18
  },
  mdlTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  mdlBackBtn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.nbIconChip,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8
  },
  mdlKicker: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 6
  },
  mdlTitle: {
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    lineHeight: 28
  },
  mdlMusclePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 8
  },
  mdlPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill
  },
  mdlPillText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold'
  },
  mdlScroll: {
    paddingTop: 8,
    paddingBottom: 20
  },
  mdlPlayerWrap: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    marginBottom: 16
  },
  mdlSection: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 14,
    gap: 10,
    marginBottom: 12
  },
  mdlSectionTitle: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 0.8
  },
  mdlBody: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular'
  },
  mdlTipRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start'
  },
  mdlTipIdx: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    minWidth: 22
  },
  mdlTipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular'
  }
});
