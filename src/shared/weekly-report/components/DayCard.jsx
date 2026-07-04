import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { GRADIENTS, useTheme } from '../theme/WeeklyReportThemeContext';
import { GradientBorder } from './GradientBorder';
import { ReportMetricIcon } from './ReportMetricIcon';
import { HOME_STAT_WORKOUT_GRADIENT } from '../../../shared-ui/homeStatGradients';

const CARD_BORDER = GRADIENTS.g4;
const PREVIEW_ICON = { size: 48, imageSize: 24 };
const SECTION_ICON = { size: 44, imageSize: 22 };

const SECTION_THEMES = {
  workout: { gradient: HOME_STAT_WORKOUT_GRADIENT, label: 'WORKOUT', metricKey: 'workout' },
  nutrition: { gradient: GRADIENTS.g1, label: 'NUTRITION', metricKey: 'nutrition' },
  wellness: { gradient: GRADIENTS.g4, label: 'WELLNESS', metricKey: 'energy' },
  notes: { gradient: GRADIENTS.g3, label: 'NOTES', metricKey: 'mood' },
  checkin: { gradient: GRADIENTS.g1, label: 'CHECK-IN NOTES', metricKey: 'stress' },
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d) {
  const parts = d.split('-').map(Number);
  return `${MONTHS[parts[1] - 1]} ${parts[2]}`;
}

function isRestWorkout(workouts = []) {
  if (!workouts.length) return false;
  return workouts.every((w) => /\brest\b|recovery|off day/i.test(String(w?.name || '')));
}

function formatSteps(steps) {
  if (!steps) return '0';
  if (steps >= 1000) return `${(steps / 1000).toFixed(1)}k`;
  return String(steps);
}

function shouldShowDaySummary(day, wellnessCount) {
  const fb = String(day.summaryFallback || '').trim();
  if (!fb) return false;
  if (wellnessCount > 0 && fb.length < 48 && /^(sleep|water|steps|energy|mood|stress|soreness|weight|body fat|workout)/i.test(fb)) {
    return false;
  }
  return true;
}

