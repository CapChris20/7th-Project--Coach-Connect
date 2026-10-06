// Trainer snapshot on the weekly report: workout adherence, red flags, and the week's note.
// Flow: read week.trainerInsights → skip the section if every piece is empty → stack the cards that have data.
// Used by WeeklyReportBody under the sleep chart.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GRADIENTS, useTheme } from '../weekly-report/reportColorSettings';
import { ColorBorder } from './ColorBorder';
import { StatIcon } from './StatIcon';
import { HOME_STAT_WORKOUT_GRADIENT } from '../../look-and-feel/homeStatColors';

// ===== NAMED CONSTANTS =====

const DARK_MODE = 'dark';
const ALERT_TONE = 'alert';
const COACH_NOTE_SOURCE = 'coach';
const DARK_CARD_BACKGROUND = 'rgba(14,14,22,0.98)';
const LIGHT_CARD_BACKGROUND = '#ffffff';

// ===== HELPER FUNCTIONS =====

function isDarkMode(mode) {
  return mode === DARK_MODE;
}

function cardInnerBackground(mode) {
  if (isDarkMode(mode)) return DARK_CARD_BACKGROUND;
  return LIGHT_CARD_BACKGROUND;
}

function isAlertFlag(flag) {
  return flag.tone === ALERT_TONE;
}

function shouldShowWorkoutAdherence(workoutAdherence) {
  return workoutAdherence && (workoutAdherence.completed > 0 || workoutAdherence.planned != null);
}

function hasRedFlags(redFlags) {
  return redFlags?.length > 0;
}

function hasTrainerNote(trainerNote) {
  return Boolean(trainerNote?.text);
}

function isCoachNote(note) {
  return note.source === COACH_NOTE_SOURCE;
}

