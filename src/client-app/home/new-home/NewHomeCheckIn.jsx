// Daily check-in: soreness, energy, stress, mood and post-workout rating in one card with tabs.
// Flow: five saved values load through useCardState → a tab row picks one → tapping a number or mood saves it → trainer is told.
// Used by NewHomeLayout. Values are saved under the same keys the old separate cards used.

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { NbChip } from '../../../look-and-feel/nb/NbChip';
import { NbPill } from '../../../look-and-feel/nb/NbAccentPieces';
import { NbSurface } from '../../../look-and-feel/nb/NbSurface';
import { NB_RADIUS, NB_SPACING, getNbAccent, getNbColors } from '../../../look-and-feel/nb/nbTokens';
import { useCardState } from '../dashboardCardState';

// ===== NAMED CONSTANTS =====

const MOOD_LABELS = ['Very low', 'Low', 'Okay', 'Good', 'Great'];
const NOTIFIED_ACCENT_POSITION = 7;
const QUESTION_FONT_SIZE = 18;
const HINT_FONT_SIZE = 13;
const CHIP_COLUMN_WIDTH = '23%';

// ===== HELPER FUNCTIONS =====

/**
 * @param {number} count
 * @returns {number[]} 1 up to count.
 */
function oneToCount(count) {
  return Array.from({ length: count }, (_, index) => index + 1);
}

/**
 * @param {string|null} savedValue
 * @returns {number} The saved number, or NaN when nothing is saved.
 */
function savedNumber(savedValue) {
  if (savedValue === null || savedValue === undefined || savedValue === '') return NaN;
  return parseInt(String(savedValue), 10);
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {Function} [props.onMetricsChange] Called with { soreness }, { energyLevel } or { stressLevel } after a save.
 * @returns {JSX.Element}
 */
export function NewHomeCheckIn({ onMetricsChange }) {
  // 1. Colors, and the five saved values (the same five keys the old cards used).
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);
  const sorenessState = useCardState('dashboard_soreness', onMetricsChange ? (v) => onMetricsChange({ soreness: v }) : undefined);
  const energyState = useCardState('dashboard_energy', onMetricsChange ? (v) => onMetricsChange({ energyLevel: v }) : undefined);
  const stressState = useCardState('dashboard_stress', onMetricsChange ? (v) => onMetricsChange({ stressLevel: v }) : undefined);
  const moodState = useCardState('dashboard_mood');
  const ratingState = useCardState('dashboard_workout_rating');

  const checks = [
    { id: 'soreness', tab: 'Soreness', question: 'How sore are you?', hint: '1 is fresh, 8 is very sore', count: 8, state: sorenessState },
    { id: 'energy', tab: 'Energy', question: 'How is your energy?', hint: '1 is drained, 8 is charged', count: 8, state: energyState },
    { id: 'stress', tab: 'Stress', question: 'How stressed are you?', hint: '1 is calm, 8 is overwhelmed', count: 8, state: stressState },
    { id: 'mood', tab: 'Mood', question: 'How are you feeling?', hint: '', count: 0, state: moodState },
    { id: 'rating', tab: 'Workout', question: "How was today's session?", hint: '1 is rough, 10 is great', count: 10, state: ratingState },
  ];

  // 2. Which tab is open.
  const [activeId, setActiveId] = useState(checks[0].id);
  const active = checks.find((check) => check.id === activeId);
  const activeNumber = savedNumber(active.state.savedValue);

  // 3. Tab row, then the question and the answers for the open tab.
  const isMood = active.id === 'mood';
  return (
    <NbSurface radius={NB_RADIUS.sheet} innerStyle={styles.cardInner}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {checks.map((check) => {
          const number = savedNumber(check.state.savedValue);
          const hasValue = Number.isFinite(number);
          const valueText = check.id === 'mood' ? MOOD_LABELS[number] : String(number);
          return (
            <NbChip
              key={check.id}
              label={hasValue && valueText ? `${check.tab} · ${valueText}` : check.tab}
              isSelected={check.id === activeId}
              onPress={() => setActiveId(check.id)}
            />
          );
        })}
      </ScrollView>

      <View style={styles.questionRow}>
        <View style={styles.questionText}>
          <Text style={[styles.question, { color: colors.ink }]}>{active.question}</Text>
          {active.hint ? <Text style={[styles.hint, { color: colors.muted }]}>{active.hint}</Text> : null}
        </View>
        {active.state.showNotified ? <NbPill label="Trainer notified" accent={getNbAccent(NOTIFIED_ACCENT_POSITION)} /> : null}
      </View>

      {isMood ? (
        <View style={styles.answerGrid}>
          {MOOD_LABELS.map((moodLabel, index) => (
            <View key={moodLabel} style={styles.moodSlot}>
              <NbChip label={moodLabel} isSelected={activeNumber === index} onPress={() => active.state.save(String(index))} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.answerGrid}>
          {oneToCount(active.count).map((number) => (
            <View key={number} style={styles.numberSlot}>
              <NbChip label={String(number)} isSelected={activeNumber === number} onPress={() => active.state.save(String(number))} />
            </View>
          ))}
        </View>
      )}
    </NbSurface>
  );
}

export default NewHomeCheckIn;

const styles = StyleSheet.create({
  cardInner: { padding: NB_SPACING.large, gap: NB_SPACING.large },
  tabRow: { gap: NB_SPACING.small, paddingRight: NB_SPACING.small, paddingBottom: NB_SPACING.small },
  questionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: NB_SPACING.medium },
  questionText: { flex: 1 },
  question: { fontSize: QUESTION_FONT_SIZE, fontWeight: '800' },
  hint: { fontSize: HINT_FONT_SIZE, fontWeight: '500', marginTop: 2 },
  answerGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: NB_SPACING.small },
  numberSlot: { width: CHIP_COLUMN_WIDTH },
  moodSlot: { width: '31%' },
});