function PreviewChip({ metricKey, value, label }) {
  const { colors } = useTheme();

  return (
    <View style={styles.previewChip}>
      <ReportMetricIcon metricKey={metricKey} size={PREVIEW_ICON.size} imageSize={PREVIEW_ICON.imageSize} />
      <Text style={[styles.previewValue, { color: colors.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      {label ? (
        <Text style={[styles.previewLabel, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

function GradientSection({ themeKey, children }) {
  const { colors, mode } = useTheme();
  const theme = SECTION_THEMES[themeKey];
  const innerBg = mode === 'dark' ? 'rgba(14,14,22,0.98)' : '#ffffff';

  return (
    <GradientBorder colors={theme.gradient} borderWidth={1.5} radius={18} innerBackground={innerBg}>
      <LinearGradient
        colors={[`${theme.gradient[0]}22`, `${theme.gradient[1]}0A`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.sectionBody}>
        <View style={styles.sectionHeaderRow}>
          <ReportMetricIcon
            metricKey={theme.metricKey}
            size={SECTION_ICON.size}
            imageSize={SECTION_ICON.imageSize}
          />
          <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>{theme.label}</Text>
        </View>
        {children}
      </View>
    </GradientBorder>
  );
}

function MetricTile({ label, value }) {
  const { colors, mode } = useTheme();
  const tileBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <View style={[styles.metricTile, { backgroundColor: tileBg }]}>
      <Text style={[styles.tileLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.tileValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function ExerciseRow({ workout }) {
  const { colors, mode } = useTheme();
  const rowBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <View style={[styles.exerciseRow, { backgroundColor: rowBg }]}>
      <View style={styles.exerciseText}>
        <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{workout.name}</Text>
        {workout.setsDetail ? (
          <Text style={[styles.exerciseSets, { color: colors.textSecondary }]}>
            {workout.setsCount ? `${workout.setsCount} sets · ` : ''}
            {workout.setsDetail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function NotePanel({ themeKey, text }) {
  const { colors, mode } = useTheme();
  const panelBg = mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <GradientSection themeKey={themeKey}>
      <View style={[styles.notePanel, { backgroundColor: panelBg }]}>
        <Text style={[styles.noteQuoteMark, { color: colors.textMuted }]}>“</Text>
        <Text style={[styles.noteBody, { color: colors.textPrimary }]}>{text}</Text>
      </View>
    </GradientSection>
  );
}

export function DayCard({ day, index }) {
  const { colors, mode } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const innerBg = mode === 'dark' ? '#13131e' : '#ffffff';

  const hasWorkouts = (day.workouts || []).length > 0;
  const isTraining = hasWorkouts && !isRestWorkout(day.workouts);
  const isRestDay = day.isRecovery || !isTraining;
  const workoutDayName = day.workoutName?.trim() || null;

  const wellness = useMemo(() => {
    const items = [];
    if (day.energy != null) items.push({ label: 'Energy', value: `${day.energy}/8` });
    if (day.mood != null) items.push({ label: 'Mood', value: `${day.mood}/4` });
    if (day.stress != null) items.push({ label: 'Stress', value: `${day.stress}/8` });
    if (day.soreness != null) items.push({ label: 'Soreness', value: `${day.soreness}/8` });
    if (day.weight != null) items.push({ label: 'Weight', value: `${day.weight} lb` });
    if (day.bodyFat != null) items.push({ label: 'Body fat', value: `${day.bodyFat}%` });
    if (day.workoutRating != null) items.push({ label: 'Lift feel', value: `${day.workoutRating}/8` });
    return items;
  }, [day]);

  const hasNutrition = day.calories > 0 || day.protein > 0 || day.carbs > 0 || day.fat > 0;
  const showSummary = shouldShowDaySummary(day, wellness.length);
  const hasExpandedContent =
    hasWorkouts ||
    isRestDay ||
    wellness.length > 0 ||
    hasNutrition ||
    Boolean(day.notes) ||
    showSummary;

  return (
    <View style={styles.wrap}>
      <GradientBorder
        colors={CARD_BORDER}
        borderWidth={expanded ? 1.75 : 1.25}
        radius={22}
        innerBackground={innerBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Pressable
          testID={`daily-expand-btn-${index}`}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setExpanded((p) => !p);
          }}
          style={styles.inner}
        >
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dateLabel, { color: colors.textPrimary }]}>
                {day.fullDayName || day.dayName}, {fmtDate(day.date)}
              </Text>
              {workoutDayName && isTraining ? (
                <Text style={[styles.workoutDayName, { color: colors.textSecondary }]}>{workoutDayName}</Text>
              ) : null}
            </View>
            <View style={styles.headerRight}>
              {isTraining ? (
                <LinearGradient
                  colors={HOME_STAT_WORKOUT_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.badgeActive}
                >
                  <Ionicons name="flame" size={11} color="#1a1a1a" />
                  <Text style={styles.badgeActiveText}>TRAINING</Text>
                </LinearGradient>
              ) : (
                <View
                  style={[
                    styles.badgeRest,
                    {
                      borderColor: colors.border,
                      backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    },
                  ]}
                >
                  <Ionicons name="bed" size={11} color={colors.textSecondary} />
                  <Text style={[styles.badgeRestText, { color: colors.textSecondary }]}>REST</Text>
                </View>
              )}
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.previewGrid}>
            <PreviewChip metricKey="sleep" value={`${day.sleepHours || 0}h`} label="Sleep" />
            <PreviewChip metricKey="water" value={`${day.waterOz || 0}oz`} label="Water" />
            <PreviewChip metricKey="steps" value={formatSteps(day.steps)} label="Steps" />
            <PreviewChip metricKey="nutrition" value={`${day.calories || 0}`} label="Cal" />
          </View>

          {expanded && hasExpandedContent ? (
            <View style={styles.expanded}>
              {(hasWorkouts || isRestDay) && (
                <GradientSection themeKey="workout">
                  {isTraining ? (
                    <View style={styles.exerciseList}>
                      {workoutDayName ? (
                        <View style={styles.workoutTitleBlock}>
                          <Text style={[styles.workoutTitle, { color: colors.textPrimary }]}>{workoutDayName}</Text>
                          <Text style={[styles.workoutSubtitle, { color: colors.textMuted }]}>
                            {day.workouts.length} exercise{day.workouts.length === 1 ? '' : 's'} logged
                          </Text>
                        </View>
                      ) : null}
                      {day.workouts.map((w, wi) => (
                        <ExerciseRow key={`${day.date}-w-${wi}`} workout={w} />
                      ))}
                    </View>
                  ) : (
                    <Text style={[styles.restDayText, { color: colors.textSecondary }]}>Rest day</Text>
                  )}
                </GradientSection>
              )}

              {hasNutrition ? (
                <GradientSection themeKey="nutrition">
                  <View style={styles.metricGrid}>
                    <MetricTile label="Calories" value={`${day.calories || 0}`} />
                    <MetricTile label="Protein" value={`${day.protein || 0}g`} />
                    <MetricTile label="Carbs" value={`${day.carbs || 0}g`} />
                    <MetricTile label="Fat" value={`${day.fat || 0}g`} />
                  </View>
                </GradientSection>
              ) : null}

              {wellness.length > 0 ? (
                <GradientSection themeKey="wellness">
                  <View style={styles.metricGrid}>
                    {wellness.map((item) => (
                      <MetricTile key={item.label} label={item.label} value={item.value} />
                    ))}
                  </View>
                </GradientSection>
              ) : null}

              {day.notes ? <NotePanel themeKey="notes" text={day.notes} /> : null}

              {showSummary ? <NotePanel themeKey="checkin" text={day.summaryFallback} /> : null}
            </View>
          ) : null}
        </Pressable>
      </GradientBorder>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  inner: { padding: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateLabel: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  workoutDayName: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.15,
    marginTop: 6,
  },
  badgeActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeActiveText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#1a1a1a',
  },
  badgeRest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeRestText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  previewGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 4,
  },
  previewChip: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  previewLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  expanded: {
    marginTop: 16,
    gap: 12,
  },
  sectionBody: {
    padding: 14,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  exerciseList: {
    gap: 8,
  },
  workoutTitleBlock: {
    gap: 2,
    marginBottom: 4,
  },
  workoutTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  workoutSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  exerciseRow: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  exerciseText: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  exerciseSets: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    lineHeight: 18,
  },
  restDayText: {
    fontSize: 15,
    fontWeight: '600',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricTile: {
    width: '47%',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 4,
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tileValue: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  notePanel: {
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  noteQuoteMark: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 24,
    opacity: 0.35,
  },
  noteBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
