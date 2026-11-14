// Design Law Progress tab (trainer-home PNG 01/02): metric list + workout + photos row.
// Flow: read today’s daily log → ink list rows → workout card → photos chevron → optional note.
// Used by: TrainerHomeContent under the client tab pills.
// Read order: constants → log readers → row pieces → exported ProgressTab → PLUMBING styles.
//
// vocab: NbIconChip = gradient accent square with owner handoff art
// Freeze: dashboard_* / injuryNote / workoutRating field letters stay as Firestore stores them

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { lightColors, darkColors, nb } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import NbIconChip from '../../look-and-feel/NbIconChip';
import NbButton from '../../look-and-feel/NbButton';
import { resolveTrainerProgressCurrentWeight } from './pickWeightToShow';

// ===== NAMED CONSTANTS =====

const ICON_SLEEP = require('../../assets/icons/handoff/sleeping.png');
const ICON_STEPS = require('../../assets/icons/handoff/workout.png');
const ICON_WATER = require('../../assets/icons/handoff/hydration.png');
const ICON_ENERGY = require('../../assets/icons/handoff/energy.png');
const ICON_SORENESS = require('../../assets/icons/handoff/injury.png');
const ICON_STRESS = require('../../assets/icons/handoff/stress.png');
const ICON_DUMBBELLS = require('../../assets/icons/handoff/dumbbells.png');
const ICON_PHOTOS = require('../../assets/icons/handoff/picture.png');

// Manipulate here: steps / water goals shown under those rows
const STEPS_GOAL_DEFAULT = 8000;
const WATER_GOAL_CUPS_DEFAULT = 8;
const OZ_PER_CUP = 8;
// Manipulate here: energy / soreness / stress “of N” scale on the value suffix
const LEVEL_SCALE = 8;
const EMPTY_METRIC = '—';
const WEIGHT_NOT_LOGGED_COPY = 'Weight not logged';
const NOT_LOGGED_YET_COPY = 'Not logged yet';
const REMIND_BUTTON_LABEL = 'Remind';
const LOGGED_PILL_LABEL = 'Logged';
const NO_WORKOUT_TITLE = 'No workout logged';
const PHOTOS_TITLE = 'Progress photos';
const PHOTOS_SUBTITLE = 'Open gallery';
const NOTE_TITLE = 'Note from client';
const ICON_CHIP_SIZE = 40;
const CHEVRON_SIZE = 18;
const CHEVRON_STROKE = 3;
const PHOTOS_PRESS_OPACITY = 0.88;

// Decorative sleep sparkline heights (Design Law 7-bar strip) — not real sleep data.
const SLEEP_SPARK_BAR_HEIGHTS = [15, 16, 13, 17, 15, 14, 16];
const SLEEP_SPARK_BAR_WIDTH = 3;
const SLEEP_SPARK_BASE_OPACITY = 0.55;
const SLEEP_SPARK_OPACITY_STEP = 0.12;

// ===== HELPER FUNCTIONS =====

/**
 * Turn a dashboard field into a finite number, or null when missing / garbage.
 * @param {*} rawValue
 * @returns {number|null}
 */
function parseFiniteNumberOrNull(rawValue) {
  if (rawValue == null || rawValue === '') {
    return null;
  }
  const asNumber = Number(rawValue);
  if (!Number.isFinite(asNumber)) {
    return null;
  }
  return asNumber;
}

/**
 * Steps with thousands separators, or an em dash when not logged.
 * @param {number|null} stepCount
 * @returns {string}
 */
function formatStepsForDisplay(stepCount) {
  if (stepCount == null) {
    return EMPTY_METRIC;
  }
  return Number(stepCount).toLocaleString();
}

/**
 * Logs often store ounces; Design Law shows cups. Small numbers stay as cups.
 * @param {number|null} ozOrCups
 * @returns {number|null}
 */
