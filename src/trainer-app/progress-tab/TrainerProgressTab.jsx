// Design Law Progress tab (trainer-home PNG 01/02): one metric list + workout + photos row.
// Flow: read today’s daily log → paint ink list rows → workout card → photos chevron.
// Used by TrainerHomeContent under the client tab pills.
//
// vocab: NbIconChip = gradient accent square with owner handoff art

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

const STEPS_GOAL_DEFAULT = 8000;
const WATER_GOAL_CUPS_DEFAULT = 8;
const OZ_PER_CUP = 8;
const LEVEL_SCALE = 8;

// ===== HELPERS =====

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatSteps(value) {
  if (value == null) return '—';
  return Number(value).toLocaleString();
}

function waterCupsFromLog(ozOrCups) {
  if (ozOrCups == null) return null;
  // Logs store ounces in many paths; Design Law shows cups.
  if (ozOrCups <= 20) return Math.round(ozOrCups);
  return Math.round(ozOrCups / OZ_PER_CUP);
}

function SleepSpark({ isDark }) {
  // Decorative only — Design Law shows a tiny 7-bar sparkline next to sleep.
  const barColor = isDark ? darkColors.nbInk : lightColors.nbInk;
  const heights = [15, 16, 13, 17, 15, 14, 16];
  return (
    <View style={styles.spark}>
      {heights.map((h, i) => (
        <View
          key={`spk-${i}`}
          style={{
            width: 3,
            height: h,
            borderRadius: 1,
            backgroundColor: barColor,
            opacity: 0.55 + (i % 3) * 0.12,
          }}
        />
      ))}
    </View>
  );
}

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
  const ink = isDark ? darkColors.nbInk : lightColors.nbInk;
  const muted = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  return (
    <View
      style={[
        styles.row,
        !isLast
          ? {
              borderBottomWidth: 2,
              borderBottomColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
            }
          : null,
      ]}
    >
      <NbIconChip source={icon} index={gradientIndex} size={40} />
      <View style={styles.grow}>
        <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.rowSub, { color: muted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing || (
        <Text style={[styles.rowValue, { color: ink }]} numberOfLines={1}>
          {value}
          {valueSuffix ? (
            <Text style={[styles.rowValueSuffix, { color: muted }]}>{valueSuffix}</Text>
          ) : null}
        </Text>
      )}
    </View>
  );
}

// ===== MAIN =====

/**
 * Progress tab body for one trainee — Design Law list, not old mini-card grid.
 * @param {object} props
 */