function RedFlagChip({ flag, colors, mode }) {
  const isAlert = isAlertFlag(flag);
  const gradient = isAlert ? GRADIENTS.g1 : GRADIENTS.g3;
  const innerBackground = cardInnerBackground(mode);

  return (
    <ColorBorder colors={gradient} borderWidth={1.25} radius={14} innerBackground={innerBackground} style={styles.flagWrap}>
      <View style={styles.flagInner}>
        <View style={[styles.flagIconRing, { backgroundColor: isDarkMode(mode) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
          <Ionicons
            name={isAlert ? 'alert-circle' : 'warning'}
            size={16}
            color={colors.textPrimary}
          />
        </View>
        <View style={styles.flagText}>
          <Text style={[styles.flagTitle, { color: colors.textPrimary }]}>{flag.title}</Text>
          <Text style={[styles.flagDetail, { color: colors.textSecondary }]}>{flag.detail}</Text>
        </View>
      </View>
    </ColorBorder>
  );
}

function WorkoutAdherenceCard({ adherence, colors, mode }) {
  const innerBackground = cardInnerBackground(mode);
  const adherencePercent = adherence.pct;

  return (
    <ColorBorder colors={HOME_STAT_WORKOUT_GRADIENT} borderWidth={1.5} radius={20} innerBackground={innerBackground}>
      <LinearGradient
        colors={[`${HOME_STAT_WORKOUT_GRADIENT[0]}22`, `${HOME_STAT_WORKOUT_GRADIENT[1]}0A`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.adherenceBody}>
        <StatIcon metricKey="workout" size={52} imageSize={26} />
        <View style={styles.adherenceCopy}>
          <Text style={[styles.adherenceEyebrow, { color: colors.textMuted }]}>WORKOUT ADHERENCE</Text>
          <Text style={[styles.adherenceValue, { color: colors.textPrimary }]}>{adherence.label}</Text>
          <Text style={[styles.adherenceSub, { color: colors.textSecondary }]}>{adherence.sublabel}</Text>
        </View>
        {adherencePercent != null ? (
          <View style={[styles.pctRing, { borderColor: colors.border }]}>
            <Text style={[styles.pctText, { color: colors.textPrimary }]}>{adherencePercent}%</Text>
          </View>
        ) : null}
      </View>
    </ColorBorder>
  );
}

function TrainerNoteCard({ note, colors, mode }) {
  const innerBackground = cardInnerBackground(mode);
  const isFromCoach = isCoachNote(note);

  return (
    <ColorBorder colors={GRADIENTS.g4} borderWidth={1.5} radius={20} innerBackground={innerBackground}>
      <LinearGradient
        colors={[`${GRADIENTS.g4[0]}20`, `${GRADIENTS.g4[1]}0A`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.noteBody}>
        <View style={styles.noteHeader}>
          <StatIcon metricKey="mood" size={48} imageSize={24} />
          <View style={styles.noteHeaderText}>
            <Text style={[styles.noteEyebrow, { color: colors.textMuted }]}>
              {isFromCoach ? 'COACH NOTE' : 'WEEKLY NOTE'}
            </Text>
            <Text style={[styles.noteHint, { color: colors.textSecondary }]}>
              {isFromCoach ? 'From your trainer' : 'Auto recap from logged data'}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.noteBubble,
            { backgroundColor: isDarkMode(mode) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
          ]}
        >
          <Text style={[styles.noteText, { color: colors.textPrimary }]}>{note.text}</Text>
        </View>
      </View>
    </ColorBorder>
  );
}

// ===== MAIN FUNCTION =====

/**
 * "At a glance" trainer block for one week. Renders nothing when the week has no insights.
 * @param {{ week: { trainerInsights?: object } }} props
 */
export function TrainerTipsForWeek({ week }) {
  const { colors, mode } = useTheme();
  const insights = week.trainerInsights;
  if (!insights) return null;

  const { workoutAdherence, redFlags, trainerNote } = insights;
  const showAdherence = shouldShowWorkoutAdherence(workoutAdherence);
  const showFlags = hasRedFlags(redFlags);
  const showNote = hasTrainerNote(trainerNote);

  if (!showAdherence && !showFlags && !showNote) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>TRAINER SNAPSHOT</Text>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>At a glance</Text>
      </View>

      <View style={styles.stack}>
        {showAdherence ? <WorkoutAdherenceCard adherence={workoutAdherence} colors={colors} mode={mode} /> : null}

        {showFlags ? (
          <View
            style={[
              styles.flagsShell,
              {
                backgroundColor: isDarkMode(mode) ? 'rgba(20,20,30,0.55)' : 'rgba(255,255,255,0.7)',
              },
            ]}
          >
            <BlurView intensity={20} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
            <Text style={[styles.flagsTitle, { color: colors.textMuted }]}>NEEDS ATTENTION</Text>
            <View style={styles.flagsGrid}>
              {redFlags.map((flag) => (
                <RedFlagChip key={flag.id} flag={flag} colors={colors} mode={mode} />
              ))}
            </View>
          </View>
        ) : null}

        {showNote ? <TrainerNoteCard note={trainerNote} colors={colors} mode={mode} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  stack: {
    gap: 12,
  },
  adherenceBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
  },
  adherenceCopy: {
    flex: 1,
    gap: 3,
  },
  adherenceEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  adherenceValue: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  adherenceSub: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  pctRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pctText: {
    fontSize: 14,
    fontWeight: '900',
  },
  flagsShell: {
    borderRadius: 20,
    padding: 14,
    overflow: 'hidden',
    gap: 10,
  },
  flagsTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    marginLeft: 2,
  },
  flagsGrid: {
    gap: 8,
  },
  flagWrap: {
    marginBottom: 0,
  },
  flagInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  flagIconRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagText: {
    flex: 1,
    gap: 2,
  },
  flagTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  flagDetail: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  noteBody: {
    padding: 16,
    gap: 12,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noteHeaderText: {
    flex: 1,
    gap: 2,
  },
  noteEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  noteHint: {
    fontSize: 12,
    fontWeight: '500',
  },
  noteBubble: {
    borderRadius: 16,
    padding: 14,
  },
  noteText: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