function waterCupsFromOuncesOrCups(ozOrCups) {
  if (ozOrCups == null) {
    return null;
  }
  // Manipulate here: ≤20 treated as cups already; above that divide by OZ_PER_CUP
  if (ozOrCups <= 20) {
    return Math.round(ozOrCups);
  }
  return Math.round(ozOrCups / OZ_PER_CUP);
}

/**
 * Prefer dashboard_workout_name; fall back to the first line of legacy dashboard_workouts.
 * @param {object} dailyLog
 * @returns {string|null}
 */
function workoutTitleFromDailyLog(dailyLog) {
  let nameFromDashboard = '';
  if (dailyLog.dashboard_workout_name != null) {
    nameFromDashboard = String(dailyLog.dashboard_workout_name).trim();
  }
  if (nameFromDashboard) {
    return nameFromDashboard;
  }

  let legacyWorkoutBlob = '';
  if (dailyLog.dashboard_workouts != null && dailyLog.dashboard_workouts !== '') {
    legacyWorkoutBlob = String(dailyLog.dashboard_workouts).trim();
  }
  if (!legacyWorkoutBlob) {
    return null;
  }

  const firstLine = legacyWorkoutBlob.split('\n')[0];
  if (!firstLine) {
    return null;
  }
  return firstLine;
}

/**
 * Soreness note: dashboard_soreness_note first, then injuryNote.
 * @param {object} dailyLog
 * @returns {string|null}
 */
function sorenessNoteFromDailyLog(dailyLog) {
  if (dailyLog.dashboard_soreness_note) {
    const dashboardNote = String(dailyLog.dashboard_soreness_note).trim();
    if (dashboardNote) {
      return dashboardNote;
    }
  }
  if (dailyLog.injuryNote) {
    const injuryNote = String(dailyLog.injuryNote).trim();
    if (injuryNote) {
      return injuryNote;
    }
  }
  return null;
}

/**
 * Workout card subtitle: weight-only when no title; rating line when rated; else Today · weight.
 * @param {string|null} workoutTitle
 * @param {number|null} workoutRating
 * @param {string} weightLine
 * @returns {string}
 */
function buildWorkoutSubtitleLine(workoutTitle, workoutRating, weightLine) {
  if (!workoutTitle) {
    return weightLine;
  }
  if (workoutRating != null) {
    return `Today · rated ${workoutRating} of 10`;
  }
  return `Today · ${weightLine}`;
}

/**
 * Trimmed client note from dashboard_notes, or null when blank.
 * @param {object} dailyLog
 * @returns {string|null}
 */
function clientNoteTextFromDailyLog(dailyLog) {
  if (dailyLog.dashboard_notes == null) {
    return null;
  }
  const trimmed = String(dailyLog.dashboard_notes).trim();
  if (trimmed === '') {
    return null;
  }
  return trimmed;
}

/**
 * Pull every Progress-tab metric the list needs from today’s daily log + weight helpers.
 * Field letters stay frozen (dashboard_*).
 * @param {object} args
 * @returns {object}
 */
