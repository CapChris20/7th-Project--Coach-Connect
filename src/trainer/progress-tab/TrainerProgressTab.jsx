/**
 * Trainer Progress Tab
 *
 * Purpose: UI screen or component: Trainer Progress Tab. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: (see file)
 *
 * @file-header
 */
/** Trainer dashboard — Progress tab */
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, useWindowDimensions, Platform, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import {
  GradientOutlineText,
  HOME_STAT_ENERGY_GRADIENT,
  HOME_STAT_STRESS_GRADIENT,
  HOME_STAT_MOOD_GRADIENT,
  HOME_STAT_SORENESS_GRADIENT,
  HOME_STAT_WORKOUT_GRADIENT,
} from '../../shared/ui/homeStatGradients';
import {
  GlassCard,
  AuroraHeroBanner,
  Icon,
  ICON_ACCENT,
  SCREEN_WIDTH,
  TabPills,
  TABS,
  CategoryCard,
  ArcProgress,
  BorderedCard,
  TrainerNotesFilesHeroAndWorkspace,
  PremiumTabEmptyState,
  EmptyState,
  getTrainerDashboardLottieSource,
  getTrainerDashboardLottieCaption,
  getClientInitials,
  getClientRosterStats,
  formatClientHeightDisplay,
  getClientSubtext,
  useTrainerTheme,
  PINK,
  CARD_BORDER_PROGRESS,
  CARD_BORDER_NUTRITION,
  CARD_BORDER_CALENDAR,
  GRADIENT_NUTRITION_PROTEIN,
  GRADIENT_NUTRITION_CARBS,
  GRADIENT_NUTRITION_FAT,
  GRADIENT_CALENDAR,
} from '../dashboard/trainerDashboardUi';


const metricValueFillColor = (isDark) => (isDark ? '#FFFFFF' : '#1A1040');

const metricValueStyle = (fontSize) => ({
  fontSize,
  fontWeight: '900',
  letterSpacing: -1,
  lineHeight: Math.round(fontSize * 1.12),
  textAlign: 'center',
});

