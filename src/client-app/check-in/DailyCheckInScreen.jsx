// Design Law Daily check-in — soreness / energy / stress sliders + mood chips + note (07/08).
// Flow: load today's dashboard_* metrics → edit locally → Save writes the same keys the home card reads.
// Used by CLIENT_ROUTES.DailyCheckIn. Preserve storage keys: dashboard_soreness / energy / stress / mood / notes.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbButton from '../../look-and-feel/NbButton';
import NbSlider from '../../look-and-feel/NbSlider';
import NbProgressSteps from '../../look-and-feel/NbProgressSteps';
import HardShadow from '../../look-and-feel/HardShadow';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';
import { auth, db } from '../../app-start/cloudConnection';
import { saveDashboardMetricField } from '../../daily-stats/saveDailyStats';
import { getClientDateKey } from '../../helpers/dateStrings';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
// Manipulate here: how many slots the header “X of N done” counts (sliders + mood + note)
const TOTAL_CHECK_IN_SLOTS = 5;
// Manipulate here: mood chip labels — must stay aligned with ClientHomeBlocks index map
const MOOD_CHIP_LABELS = ['Happy', 'Okay', 'Tired', 'Stressed', 'Anxious'];
const MOOD_CHIP_TO_INDEX = { Happy: 4, Okay: 2, Tired: 1, Stressed: 0, Anxious: 0 };
const DEFAULT_SORENESS = 3;
const DEFAULT_ENERGY = 6;
const DEFAULT_STRESS = 4;
const DEFAULT_MOOD_LABEL = 'Okay';
const DEFAULT_MOOD_INDEX_WHEN_UNKNOWN = 2;
const PROGRESS_BAR_SEGMENT_COUNT = 4;
const SLIDER_MIN = 1;
const SLIDER_MAX = 8;
const PROGRESS_FRACTION_EMPTY = 0.25;
const PROGRESS_FRACTION_IN_PROGRESS = 0.7;
const PROGRESS_FRACTION_COMPLETE = 1;
const MAX_PROGRESS_STEP_BEFORE_OVERFLOW = 4;

// ===== HELPER FUNCTIONS =====

function moodChipLabelFromNumberIndex(moodIndex) {
  for (let index = 0; index < MOOD_CHIP_LABELS.length; index += 1) {
    const chipLabel = MOOD_CHIP_LABELS[index];
    if (MOOD_CHIP_TO_INDEX[chipLabel] === moodIndex) {
      return chipLabel;
    }
  }
  return null;
}

function moodChipLabelFromWord(moodWord) {
  const trimmedWord = String(moodWord).trim();
  const lowerWord = trimmedWord.toLowerCase();

  for (let index = 0; index < MOOD_CHIP_LABELS.length; index += 1) {
    const chipLabel = MOOD_CHIP_LABELS[index];
    if (chipLabel.toLowerCase() === lowerWord) {
      return chipLabel;
    }
  }
  return null;
}

// Turn a saved dashboard_mood (number index or word) into a chip label, or null if unknown.
function moodChipLabelFromFirestoreValue(moodRaw) {
  if (moodRaw == null || moodRaw === '') {
    return null;
  }

  const asNumber = Number(moodRaw);
  if (Number.isFinite(asNumber)) {
    return moodChipLabelFromNumberIndex(asNumber);
  }

  return moodChipLabelFromWord(moodRaw);
}

function slotCountsAsFilled(value) {
  if (value == null) {
    return false;
  }
  if (value === '') {
    return false;
  }
  return true;
}

function noteCountsAsFilled(note) {
  const trimmedNote = String(note || '').trim();
  return trimmedNote.length > 0;
}

