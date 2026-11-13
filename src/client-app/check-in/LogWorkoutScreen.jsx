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

// ===== HELPERS =====

function formatSubtitleDate(date = new Date()) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * True when the diary has nothing the user would call a real log yet.
 * workoutDiary seeds one blank exercise after load — treat blank name + empty sets as empty UI.
 * @param {Array} exercises
 */
function isEmptyWorkout(exercises) {
  if (!exercises?.length) return true;
  return exercises.every((ex) => {
    const named = String(ex.name || '').trim();
    const filled = (ex.sets || []).some(
      (s) => String(s.reps || '').trim() || String(s.weight || '').trim(),
    );
    return !named && !filled;
  });
}

// ===== UI PIECES =====

function EmptyWorkoutShell({ colors, onAddFromPlan, onAddExercise }) {
  return (
    <View
      style={[
        styles.emptyDash,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbBackground },
      ]}
    >
      <NbIconChip source={HANDOFF_WORKOUT} index={5} size={48} />
      <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>No workout logged yet</Text>
      <Text style={[styles.emptyBody, { color: colors.nbMuted }]}>
        Add the exercises you did, with sets and weight. Your trainer is told when you save.
      </Text>
      <NbButton variant="fill" onPress={onAddFromPlan} style={{ alignSelf: 'stretch' }}>
        Add from my plan
      </NbButton>
      <NbButton variant="ghost" onPress={onAddExercise} style={{ alignSelf: 'stretch', marginTop: 10 }}>
        Add an exercise
      </NbButton>
    </View>
  );
}

