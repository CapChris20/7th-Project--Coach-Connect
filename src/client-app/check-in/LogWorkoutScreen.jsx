// Design Law Log workout — standalone SET / LB / REPS cards (missing-screens 03–06).
// Flow: load workoutDiary → empty shell or exercise cards → save via diary.save().
// Used by client stack (CLIENT_ROUTES.LogWorkout). Home “Workouts today” opens this screen.
// Do not change workoutDiary storage keys (workoutLog / dashboard_workout_name / dashboard_workouts).

import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbButton from '../../look-and-feel/NbButton';
import NbSlider from '../../look-and-feel/NbSlider';
import NbIconChip from '../../look-and-feel/NbIconChip';
import HardShadow from '../../look-and-feel/HardShadow';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';
import { workoutDiary } from '../home/workoutDiary';
import { saveDashboardMetricField } from '../../daily-stats/saveDailyStats';
import { auth } from '../../app-start/cloudConnection';
import { getClientDateKey } from '../../helpers/dateStrings';

// ===== NAMED CONSTANTS =====

const HANDOFF_WORKOUT = require('../../assets/icons/handoff/workout.png');
// Manipulate here: default day label when diary has no name yet (subtitle only)
const DEFAULT_DAY_LABEL = 'Lower body';
const DEFAULT_POST_WORKOUT_RATING = 8;
const RATING_MIN = 1;
const RATING_MAX = 10;

// ===== HELPER FUNCTIONS =====

function formatHeaderSubtitleDate(today = new Date()) {
  return today.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function setRowHasWeightOrReps(setRow) {
  const hasReps = String(setRow.reps || '').trim();
  const hasWeight = String(setRow.weight || '').trim();
  if (hasReps) {
    return true;
  }
  if (hasWeight) {
    return true;
  }
  return false;
}

function anySetHasWeightOrReps(setList) {
  const safeSetList = setList || [];
  for (let index = 0; index < safeSetList.length; index += 1) {
    if (setRowHasWeightOrReps(safeSetList[index])) {
      return true;
    }
  }
  return false;
}

/**
 * True when the diary has nothing the user would call a real log yet.
 * workoutDiary seeds one blank exercise after load — treat blank name + empty sets as empty UI.
 * @param {Array} exerciseList
 */
function workoutDiaryLooksEmpty(exerciseList) {
  if (!exerciseList || exerciseList.length === 0) {
    return true;
  }

  for (let index = 0; index < exerciseList.length; index += 1) {
    const exercise = exerciseList[index];
    const hasName = String(exercise.name || '').trim();
    const anySetFilled = anySetHasWeightOrReps(exercise.sets);
    if (hasName || anySetFilled) {
      return false;
    }
  }

  return true;
}

function buildWorkoutHeaderSubtitle(workoutName) {
  const trimmedName = String(workoutName || '').trim();
  let dayLabel = DEFAULT_DAY_LABEL;
  if (trimmedName) {
    dayLabel = trimmedName;
  }
  return `${dayLabel} · ${formatHeaderSubtitleDate()}`;
}

function flipSetDoneFlag(previousDoneMap, setId) {
  const wasDone = previousDoneMap[setId];
  return { ...previousDoneMap, [setId]: !wasDone };
}

function startingRatingFromProp(ratingProp) {
  const asNumber = Number(ratingProp);
  if (asNumber) {
    return asNumber;
  }
  return DEFAULT_POST_WORKOUT_RATING;
}

// ===== SMALL UI PIECES =====

function EmptyWorkoutShell({ colors, onAddFromPlan, onAddExercise }) {
  const shellStyle = [
    styles.emptyDash,
    { borderColor: colors.nbBorder, backgroundColor: colors.nbBackground },
  ];

  return (
    <View style={shellStyle}>
      <NbIconChip source={HANDOFF_WORKOUT} index={5} size={48} />
      <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>No workout logged yet</Text>
      <Text style={[styles.emptyBody, { color: colors.nbMuted }]}>
        Add the exercises you did, with sets and weight. Your trainer is told when you save.
      </Text>
      <NbButton variant="fill" onPress={onAddFromPlan} style={{ alignSelf: 'stretch' }}>
        Add from my plan
      </NbButton>
      <NbButton
        variant="ghost"
        onPress={onAddExercise}
        style={{ alignSelf: 'stretch', marginTop: 10 }}
      >
        Add an exercise
      </NbButton>
    </View>
  );
}

function WorkoutSetRow({
  setIndex,
  setRow,
  isDone,
  colors,
  onChangeWeight,
  onChangeReps,
  onToggleDone,
}) {
  const setNumberStyle = [
    styles.setNum,
    { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
  ];
  const weightInputStyle = [
    styles.setInput,
    styles.lbInput,
    {
      borderColor: colors.nbBorder,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface,
    },
  ];
  const repsInputStyle = [
    styles.setInput,
    styles.repsInput,
    {
      borderColor: colors.nbBorder,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface,
    },
  ];

  let doneBoxBackground = colors.nbSurface;
  if (isDone) {
    doneBoxBackground = colors.nbFill;
  }
  const doneBoxStyle = [
    styles.doneBox,
    { borderColor: colors.nbBorder, backgroundColor: doneBoxBackground },
  ];

  const setNumberText = setIndex + 1;
  const weightText = String(setRow.weight || '');
  const repsText = String(setRow.reps || '');

  let checkmarkIcon = null;
  if (isDone) {
    checkmarkIcon = <Ionicons name="checkmark" size={16} color={colors.nbOnFill} />;
  }

  return (
    <View style={styles.setRow}>
      <View style={setNumberStyle}>
        <Text style={[styles.setNumText, { color: colors.nbInk }]}>{setNumberText}</Text>
      </View>
      <TextInput
        style={weightInputStyle}
        value={weightText}
        onChangeText={onChangeWeight}
        keyboardType="numeric"
        placeholder="—"
        placeholderTextColor={colors.nbMuted}
      />
      <TextInput
        style={repsInputStyle}
        value={repsText}
        onChangeText={onChangeReps}
        keyboardType="numeric"
        placeholder="—"
        placeholderTextColor={colors.nbMuted}
      />
      <TouchableOpacity
        onPress={onToggleDone}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isDone }}
        style={doneBoxStyle}
      >
        {checkmarkIcon}
      </TouchableOpacity>
    </View>
  );
}