// Count how many of the five slots the user has filled (for the header + progress bar).
function countCompletedCheckInSlots(slotValues) {
  let completedSlotCount = 0;

  if (slotCountsAsFilled(slotValues.soreness)) {
    completedSlotCount += 1;
  }
  if (slotCountsAsFilled(slotValues.energy)) {
    completedSlotCount += 1;
  }
  if (slotCountsAsFilled(slotValues.stress)) {
    completedSlotCount += 1;
  }
  if (slotValues.mood) {
    completedSlotCount += 1;
  }
  if (noteCountsAsFilled(slotValues.note)) {
    completedSlotCount += 1;
  }

  return completedSlotCount;
}

function noteToTrainerHeading(trainerFirstName) {
  if (trainerFirstName) {
    const upperName = String(trainerFirstName).toUpperCase();
    return `NOTE TO ${upperName}`;
  }
  return 'NOTE TO TRAINER';
}

// Map done-slot count → NbProgressSteps current + fraction.
// vocab: NbProgressSteps current is 1-indexed; fraction fills the active segment
function progressBarNumbers(doneCount) {
  let clampedCurrent = doneCount || 1;
  if (clampedCurrent < 1) {
    clampedCurrent = 1;
  }
  if (clampedCurrent > TOTAL_CHECK_IN_SLOTS) {
    clampedCurrent = TOTAL_CHECK_IN_SLOTS;
  }

  let progressFraction = PROGRESS_FRACTION_IN_PROGRESS;
  if (doneCount === 0) {
    progressFraction = PROGRESS_FRACTION_EMPTY;
  }
  if (doneCount >= TOTAL_CHECK_IN_SLOTS) {
    progressFraction = PROGRESS_FRACTION_COMPLETE;
  }

  // Bar has 4 segments visually; when all 5 slots are done we still pass current=5.
  let stepCurrentForBar = clampedCurrent;
  if (clampedCurrent > MAX_PROGRESS_STEP_BEFORE_OVERFLOW) {
    stepCurrentForBar = 5;
  }

  return { progressCurrent: stepCurrentForBar, progressFraction };
}

function mergeTouchedField(previousTouched, fieldName) {
  return { ...previousTouched, [fieldName]: true };
}

function moodIndexForSave(moodLabel) {
  const mappedIndex = MOOD_CHIP_TO_INDEX[moodLabel];
  if (mappedIndex == null) {
    return DEFAULT_MOOD_INDEX_WHEN_UNKNOWN;
  }
  return mappedIndex;
}

// ===== SMALL UI PIECES (no hooks) =====

function DailyCheckInSliderCard({
  colors,
  soreness,
  energy,
  stress,
  onSorenessChange,
  onEnergyChange,
  onStressChange,
}) {
  const cardShellStyle = [
    styles.sliderCard,
    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
  ];
  const sorenessValueLabel = `${soreness}/8`;
  const energyValueLabel = `${energy}/8`;
  const stressValueLabel = `${stress}/8`;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View style={cardShellStyle}>
        <NbSlider
          label="Muscle soreness"
          valueLabel={sorenessValueLabel}
          value={soreness}
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          colors={accentGradients[1]}
          onChange={onSorenessChange}
          style={{ marginBottom: 14 }}
        />
        <NbSlider
          label="Energy level"
          valueLabel={energyValueLabel}
          value={energy}
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          colors={accentGradients[0]}
          onChange={onEnergyChange}
          style={{ marginBottom: 14 }}
        />
        <NbSlider
          label="Stress level"
          valueLabel={stressValueLabel}
          value={stress}
          min={SLIDER_MIN}
          max={SLIDER_MAX}
          colors={accentGradients[2]}
          onChange={onStressChange}
        />
      </View>
    </HardShadow>
  );
}

