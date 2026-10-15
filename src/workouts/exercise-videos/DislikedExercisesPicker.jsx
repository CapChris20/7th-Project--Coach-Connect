// Multi-select exercise pills with a slow lottery-cage drift. Selected ids are serialized back to the parent.
// Flow: parse stored value → filter catalog by search → toggle ids → serializeExerciseDislikes.
// Used by onboarding / plan-preference steps. The stored field is still `exercisesDislike`.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  EXERCISE_DISLIKE_CATEGORIES,
  EXERCISE_DISLIKE_CATALOG,
  searchExerciseDislikeCatalog,
} from './dislikableExercises';
import { parseExerciseDislikes, serializeExerciseDislikes } from './dislikedExercisesText';

// ===== NAMED CONSTANTS =====

const INTENT_DISLIKE = 'dislike';
const INTENT_PREFER = 'prefer';
const DRIFT_X_BASE_MS = 1600;
const DRIFT_Y_BASE_MS = 1900;
const ROTATION_BASE_MS = 2400;
const DRIFT_X_STEP_MS = 240;
const DRIFT_Y_STEP_MS = 200;
const ROTATION_STEP_MS = 160;
const DRIFT_X_INDEX_MOD = 6;
const DRIFT_Y_INDEX_MOD = 5;
const ROTATION_INDEX_MOD = 7;
const AMP_X_INDEX_MOD = 4;
const AMP_Y_INDEX_MOD = 5;
const ROT_DEG_INDEX_MOD = 3;
const ENTER_STAGGER_MS = 55;
const ENTER_STAGGER_MOD = 9;
const SELECT_POP_SCALE = 1.08;
const SELECTED_DRIFT_DAMPEN = 0.35;
const IDLE_DRIFT_AMOUNT = 1;
const ENTER_SPRING_FRICTION = 5;
const ENTER_SPRING_TENSION = 90;
const POP_OUT_FRICTION = 4;
const POP_OUT_TENSION = 200;
const POP_IN_FRICTION = 6;
const POP_IN_TENSION = 160;
const AMP_X_BASE = 2.5;
const AMP_X_STEP = 0.8;
const AMP_Y_BASE = 2;
const AMP_Y_STEP = 0.7;
const ROT_DEG_BASE = 1.2;
const ROT_DEG_STEP = 0.4;
const INDEX_SPREAD = 3;

// ===== HELPER FUNCTIONS =====

function pillDriftAmplitudes(index) {
  return {
    ampX: AMP_X_BASE + (index % AMP_X_INDEX_MOD) * AMP_X_STEP,
    ampY: AMP_Y_BASE + (index % AMP_Y_INDEX_MOD) * AMP_Y_STEP,
    rotDeg: ROT_DEG_BASE + (index % ROT_DEG_INDEX_MOD) * ROT_DEG_STEP,
  };
}

function sineLoop(animatedValue, durationMs) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: -1,
        duration: durationMs,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]),
  );
}

/**
 * Three independent loops (x, y, rotate) so the pill wanders instead of circling on a perfect oval.
 * Durations stay slightly different per index so neighboring pills do not sync.
 * @param {object} args
 */
function startPillDriftLoops({ driftX, driftY, rotation, index }) {
  const durationX = DRIFT_X_BASE_MS + (index % DRIFT_X_INDEX_MOD) * DRIFT_X_STEP_MS;
  const durationY = DRIFT_Y_BASE_MS + (index % DRIFT_Y_INDEX_MOD) * DRIFT_Y_STEP_MS;
  const durationRotation = ROTATION_BASE_MS + (index % ROTATION_INDEX_MOD) * ROTATION_STEP_MS;
  const loopX = sineLoop(driftX, durationX);
  const loopY = sineLoop(driftY, durationY);
  const loopRotation = sineLoop(rotation, durationRotation);
  loopX.start();
  loopY.start();
  loopRotation.start();
  return () => {
    loopX.stop();
    loopY.stop();
    loopRotation.stop();
  };
}

function exercisesGroupedByCategory(filteredExercises) {
  const byCategory = {};
  for (const category of EXERCISE_DISLIKE_CATEGORIES) {
    byCategory[category.id] = [];
  }
  for (const exercise of filteredExercises) {
    if (byCategory[exercise.category]) byCategory[exercise.category].push(exercise);
  }
  return EXERCISE_DISLIKE_CATEGORIES
    .map((category) => ({ ...category, exercises: byCategory[category.id] || [] }))
    .filter((category) => category.exercises.length > 0);
}

function pickerHintText({ isPrefer, selectedCount }) {
  const countSuffix = selectedCount > 0 ? ` (${selectedCount} selected)` : '';
  if (isPrefer) {
    return `Tap exercises you would prefer in your plan. Skip any you don't care about.${countSuffix}`;
  }
  return `Tap exercises you never want in your plan. Selected = avoided.${countSuffix}`;
}

function idsWithToggledId(selectedIds, id) {
  if (selectedIds.includes(id)) return selectedIds.filter((selectedId) => selectedId !== id);
  return [...selectedIds, id];
}

/**
 * One drifting pill. Animation math stays in the Animated style interpolations (native driver / UI thread).
 * @param {object} props
 */
