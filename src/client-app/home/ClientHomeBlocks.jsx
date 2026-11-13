// Design Law Client Home blocks — pixels match docs/design/Design-Law/screens/client-home.
// Flow: tiles/sheets/sliders/macros paint the mockup; parents still own Firestore handlers.
// Used only by TrainingHomeScreenLayout. Not a parallel chrome system — Nb* + handoff assets only.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';
import NbProgressBar from '../../look-and-feel/NbProgressBar';
import NbRing from '../../look-and-feel/NbRing';
import NbSheet from '../../look-and-feel/NbSheet';
import NbSlider from '../../look-and-feel/NbSlider';
import {
  accentGradients,
  lightColors,
  nb,
} from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const HANDOFF_SLEEP = require('../../assets/icons/handoff/sleeping.png');
const HANDOFF_WATER = require('../../assets/icons/handoff/hydration.png');
const HANDOFF_SCALES = require('../../assets/icons/handoff/scales.png');
const HANDOFF_WORKOUT = require('../../assets/icons/handoff/workout.png');
const HANDOFF_PROTEIN = require('../../assets/icons/handoff/protein.png');
const HANDOFF_CARBS = require('../../assets/icons/handoff/carbs.png');
const HANDOFF_FATS = require('../../assets/icons/handoff/fats.png');
const HANDOFF_PROGRESS = require('../../assets/icons/handoff/progress.png');
const HANDOFF_SCHEDULE = require('../../assets/icons/handoff/schedule.png');
const HANDOFF_CHECKIN = require('../../assets/icons/handoff/checkin.png');

// Manipulate here: Design Law water UI is cups; app stores oz — 1 cup = 8 oz
const OZ_PER_CUP = 8;
const WATER_CUP_GOAL = 8;
const MOOD_CHIPS = ['Happy', 'Okay', 'Tired', 'Stressed', 'Anxious'];
// Map chip label → legacy MoodCard index (0–4) so dailyLogs stays compatible
const MOOD_CHIP_TO_INDEX = { Happy: 4, Okay: 2, Tired: 1, Stressed: 0, Anxious: 0 };

// ===== HELPERS =====

function ozToCups(oz) {
  const n = Number(oz) || 0;
  return Math.max(0, Math.round(n / OZ_PER_CUP));
}

function cupsToOz(cups) {
  return Math.max(0, Math.round(Number(cups) || 0) * OZ_PER_CUP);
}

// ===== NUMBER TILES =====

/** Mini spark bars under Sleep (Design Law notebook card detail). */
function MiniBars({ themeColors, fillRatio = 0.6 }) {
  const heights = [8, 14, 10, 18, 12, 16, 9];
  return (
    <View style={styles.miniBars}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: h,
            borderRadius: 2,
            borderWidth: 1.5,
            borderColor: themeColors.cardBorder,
            backgroundColor: i / heights.length < fillRatio ? themeColors.fill : themeColors.pillBg,
          }}
        />
      ))}
    </View>
  );
}

function NumberTile({ tile, themeColors, sleepHours, onOpenLog, compact }) {
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10} style={compact ? styles.vtCellCompact : styles.vtCell}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onOpenLog?.(tile.key)}
        style={[
          compact ? styles.vtCompact : styles.vt,
          tile.radius,
          {
            backgroundColor: themeColors.cardBg,
            borderColor: themeColors.cardBorder,
          },
        ]}
      >
        <View style={styles.vtTop}>
          <Text style={[styles.vtLabel, { color: themeColors.textMuted }]}>{tile.label}</Text>
          <NbIconChip source={tile.icon} index={tile.index} size={compact ? 32 : 44} />
        </View>
        <Text style={[compact ? styles.vtValueCompact : styles.vtValue, { color: themeColors.text }]}>
          {tile.value}
          {tile.unit ? (
            <Text style={[styles.vtUnit, { color: themeColors.textMuted }]}>{` ${tile.unit}`}</Text>
          ) : null}
        </Text>
        <View style={styles.vtFooter}>
          {tile.spark ? (
            <MiniBars
              themeColors={themeColors}
              fillRatio={typeof sleepHours === 'number' ? Math.min(1, sleepHours / 8) : 0.4}
            />
          ) : (
            <Text style={[styles.vtHint, { color: themeColors.text }]}>{tile.hint}</Text>
          )}
        </View>
      </TouchableOpacity>
    </HardShadow>
  );
}