function LoggedExerciseCard({
  exercise,
  colors,
  doneBySetId,
  onToggleDone,
  onRename,
  onRemove,
  onAddSet,
  onUpdateSet,
}) {
  const cardShellStyle = [
    styles.exCard,
    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
  ];
  const setList = exercise.sets || [];
  const setRowNodes = [];

  for (let setIndex = 0; setIndex < setList.length; setIndex += 1) {
    const setRow = setList[setIndex];
    const isDone = Boolean(doneBySetId[setRow.id]);

    setRowNodes.push(
      <WorkoutSetRow
        key={setRow.id}
        setIndex={setIndex}
        setRow={setRow}
        isDone={isDone}
        colors={colors}
        onChangeWeight={function onChangeWeight(value) {
          onUpdateSet(setRow.id, 'weight', value);
        }}
        onChangeReps={function onChangeReps(value) {
          onUpdateSet(setRow.id, 'reps', value);
        }}
        onToggleDone={function onToggleDone() {
          onToggleDone(setRow.id);
        }}
      />,
    );
  }

  const addSetButtonStyle = [
    styles.addSetBtn,
    { borderColor: colors.nbBorder, shadowColor: colors.nbShadow },
  ];

  return (
    <HardShadow
      offset={nb.shadowOffsetCard}
      radius={borderRadius.nbCard}
      style={{ marginBottom: 14 }}
    >
      <View style={cardShellStyle}>
        <View style={styles.exHead}>
          <TextInput
            style={[styles.exName, { color: colors.nbInk }]}
            value={exercise.name}
            onChangeText={onRename}
            placeholder="Exercise name"
            placeholderTextColor={colors.nbMuted}
          />
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={8}
            style={[styles.xBtn, { borderColor: colors.nbBorder }]}
            accessibilityLabel="Remove exercise"
          >
            <Ionicons name="close" size={18} color={colors.nbInk} />
          </TouchableOpacity>
        </View>

        <View style={styles.colLabels}>
          <Text style={[styles.colLabel, styles.colSet, { color: colors.nbMuted }]}>SET</Text>
          <Text style={[styles.colLabel, styles.colLb, { color: colors.nbMuted }]}>LB</Text>
          <Text style={[styles.colLabel, styles.colReps, { color: colors.nbMuted }]}>REPS</Text>
          <View style={styles.colDone} />
        </View>

        {setRowNodes}

        <TouchableOpacity onPress={onAddSet} style={addSetButtonStyle}>
          <Text style={[styles.addSetText, { color: colors.nbInk }]}>+ Add set</Text>
        </TouchableOpacity>
      </View>
    </HardShadow>
  );
}