function SetRow({
  setIndex,
  setRow,
  done,
  colors,
  onChangeWeight,
  onChangeReps,
  onToggleDone,
}) {
  return (
    <View style={styles.setRow}>
      <View
        style={[
          styles.setNum,
          { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
        ]}
      >
        <Text style={[styles.setNumText, { color: colors.nbInk }]}>{setIndex + 1}</Text>
      </View>
      <TextInput
        style={[
          styles.setInput,
          styles.lbInput,
          {
            borderColor: colors.nbBorder,
            color: colors.nbInk,
            backgroundColor: colors.nbSurface,
          },
        ]}
        value={String(setRow.weight || '')}
        onChangeText={onChangeWeight}
        keyboardType="numeric"
        placeholder="—"
        placeholderTextColor={colors.nbMuted}
      />
      <TextInput
        style={[
          styles.setInput,
          styles.repsInput,
          {
            borderColor: colors.nbBorder,
            color: colors.nbInk,
            backgroundColor: colors.nbSurface,
          },
        ]}
        value={String(setRow.reps || '')}
        onChangeText={onChangeReps}
        keyboardType="numeric"
        placeholder="—"
        placeholderTextColor={colors.nbMuted}
      />
      <TouchableOpacity
        onPress={onToggleDone}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        style={[
          styles.doneBox,
          {
            borderColor: colors.nbBorder,
            backgroundColor: done ? colors.nbFill : colors.nbSurface,
          },
        ]}
      >
        {done ? <Ionicons name="checkmark" size={16} color={colors.nbOnFill} /> : null}
      </TouchableOpacity>
    </View>
  );
}

function ExerciseCard({
  exercise,
  colors,
  doneBySetId,
  onToggleDone,
  onRename,
  onRemove,
  onAddSet,
  onUpdateSet,
}) {
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={{ marginBottom: 14 }}>
      <View
        style={[
          styles.exCard,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
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

        {(exercise.sets || []).map((setRow, setIndex) => (
          <SetRow
            key={setRow.id}
            setIndex={setIndex}
            setRow={setRow}
            done={!!doneBySetId[setRow.id]}
            colors={colors}
            onChangeWeight={(v) => onUpdateSet(setRow.id, 'weight', v)}
            onChangeReps={(v) => onUpdateSet(setRow.id, 'reps', v)}
            onToggleDone={() => onToggleDone(setRow.id)}
          />
        ))}

        <TouchableOpacity
          onPress={onAddSet}
          style={[
            styles.addSetBtn,
            { borderColor: colors.nbBorder, shadowColor: colors.nbShadow },
          ]}
        >
          <Text style={[styles.addSetText, { color: colors.nbInk }]}>+ Add set</Text>
        </TouchableOpacity>
      </View>
    </HardShadow>
  );
}

// ===== MAIN =====

/**
 * @param {{ onBack?: Function, onOpenPlan?: Function, workoutRating?: number|string|null }} props
 */
export default function LogWorkoutScreen({ onBack, onOpenPlan, workoutRating: ratingProp }) {
  const { colors } = useTheme();
  const diary = workoutDiary();
  // vocab: doneBySetId = UI-only checkmarks — not persisted (preserve workoutLog keys)
  const [doneBySetId, setDoneBySetId] = useState({});
  const [rating, setRating] = useState(() => Number(ratingProp) || 8);
  const [forceShowForm, setForceShowForm] = useState(false);

  const subtitle = useMemo(() => {
    const day = String(diary.workoutName || '').trim() || DEFAULT_DAY_LABEL;
    return `${day} · ${formatSubtitleDate()}`;
  }, [diary.workoutName]);

  const empty = !forceShowForm && isEmptyWorkout(diary.workoutExercises);

  const beginExercise = () => {
    setForceShowForm(true);
    if (isEmptyWorkout(diary.workoutExercises)) {
      // Diary may already have one blank row — show the form; otherwise add one.
      if (!diary.workoutExercises?.length) diary.addExercise();
    } else {
      diary.addExercise();
    }
  };

  const saveAll = async () => {
    await diary.save();
    const uid = auth?.currentUser?.uid;
    if (uid && Number.isFinite(rating)) {
      // Same key DesignLawCheckInCard / home post-workout slider uses
      await saveDashboardMetricField(uid, 'dashboard_workout_rating', String(rating), getClientDateKey());
    }
    onBack?.();
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader title="Log workout" subtitle={subtitle} onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!diary.loaded ? (
          <Text style={{ color: colors.nbMuted, fontWeight: '600' }}>Loading…</Text>
        ) : empty ? (
          <EmptyWorkoutShell
            colors={colors}
            onAddFromPlan={() => (onOpenPlan ? onOpenPlan() : beginExercise())}
            onAddExercise={beginExercise}
          />
        ) : (
          <>
            {diary.workoutExercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                colors={colors}
                doneBySetId={doneBySetId}
                onToggleDone={(setId) =>
                  setDoneBySetId((prev) => ({ ...prev, [setId]: !prev[setId] }))
                }
                onRename={(name) => diary.updateExerciseName(ex.id, name)}
                onRemove={() => diary.removeExercise(ex.id)}
                onAddSet={() => diary.addSet(ex.id)}
                onUpdateSet={(setId, field, value) =>
                  diary.updateSetField(ex.id, setId, field, value)
                }
              />
            ))}

            <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={{ marginBottom: 14 }}>
              <TouchableOpacity
                onPress={() => diary.addExercise()}
                style={[
                  styles.addExBtn,
                  {
                    borderColor: colors.nbBorder,
                    backgroundColor: colors.nbSurface,
                    shadowColor: colors.nbShadow,
                  },
                ]}
              >
                <Text style={[styles.addExText, { color: colors.nbInk }]}>+ Add exercise</Text>
              </TouchableOpacity>
            </HardShadow>

            <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={{ marginBottom: 14 }}>
              <View
                style={[
                  styles.ratingCard,
                  { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                ]}
              >
                <NbSlider
                  label="Post-workout rating"
                  valueLabel={`${rating} / 10`}
                  value={rating}
                  min={1}
                  max={10}
                  colors={accentGradients[3]}
                  onChange={setRating}
                />
              </View>
            </HardShadow>

            <NbButton variant="fill" onPress={saveAll}>
              Save workout
            </NbButton>
            {diary.showNotified ? (
              <Text style={[styles.notified, { color: colors.nbMuted }]}>
                Trainer notified after you save
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