function LotteryDriftPill({ index, label, selected, onPress, t: theme, animate }) {
  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const selectPop = useRef(new Animated.Value(1)).current;

  const { ampX, ampY, rotDeg } = pillDriftAmplitudes(index);

  useEffect(() => {
    if (!animate) {
      enter.setValue(1);
      return undefined;
    }

    const delay = (index % ENTER_STAGGER_MOD) * ENTER_STAGGER_MS;
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(enter, {
        toValue: 1,
        friction: ENTER_SPRING_FRICTION,
        tension: ENTER_SPRING_TENSION,
        useNativeDriver: true,
      }),
    ]).start();

    return startPillDriftLoops({ driftX, driftY, rotation, index });
  }, [animate, index, driftX, driftY, rotation, enter]);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(selectPop, {
        toValue: SELECT_POP_SCALE,
        friction: POP_OUT_FRICTION,
        tension: POP_OUT_TENSION,
        useNativeDriver: true,
      }),
      Animated.spring(selectPop, {
        toValue: 1,
        friction: POP_IN_FRICTION,
        tension: POP_IN_TENSION,
        useNativeDriver: true,
      }),
    ]).start();
  }, [selected, selectPop]);

  const idleDrift = selected ? SELECTED_DRIFT_DAMPEN : IDLE_DRIFT_AMOUNT;

  return (
    <Animated.View
      style={{
        transform: [
          {
            scale: Animated.multiply(
              enter.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
              selectPop,
            ),
          },
          {
            translateX: driftX.interpolate({
              inputRange: [-1, 1],
              outputRange: [-ampX * idleDrift, ampX * idleDrift],
            }),
          },
          {
            translateY: driftY.interpolate({
              inputRange: [-1, 1],
              outputRange: [-ampY * idleDrift, ampY * idleDrift],
            }),
          },
          {
            rotate: rotation.interpolate({
              inputRange: [-1, 1],
              outputRange: [`-${rotDeg * idleDrift}deg`, `${rotDeg * idleDrift}deg`],
            }),
          },
        ],
        opacity: enter,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 50,
          marginRight: 8,
          marginBottom: 8,
          borderWidth: 1.5,
          borderColor: selected ? theme.cardSelectedBorder : theme.cardBorder,
          backgroundColor: selected ? theme.cardSelectedBg : theme.cardBg,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textPrimary }}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function CategoryPillSection({ section, shuffleKey, selectedIds, onToggle, theme, animatePills }) {
  return (
    <View key={section.id} style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{section.label}</Text>
      <View style={styles.pillRow}>
        {section.exercises.map((exercise, exerciseIndex) => (
          <LotteryDriftPill
            key={`${exercise.id}-${shuffleKey}`}
            index={exerciseIndex + section.id.length * INDEX_SPREAD}
            label={exercise.name}
            selected={selectedIds.includes(exercise.id)}
            onPress={() => onToggle(exercise.id)}
            t={theme}
            animate={animatePills}
          />
        ))}
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Catalog multi-select. `intent` only changes the hint copy; the stored field is still exercisesDislike.
 * @param {object} props
 */
export default function DislikedExercisesPicker({
  value = '',
  onChange,
  t: theme,
  animatePills = true,
  showOtherField = true,
  /** Stored field is still `exercisesDislike`; selected items = exercises to prioritize */
  intent = INTENT_PREFER,
}) {
  const { selectedIds, customText } = useMemo(() => parseExerciseDislikes(value), [value]);
  const [search, setSearch] = useState('');
  const shuffleKey = useRef(0);

  const filtered = useMemo(() => searchExerciseDislikeCatalog(search), [search]);

  const grouped = useMemo(() => exercisesGroupedByCategory(filtered), [filtered]);

  const toggleId = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const nextIds = idsWithToggledId(selectedIds, id);
    onChange?.(serializeExerciseDislikes(nextIds, customText));
  };

  const handleCustomChange = (text) => {
    onChange?.(serializeExerciseDislikes(selectedIds, text));
  };

  const handleSearchChange = (text) => {
    setSearch(text);
    shuffleKey.current += 1;
  };

  const selectedCount = selectedIds.length;
  const isPrefer = intent !== INTENT_DISLIKE;
  const hintText = pickerHintText({ isPrefer, selectedCount });
  const otherLabel = isPrefer ? 'Other exercises you prefer' : 'Other (not listed)';

  return (
    <View style={styles.root}>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>{hintText}</Text>

      <TextInput
        value={search}
        onChangeText={handleSearchChange}
        placeholder="Search exercises..."
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.search,
          {
            color: theme.textPrimary,
            backgroundColor: theme.cardBg,
            borderColor: theme.cardBorder,
          },
        ]}
      />

      {grouped.map((section) => (
        <CategoryPillSection
          key={section.id}
          section={section}
          shuffleKey={shuffleKey.current}
          selectedIds={selectedIds}
          onToggle={toggleId}
          theme={theme}
          animatePills={animatePills}
        />
      ))}

      {!grouped.length ? (
        <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 8 }}>
          No matches — add a custom exercise below.
        </Text>
      ) : null}

      {showOtherField ? (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>{otherLabel}</Text>
          <TextInput
            value={customText}
            onChangeText={handleCustomChange}
            placeholder="e.g. sled drags, specific machine at your gym..."
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[
              styles.otherInput,
              {
                color: theme.textPrimary,
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  section: {
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  otherInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
});