function readProgressMetricsFromDailyLog({
  dailyLog,
  latestLoggedWeight,
  clientData,
}) {
  const todayDashboardWeight = parseFiniteNumberOrNull(dailyLog.dashboard_weight);
  // vocab: ?? keeps 0 lbs if either profile field is 0; || would wipe a real zero
  const profileWeight = clientData?.profileWeight ?? clientData?.currentWeight;
  const currentWeight = resolveTrainerProgressCurrentWeight({
    todayDashboardWeight,
    latestLoggedWeight,
    profileWeight,
  });

  let weightLine = WEIGHT_NOT_LOGGED_COPY;
  if (currentWeight != null) {
    weightLine = `${currentWeight} lb`;
  }

  const sleepHours = parseFiniteNumberOrNull(dailyLog.dashboard_sleep);
  const stepCount = parseFiniteNumberOrNull(dailyLog.dashboard_steps);
  const waterCups = waterCupsFromOuncesOrCups(
    parseFiniteNumberOrNull(dailyLog.dashboard_water),
  );
  const energyLevel = parseFiniteNumberOrNull(dailyLog.dashboard_energy);
  const sorenessLevel = parseFiniteNumberOrNull(dailyLog.dashboard_soreness);
  const stressLevel = parseFiniteNumberOrNull(dailyLog.dashboard_stress);

  const workoutTitle = workoutTitleFromDailyLog(dailyLog);
  const workoutRating = parseFiniteNumberOrNull(
    dailyLog.dashboard_workout_rating ?? dailyLog.workoutRating,
  );
  const workoutSubtitle = buildWorkoutSubtitleLine(
    workoutTitle,
    workoutRating,
    weightLine,
  );
  const sorenessNote = sorenessNoteFromDailyLog(dailyLog);
  const clientNoteText = clientNoteTextFromDailyLog(dailyLog);

  return {
    sleepHours,
    stepCount,
    waterCups,
    energyLevel,
    sorenessLevel,
    stressLevel,
    workoutTitle,
    workoutSubtitle,
    sorenessNote,
    clientNoteText,
    weightLine,
  };
}

/**
 * Subtitle strings for sleep / energy / soreness / stress rows.
 */
function buildMetricSubtitles({
  sleepHours,
  energyLevel,
  sorenessLevel,
  sorenessNote,
  stressLevel,
}) {
  let sleepSubtitle = NOT_LOGGED_YET_COPY;
  if (sleepHours != null) {
    sleepSubtitle = 'Last 7 nights';
  }

  let energySubtitle = NOT_LOGGED_YET_COPY;
  if (energyLevel != null) {
    energySubtitle = 'Rated today';
  }

  let sorenessSubtitle = NOT_LOGGED_YET_COPY;
  if (sorenessNote) {
    sorenessSubtitle = sorenessNote;
  } else if (sorenessLevel != null) {
    sorenessSubtitle = 'Logged today';
  }

  let stressSubtitle = 'Stress not logged yet';
  if (stressLevel != null) {
    stressSubtitle = 'Logged today';
  }

  return { sleepSubtitle, energySubtitle, sorenessSubtitle, stressSubtitle };
}

/**
 * Display value + optional suffix for a numeric metric (or em dash when missing).
 */
function metricValueAndSuffix(numericValue, suffixWhenPresent) {
  if (numericValue == null) {
    return { value: EMPTY_METRIC, valueSuffix: '' };
  }
  return {
    value: String(numericValue),
    valueSuffix: suffixWhenPresent,
  };
}

function themeInkColors(isDark) {
  if (isDark) {
    return { titleInk: darkColors.nbInk, mutedInk: darkColors.nbMuted };
  }
  return { titleInk: lightColors.nbInk, mutedInk: lightColors.nbMuted };
}

function themeBorderColor(isDark) {
  if (isDark) {
    return darkColors.nbBorder;
  }
  return lightColors.nbBorder;
}

function themeSurfaceChipColor(isDark) {
  if (isDark) {
    return darkColors.nbSurfaceChip;
  }
  return lightColors.nbSurfaceChip;
}

function themeSurfaceColor(isDark) {
  if (isDark) {
    return darkColors.nbSurface;
  }
  return lightColors.nbSurface;
}

/**
 * Decorative 7-bar sparkline next to sleep hours (not real history data).
 */