/**
 * Design Law “Today’s numbers” — Sleep + Water as the hero pair; Weight/Steps secondary.
 * Tap opens the parent log sheet.
 */
export function ClientNumberTiles({
  themeColors,
  sleepHours,
  waterOz,
  weightLb,
  steps,
  onOpenLog,
}) {
  const primary = [
    {
      key: 'sleep',
      label: 'Sleep',
      value: typeof sleepHours === 'number' ? `${sleepHours}` : '—',
      unit: 'hrs',
      hint: null,
      spark: true,
      icon: HANDOFF_SLEEP,
      index: 2,
      radius: { borderTopLeftRadius: 10, borderTopRightRadius: 26, borderBottomRightRadius: 10, borderBottomLeftRadius: 10 },
    },
    {
      key: 'water',
      label: 'Water',
      value: `${ozToCups(waterOz)}`,
      unit: 'cups',
      hint: '+ Add a cup',
      spark: false,
      icon: HANDOFF_WATER,
      index: 0,
      radius: { borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomRightRadius: 26, borderBottomLeftRadius: 10 },
    },
  ];
  const secondary = [
    {
      key: 'weight',
      label: 'Weight',
      value: weightLb != null ? `${weightLb}` : '—',
      unit: 'lb',
      hint: 'Tap to log',
      spark: false,
      icon: HANDOFF_SCALES,
      index: 5,
      radius: { borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomRightRadius: 10, borderBottomLeftRadius: 10 },
    },
    {
      key: 'steps',
      label: 'Steps',
      value: steps != null ? `${Number(steps).toLocaleString()}` : '—',
      unit: '',
      hint: 'Tap to log',
      spark: false,
      icon: HANDOFF_WORKOUT,
      index: 3,
      radius: { borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomRightRadius: 10, borderBottomLeftRadius: 10 },
    },
  ];

  return (
    <View style={{ marginBottom: nb.blockGap, gap: 12 }}>
      <View style={styles.vtGrid}>
        {primary.map((tile) => (
          <NumberTile
            key={tile.key}
            tile={tile}
            themeColors={themeColors}
            sleepHours={sleepHours}
            onOpenLog={onOpenLog}
          />
        ))}
      </View>
      <View style={styles.vtGrid}>
        {secondary.map((tile) => (
          <NumberTile
            key={tile.key}
            tile={tile}
            themeColors={themeColors}
            sleepHours={sleepHours}
            onOpenLog={onOpenLog}
            compact
          />
        ))}
      </View>
    </View>
  );
}

// ===== NUTRITION =====

/**
 * Nutrition today — calorie ring + protein/carbs/fats bars (Design Law).
 * Macro totals are optional; when missing we show 0 / goal placeholders from calorieGoal.
 */