const ProgressTab = ({
  isDark,
  clientData,
  todayDailyLog,
  latestLoggedWeight = null,
  onRemindStress,
  onOpenProgressPhotos,
}) => {
  const ink = isDark ? darkColors.nbInk : lightColors.nbInk;
  const muted = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const log = todayDailyLog || {};

  const todayWeight = finiteOrNull(log.dashboard_weight);
  const currentWeight = resolveTrainerProgressCurrentWeight({
    todayDashboardWeight: todayWeight,
    latestLoggedWeight,
    profileWeight: clientData?.profileWeight ?? clientData?.currentWeight,
  });

  const sleepVal = finiteOrNull(log.dashboard_sleep);
  const stepsVal = finiteOrNull(log.dashboard_steps);
  const waterVal = waterCupsFromLog(finiteOrNull(log.dashboard_water));
  const energyVal = finiteOrNull(log.dashboard_energy);
  const sorenessVal = finiteOrNull(log.dashboard_soreness);
  const stressVal = finiteOrNull(log.dashboard_stress);

  const workoutNameRaw =
    log.dashboard_workout_name != null ? String(log.dashboard_workout_name).trim() : '';
  const legacyWorkoutStr =
    log.dashboard_workouts != null && log.dashboard_workouts !== ''
      ? String(log.dashboard_workouts).trim()
      : '';
  const workoutTitle = workoutNameRaw || legacyWorkoutStr.split('\n')[0] || null;
  const workoutRating = finiteOrNull(log.dashboard_workout_rating ?? log.workoutRating);

  const sorenessNote =
    (log.dashboard_soreness_note && String(log.dashboard_soreness_note).trim()) ||
    (log.injuryNote && String(log.injuryNote).trim()) ||
    null;

  const stepsGoal = STEPS_GOAL_DEFAULT;
  const waterGoal = WATER_GOAL_CUPS_DEFAULT;

  const weightLine =
    currentWeight != null ? `${currentWeight} lb` : 'Weight not logged';

  return (
    <View style={styles.root}>
      <NbCard style={styles.listCard} noShadow={false}>
        <MetricRow
          isDark={isDark}
          icon={ICON_SLEEP}
          gradientIndex={6}
          title="Sleep hours"
          subtitle={sleepVal != null ? 'Last 7 nights' : 'Not logged yet'}
          value={sleepVal != null ? String(sleepVal) : '—'}
          valueSuffix={sleepVal != null ? ' h' : ''}
          trailing={
            sleepVal != null ? (
              <View style={styles.valueWithSpark}>
                <SleepSpark isDark={isDark} />
                <Text style={[styles.rowValue, { color: ink }]} numberOfLines={1}>
                  {sleepVal}
                  <Text style={[styles.rowValueSuffix, { color: muted }]}> h</Text>
                </Text>
              </View>
            ) : undefined
          }
        />
        <MetricRow
          isDark={isDark}
          icon={ICON_STEPS}
          gradientIndex={9}
          title="Steps today"
          subtitle={`Goal ${stepsGoal.toLocaleString()}`}
          value={formatSteps(stepsVal)}
        />
        <MetricRow
          isDark={isDark}
          icon={ICON_WATER}
          gradientIndex={1}
          title="Water intake"
          subtitle={`Goal ${waterGoal} cups`}
          value={waterVal != null ? String(waterVal) : '—'}
          valueSuffix={waterVal != null ? ' cups' : ''}
        />
        <MetricRow
          isDark={isDark}
          icon={ICON_ENERGY}
          gradientIndex={4}
          title="Energy level"
          subtitle={energyVal != null ? 'Rated today' : 'Not logged yet'}
          value={energyVal != null ? String(energyVal) : '—'}
          valueSuffix={energyVal != null ? ` / ${LEVEL_SCALE}` : ''}
        />
        <MetricRow
          isDark={isDark}
          icon={ICON_SORENESS}
          gradientIndex={7}
          title="Soreness level"
          subtitle={sorenessNote || (sorenessVal != null ? 'Logged today' : 'Not logged yet')}
          value={sorenessVal != null ? String(sorenessVal) : '—'}
          valueSuffix={sorenessVal != null ? ` / ${LEVEL_SCALE}` : ''}
        />
        <MetricRow
          isDark={isDark}
          icon={ICON_STRESS}
          gradientIndex={10}
          title="Stress level"
          subtitle={stressVal != null ? 'Logged today' : 'Stress not logged yet'}
          value={stressVal != null ? String(stressVal) : '—'}
          valueSuffix={stressVal != null ? ` / ${LEVEL_SCALE}` : ''}
          trailing={
            stressVal == null ? (
              <NbButton variant="ghost" sm onPress={onRemindStress} style={styles.remindBtn}>
                Remind
              </NbButton>
            ) : undefined
          }
          isLast
        />
      </NbCard>

      <NbCard style={styles.sideCard}>
        <View style={styles.sideRow}>
          <NbIconChip source={ICON_DUMBBELLS} index={2} size={40} />
          <View style={styles.grow}>
            <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={2}>
              {workoutTitle || 'No workout logged'}
            </Text>
            <Text style={[styles.rowSub, { color: muted }]} numberOfLines={2}>
              {workoutTitle
                ? workoutRating != null
                  ? `Today · rated ${workoutRating} of 10`
                  : `Today · ${weightLine}`
                : weightLine}
            </Text>
          </View>
          {workoutTitle ? (
            <View
              style={[
                styles.pill,
                {
                  borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
                  backgroundColor: isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip,
                },
              ]}
            >
              <Text style={[styles.pillText, { color: ink }]} numberOfLines={1}>
                Logged
              </Text>
            </View>
          ) : null}
        </View>
      </NbCard>

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onOpenProgressPhotos}
        disabled={!onOpenProgressPhotos}
      >
        <NbCard style={styles.sideCard}>
          <View style={styles.sideRow}>
            <NbIconChip source={ICON_PHOTOS} index={0} size={40} />
            <View style={styles.grow}>
              <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>
                Progress photos
              </Text>
              <Text style={[styles.rowSub, { color: muted }]} numberOfLines={1}>
                Open gallery
              </Text>
            </View>
            <ChevronRight size={18} color={ink} strokeWidth={3} />
          </View>
        </NbCard>
      </TouchableOpacity>

      {log.dashboard_notes != null && String(log.dashboard_notes).trim() !== '' ? (
        <View
          style={[
            styles.noteCard,
            {
              borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
              backgroundColor: isDark ? darkColors.nbSurface : lightColors.nbSurface,
            },
          ]}
        >
          <Text style={[styles.noteTitle, { color: ink }]}>Note from client</Text>
          <Text style={[styles.noteBody, { color: muted }]}>{String(log.dashboard_notes)}</Text>
        </View>
      ) : null}
    </View>
  );
};

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

export default ProgressTab;