function AddExerciseCard({ colors, onPress }) {
  const buttonStyle = [
    styles.addExBtn,
    {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface,
      shadowColor: colors.nbShadow,
    },
  ];

  return (
    <HardShadow
      offset={nb.shadowOffsetCard}
      radius={borderRadius.nbCard}
      style={{ marginBottom: 14 }}
    >
      <TouchableOpacity onPress={onPress} style={buttonStyle}>
        <Text style={[styles.addExText, { color: colors.nbInk }]}>+ Add exercise</Text>
      </TouchableOpacity>
    </HardShadow>
  );
}

function PostWorkoutRatingCard({ colors, rating, onRatingChange }) {
  const cardShellStyle = [
    styles.ratingCard,
    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
  ];
  const ratingValueLabel = `${rating} / 10`;

  return (
    <HardShadow
      offset={nb.shadowOffsetCard}
      radius={borderRadius.nbCard}
      style={{ marginBottom: 14 }}
    >
      <View style={cardShellStyle}>
        <NbSlider
          label="Post-workout rating"
          valueLabel={ratingValueLabel}
          value={rating}
          min={RATING_MIN}
          max={RATING_MAX}
          colors={accentGradients[3]}
          onChange={onRatingChange}
        />
      </View>
    </HardShadow>
  );
}