export function ClientNutritionCard({
  themeColors,
  todayCalories,
  calorieGoal,
  proteinG,
  carbsG,
  fatsG,
  proteinGoal = 170,
  carbsGoal = 220,
  fatsGoal = 70,
  onOpenNutrition,
}) {
  const cal = Math.round(todayCalories || 0);
  const goal = Math.max(1, Math.round(calorieGoal || 2000));
  const p = Math.round(proteinG || 0);
  const c = Math.round(carbsG || 0);
  const f = Math.round(fatsG || 0);
  // empty-vs-data PNG: no meals → dashed shell + Log a meal (not a zeroed ring)
  const isEmpty = cal <= 0 && p <= 0 && c <= 0 && f <= 0;
  const macros = [
    {
      key: 'protein',
      label: 'Protein',
      value: p,
      goal: proteinGoal,
      icon: HANDOFF_PROTEIN,
      index: 1,
    },
    {
      key: 'carbs',
      label: 'Carbs',
      value: c,
      goal: carbsGoal,
      icon: HANDOFF_CARBS,
      index: 3,
    },
    {
      key: 'fats',
      label: 'Fats',
      value: f,
      goal: fatsGoal,
      icon: HANDOFF_FATS,
      index: 0,
    },
  ];

  if (isEmpty) {
    return (
      <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
        <View
          style={[
            styles.emptyDashCard,
            {
              backgroundColor: themeColors.cardBg,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          <NbIconChip source={HANDOFF_PROTEIN} index={2} size={48} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No meals logged yet</Text>
          <Text style={[styles.emptyBody, { color: themeColors.textMuted }]}>
            Log breakfast, lunch, or a snack and macros show up here.
          </Text>
          {typeof onOpenNutrition === 'function' ? (
            <NbButton variant="fill" onPress={onOpenNutrition} style={{ alignSelf: 'stretch' }}>
              Log a meal
            </NbButton>
          ) : null}
        </View>
      </HardShadow>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onOpenNutrition} style={{ marginBottom: nb.blockGap }}>
      <HardShadow offset={nb.shadowOffsetCard} radius={10}>
        <View style={[styles.nutritionCard, { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }]}>
          <NbRing
            progress={Math.min(1, cal / goal)}
            size={112}
            strokeWidth={12}
            value={`${cal.toLocaleString()}`}
            label={`of ${goal.toLocaleString()}`}
          />
          <View style={{ flex: 1, gap: 10, minWidth: 0 }}>
            {macros.map((m) => (
              <View key={m.key} style={{ gap: 4 }}>
                <View style={styles.macroRow}>
                  <NbIconChip source={m.icon} index={m.index} size={28} />
                  <Text style={[styles.macroLabel, { color: themeColors.text }]}>{m.label}</Text>
                  <Text style={[styles.macroFrac, { color: themeColors.textMuted }]}>
                    {`${m.value}/${m.goal}g`}
                  </Text>
                </View>
                <NbProgressBar progress={m.value / Math.max(1, m.goal)} index={m.index} />
              </View>
            ))}
          </View>
        </View>
      </HardShadow>
    </TouchableOpacity>
  );
}

// ===== WORKOUTS (set chips) =====

/**
 * Workouts today — exercise rows with set chips (Design Law), still driven by workoutDiary state.
 */
export function ClientWorkoutCard({ themeColors, state }) {
  if (!state?.loaded) return null;
  const {
    workoutName,
    setWorkoutName,
    workoutExercises,
    addExercise,
    removeExercise,
    updateExerciseName,
    addSet,
    removeSet,
    updateSetField,
    save,
    showNotified,
  } = state;

  // empty-vs-data PNG: dashed shell + Add exercise when nothing logged yet
  if (!workoutExercises?.length) {
    return (
      <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
        <View
          style={[
            styles.emptyDashCard,
            {
              backgroundColor: themeColors.cardBg,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          <NbIconChip source={HANDOFF_WORKOUT} index={5} size={48} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No workout logged yet</Text>
          <Text style={[styles.emptyBody, { color: themeColors.textMuted }]}>
            Add an exercise and its sets. Your trainer is told when you save.
          </Text>
          <NbButton variant="fill" onPress={addExercise} style={{ alignSelf: 'stretch' }}>
            + Add exercise
          </NbButton>
        </View>
      </HardShadow>
    );
  }

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
      <View style={[styles.workoutCard, { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }]}>
        <TextInput
          style={[styles.dayInput, { borderColor: themeColors.cardBorder, color: themeColors.text, backgroundColor: themeColors.pillBg }]}
          placeholder="Workout day — Chest, Pull, Legs…"
          placeholderTextColor={themeColors.textMuted}
          value={workoutName}
          onChangeText={setWorkoutName}
        />
        {workoutExercises.map((ex) => (
          <View key={ex.id} style={styles.exBlock}>
            <View style={styles.exHeader}>
              <TextInput
                style={[styles.exName, { color: themeColors.text }]}
                placeholder="Exercise name"
                placeholderTextColor={themeColors.textMuted}
                value={ex.name}
                onChangeText={(v) => updateExerciseName(ex.id, v)}
              />
              <TouchableOpacity onPress={() => removeExercise(ex.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.setsRow}>
              {ex.sets.map((set) => {
                const reps = String(set.reps || '').trim();
                const weight = String(set.weight || '').trim();
                const label = reps || weight ? `${reps || '—'} × ${weight || '—'}` : 'Reps × lbs';
                return (
                  <TouchableOpacity
                    key={set.id}
                    onLongPress={() => removeSet(ex.id, set.id)}
                    style={[styles.setChip, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.pillBg }]}
                  >
                    <TextInput
                      style={[styles.setChipInput, { color: themeColors.text }]}
                      placeholder="8 × 135"
                      placeholderTextColor={themeColors.textMuted}
                      value={reps || weight ? label : ''}
                      onChangeText={(raw) => {
                        // Accept "8 x 135" or "8×135" so the chip matches Design Law
                        const parts = String(raw).split(/\s*[x×]\s*/i);
                        updateSetField(ex.id, set.id, 'reps', parts[0] || '');
                        updateSetField(ex.id, set.id, 'weight', parts[1] || '');
                      }}
                    />
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={() => addSet(ex.id)}
                style={[styles.addSet, { borderColor: themeColors.cardBorder }]}
              >
                <Text style={{ fontWeight: '900', color: themeColors.text, fontSize: 13 }}>+ Add set</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <TouchableOpacity
            onPress={addExercise}
            style={[styles.ghostBtn, { flex: 1, borderColor: themeColors.cardBorder }]}
          >
            <Text style={{ fontWeight: '900', color: themeColors.text }}>+ Exercise</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={save}
          activeOpacity={0.9}
          style={[styles.saveBtn, { backgroundColor: themeColors.fill, borderColor: themeColors.cardBorder }]}
        >
          <Text style={{ fontSize: 16, fontWeight: '900', color: themeColors.onFill }}>Save workout</Text>
        </TouchableOpacity>
        {showNotified ? (
          <View style={[styles.notifyPill, { backgroundColor: accentGradients[0][0], borderColor: themeColors.cardBorder }]}>
            <Text style={{ fontSize: 12, fontWeight: '900', color: lightColors.nbInk }}>Trainer notified after you save</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 6 }}>Trainer notified after you save</Text>
        )}
      </View>
    </HardShadow>
  );
}

// ===== CHECK-IN =====

/**
 * One Daily check-in card: sliders + mood chips + post-workout (Design Law).
 * saveFn(storageKey, stringValue) must write the same keys RatingCard used.
 */
export function ClientCheckInCard({
  themeColors,
  values,
  onSave,
  trainerFirstName,
  noteValue,
  onNoteChange,
  onNoteBlur,
}) {
  const [expanded, setExpanded] = useState(false);
  const soreness = Number(values?.soreness) || 4;
  const energy = Number(values?.energy) || 5;
  const stress = Number(values?.stress) || 3;
  const workout = Number(values?.workout) || 7;
  const moodIdx = values?.mood;
  const moodLabel =
    MOOD_CHIPS.find((c) => MOOD_CHIP_TO_INDEX[c] === Number(moodIdx)) ||
    (Number.isFinite(Number(moodIdx)) ? MOOD_CHIPS[2] : null);

  const doneCount = [values?.soreness, values?.energy, values?.stress, values?.mood, values?.workout].filter(
    (v) => v != null && v !== '',
  ).length;

  // empty-vs-data PNG: collapsed “Not logged yet” until the first slider/mood is saved (or tap to expand)
  if (doneCount === 0 && !expanded) {
    return (
      <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => setExpanded(true)}
          style={[
            styles.emptyDashCard,
            {
              backgroundColor: themeColors.cardBg,
              borderColor: themeColors.cardBorder,
              alignItems: 'flex-start',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}>
            <NbIconChip source={HANDOFF_CHECKIN} index={4} size={44} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Not logged yet</Text>
              <Text style={[styles.emptyBody, { color: themeColors.textMuted }]}>
                Soreness, energy, stress, and mood — tap to start.
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </HardShadow>
    );
  }

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
      <View style={[styles.checkCard, { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }]}>
        <View style={styles.checkHead}>
          <Text style={[styles.checkTitle, { color: themeColors.text }]}>Daily check-in</Text>
          <View style={[styles.donePill, { borderColor: themeColors.cardBorder, backgroundColor: themeColors.pillBg }]}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: themeColors.textMuted }}>{`${doneCount} of 5 done`}</Text>
          </View>
        </View>

        <NbSlider
          label="Muscle soreness"
          valueLabel={`${soreness}/8`}
          value={soreness}
          min={1}
          max={8}
          colors={accentGradients[1]}
          onChange={(n) => onSave?.('dashboard_soreness', String(n))}
          style={{ marginBottom: 14 }}
        />
        <NbSlider
          label="Energy level"
          valueLabel={`${energy}/8`}
          value={energy}
          min={1}
          max={8}
          colors={accentGradients[0]}
          onChange={(n) => onSave?.('dashboard_energy', String(n))}
          style={{ marginBottom: 14 }}
        />
        <NbSlider
          label="Stress level"
          valueLabel={`${stress}/8`}
          value={stress}
          min={1}
          max={8}
          colors={accentGradients[2]}
          onChange={(n) => onSave?.('dashboard_stress', String(n))}
          style={{ marginBottom: 14 }}
        />

        <Text style={[styles.moodLabel, { color: themeColors.text }]}>Mood</Text>
        <View style={styles.moodRow}>
          {MOOD_CHIPS.map((chip) => {
            const selected = moodLabel === chip;
            return (
              <TouchableOpacity
                key={chip}
                onPress={() => onSave?.('dashboard_mood', String(MOOD_CHIP_TO_INDEX[chip]))}
                style={[
                  styles.moodChip,
                  {
                    borderColor: themeColors.cardBorder,
                    backgroundColor: selected ? themeColors.fill : themeColors.pillBg,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '900', color: selected ? themeColors.onFill : themeColors.text }}>
                  {chip}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <NbSlider
          label="Post-workout rating"
          valueLabel={`${workout}/10`}
          value={workout}
          min={1}
          max={10}
          colors={accentGradients[3]}
          onChange={(n) => onSave?.('dashboard_workout_rating', String(n))}
          style={{ marginTop: 14, marginBottom: 14 }}
        />

        <Text style={[styles.moodLabel, { color: themeColors.text }]}>
          {trainerFirstName ? `Note to ${trainerFirstName}` : 'Note to trainer'}
        </Text>
        <TextInput
          style={[
            styles.noteBox,
            {
              borderColor: themeColors.cardBorder,
              backgroundColor: themeColors.pillBg,
              color: themeColors.text,
            },
          ]}
          placeholder="How did you feel today? Any pain or wins?"
          placeholderTextColor={themeColors.textMuted}
          multiline
          value={noteValue || ''}
          onChangeText={onNoteChange}
          onBlur={onNoteBlur}
        />
      </View>
    </HardShadow>
  );
}

// ===== GO TO =====

export function ClientGoToGrid({ themeColors, items, notesFilesItem }) {
  return (
    <View style={{ marginBottom: 24, gap: 10 }}>
      <View style={styles.goGrid}>
        {items.map((item, idx) => (
          <HardShadow key={item.label} offset={nb.shadowOffsetSmall} radius={10} style={{ width: '48%' }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={item.onPress || (() => {})}
              style={[styles.goTile, { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }]}
            >
              <NbIconChip source={item.icon || HANDOFF_PROGRESS} index={idx * 3} size={40} />
              <Text style={[styles.goLabel, { color: themeColors.text }]}>{item.label}</Text>
              {item.sub ? <Text style={{ fontSize: 12, color: themeColors.textMuted }}>{item.sub}</Text> : null}
            </TouchableOpacity>
          </HardShadow>
        ))}
      </View>
      {notesFilesItem ? (
        <HardShadow offset={nb.shadowOffsetCard} radius={10}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={notesFilesItem.onPress || (() => {})}
            style={[styles.notesRow, { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder }]}
          >
            <NbIconChip source={HANDOFF_SCHEDULE} index={2} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: themeColors.text }}>{notesFilesItem.label}</Text>
              <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>{notesFilesItem.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.text} />
          </TouchableOpacity>
        </HardShadow>
      ) : null}
    </View>
  );
}

// ===== LOG SHEET (water cups + generic) =====

export function ClientLogSheet({
  visible,
  metricKey,
  themeColors,
  waterOz,
  sleepHours,
  weightLb,
  steps,
  onClose,
  onSaveWaterOz,
  onSaveSleep,
  onSaveWeight,
  onSaveSteps,
}) {
  const title =
    metricKey === 'water'
      ? 'Log water'
      : metricKey === 'sleep'
        ? 'Log sleep'
        : metricKey === 'weight'
          ? 'Log weight'
          : metricKey === 'steps'
            ? 'Log steps'
            : 'Log';

  const [cups, setCups] = useState(ozToCups(waterOz));
  const [sleepDraft, setSleepDraft] = useState(String(sleepHours ?? ''));
  const [weightDraft, setWeightDraft] = useState(String(weightLb ?? ''));
  const [stepsDraft, setStepsDraft] = useState(String(steps ?? ''));
  const [dayOffset, setDayOffset] = useState(0); // 0 today, 1 yesterday (UI only for water)

  useEffect(() => {
    if (!visible) return;
    setCups(ozToCups(waterOz));
    setSleepDraft(String(sleepHours ?? ''));
    setWeightDraft(String(weightLb ?? ''));
    setStepsDraft(String(steps ?? ''));
    setDayOffset(0);
  }, [visible, metricKey, waterOz, sleepHours, weightLb, steps]);

  const save = () => {
    if (metricKey === 'water') onSaveWaterOz?.(cupsToOz(cups));
    if (metricKey === 'sleep') {
      const n = parseFloat(sleepDraft);
      if (!Number.isNaN(n)) onSaveSleep?.(n);
    }
    if (metricKey === 'weight') {
      const n = parseFloat(weightDraft);
      if (!Number.isNaN(n)) onSaveWeight?.(n);
    }
    if (metricKey === 'steps') {
      const n = parseInt(stepsDraft, 10);
      if (!Number.isNaN(n)) onSaveSteps?.(n);
    }
    onClose?.();
  };

  return (
    <NbSheet visible={!!visible} onClose={onClose} title={title}>
      {metricKey === 'water' ? (
        <View style={{ gap: 16, paddingBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: themeColors.text }}>
            {`${cups} of ${WATER_CUP_GOAL} cups`}
          </Text>
          <View style={styles.cupGrid}>
            {Array.from({ length: WATER_CUP_GOAL }, (_, i) => {
              const filled = i < cups;
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => setCups(i + 1)}
                  style={[
                    styles.cup,
                    {
                      borderColor: themeColors.cardBorder,
                      backgroundColor: filled ? themeColors.fill : themeColors.pillBg,
                    },
                  ]}
                >
                  <Image
                    source={HANDOFF_WATER}
                    style={{ width: 22, height: 22, tintColor: filled ? themeColors.onFill : undefined }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { id: 0, label: 'Today' },
              { id: 1, label: 'Yesterday' },
            ].map((d) => (
              <TouchableOpacity
                key={d.id}
                onPress={() => setDayOffset(d.id)}
                style={[
                  styles.dayChip,
                  {
                    borderColor: themeColors.cardBorder,
                    backgroundColor: dayOffset === d.id ? themeColors.fill : themeColors.pillBg,
                  },
                ]}
              >
                <Text style={{ fontWeight: '900', color: dayOffset === d.id ? themeColors.onFill : themeColors.text }}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <NbButton variant="ghost" onPress={onClose}>Cancel</NbButton>
            </View>
            <View style={{ flex: 1 }}>
              <NbButton variant="fill" onPress={save}>Save</NbButton>
            </View>
          </View>
        </View>
      ) : (
        <View style={{ gap: 16, paddingBottom: 24 }}>
          <TextInput
            style={[
              styles.genericInput,
              { borderColor: themeColors.cardBorder, color: themeColors.text, backgroundColor: themeColors.pillBg },
            ]}
            keyboardType="decimal-pad"
            value={metricKey === 'sleep' ? sleepDraft : metricKey === 'weight' ? weightDraft : stepsDraft}
            onChangeText={metricKey === 'sleep' ? setSleepDraft : metricKey === 'weight' ? setWeightDraft : setStepsDraft}
            placeholder={metricKey === 'sleep' ? 'Hours' : metricKey === 'weight' ? 'Lbs' : 'Steps'}
            placeholderTextColor={themeColors.textMuted}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <NbButton variant="ghost" onPress={onClose}>Cancel</NbButton>
            </View>
            <View style={{ flex: 1 }}>
              <NbButton variant="fill" onPress={save}>Save</NbButton>
            </View>
          </View>
        </View>
      )}
    </NbSheet>
  );
}

// ===== TRAINER SHEET (client-home PNG 11/12) =====

// Manipulate here: subtitles match Design Law copy; icon indices cycle accentGradients
const TRAINER_SHEET_ROWS = [
  {
    key: 'message',
    label: 'Message',
    subtitle: 'Usually replies within a few hours',
    ion: 'chatbubble-outline',
    accentIndex: 0,
  },
  {
    key: 'profile',
    label: 'View profile',
    subtitle: 'Rates, specialties, credentials',
    ion: 'person-outline',
    accentIndex: 2,
  },
  {
    key: 'notes',
    label: 'Notes and files',
    subtitle: 'Shared between you and your coach',
    ion: 'folder-outline',
    accentIndex: 4,
  },
  {
    key: 'pay',
    label: 'Manage coaching payment',
    subtitle: 'Next charge on the 1st',
    ion: 'card-outline',
    accentIndex: 3,
    paymentOnly: true,
  },
  {
    key: 'review',
    label: 'Write a review',
    subtitle: 'Tell other clients how it went',
    ion: 'star-outline',
    accentIndex: 1,
  },
];

export function ClientTrainerSheet({
  visible,
  onClose,
  trainerName,
  trainerInitials,
  trainerSpecialty,
  themeColors,
  onMessage,
  onProfile,
  onNotesFiles,
  onPayment,
  onReview,
  showPayment,
  notesSubtitle,
  paymentSubtitle,
}) {
  const handlers = useMemo(
    () => ({
      message: onMessage,
      profile: onProfile,
      notes: onNotesFiles,
      pay: onPayment,
      review: onReview,
    }),
    [onMessage, onProfile, onNotesFiles, onPayment, onReview],
  );

  const rows = useMemo(
    () =>
      TRAINER_SHEET_ROWS.filter((row) => !row.paymentOnly || showPayment).map((row) => {
        let subtitle = row.subtitle;
        if (row.key === 'notes' && notesSubtitle) subtitle = notesSubtitle;
        if (row.key === 'pay' && paymentSubtitle) subtitle = paymentSubtitle;
        return { ...row, subtitle, onPress: handlers[row.key] };
      }),
    [handlers, showPayment, notesSubtitle, paymentSubtitle],
  );

  const specialtyLine = trainerSpecialty || 'Your coach';

  return (
    <NbSheet visible={!!visible} onClose={onClose}>
      <View style={{ gap: 6, paddingBottom: 28 }}>
        {/* Header: avatar + name + specialty + Your trainer pill (PNG 11) */}
        <View style={styles.trainerHeadRow}>
          <View
            style={[
              styles.av,
              { backgroundColor: accentGradients[0][0], borderColor: themeColors.cardBorder },
            ]}
          >
            <Text style={{ fontWeight: '900', color: lightColors.nbInk }}>{trainerInitials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: themeColors.text }} numberOfLines={1}>
              {trainerName || 'Your trainer'}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textMuted, marginTop: 2 }}>
              {specialtyLine}
            </Text>
          </View>
          <View
            style={[
              styles.yourTrainerPill,
              { borderColor: themeColors.cardBorder, backgroundColor: themeColors.pillBg },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '900', color: themeColors.text }}>Your trainer</Text>
          </View>
        </View>

        {rows.map((row) => (
          <TouchableOpacity
            key={row.key}
            onPress={() => {
              onClose?.();
              row.onPress?.();
            }}
            style={[styles.sheetRow, { borderColor: themeColors.cardBorder }]}
            accessibilityRole="button"
            accessibilityLabel={row.label}
          >
            <NbIconChip index={row.accentIndex} size={44}>
              <Ionicons name={row.ion} size={20} color={lightColors.nbInk} />
            </NbIconChip>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: themeColors.text }}>{row.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: themeColors.textMuted, marginTop: 2 }}>
                {row.subtitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </NbSheet>
  );
}

// ===== REVIEW SHEET (client-home PNG 13/14) — look-only; Firestore write is WriteTrainerReviewPopup =====

// Manipulate here: tag list matches Design Law review sheet chips
const REVIEW_TAGS = ['Clear plans', 'Responsive', 'Pushes me', 'Great with injuries', 'On time'];

export function ClientReviewSheet({ visible, onClose, themeColors, trainerName, trainerInitials, onSubmit }) {
  const [stars, setStars] = useState(4);
  const [tags, setTags] = useState(['Clear plans', 'Responsive']);
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!visible) return;
    setStars(4);
    setTags(['Clear plans', 'Responsive']);
    setBody('');
  }, [visible]);

  const firstName = String(trainerName || '').split(/\s+/)[0] || 'trainer';

  return (
    <NbSheet visible={!!visible} onClose={onClose}>
      <View style={{ gap: 14, paddingBottom: 28 }}>
        <View style={styles.trainerHeadRow}>
          <View
            style={[
              styles.av,
              { backgroundColor: accentGradients[1][0], borderColor: themeColors.cardBorder },
            ]}
          >
            <Text style={{ fontWeight: '900', color: lightColors.nbInk }}>
              {trainerInitials || firstName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: themeColors.text }}>
              {`Review ${firstName}`}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: themeColors.textMuted, marginTop: 2 }}>
              Visible on their profile.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity key={n} onPress={() => setStars(n)} hitSlop={6}>
              <Ionicons
                name={n <= stars ? 'star' : 'star-outline'}
                size={36}
                color={n <= stars ? themeColors.fill : themeColors.textMuted}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {REVIEW_TAGS.map((tag) => {
            const on = tags.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => setTags((prev) => (on ? prev.filter((t) => t !== tag) : [...prev, tag]))}
                style={[
                  styles.tagChip,
                  {
                    borderColor: themeColors.cardBorder,
                    backgroundColor: on ? themeColors.fill : themeColors.pillBg,
                  },
                ]}
              >
                <Text style={{ fontWeight: '800', color: on ? themeColors.onFill : themeColors.text }}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <HardShadow>
          <TextInput
            style={[
              styles.noteBox,
              {
                minHeight: 100,
                borderColor: themeColors.cardBorder,
                backgroundColor: themeColors.surface || themeColors.pillBg,
                color: themeColors.text,
              },
            ]}
            multiline
            placeholder="Built around my knee from week one, and checks in without nagging."
            placeholderTextColor={themeColors.textMuted}
            value={body}
            onChangeText={setBody}
          />
        </HardShadow>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <NbButton variant="ghost" onPress={onClose} style={{ flex: 1 }}>
            Not now
          </NbButton>
          <NbButton
            variant="fill"
            style={{ flex: 1 }}
            onPress={() => {
              onSubmit?.({ stars, tags, body });
              onClose?.();
            }}
          >
            Post review
          </NbButton>
        </View>
      </View>
    </NbSheet>
  );
}

export { HANDOFF_CHECKIN, HANDOFF_PROGRESS, HANDOFF_SCHEDULE, HANDOFF_WORKOUT, ozToCups, cupsToOz };

const styles = StyleSheet.create({
  vtGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  vtCell: {
    width: '48%',
  },
  vtCellCompact: {
    width: '48%',
  },
  vt: {
    minHeight: 176,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
    justifyContent: 'space-between',
  },
  vtCompact: {
    minHeight: 112,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
    justifyContent: 'space-between',
  },
  vtTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vtLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase', paddingTop: 4 },
  vtValue: { fontSize: 36, fontWeight: '900', letterSpacing: -1.4, marginTop: 14 },
  vtValueCompact: { fontSize: 26, fontWeight: '900', letterSpacing: -1, marginTop: 8 },
  vtUnit: { fontSize: 14, fontWeight: '800' },
  vtFooter: { marginTop: 12, minHeight: 22, justifyContent: 'flex-end' },
  vtHint: { fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  miniBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 20 },
  nutritionCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroLabel: { flex: 1, fontSize: 13, fontWeight: '800' },
  macroFrac: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  workoutCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  dayInput: {
    minHeight: 44,
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
  },
  exBlock: { gap: 8 },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exName: { flex: 1, fontSize: 17, fontWeight: '900' },
  setsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setChip: {
    minHeight: 40,
    minWidth: 88,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  setChipInput: { fontSize: 13, fontWeight: '800', paddingVertical: 6 },
  addSet: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtn: {
    minHeight: 44,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    minHeight: 50,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  notifyPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
    justifyContent: 'center',
  },
  checkCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
  },
  checkHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  checkTitle: { fontSize: 17, fontWeight: '900' },
  donePill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
    justifyContent: 'center',
  },
  moodLabel: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBox: {
    minHeight: 72,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  goGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  goTile: {
    minHeight: 112,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  goLabel: { fontSize: 15, fontWeight: '900' },
  notesRow: {
    minHeight: 64,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cup: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genericInput: {
    minHeight: 50,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
  },
  trainerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: nb.borderWidthDivider,
  },
  trainerHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  yourTrainerPill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  av: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRow: {
    // PNG 11 rows carry subtitle — taller than a single-line list row
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: nb.borderWidthDivider,
    paddingVertical: 10,
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // empty-vs-data PNG: dashed HardShadow shells for nutrition / workout / check-in
  emptyDashCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    borderStyle: 'dashed',
    padding: 18,
    gap: 10,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'left', alignSelf: 'stretch' },
  emptyBody: { fontSize: 14, fontWeight: '600', lineHeight: 20, textAlign: 'left', alignSelf: 'stretch' },
});