function OneMoodChip({ chipLabel, isSelected, colors, onPickMood }) {
  let chipBackground = colors.nbSurface;
  let chipTextColor = colors.nbInk;
  if (isSelected) {
    chipBackground = colors.nbFill;
    chipTextColor = colors.nbOnFill;
  }

  const chipShellStyle = [
    styles.moodChip,
    {
      borderColor: colors.nbBorder,
      backgroundColor: chipBackground,
      shadowColor: colors.nbShadow,
    },
  ];
  if (isSelected) {
    chipShellStyle.push(styles.moodChipShadow);
  }

  function handlePress() {
    onPickMood(chipLabel);
  }

  return (
    <TouchableOpacity onPress={handlePress} style={chipShellStyle}>
      <Text style={{ fontSize: 13, fontWeight: '900', color: chipTextColor }}>
        {chipLabel}
      </Text>
    </TouchableOpacity>
  );
}

function MoodChipRow({ colors, selectedMood, showMoodAsTouched, onPickMood }) {
  const chipNodes = [];

  for (let index = 0; index < MOOD_CHIP_LABELS.length; index += 1) {
    const chipLabel = MOOD_CHIP_LABELS[index];
    const isSelected = selectedMood === chipLabel && showMoodAsTouched;
    chipNodes.push(
      <OneMoodChip
        key={chipLabel}
        chipLabel={chipLabel}
        isSelected={isSelected}
        colors={colors}
        onPickMood={onPickMood}
      />,
    );
  }

  return (
    <>
      <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>MOOD</Text>
      <View style={styles.moodRow}>{chipNodes}</View>
    </>
  );
}