function WorkoutDiaryForm({
  colors,
  diary,
  doneBySetId,
  rating,
  onToggleSetDone,
  onRatingChange,
  onSave,
}) {
  const exerciseCards = [];
  const exerciseList = diary.workoutExercises;

  for (let index = 0; index < exerciseList.length; index += 1) {
    const exercise = exerciseList[index];
    exerciseCards.push(
      <LoggedExerciseCard
        key={exercise.id}
        exercise={exercise}
        colors={colors}
        doneBySetId={doneBySetId}
        onToggleDone={onToggleSetDone}
        onRename={function onRename(name) {
          diary.updateExerciseName(exercise.id, name);
        }}
        onRemove={function onRemove() {
          diary.removeExercise(exercise.id);
        }}
        onAddSet={function onAddSet() {
          diary.addSet(exercise.id);
        }}
        onUpdateSet={function onUpdateSet(setId, field, value) {
          diary.updateSetField(exercise.id, setId, field, value);
        }}
      />,
    );
  }

  let notifiedLine = null;
  if (diary.showNotified) {
    notifiedLine = (
      <Text style={[styles.notified, { color: colors.nbMuted }]}>
        Trainer notified after you save
      </Text>
    );
  }

  function handleAddExercise() {
    diary.addExercise();
  }

  return (
    <>
      {exerciseCards}

      <AddExerciseCard colors={colors} onPress={handleAddExercise} />

      <PostWorkoutRatingCard
        colors={colors}
        rating={rating}
        onRatingChange={onRatingChange}
      />

      <NbButton variant="fill" onPress={onSave}>
        Save workout
      </NbButton>
      {notifiedLine}
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen log-workout editor backed by workoutDiary().
 * @param {{ onBack?: Function, onOpenPlan?: Function, workoutRating?: number|string|null }} props
 */
export default function LogWorkoutScreen({ onBack, onOpenPlan, workoutRating: ratingProp }) {
  // 1. Theme + live diary hook (loads workoutLog for today).
  const { colors } = useTheme();
  // vocab: workoutDiary = client hook that owns workoutExercises / save / addExercise
  const diary = workoutDiary();

  // 2. UI-only done checkmarks + post-workout rating + “leave empty shell” flag.
  // vocab: doneBySetId = UI-only checkmarks — not persisted (preserve workoutLog keys)
  const [doneBySetId, setDoneBySetId] = useState({});
  const [rating, setRating] = useState(function initRating() {
    return startingRatingFromProp(ratingProp);
  });
  const [forceShowForm, setForceShowForm] = useState(false);

  // 3. Header subtitle: day name · short date.
  const headerSubtitle = useMemo(() => {
    return buildWorkoutHeaderSubtitle(diary.workoutName);
  }, [diary.workoutName]);

  const diaryLooksEmpty = workoutDiaryLooksEmpty(diary.workoutExercises);
  const showEmptyShell = !forceShowForm && diaryLooksEmpty;
  const showLoadingLine = !diary.loaded;
  const rootStyle = [styles.root, { backgroundColor: colors.nbBackground }];

  // 4. Leave the dashed empty state and show the exercise form.
  function beginAddingExercises() {
    // 1. Leave the dashed empty state
    setForceShowForm(true);

    // 2. Ensure at least one row exists — diary may already seed a blank exercise
    const diaryIsBlank = workoutDiaryLooksEmpty(diary.workoutExercises);
    if (diaryIsBlank) {
      const hasNoExercises = !diary.workoutExercises || diary.workoutExercises.length === 0;
      if (hasNoExercises) {
        diary.addExercise();
      }
      return;
    }

    diary.addExercise();
  }

  function openPlanOrBeginExercise() {
    if (onOpenPlan) {
      onOpenPlan();
      return;
    }
    beginAddingExercises();
  }

  function handleToggleSetDone(setId) {
    setDoneBySetId(function flipDone(previous) {
      return flipSetDoneFlag(previous, setId);
    });
  }

  // 5. Persist workoutLog + optional dashboard_workout_rating, then go back.
  async function saveAll() {
    // 1. Persist workoutLog via diary helper (unchanged keys)
    await diary.save();
    // 2. Mirror post-workout rating to dashboard_workout_rating when signed in
    await persistWorkoutRatingIfSignedIn(rating);
    // 3. Return to caller
    if (onBack) {
      onBack();
    }
  }

  // 6. Header + loading / empty shell / exercise form.
  let scrollBody = null;
  if (showLoadingLine) {
    scrollBody = (
      <Text style={{ color: colors.nbMuted, fontWeight: '600' }}>Loading…</Text>
    );
  } else if (showEmptyShell) {
    scrollBody = (
      <EmptyWorkoutShell
        colors={colors}
        onAddFromPlan={openPlanOrBeginExercise}
        onAddExercise={beginAddingExercises}
      />
    );
  } else {
    scrollBody = (
      <WorkoutDiaryForm
        colors={colors}
        diary={diary}
        doneBySetId={doneBySetId}
        rating={rating}
        onToggleSetDone={handleToggleSetDone}
        onRatingChange={setRating}
        onSave={saveAll}
      />
    );
  }

  return (
    <SafeAreaView style={rootStyle} edges={SHELL_SAFE_AREA_EDGES}>
      <NbPageHeader title="Log workout" subtitle={headerSubtitle} onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {scrollBody}
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== PLUMBING — skip unless debugging =====

// Same key ClientCheckInCard / home post-workout slider uses.
async function persistWorkoutRatingIfSignedIn(rating) {
  const userId = auth?.currentUser?.uid;
  if (!userId) {
    return;
  }
  if (!Number.isFinite(rating)) {
    return;
  }

  await saveDashboardMetricField(
    userId,
    'dashboard_workout_rating',
    String(rating),
    getClientDateKey(),
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: nb.screenGutter,
    paddingBottom: spacing.xl,
  },
  emptyDash: {
    borderWidth: nb.borderWidth,
    borderStyle: 'dashed',
    borderRadius: borderRadius.nbCard,
    padding: 20,
    gap: 12,
    alignItems: 'flex-start',
  },
  emptyTitle: { fontSize: 17, fontWeight: '900' },
  emptyBody: { fontSize: 14, fontWeight: '600', lineHeight: 20, marginBottom: 4 },
  exCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
  },
  exHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  exName: { flex: 1, fontSize: 16, fontWeight: '900', paddingVertical: 4 },
  xBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colLabels: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  colLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  colSet: { width: 36, textAlign: 'center' },
  colLb: { flex: 1.2 },
  colReps: { flex: 1 },
  colDone: { width: 32 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  setNum: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumText: { fontSize: 14, fontWeight: '900' },
  setInput: {
    height: 36,
    borderWidth: nb.borderWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 15,
    fontWeight: '800',
  },
  lbInput: { flex: 1.2 },
  repsInput: { flex: 1 },
  doneBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetBtn: {
    marginTop: 4,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  addSetText: { fontSize: 14, fontWeight: '900' },
  addExBtn: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addExText: { fontSize: 15, fontWeight: '900' },
  ratingCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
  },
  notified: { marginTop: 10, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