function SleepSpark({ isDark }) {
  const barColor = isDark ? darkColors.nbInk : lightColors.nbInk;

  return (
    <View style={styles.spark}>
      {SLEEP_SPARK_BAR_HEIGHTS.map((barHeight, barIndex) => {
        // Manipulate here: opacity steps make the tiny strip feel alive without real data
        const barOpacity =
          SLEEP_SPARK_BASE_OPACITY + (barIndex % 3) * SLEEP_SPARK_OPACITY_STEP;
        return (
          <View
            key={`spk-${barIndex}`}
            style={{
              width: SLEEP_SPARK_BAR_WIDTH,
              height: barHeight,
              borderRadius: 1,
              backgroundColor: barColor,
              opacity: barOpacity,
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * One ink row: icon chip + title/subtitle + value (or custom trailing).
 */
function MetricRow({
  icon,
  gradientIndex,
  title,
  subtitle,
  value,
  valueSuffix,
  trailing,
  isDark,
  isLast,
}) {
  const { titleInk, mutedInk } = themeInkColors(isDark);

  let rowDividerStyle = null;
  if (!isLast) {
    rowDividerStyle = {
      borderBottomWidth: 2,
      borderBottomColor: themeBorderColor(isDark),
    };
  }

  const titleStyle = [styles.rowTitle, { color: titleInk }];
  const subtitleStyle = [styles.rowSub, { color: mutedInk }];
  const valueStyle = [styles.rowValue, { color: titleInk }];
  const suffixStyle = [styles.rowValueSuffix, { color: mutedInk }];

  // Name the decision: custom trailing (Remind / sleep spark) vs plain value text.
  let trailingContent = trailing;
  if (!trailingContent) {
    trailingContent = (
      <Text style={valueStyle} numberOfLines={1}>
        {value}
        {valueSuffix ? <Text style={suffixStyle}>{valueSuffix}</Text> : null}
      </Text>
    );
  }

  let subtitleBlock = null;
  if (subtitle) {
    subtitleBlock = (
      <Text style={subtitleStyle} numberOfLines={2}>
        {subtitle}
      </Text>
    );
  }

  return (
    <View style={[styles.row, rowDividerStyle]}>
      <NbIconChip source={icon} index={gradientIndex} size={ICON_CHIP_SIZE} />
      <View style={styles.grow}>
        <Text style={titleStyle} numberOfLines={1}>
          {title}
        </Text>
        {subtitleBlock}
      </View>
      {trailingContent}
    </View>
  );
}

/**
 * Sleep value with the decorative sparkline when hours are logged.
 */
function SleepValueWithSpark({ sleepHours, isDark, titleInk, mutedInk }) {
  return (
    <View style={styles.valueWithSpark}>
      <SleepSpark isDark={isDark} />
      <Text style={[styles.rowValue, { color: titleInk }]} numberOfLines={1}>
        {sleepHours}
        <Text style={[styles.rowValueSuffix, { color: mutedInk }]}> h</Text>
      </Text>
    </View>
  );
}

/**
 * Workout card: dumbbell chip + title/subtitle + optional Logged pill.
 */
function WorkoutLoggedCard({
  workoutTitle,
  workoutSubtitle,
  titleInk,
  mutedInk,
  isDark,
}) {
  const hasWorkoutTitle = Boolean(workoutTitle);
  let displayTitle = NO_WORKOUT_TITLE;
  if (hasWorkoutTitle) {
    displayTitle = workoutTitle;
  }

  let loggedPill = null;
  if (hasWorkoutTitle) {
    loggedPill = (
      <View
        style={[
          styles.pill,
          {
            borderColor: themeBorderColor(isDark),
            backgroundColor: themeSurfaceChipColor(isDark),
          },
        ]}
      >
        <Text style={[styles.pillText, { color: titleInk }]} numberOfLines={1}>
          {LOGGED_PILL_LABEL}
        </Text>
      </View>
    );
  }

  return (
    <NbCard style={styles.sideCard}>
      <View style={styles.sideRow}>
        <NbIconChip source={ICON_DUMBBELLS} index={2} size={ICON_CHIP_SIZE} />
        <View style={styles.grow}>
          <Text style={[styles.rowTitle, { color: titleInk }]} numberOfLines={2}>
            {displayTitle}
          </Text>
          <Text style={[styles.rowSub, { color: mutedInk }]} numberOfLines={2}>
            {workoutSubtitle}
          </Text>
        </View>
        {loggedPill}
      </View>
    </NbCard>
  );
}

/**
 * Tappable Progress photos row with chevron.
 */
function ProgressPhotosCard({ titleInk, mutedInk, onOpenProgressPhotos }) {
  const photosDisabled = !onOpenProgressPhotos;

  return (
    <TouchableOpacity
      activeOpacity={PHOTOS_PRESS_OPACITY}
      onPress={onOpenProgressPhotos}
      disabled={photosDisabled}
    >
      <NbCard style={styles.sideCard}>
        <View style={styles.sideRow}>
          <NbIconChip source={ICON_PHOTOS} index={0} size={ICON_CHIP_SIZE} />
          <View style={styles.grow}>
            <Text style={[styles.rowTitle, { color: titleInk }]} numberOfLines={1}>
              {PHOTOS_TITLE}
            </Text>
            <Text style={[styles.rowSub, { color: mutedInk }]} numberOfLines={1}>
              {PHOTOS_SUBTITLE}
            </Text>
          </View>
          <ChevronRight
            size={CHEVRON_SIZE}
            color={titleInk}
            strokeWidth={CHEVRON_STROKE}
          />
        </View>
      </NbCard>
    </TouchableOpacity>
  );
}

/**
 * Optional “Note from client” card under the photos row.
 */
function ClientNoteCard({ clientNoteText, titleInk, mutedInk, isDark }) {
  if (!clientNoteText) {
    return null;
  }

  return (
    <View
      style={[
        styles.noteCard,
        {
          borderColor: themeBorderColor(isDark),
          backgroundColor: themeSurfaceColor(isDark),
        },
      ]}
    >
      <Text style={[styles.noteTitle, { color: titleInk }]}>{NOTE_TITLE}</Text>
      <Text style={[styles.noteBody, { color: mutedInk }]}>{clientNoteText}</Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Trainer Progress tab body for one client’s today log.
 * @param {{ isDark: boolean, clientData: object, todayDailyLog: object, latestLoggedWeight?: *, onRemindStress?: Function, onOpenProgressPhotos?: Function }} props
 */
const ProgressTab = ({
  isDark,
  clientData,
  todayDailyLog,
  latestLoggedWeight = null,
  onRemindStress,
  onOpenProgressPhotos,
}) => {
  // 1. Theme ink for cards outside MetricRow.
  const { titleInk, mutedInk } = themeInkColors(isDark);

  // 2. Today’s log object (may be empty).
  const dailyLog = todayDailyLog || {};

  // 3. Read every metric + workout + note from the log (Firestore letters frozen).
  const metrics = readProgressMetricsFromDailyLog({
    dailyLog,
    latestLoggedWeight,
    clientData,
  });

  // 4. Subtitle copy for the four level-ish rows.
  const {
    sleepSubtitle,
    energySubtitle,
    sorenessSubtitle,
    stressSubtitle,
  } = buildMetricSubtitles({
    sleepHours: metrics.sleepHours,
    energyLevel: metrics.energyLevel,
    sorenessLevel: metrics.sorenessLevel,
    sorenessNote: metrics.sorenessNote,
    stressLevel: metrics.stressLevel,
  });

  // 5. Named display values for the list rows (no nested ternaries in JSX).
  const sleepDisplay = metricValueAndSuffix(metrics.sleepHours, ' h');
  const waterDisplay = metricValueAndSuffix(metrics.waterCups, ' cups');
  const energyDisplay = metricValueAndSuffix(
    metrics.energyLevel,
    ` / ${LEVEL_SCALE}`,
  );
  const sorenessDisplay = metricValueAndSuffix(
    metrics.sorenessLevel,
    ` / ${LEVEL_SCALE}`,
  );
  const stressDisplay = metricValueAndSuffix(
    metrics.stressLevel,
    ` / ${LEVEL_SCALE}`,
  );
  const stepsGoalLabel = `Goal ${STEPS_GOAL_DEFAULT.toLocaleString()}`;
  const waterGoalLabel = `Goal ${WATER_GOAL_CUPS_DEFAULT} cups`;

  // 6. Trailing slots: sleep spark when logged; Remind when stress missing.
  let sleepValueTrailing = undefined;
  if (metrics.sleepHours != null) {
    sleepValueTrailing = (
      <SleepValueWithSpark
        sleepHours={metrics.sleepHours}
        isDark={isDark}
        titleInk={titleInk}
        mutedInk={mutedInk}
      />
    );
  }

  let stressRowTrailing = undefined;
  if (metrics.stressLevel == null) {
    stressRowTrailing = (
      <NbButton
        variant="ghost"
        sm
        onPress={onRemindStress}
        style={styles.remindBtn}
      >
        {REMIND_BUTTON_LABEL}
      </NbButton>
    );
  }

  return (
    <View style={styles.root}>
      <NbCard style={styles.listCard} noShadow={false}>
        <MetricRow
          isDark={isDark}
          icon={ICON_SLEEP}
          gradientIndex={6}
          title="Sleep hours"
          subtitle={sleepSubtitle}
          value={sleepDisplay.value}
          valueSuffix={sleepDisplay.valueSuffix}
          trailing={sleepValueTrailing}
        />
        <MetricRow
          isDark={isDark}
          icon={ICON_STEPS}
          gradientIndex={9}
          title="Steps today"
          subtitle={stepsGoalLabel}
          value={formatStepsForDisplay(metrics.stepCount)}
        />
        <MetricRow
          isDark={isDark}
          icon={ICON_WATER}
          gradientIndex={1}
          title="Water intake"
          subtitle={waterGoalLabel}
          value={waterDisplay.value}
          valueSuffix={waterDisplay.valueSuffix}
        />
        <MetricRow
          isDark={isDark}
          icon={ICON_ENERGY}
          gradientIndex={4}
          title="Energy level"
          subtitle={energySubtitle}
          value={energyDisplay.value}
          valueSuffix={energyDisplay.valueSuffix}
        />
        <MetricRow
          isDark={isDark}
          icon={ICON_SORENESS}
          gradientIndex={7}
          title="Soreness level"
          subtitle={sorenessSubtitle}
          value={sorenessDisplay.value}
          valueSuffix={sorenessDisplay.valueSuffix}
        />
        <MetricRow
          isDark={isDark}
          icon={ICON_STRESS}
          gradientIndex={10}
          title="Stress level"
          subtitle={stressSubtitle}
          value={stressDisplay.value}
          valueSuffix={stressDisplay.valueSuffix}
          trailing={stressRowTrailing}
          isLast
        />
      </NbCard>

      <WorkoutLoggedCard
        workoutTitle={metrics.workoutTitle}
        workoutSubtitle={metrics.workoutSubtitle}
        titleInk={titleInk}
        mutedInk={mutedInk}
        isDark={isDark}
      />

      <ProgressPhotosCard
        titleInk={titleInk}
        mutedInk={mutedInk}
        onOpenProgressPhotos={onOpenProgressPhotos}
      />

      <ClientNoteCard
        clientNoteText={metrics.clientNoteText}
        titleInk={titleInk}
        mutedInk={mutedInk}
        isDark={isDark}
      />
    </View>
  );
};

export default ProgressTab;

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  root: {
    gap: 16,
    paddingTop: 4,
  },
  listCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  rowSub: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 17,
  },
  rowValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
  },
  rowValueSuffix: {
    fontSize: 14,
    fontWeight: '700',
  },
  valueWithSpark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  spark: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 18,
  },
  remindBtn: {
    marginLeft: 8,
    minWidth: 88,
  },
  sideCard: {
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  sideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pill: {
    borderWidth: 2.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  noteCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
  },
  noteBody: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