function DailyCheckInFormBody({
  colors,
  noteHeading,
  soreness,
  energy,
  stress,
  mood,
  note,
  touched,
  saving,
  onSorenessChange,
  onEnergyChange,
  onStressChange,
  onPickMood,
  onNoteChange,
  onSave,
}) {
  const noteBoxStyle = [
    styles.noteBox,
    {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface,
      color: colors.nbInk,
    },
  ];

  let saveButtonLabel = 'Save check-in';
  if (saving) {
    saveButtonLabel = 'Saving…';
  }

  return (
    <>
      <DailyCheckInSliderCard
        colors={colors}
        soreness={soreness}
        energy={energy}
        stress={stress}
        onSorenessChange={onSorenessChange}
        onEnergyChange={onEnergyChange}
        onStressChange={onStressChange}
      />

      <MoodChipRow
        colors={colors}
        selectedMood={mood}
        showMoodAsTouched={touched.mood}
        onPickMood={onPickMood}
      />

      <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{noteHeading}</Text>
      <TextInput
        style={noteBoxStyle}
        value={note}
        onChangeText={onNoteChange}
        placeholder="Slept badly, long day at work."
        placeholderTextColor={colors.nbMuted}
        multiline
        textAlignVertical="top"
      />

      <NbButton
        variant="fill"
        onPress={onSave}
        disabled={saving}
        style={{ marginTop: spacing.lg }}
      >
        {saveButtonLabel}
      </NbButton>
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen daily check-in: sliders, mood chips, optional note to the trainer.
 * @param {{
 *   userId?: string|null,
 *   trainerFirstName?: string,
 *   onBack?: Function,
 * }} props
 */
export default function DailyCheckInScreen({
  userId: userIdProp,
  trainerFirstName = '',
  onBack,
}) {
  // 1. Theme + who we are writing for + today's date key.
  const { colors } = useTheme();
  const clientUserId = userIdProp || auth?.currentUser?.uid || null;
  // vocab: getClientDateKey = YYYY-MM-DD string the rest of daily stats already uses
  const todayDateKey = getClientDateKey();

  // 2. Form state — defaults match the empty home-card look until Firestore hydrates.
  const [soreness, setSoreness] = useState(DEFAULT_SORENESS);
  const [energy, setEnergy] = useState(DEFAULT_ENERGY);
  const [stress, setStress] = useState(DEFAULT_STRESS);
  const [mood, setMood] = useState(DEFAULT_MOOD_LABEL);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState({
    soreness: false,
    energy: false,
    stress: false,
    mood: false,
  });
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  function markFieldTouched(fieldName) {
    setTouched(function updateTouched(previousTouched) {
      return mergeTouchedField(previousTouched, fieldName);
    });
  }

  // 3. Live hydrate from users/{uid}/dailyLogs/{dateKey} so reopening shows today's values.
  // vocab: onSnapshot = Firestore live listener; return value unsubscribes on cleanup
  useEffect(() => {
    if (!db || !clientUserId) {
      setHydrated(true);
      return undefined;
    }

    const dailyLogRef = doc(
      db,
      USERS_COLLECTION,
      clientUserId,
      DAILY_LOGS_COLLECTION,
      todayDateKey,
    );

    return onSnapshot(
      dailyLogRef,
      function onDailyLogSnapshot(snapshot) {
        applyDailyLogSnapshotToForm(snapshot, {
          setSoreness,
          setEnergy,
          setStress,
          setMood,
          setNote,
          markFieldTouched,
          setHydrated,
        });
      },
      function onDailyLogError() {
        setHydrated(true);
      },
    );
  }, [clientUserId, todayDateKey]);

  // 4. Progress: only count a slider/mood once the user (or hydrate) has touched it.
  const doneCount = useMemo(() => {
    let sorenessForCount = null;
    let energyForCount = null;
    let stressForCount = null;
    let moodForCount = null;

    if (touched.soreness) {
      sorenessForCount = soreness;
    }
    if (touched.energy) {
      energyForCount = energy;
    }
    if (touched.stress) {
      stressForCount = stress;
    }
    if (touched.mood) {
      moodForCount = mood;
    }

    return countCompletedCheckInSlots({
      soreness: sorenessForCount,
      energy: energyForCount,
      stress: stressForCount,
      mood: moodForCount,
      note,
    });
  }, [soreness, energy, stress, mood, note, touched]);

  const progressNumbers = progressBarNumbers(doneCount);
  const progressCurrent = progressNumbers.progressCurrent;
  const progressFraction = progressNumbers.progressFraction;
  const noteHeading = noteToTrainerHeading(trainerFirstName);
  const headerSubtitle = `${doneCount} of ${TOTAL_CHECK_IN_SLOTS} done`;
  const showLoadingLine = !hydrated;
  const rootStyle = [styles.root, { backgroundColor: colors.nbBackground }];

  function handleSorenessChange(nextValue) {
    setSoreness(nextValue);
    markFieldTouched('soreness');
  }

  function handleEnergyChange(nextValue) {
    setEnergy(nextValue);
    markFieldTouched('energy');
  }

  function handleStressChange(nextValue) {
    setStress(nextValue);
    markFieldTouched('stress');
  }

  function handlePickMood(chipLabel) {
    setMood(chipLabel);
    markFieldTouched('mood');
  }

  // 5. Save — write all dashboard_* keys the home card already reads, then go back.
  async function saveCheckIn() {
    // 1. Bail if there is no signed-in user or a save is already running
    if (!clientUserId || saving) {
      return;
    }

    // 2. Write dashboard_* fields (same letters home card reads)
    setSaving(true);
    try {
      await writeDailyCheckInMetrics(clientUserId, todayDateKey, {
        soreness,
        energy,
        stress,
        mood,
        note,
      });
      // 3. Pop back to the screen that opened this flow
      if (onBack) {
        onBack();
      }
    } catch (error) {
      console.warn('DailyCheckInScreen save:', error?.message);
    } finally {
      setSaving(false);
    }
  }

  // 6. Header + progress bar + form (or Loading…)
  let scrollBody = (
    <DailyCheckInFormBody
      colors={colors}
      noteHeading={noteHeading}
      soreness={soreness}
      energy={energy}
      stress={stress}
      mood={mood}
      note={note}
      touched={touched}
      saving={saving}
      onSorenessChange={handleSorenessChange}
      onEnergyChange={handleEnergyChange}
      onStressChange={handleStressChange}
      onPickMood={handlePickMood}
      onNoteChange={setNote}
      onSave={saveCheckIn}
    />
  );
  if (showLoadingLine) {
    scrollBody = (
      <Text style={{ color: colors.nbMuted, fontWeight: '600' }}>Loading…</Text>
    );
  }

  return (
    <SafeAreaView style={rootStyle} edges={SHELL_SAFE_AREA_EDGES}>
      <NbPageHeader
        title="Daily check-in"
        subtitle={headerSubtitle}
        onBack={onBack}
      />
      <View style={styles.progressWrap}>
        <NbProgressSteps
          total={PROGRESS_BAR_SEGMENT_COUNT}
          current={progressCurrent}
          fraction={progressFraction}
        />
      </View>

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

function applyDashboardNumberField(rawValue, defaultValue, setValue, fieldName, markFieldTouched) {
  if (rawValue == null || rawValue === '') {
    return;
  }
  setValue(Number(rawValue) || defaultValue);
  markFieldTouched(fieldName);
}

// Push today's dailyLogs doc into the form fields (and mark those fields touched).
function applyDailyLogSnapshotToForm(snapshot, callbacks) {
  const setSoreness = callbacks.setSoreness;
  const setEnergy = callbacks.setEnergy;
  const setStress = callbacks.setStress;
  const setMood = callbacks.setMood;
  const setNote = callbacks.setNote;
  const markFieldTouched = callbacks.markFieldTouched;
  const setHydrated = callbacks.setHydrated;

  if (!snapshot.exists()) {
    setHydrated(true);
    return;
  }

  const dailyLogData = snapshot.data() || {};

  applyDashboardNumberField(
    dailyLogData.dashboard_soreness,
    DEFAULT_SORENESS,
    setSoreness,
    'soreness',
    markFieldTouched,
  );
  applyDashboardNumberField(
    dailyLogData.dashboard_energy,
    DEFAULT_ENERGY,
    setEnergy,
    'energy',
    markFieldTouched,
  );
  applyDashboardNumberField(
    dailyLogData.dashboard_stress,
    DEFAULT_STRESS,
    setStress,
    'stress',
    markFieldTouched,
  );

  const moodFromLog = moodChipLabelFromFirestoreValue(dailyLogData.dashboard_mood);
  if (moodFromLog) {
    setMood(moodFromLog);
    markFieldTouched('mood');
  }

  if (dailyLogData.dashboard_notes) {
    setNote(String(dailyLogData.dashboard_notes));
  }

  setHydrated(true);
}

// Parallel write of the dashboard_* metric letters the home card already knows.
async function writeDailyCheckInMetrics(userId, dateKey, formValues) {
  const soreness = formValues.soreness;
  const energy = formValues.energy;
  const stress = formValues.stress;
  const mood = formValues.mood;
  const note = formValues.note;
  const moodIndex = moodIndexForSave(mood);

  const writeJobs = [
    saveDashboardMetricField(userId, 'dashboard_soreness', String(soreness), dateKey),
    saveDashboardMetricField(userId, 'dashboard_energy', String(energy), dateKey),
    saveDashboardMetricField(userId, 'dashboard_stress', String(stress), dateKey),
    saveDashboardMetricField(userId, 'dashboard_mood', String(moodIndex), dateKey),
  ];

  const trimmedNote = String(note || '').trim();
  if (trimmedNote) {
    writeJobs.push(
      saveDashboardMetricField(userId, 'dashboard_notes', trimmedNote, dateKey),
    );
  }

  await Promise.all(writeJobs);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressWrap: {
    paddingHorizontal: nb.screenGutter,
    marginBottom: spacing.sm,
  },
  scroll: {
    paddingHorizontal: nb.screenGutter,
    paddingBottom: spacing.xl,
  },
  sliderCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: spacing.md,
    marginBottom: 8,
  },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  moodChipShadow: {
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  noteBox: {
    minHeight: 96,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
});