const ProgressTab = ({ isDark, clientData, todayDailyLog, latestLoggedWeight = null }) => {
  const textColor = isDark ? '#FFFFFF' : '#020617';
  const mutedColor = isDark ? 'rgba(255,255,255,0.56)' : 'rgba(15,23,42,0.72)';
  const subtleLabelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.55)';

  const { width: windowWidth } = useWindowDimensions();
  const [metricsGridWidth, setMetricsGridWidth] = useState(() => Math.max(0, (windowWidth || SCREEN_WIDTH) - 32));

  const beforeWeight = clientData?.beforeWeight ?? null;
  const log = todayDailyLog || {};
  const todayWeight =
    log.dashboard_weight != null && log.dashboard_weight !== ''
      ? Number(log.dashboard_weight)
      : null;
  const lastLoggedWeight =
    latestLoggedWeight != null && latestLoggedWeight !== ''
      ? Number(latestLoggedWeight)
      : null;
  const currentWeight = Number.isFinite(todayWeight)
    ? todayWeight
    : Number.isFinite(lastLoggedWeight)
      ? lastLoggedWeight
      : null;

  const parsedBefore = beforeWeight != null && beforeWeight !== '' ? Number(beforeWeight) : null;
  const hasBefore = Number.isFinite(parsedBefore);
  const hasCurrent = Number.isFinite(currentWeight);
  const diff = hasBefore && hasCurrent ? Number((currentWeight - parsedBefore).toFixed(1)) : null;
  const diffDir = diff == null ? '→' : diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
  const diffColor = diff == null ? 'rgba(148,163,184,0.9)' : diff < 0 ? '#10B981' : diff > 0 ? '#EF4444' : 'rgba(148,163,184,0.9)';

  const bodyFat = log.dashboard_bodyfat != null && log.dashboard_bodyfat !== '' ? String(log.dashboard_bodyfat) : null;

  // Normalize today's workout so structured logs + legacy strings all populate the rich card.
  const structuredWorkoutLog = Array.isArray(log.workoutLog)
    ? log.workoutLog.map((item) => ({
        name: item?.exerciseName || item?.name || item?.label || '',
        sets: Array.isArray(item?.sets) ? item.sets : [],
      }))
    : null;
  const workoutNameRaw = log.dashboard_workout_name != null ? String(log.dashboard_workout_name).trim() : '';
  const legacyWorkoutStr =
    log.dashboard_workouts != null && log.dashboard_workouts !== '' ? String(log.dashboard_workouts).trim() : '';

  // If we only have the legacy multiline string, split it into individual exercise lines.
  const legacyLines = legacyWorkoutStr
    ? legacyWorkoutStr
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const legacyFirstLine = legacyLines[0] || '';
  const legacyExerciseLines = legacyLines.length > 1 ? legacyLines.slice(1) : [];

  const workoutExercises =
    structuredWorkoutLog && structuredWorkoutLog.length > 0
      ? structuredWorkoutLog
      : Array.isArray(log.dashboard_workout_exercises) && log.dashboard_workout_exercises.length > 0
      ? log.dashboard_workout_exercises.map((name) => ({
          name: String(name),
          sets: [],
        }))
      : legacyExerciseLines.length > 0
      ? legacyExerciseLines.map((line) => ({ name: line, sets: [] }))
      : legacyLines.map((line) => ({ name: line, sets: [] }));

  const resolvedWorkoutTitle =
    workoutNameRaw ||
    legacyFirstLine ||
    (workoutExercises.length ? `${workoutExercises.length} exercise${workoutExercises.length === 1 ? '' : 's'}` : '');
  const hasWorkoutToday = !!resolvedWorkoutTitle;

  const sleepVal = log.dashboard_sleep != null && log.dashboard_sleep !== '' ? Number(log.dashboard_sleep) : null;
  const waterVal = log.dashboard_water != null && log.dashboard_water !== '' ? Number(log.dashboard_water) : null;

  const sectionHeaderStyle = {
    color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.55)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 18,
  };

  const gridGap = 12;
  const isTablet = (windowWidth || SCREEN_WIDTH) > 768;
  const cols = isTablet ? 3 : 2;
  const cardWidth = (metricsGridWidth - gridGap * (cols - 1)) / cols;

  const clampPct = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

  const MetricMini = ({ label, value, scale, valueGradient, emptyType, style }) => {
    const hasVal = value != null && value !== '' && Number.isFinite(Number(value));
    const n = hasVal ? Number(value) : null;
    const pct = hasVal ? clampPct(n / scale) : 0;
    const valueColors =
      Array.isArray(valueGradient) && valueGradient.length >= 2 ? valueGradient : HOME_STAT_WORKOUT_GRADIENT;
    const valueFontSize = hasVal && String(value).length >= 5 ? 36 : 44;
    const valueFill = metricValueFillColor(isDark);
    const outlineStroke = Math.max(1, Math.round(valueFontSize * 0.04));
    const todayTint = isDark ? 'rgba(148,163,184,0.9)' : 'rgba(107,114,128,0.78)';
    const emptyLottieSource = emptyType ? getTrainerDashboardLottieSource(emptyType) : null;

    return (
      <View style={[{ width: cardWidth }, style]}>
        <View
          style={{
            borderRadius: 18,
            padding: 1,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(55,65,81,0.9)' : 'rgba(209,213,219,1)',
          }}
        >
          <View
            style={{
              borderRadius: 16,
              padding: 14,
              minHeight: 138,
              backgroundColor: isDark ? '#020617' : '#FFFFFF',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text
                style={{
                  flex: 1,
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                  color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(75,85,99,1)',
                  paddingRight: 6,
                }}
                numberOfLines={1}
              >
                {label}
              </Text>
              {hasVal && emptyLottieSource ? (
                <View pointerEvents="none" style={{ opacity: 0.52 }}>
                  <LottieView source={emptyLottieSource} autoPlay loop style={{ width: 36, height: 36 }} />
                </View>
              ) : null}
            </View>

            {hasVal ? (
              <>
                <GradientOutlineText
                  style={metricValueStyle(valueFontSize)}
                  colors={valueColors}
                  fillColor={valueFill}
                  stroke={outlineStroke}
                >
                  {String(value)}
                </GradientOutlineText>
                <View
                  style={{
                    height: 3,
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.08)',
                    marginTop: 10,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(pct * 100)}%`,
                      height: 3,
                      borderRadius: 999,
                      backgroundColor: '#06B6D4',
                    }}
                  />
                </View>
                <Text style={{ color: todayTint, fontSize: 11, marginTop: 8 }}>Today</Text>
              </>
            ) : emptyLottieSource ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 2, minHeight: 112 }}>
                <LottieView
                  source={emptyLottieSource}
                  autoPlay
                  loop
                  style={{ width: 100, height: 100 }}
                />
                <Text
                  style={{
                    color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                    fontSize: 12,
                    marginTop: 6,
                  }}
                >
                  Not logged
                </Text>
              </View>
            ) : emptyType ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text
                  style={{
                    color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                    fontSize: 13,
                    fontStyle: 'italic',
                  }}
                >
                  No data
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text
                  style={{
                    color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                    fontSize: 13,
                    fontStyle: 'italic',
                  }}
                >
                  No data
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ paddingTop: 4 }}>
      {/* WEIGHT — hero */}
      <View style={{ marginTop: 10 }}>
        <LinearGradient colors={['#FF6B9D', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 2 }}>
          <LinearGradient
            colors={isDark ? ['#1a1a24', '#0f0f14'] : ['#FFFFFF', '#F9FAFB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: 18 }}
          >
            <Text style={{ color: mutedColor, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>WEIGHT</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: subtleLabelColor, fontSize: 12, marginBottom: 6 }}>Before</Text>
                <Text style={{ fontSize: 40, fontWeight: '900', color: 'rgba(192,132,252,0.95)', letterSpacing: -1 }}>
                  {hasBefore ? parsedBefore : '—'}
                </Text>
              </View>

              <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingBottom: 6 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: diffColor }}>{diffDir}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: diffColor, marginTop: 4 }}>
                  {diff == null ? '—' : `${Math.abs(diff)} lbs`}
                </Text>
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: subtleLabelColor, fontSize: 12, marginBottom: 6 }}>Current</Text>
                <Text style={{ fontSize: 40, fontWeight: '900', color: '#06B6D4', letterSpacing: -1 }}>
                  {hasCurrent ? currentWeight : '—'}
                </Text>
              </View>
            </View>

            {bodyFat ? (
              <View style={{ marginTop: 14, alignSelf: 'flex-start' }}>
                <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,107,157,0.35)', backgroundColor: 'rgba(255,107,157,0.10)' }}>
                  <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#0B1220', fontSize: 11, fontWeight: '700' }}>Body Fat: {bodyFat}%</Text>
                </View>
              </View>
            ) : null}
          </LinearGradient>
        </LinearGradient>
      </View>

      {/* TODAY'S WORKOUT — hero (read-only) */}
      <View style={{ marginTop: 16 }}>
        <LinearGradient
          colors={['#E91E63', '#FF6B9D', '#C084FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            padding: 2,
            overflow: 'hidden',
            ...(Platform.OS === 'ios' && {
              shadowColor: '#a855f7',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
            }),
            elevation: 4,
          }}
        >
          <View style={{ borderRadius: 20, overflow: 'hidden' }}>
            {/* Left accent rail */}
            <LinearGradient
              colors={['#E91E63', '#FF6B9D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, zIndex: 4 }}
            />

            {/* Rich background */}
            <LinearGradient
              colors={isDark ? ['#1A1F2E', '#0F1419'] : ['#FFFFFF', '#F9FAFB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 20, overflow: 'hidden', minHeight: 132 }}
            >
              {/* Subtle texture */}
              <LinearGradient
                colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)', 'rgba(192,132,252,0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ ...StyleSheet.absoluteFillObject, opacity: 0.55 }}
              />

              <View style={{ padding: 20 }}>
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(75,85,99,1)', fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>
                  TODAY&apos;S WORKOUT
                </Text>

                {hasWorkoutToday ? (
                  <>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: isDark ? '#FFFFFF' : '#020617', marginTop: 10 }} numberOfLines={2}>
                      {resolvedWorkoutTitle}
                    </Text>
                    {workoutExercises.length > 0 ? (
                      <>
                        <View
                          style={{
                            alignSelf: 'flex-start',
                            marginTop: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 999,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(209,213,219,1)',
                          }}
                        >
                          <Text style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(55,65,81,1)', fontSize: 12, fontWeight: '700' }}>
                            {workoutExercises.length} exercise{workoutExercises.length === 1 ? '' : 's'}
                          </Text>
                        </View>

                        {/* Preview first few exercises with sets × reps */}
                        <View style={{ marginTop: 10, gap: 6 }}>
                          {workoutExercises.slice(0, 3).map((ex, idx) => {
                            const name = ex && (ex.exerciseName || ex.name || ex.label || '');
                            const setsArr = Array.isArray(ex?.sets) ? ex.sets : [];
                            const setsCount = setsArr.length;
                            const firstSet = setsArr[0] || {};
                            const repsVal =
                              firstSet.reps != null && String(firstSet.reps).trim() !== ''
                                ? String(firstSet.reps).trim()
                                : null;
                            let meta = '';
                            if (setsCount && repsVal) {
                              meta = `${setsCount}×${repsVal}`;
                            } else if (setsCount) {
                              meta = `${setsCount} set${setsCount === 1 ? '' : 's'}`;
                            }

                            return (
                              <View key={`${name || 'exercise'}_${idx}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                                <LinearGradient
                                  colors={['rgba(233,30,99,0.9)', 'rgba(255,107,157,0.85)', 'rgba(192,132,252,0.85)']}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={{ width: 6, height: 6, borderRadius: 3, marginTop: 6 }}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      color: isDark ? 'rgba(249,250,251,0.96)' : 'rgba(17,24,39,0.95)',
                                      fontSize: 15,
                                      fontWeight: '700',
                                    }}
                                    numberOfLines={1}
                                  >
                                    {name || 'Exercise'}
                                  </Text>
                                  {!!meta && (
                                    <Text
                                      style={{
                                        color: isDark ? 'rgba(156,163,175,0.95)' : 'rgba(75,85,99,1)',
                                        fontSize: 11,
                                        marginTop: 1,
                                      }}
                                      numberOfLines={1}
                                    >
                                      {meta}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </>
                    ) : (
                      <Text
                        style={{
                          color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(107,114,128,1)',
                          fontSize: 13,
                          marginTop: 10,
                        }}
                      >
                        Logged today
                      </Text>
                    )}
                  </>
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center', height: 120, marginTop: 6 }}>
                    <LottieView source={require('../../assets/Lotties for Anatrox/boxer lottie.json')} autoPlay loop style={{ width: 90, height: 90 }} />
                    <Text
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.68)' : 'rgba(107,114,128,1)',
                        fontSize: 14,
                        marginTop: 8,
                      }}
                    >
                      No workout logged
                    </Text>
                  </View>
                )}

                {/* Subtle right-side lottie accent (even when data exists) */}
                <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 14, opacity: 0.6 }}>
                  <LottieView
                    source={require('../../assets/Lotties for Anatrox/boxer lottie.json')}
                    autoPlay
                    loop
                    style={{ width: 52, height: 52 }}
                  />
                </View>
              </View>
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>

      {/* SLEEP & WATER — 2-col with bars */}
      <View style={{ marginTop: 16 }}>
        <Text style={sectionHeaderStyle}>Sleep & Water</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <LinearGradient
              colors={isDark ? ['#020617', '#020617'] : ['#FFFFFF', '#F9FAFB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(209,213,219,1)',
              }}
            >
              <Text
                style={{
                  color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(75,85,99,1)',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                }}
              >
                SLEEP
              </Text>
              {Number.isFinite(sleepVal) ? (
                <>
                  <Text
                    style={{
                      color: isDark ? '#F9FAFB' : '#020617',
                      fontSize: 34,
                      fontWeight: '900',
                      marginTop: 10,
                    }}
                  >
                    {sleepVal}
                  </Text>
                  <View style={{ height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginTop: 10 }}>
                    <View style={{ height: 4, width: `${Math.round(clampPct(sleepVal / 8) * 100)}%`, borderRadius: 999, backgroundColor: '#06B6D4' }} />
                  </View>
                  <Text
                    style={{
                      color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                      fontSize: 11,
                      marginTop: 8,
                    }}
                  >
                    hrs
                  </Text>

                  {/* Subtle right-side lottie accent (even when data exists) */}
                  <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 10, opacity: 0.6 }}>
                    <LottieView source={require('../../assets/Lotties for Anatrox/sleep.json')} autoPlay loop style={{ width: 40, height: 40 }} />
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', height: 96 }}>
                  <LottieView source={require('../../assets/Lotties for Anatrox/sleep.json')} autoPlay loop style={{ width: 70, height: 70 }} />
                  <Text
                    style={{
                      color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Not logged
                  </Text>
                </View>
              )}
            </LinearGradient>
          </View>

          <View style={{ flex: 1 }}>
            <LinearGradient
              colors={isDark ? ['#020617', '#020617'] : ['#FFFFFF', '#F9FAFB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(209,213,219,1)',
              }}
            >
              <Text
                style={{
                  color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(75,85,99,1)',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                }}
              >
                WATER
              </Text>
              {Number.isFinite(waterVal) ? (
                <>
                  <Text
                    style={{
                      color: isDark ? '#F9FAFB' : '#020617',
                      fontSize: 34,
                      fontWeight: '900',
                      marginTop: 10,
                    }}
                  >
                    {waterVal}
                  </Text>
                  <View style={{ height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginTop: 10 }}>
                    <View style={{ height: 4, width: `${Math.round(clampPct(waterVal / 100) * 100)}%`, borderRadius: 999, backgroundColor: '#06B6D4' }} />
                  </View>
                  <Text
                    style={{
                      color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                      fontSize: 11,
                      marginTop: 8,
                    }}
                  >
                    oz
                  </Text>

                  {/* Subtle right-side lottie accent (even when data exists) */}
                  <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 10, opacity: 0.6 }}>
                    <LottieView source={require('../../assets/Lotties for Anatrox/glass water.json')} autoPlay loop style={{ width: 40, height: 40 }} />
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', height: 96 }}>
                  <LottieView source={require('../../assets/Lotties for Anatrox/glass water.json')} autoPlay loop style={{ width: 70, height: 70 }} />
                  <Text
                    style={{
                      color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Not logged
                  </Text>
                </View>
              )}
            </LinearGradient>
          </View>
        </View>
      </View>

      {/* DAILY METRICS — smart grid (body fat removed from main grid) */}
      <View style={{ marginTop: 16 }}>
        <Text style={sectionHeaderStyle}>Daily Metrics</Text>
        <View
          style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap' }}
          onLayout={(e) => {
            const w = e?.nativeEvent?.layout?.width;
            if (typeof w === 'number' && w > 0) setMetricsGridWidth(w);
          }}
        >
          {[
            { key: 'energy', label: 'ENERGY / 8', value: log.dashboard_energy, scale: 8, valueGradient: HOME_STAT_ENERGY_GRADIENT, emptyType: 'energy' },
            { key: 'stress', label: 'STRESS / 8', value: log.dashboard_stress, scale: 8, valueGradient: HOME_STAT_STRESS_GRADIENT, emptyType: 'stress' },
            { key: 'mood', label: 'MOOD / 4', value: log.dashboard_mood, scale: 4, valueGradient: HOME_STAT_MOOD_GRADIENT, emptyType: 'mood' },
            { key: 'soreness', label: 'SORENESS / 8', value: log.dashboard_soreness, scale: 8, valueGradient: HOME_STAT_SORENESS_GRADIENT, emptyType: 'soreness' },
            { key: 'steps', label: 'STEPS', value: log.dashboard_steps, scale: 15000, valueGradient: HOME_STAT_SORENESS_GRADIENT, emptyType: 'steps' },
          ].map((m, idx, arr) => {
            const isEndOfRow = (idx + 1) % cols === 0;
            const isLast = idx === arr.length - 1;
            const hasSingleLastRow = cols === 2 && arr.length % cols === 1;
            const shouldCenter = hasSingleLastRow && isLast && !isEndOfRow;
            return (
              <MetricMini
                key={m.key}
                label={m.label}
                value={m.value}
                scale={m.scale}
                valueGradient={m.valueGradient}
                emptyType={m.emptyType}
                style={{
                  marginLeft: shouldCenter ? (metricsGridWidth - cardWidth) / 2 : 0,
                  marginRight: shouldCenter ? 0 : isEndOfRow ? 0 : gridGap,
                  marginBottom: isLast ? 0 : gridGap,
                }}
              />
            );
          })}
        </View>
      </View>

      {/* TRAINER NOTES — secondary bottom section */}
      {(Array.isArray(log.trainerNotes) && log.trainerNotes.length > 0) ? (
        <View style={{ marginTop: 18 }}>
          <Text style={sectionHeaderStyle}>Trainer Notes</Text>
          {log.trainerNotes.map((note, idx) => (
            <View
              key={note?.id || idx}
              style={{
                backgroundColor: 'rgba(255, 107, 157, 0.10)',
                borderWidth: 1,
                borderColor: 'rgba(255, 107, 157, 0.28)',
                borderRadius: 16,
                padding: 14,
                marginBottom: 10,
                flexDirection: 'row',
                gap: 12,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF6B9D', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="MessageSquare" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 4 }}>From Coach</Text>
                <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 19, marginBottom: 6 }}>
                  {note?.content || ''}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                  {note?.createdAt?.toDate ? note.createdAt.toDate().toLocaleDateString() : (note?.createdAt ? new Date(note.createdAt).toLocaleDateString() : '—')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* keep client note (if present) but visually secondary */}
      {log.dashboard_notes != null && log.dashboard_notes !== '' && (
        <View style={{ marginTop: 22 }}>
          <Text style={[sectionHeaderStyle, { marginTop: 0 }]}>Client note</Text>
          <LinearGradient
            colors={isDark ? ['rgba(255,107,157,0.35)', 'rgba(139,92,246,0.28)'] : ['rgba(236,72,153,0.45)', 'rgba(139,92,246,0.35)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              borderRadius: 18,
              padding: 1,
              marginTop: 4,
            }}
          >
            <View
              style={{
                borderRadius: 17,
                overflow: 'hidden',
                backgroundColor: isDark ? 'rgba(18,18,24,0.96)' : '#FFFFFF',
                flexDirection: 'row',
                alignItems: 'stretch',
              }}
            >
              <View
                style={{
                  width: 4,
                  backgroundColor: PINK,
                  opacity: isDark ? 0.95 : 1,
                }}
              />
              <View style={{ flex: 1, flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16, gap: 14 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(255,107,157,0.14)' : 'rgba(236,72,153,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,107,157,0.28)' : 'rgba(236,72,153,0.22)',
                  }}
                >
                  <Icon name="MessageSquare" size={18} color={PINK} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.5)',
                      fontSize: 11,
                      fontWeight: '700',
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    From client (today)
                  </Text>
                  <Text
                    style={{
                      color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.88)',
                      fontSize: 15,
                      lineHeight: 24,
                      fontWeight: '500',
                    }}
                  >
                    {log.dashboard_notes}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// NUTRITION TAB
// ─────────────────────────────────────────────

export default ProgressTab;
