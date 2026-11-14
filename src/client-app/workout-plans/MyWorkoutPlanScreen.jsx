// Client "My workout plan" — Design Law Plan | Notes | Videos tabs.
// Flow: header + segmented → Plan (week strip, today hero, exercises, rest of week)
//       → Notes (timeline / important / nutrition + PDF + Share) → Videos slot.
// Used by CreateWorkoutPlanScreen / WorkoutPlanView when a client opens a saved plan.
// Read order: constants → helpers → UI pieces → MyWorkoutPlanScreen main → styles → PLUMBING.
//
// vocab: HardShadow = solid offset shadow sibling (no blur); nbFill = primary block (black light / white dark)
// Manipulate here: MIN_MINUTES_PER_EXERCISE (11), WEEK_LETTERS, TAB_SEGMENTS labels

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FORM_SCROLL_PROPS, useModalScrollBottomPad, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { lightColors, darkColors, nb, spacing, borderRadius, accentGradients } from '../../look-and-feel/colorPalette';
import HardShadow from '../../look-and-feel/HardShadow';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbSegmented from '../../look-and-feel/NbSegmented';
import NbPill from '../../look-and-feel/NbPill';
import NbIconChip from '../../look-and-feel/NbIconChip';
import ExerciseVideosTab from '../../workouts/exercise-videos/ExerciseVideosTab';
import { rootNavigate } from '../../navigation/openScreenFromAnywhere';
import { CLIENT_ROUTES } from '../../navigation/screenNames';

import iconWeek from '../../assets/icons/handoff/week.png';
import iconJourney from '../../assets/icons/handoff/journey.png';
import iconInjury from '../../assets/icons/handoff/injury.png';
import iconProtein from '../../assets/icons/handoff/protein.png';
import iconMuscle from '../../assets/icons/handoff/muscle.png';
import iconSleeping from '../../assets/icons/handoff/sleeping.png';
import iconDumbbells from '../../assets/icons/handoff/dumbbells.png';

// ===== NAMED CONSTANTS =====

const TAB_PLAN = 'plan';
const TAB_NOTES = 'notes';
const TAB_VIDEOS = 'videos';
const TAB_SEGMENTS = [
  { id: TAB_PLAN, label: 'Plan' },
  { id: TAB_NOTES, label: 'Notes' },
  { id: TAB_VIDEOS, label: 'Videos' },
];

const SCREEN_TITLE = 'My workout plan';
const DEFAULT_WEEKS_REMAINING = 4;
const DEFAULT_FOCUS_SUMMARY = 'Complete muscle building program';
const DEFAULT_HERO_TITLE = 'Your Workout Plan';
const DEFAULT_SESSION_TITLE = 'Training';
const DEFAULT_RECOVERY_LABEL = 'Recovery focus';
const DEFAULT_RECOVERY_FALLBACK = 'Light movement & rest';
const DEFAULT_REST_SHORT = 'Rest';
const SHORT_DAY_LETTERS = 3;
const LABEL_WORD_CAP = 6;
const LABEL_CHAR_CAP = 44;
const LABEL_CHAR_TRIM = 41;
const LABEL_CUT_MIN_CHARS = 8;
const STEP_MIN_CHARS = 8;
const SHEET_HEIGHT_RATIO = 0.92;
const SHELL_BOTTOM_INSET = 16;
const MODAL_SCROLL_PAD = 56;
// Manipulate here: rough session length when plan has no estimatedTime
const MIN_MINUTES_PER_EXERCISE = 11;

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEK_SHORTS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const WEEK_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEK_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const RECOVERY_TYPE_RULES = [
  { test: /walk|cardio|jog|run|hike/i, type: 'Walking' },
  { test: /yoga/i, type: 'Yoga' },
  { test: /stretch|mobil|flex/i, type: 'Stretching' },
  { test: /foam\s*roll/i, type: 'Foam Roll' },
  { test: /sleep|rest|nap/i, type: 'Sleep' },
  { test: /water|hydra|drink/i, type: 'Hydration' },
  { test: /nutri|meal|eat|food|prep/i, type: 'Nutrition' },
  { test: /breath|meditat|mindful/i, type: 'Mindfulness' },
];

const RECOVERY_FOCUS_RULES = [
  { test: /muscle|sore|blood\s*flow|circulation/i, focus: 'Muscle recovery' },
  { test: /stress|mental|mind/i, focus: 'Mental health' },
  { test: /sleep|energy/i, focus: 'Energy' },
  { test: /mobil|flex/i, focus: 'Mobility' },
];

const DEFAULT_RECOVERY_TYPE = 'Activity';
const DEFAULT_RECOVERY_FOCUS = 'Recovery';

// ===== HELPER FUNCTIONS =====

function paletteFor(isDark) {
  return isDark ? darkColors : lightColors;
}

function normalizeDayShort(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, SHORT_DAY_LETTERS);
}

function dayTitleSeparator(rawDay) {
  if (rawDay.includes('—')) return '—';
  if (rawDay.includes('–')) return '–';
  return null;
}

function trimmedNonEmptyParts(rawParts) {
  const kept = [];
  for (let index = 0; index < rawParts.length; index += 1) {
    const trimmed = String(rawParts[index] || '').trim();
    if (!trimmed) continue;
    kept.push(trimmed);
  }
  return kept;
}

function sessionTitleLines(day) {
  const dayRecord = day || {};
  const rawDay = String(dayRecord.day || '').trim();
  const focus = String(dayRecord.focus || '').trim();
  const separator = dayTitleSeparator(rawDay);

  if (separator) {
    const parts = trimmedNonEmptyParts(rawDay.split(separator));
    const title = parts[0] || rawDay;
    const subtitleFromParts = parts.slice(1).join(' · ');
    const subtitle = subtitleFromParts || focus;
    return { title, subtitle };
  }

  const focusBits = trimmedNonEmptyParts(focus.split(/\s*·\s*/));
  if (focusBits.length >= 2) {
    return {
      title: focusBits[0],
      subtitle: focusBits.slice(1).join(' · '),
    };
  }

  // Prefer focus as the hero title when it reads like "Lower body"
  const focusLooksLikeRest = /^rest/i.test(focus);
  if (focus && !focusLooksLikeRest) {
    return { title: focus, subtitle: rawDay };
  }
  return { title: rawDay || DEFAULT_SESSION_TITLE, subtitle: focus };
}

function parseSetsRepsRest(ex) {
  let sets = String(ex.sets != null ? ex.sets : '—').trim();
  let reps = String(ex.reps != null ? ex.reps : '—').trim();
  const combined = String(ex.sets || '');
  if (/[×x]/i.test(combined)) {
    const parts = combined.split(/[×x]/i);
    sets = (parts[0] || '').trim() || sets;
    reps = (parts[1] || '').trim() || reps;
  }
  let rest = String(ex.rest || '').trim();
  rest = rest.replace(/\s*rest\s*$/i, '').trim();
  if (!rest) rest = '—';
  return { sets, reps, rest };
}

/** PNG-style meta: "3 × 8 · 135 lb" (weight preferred over rest). */
function formatExerciseListMeta(ex) {
  const { sets, reps } = parseSetsRepsRest(ex);
  const mid = `${sets} × ${reps}`;
  const weight = String(ex.weight || ex.startingWeight || '').trim();
  if (weight) {
    const withUnit = /\b(lb|lbs|kg|#)\b/i.test(weight) ? weight : `${weight} lb`;
    return `${mid} · ${withUnit}`;
  }
  const equipment = inferEquipment(ex);
  if (equipment === 'Bodyweight') return `${mid} · Bodyweight`;
  return mid;
}

function inferEquipment(ex) {
  const explicit = String(ex.equipment || '').trim();
  if (explicit) return explicit;
  const blob = `${ex.name || ''} ${ex.muscle || ''}`.toLowerCase();
  if (/barbell|bb\b|squat|deadlift|hip thrust|bench/i.test(blob) && !/dumbbell|db\b/i.test(blob)) {
    return 'Barbell';
  }
  if (/dumbbell|db\b|split squat|goblet/i.test(blob)) return 'Dumbbell';
  if (/cable/i.test(blob)) return 'Cable';
  if (/machine|press/i.test(blob) && !/bench press/i.test(blob)) return 'Machine';
  if (/bodyweight|calf raise|pull-?up|push-?up|plank/i.test(blob)) return 'Bodyweight';
  return '';
}

function keepNonEmptyTrimmed(parts) {
  const kept = [];
  for (let index = 0; index < parts.length; index += 1) {
    const trimmed = String(parts[index] || '').trim();
    if (!trimmed) continue;
    kept.push(trimmed);
  }
  return kept;
}

function splitTips(text) {
  const tipText = String(text || '').trim();
  if (!tipText) return [];
  const parts = keepNonEmptyTrimmed(tipText.split(/(?<=[.!?])\s+/));
  if (parts.length > 0) return parts;
  return [tipText];
}

function splitLegacyNote(raw) {
  const lines = keepNonEmptyTrimmed(raw.split(/\n+/));
  if (lines.length > 1) return lines;
  const byArrow = keepNonEmptyTrimmed(raw.split(/\s*(?:→|➝|->)\s*/));
  if (byArrow.length > 1) return byArrow;
  const sentences = splitTips(raw);
  if (sentences.length > 0) return sentences;
  return [raw];
}

function recoveryItemIsUsable(activity) {
  if (!activity || typeof activity !== 'object') return false;
  if (typeof activity.label !== 'string') return false;
  if (!activity.label.trim()) return false;
  return true;
}

function recoveryItemsFromActivities(recoveryActivities) {
  const items = [];
  for (let index = 0; index < recoveryActivities.length; index += 1) {
    const activity = recoveryActivities[index];
    if (!recoveryItemIsUsable(activity)) continue;
    items.push({
      label: extractShortLabel(activity.label),
      detail: String(activity.detail || '').trim(),
    });
  }
  return items;
}

function recoveryItemsFromLegacyNote(day) {
  const dayRecord = day || {};
  const noteText = dayRecord.recoveryNote || dayRecord.focus || '';
  const raw = String(noteText).trim();
  if (!raw) {
    return [{ label: DEFAULT_RECOVERY_FALLBACK, detail: '' }];
  }

  const segments = splitLegacyNote(raw);
  const items = [];
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    items.push({
      label: extractShortLabel(segment),
      detail: segment.trim(),
    });
  }
  return items;
}

function toRecoveryItems(day) {
  // Prefer structured recoveryActivities when the plan saved them; else parse the old note string.
  const dayRecord = day || {};
  const recoveryActivities = dayRecord.recoveryActivities;
  const hasStructuredActivities =
    Array.isArray(recoveryActivities) && recoveryActivities.length > 0;
  if (hasStructuredActivities) {
    return recoveryItemsFromActivities(recoveryActivities);
  }
  return recoveryItemsFromLegacyNote(day);
}

function extractShortLabel(seg) {
  let labelText = String(seg || '').trim().replace(/\s+/g, ' ');
  if (!labelText) return DEFAULT_RECOVERY_LABEL;
  labelText = labelText.replace(/^[-–—•*]\s*/, '').replace(/\.\s*$/, '');
  labelText = labelText
    .replace(/^Follow\s+with\s+/i, '')
    .replace(/^Prioritize\s+/i, '')
    .replace(/^Focus\s+on\s+/i, '')
    .replace(/^Consider\s+(doing\s+)?/i, '')
    .replace(/^Use\s+this\s+time\s+to\s+/i, '')
    .replace(/^Try\s+(to\s+)?/i, '')
    .replace(/^Aim\s+for\s+/i, '')
    .replace(/^If\s+you\s+feel\s+\w+,\s*/i, '')
    .replace(/^Given\s+[^,]+,\s*/i, '')
    .replace(/^A\s+(?=\d)/i, '');
  labelText = labelText.charAt(0).toUpperCase() + labelText.slice(1);
  const cutPoints = /\s+(?:—|--|to\s+(?:promote|reduce|help|improve|support|aid|maintain|prevent|enhance|avoid|ensure|allow|boost|keep|build|maximize|minimize|flush|speed|accelerate))\b|\s+(?:outdoors|indoors|especially|throughout|tonight|today|this\s+week|for\s+the\s+(?:next|rest|week|upcoming)|focus(?:ing)?\s+on|targeting|this\s+helps|which\s+helps|helps\s|if\s+you|and\s+dr)|\s*[;:]\s*/i;
  const beforeCut = labelText.split(cutPoints)[0].trim();
  if (beforeCut && beforeCut.length >= LABEL_CUT_MIN_CHARS) labelText = beforeCut;
  const words = labelText.split(/\s+/);
  if (words.length > LABEL_WORD_CAP) labelText = words.slice(0, LABEL_WORD_CAP).join(' ');
  if (labelText.length > LABEL_CHAR_CAP) labelText = labelText.slice(0, LABEL_CHAR_TRIM).replace(/\s+\S*$/, '');
  return labelText || DEFAULT_RECOVERY_LABEL;
}

function recoveryDayDisplayName(day) {
  const dayRecord = day || {};
  const cleanedDayName = String(dayRecord.day || '').replace(/^\?\s*/, '').trim();
  if (cleanedDayName) return cleanedDayName;
  return String(dayRecord.short || DEFAULT_REST_SHORT);
}

function muscleToTargets(muscle) {
  if (!muscle) return [];
  return keepNonEmptyTrimmed(String(muscle).split(/[,/|]/));
}

function firstMatchingType(labelText) {
  for (const rule of RECOVERY_TYPE_RULES) {
    if (rule.test.test(labelText)) return rule.type;
  }
  return DEFAULT_RECOVERY_TYPE;
}

function firstMatchingFocus(labelText) {
  for (const rule of RECOVERY_FOCUS_RULES) {
    if (rule.test.test(labelText)) return rule.focus;
  }
  return DEFAULT_RECOVERY_FOCUS;
}

function parseRecoveryMeta(label) {
  const labelText = String(label).toLowerCase();
  const durMatch = labelText.match(/(\d[\d–\-]*\s*(?:min(?:ute)?s?|hours?|hr))/i);
  const duration = durMatch ? durMatch[1] : null;
  return {
    duration,
    type: firstMatchingType(labelText),
    focus: firstMatchingFocus(labelText),
  };
}

function splitDetailIntoSteps(detail) {
  if (!detail) return [];
  const parts = detail.split(/(?<=[.!?])\s+/);
  const steps = [];
  for (let index = 0; index < parts.length; index += 1) {
    const trimmed = parts[index].trim();
    if (trimmed.length <= STEP_MIN_CHARS) continue;
    steps.push(trimmed);
  }
  return steps;
}

/** Build Mon–Sun slots so the week strip always has 7 cells. */
function buildWeekSlots(workoutPlan) {
  const byShort = new Map();
  const planDays = workoutPlan || [];
  for (let index = 0; index < planDays.length; index += 1) {
    const short = normalizeDayShort(planDays[index].short);
    if (!short) continue;
    byShort.set(short, planDays[index]);
  }

  const slots = [];
  for (let index = 0; index < WEEK_SHORTS.length; index += 1) {
    const short = WEEK_SHORTS[index];
    slots.push({
      letter: WEEK_LETTERS[index],
      short,
      fullName: WEEK_FULL[index],
      index,
      day: byShort.get(short) || null,
    });
  }
  return slots;
}

function estimateSessionMinutes(day) {
  const dayRecord = day || {};
  let raw = dayRecord.estimatedTime;
  if (raw == null) raw = dayRecord.sessionDuration;
  if (raw == null) raw = dayRecord.duration;
  if (raw != null && String(raw).trim()) {
    const asNum = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    return String(raw).trim();
  }
  const exercises = dayRecord.exercises || [];
  const count = exercises.length;
  if (!count) return null;
  return count * MIN_MINUTES_PER_EXERCISE;
}

function sessionOrdinal(day, workoutPlan) {
  const dayRecord = day || {};
  const training = [];
  const planDays = workoutPlan || [];
  for (let index = 0; index < planDays.length; index += 1) {
    if (planDays[index].rest) continue;
    training.push(planDays[index]);
  }

  let matchIndex = -1;
  for (let index = 0; index < training.length; index += 1) {
    const candidate = training[index];
    if (candidate === day) {
      matchIndex = index;
      break;
    }
    const sameShort =
      normalizeDayShort(candidate.short) === normalizeDayShort(dayRecord.short);
    const sameFocus = candidate.focus === dayRecord.focus;
    if (sameShort && sameFocus) {
      matchIndex = index;
      break;
    }
  }

  const sessionTotal = Math.max(1, training.length);
  if (matchIndex < 0) {
    return { sessionNumber: 1, sessionTotal };
  }
  return { sessionNumber: matchIndex + 1, sessionTotal };
}

/**
 * Turn timeline prose into { title, body } steps for the Notes card.
 * Accepts numbered lines, bullets, or blank-line paragraphs.
 */
function numberedTimelineStepFromLine(line) {
  const match = line.match(/^(?:step\s*)?(\d+)[.)\-:]?\s*(.+)$/i);
  if (!match) return null;

  const body = match[2].trim();
  const titleMatch = body.match(/^([^.:—–-]+)[.:—–-]\s*(.+)$/);
  if (titleMatch) {
    return { title: titleMatch[1].trim(), body: titleMatch[2].trim() };
  }

  // "Weeks 1 to 2 Learn the lifts..." — first clause as title when possible
  const weekMatch = body.match(
    /^(weeks?\s+[\d\s]+(?:to|-)\s*[\d]+|week\s+\d+)\s*[.:—–-]?\s*(.*)$/i,
  );
  if (weekMatch) {
    let weekBody = weekMatch[2].trim();
    if (!weekBody) weekBody = weekMatch[1].trim();
    return { title: weekMatch[1].trim(), body: weekBody };
  }

  return { title: `Step ${match[1]}`, body };
}

function timelineStepFromPlainLine(line, stepNumber) {
  const titleMatch = line.match(/^([^.:—–-]+)[.:—–-]\s*(.+)$/);
  if (titleMatch) {
    return { title: titleMatch[1].trim(), body: titleMatch[2].trim() };
  }
  return { title: `Step ${stepNumber}`, body: line };
}

function parseTimelineSteps(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];

  const lines = keepNonEmptyTrimmed(text.split(/\n+/));

  const numbered = [];
  for (let index = 0; index < lines.length; index += 1) {
    const step = numberedTimelineStepFromLine(lines[index]);
    if (step) numbered.push(step);
  }
  if (numbered.length >= 2) return numbered;

  if (lines.length >= 2) {
    const fromLines = [];
    for (let index = 0; index < lines.length; index += 1) {
      fromLines.push(timelineStepFromPlainLine(lines[index], index + 1));
    }
    return fromLines;
  }

  const sentences = splitTips(text);
  if (sentences.length >= 2) {
    const fromSentences = [];
    for (let index = 0; index < sentences.length; index += 1) {
      fromSentences.push({ title: `Step ${index + 1}`, body: sentences[index] });
    }
    return fromSentences;
  }

  return [{ title: 'Timeline', body: text }];
}

function hardShadowStyle(colors, offset) {
  return {
    shadowColor: colors.nbShadow,
    shadowOffset: { width: offset, height: offset },
    shadowOpacity: 1,
    shadowRadius: 0,
  };
}

// ===== UI PIECES =====

function SectionEyebrow({ label, colors }) {
  return (
    <Text style={[styles.eyebrow, { color: colors.nbMuted }]}>{label}</Text>
  );
}

function PlanHeader({ title, subtitle, onBack, colors }) {
  const insets = useSafeAreaInsets();
  // Shell SafeArea is left/right only — pad under status bar / Dynamic Island
  const topPad = Math.max(insets.top, 0) + spacing.sm;

  return (
    <View style={[styles.headerRow, { paddingTop: topPad }]}>
      <TouchableOpacity
        onPress={onBack}
        style={[
          styles.backSq,
          {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface,
          },
          hardShadowStyle(colors, nb.shadowOffsetSmall),
        ]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        activeOpacity={0.85}
      >
        <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
      </TouchableOpacity>
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, { color: colors.nbInk }]} numberOfLines={1}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[styles.headerSubtitle, { color: colors.nbMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbIconChip}>
        <NbIconChip source={iconWeek} index={4} size={44} />
      </HardShadow>
    </View>
  );
}

// Pick the under-letter glyph for one week cell (today / done / rest / open).
// Why a helper: keeps WeekStrip’s map callback nesting under the Variation 3 depth cap.
function pickWeekCellStatus(slot, selectedIndex, todayIndex) {
  const selected = slot.index === selectedIndex;
  const isToday = slot.index === todayIndex;
  const dayOnSlot = slot.day;
  let dayMarkedRest = false;
  if (dayOnSlot && dayOnSlot.rest) dayMarkedRest = true;
  const emptySlotCountsAsRest = !dayOnSlot && slot.index >= 0;
  const isRest = !!(dayMarkedRest || emptySlotCountsAsRest);
  const isPast = slot.index < todayIndex;
  const hasTraining = dayOnSlot && !dayOnSlot.rest;

  if (selected || isToday) {
    return { selected, status: 'today' };
  }
  if (hasTraining && isPast) {
    return { selected, status: 'done' };
  }
  if (!hasTraining || isRest) {
    return { selected, status: 'rest' };
  }
  return { selected, status: 'open' };
}

function weekDotFillColor(status, selected, colors) {
  const isFilledStatus = status === 'today' || status === 'done';
  if (!isFilledStatus) {
    return 'transparent';
  }
  if (selected) {
    return colors.nbOnFill;
  }
  return colors.nbFill;
}

function WeekStrip({ slots, selectedIndex, todayIndex, onSelect, colors }) {
  const cells = [];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    const { selected, status } = pickWeekCellStatus(slot, selectedIndex, todayIndex);
    const cellBackgroundColor = selected ? colors.nbFill : colors.nbSurfaceChip;
    const letterColor = selected ? colors.nbOnFill : colors.nbInk;
    const dotBorderColor = selected ? colors.nbOnFill : colors.nbBorder;
    const dotBackgroundColor = weekDotFillColor(status, selected, colors);
    const dotBorderStyle = status === 'rest' ? 'dashed' : 'solid';
    const selectedShadow = selected ? hardShadowStyle(colors, nb.shadowOffsetSmall) : null;

    cells.push(
      <TouchableOpacity
        key={slot.short}
        onPress={() => onSelect(slot.index)}
        style={[
          styles.weekCell,
          {
            borderColor: colors.nbBorder,
            backgroundColor: cellBackgroundColor,
          },
          selectedShadow,
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={slot.fullName}
        activeOpacity={0.85}
      >
        <Text style={[styles.weekLetter, { color: letterColor }]}>{slot.letter}</Text>
        <View
          style={[
            styles.weekDot,
            {
              borderColor: dotBorderColor,
              backgroundColor: dotBackgroundColor,
              borderStyle: dotBorderStyle,
            },
          ]}
        />
      </TouchableOpacity>,
    );
  }

  return <View style={styles.weekStrip}>{cells}</View>;
}

/** Session badge — gradient accent only (PNG title case, not NbPill’s uppercase). */
function SessionAccentPill({ label }) {
  return (
    <LinearGradient
      colors={accentGradients[0]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.sessionPill}
    >
      <Text style={styles.sessionPillText}>{label}</Text>
    </LinearGradient>
  );
}

function heroMetaLine(day, isRest, metaParts) {
  if (isRest) {
    return String(day.recoveryNote || recoveryDayDisplayName(day) || 'Active recovery day');
  }
  return metaParts.join(' · ');
}

function buildTrainingMetaParts(exercises, minutes) {
  const metaParts = [];
  const exerciseCount = exercises.length;
  const exerciseWord = exerciseCount === 1 ? 'exercise' : 'exercises';
  metaParts.push(`${exerciseCount} ${exerciseWord}`);
  if (minutes == null) return metaParts;
  if (typeof minutes === 'number') {
    metaParts.push(`about ${minutes} min`);
    return metaParts;
  }
  metaParts.push(String(minutes));
  return metaParts;
}

function TodayHeroCard({ day, workoutPlan, onStartSession, colors }) {
  const { title } = sessionTitleLines(day);
  const isRest = !!day.rest;
  const exercises = day.exercises || [];
  const minutes = estimateSessionMinutes(day);
  const { sessionNumber, sessionTotal } = sessionOrdinal(day, workoutPlan);
  const metaParts = isRest ? [] : buildTrainingMetaParts(exercises, minutes);
  const heroTitleText = isRest ? 'Rest' : title;
  const heroMetaText = heroMetaLine(day, isRest, metaParts);
  const sessionPillLabel = `Session ${sessionNumber} of ${sessionTotal}`;

  return (
    <HardShadow offset={nb.shadowOffsetHero} radius={10}>
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.nbFill,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        <View style={styles.heroTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroTitle, { color: colors.nbOnFill }]} numberOfLines={2}>
              {heroTitleText}
            </Text>
            <Text style={[styles.heroMeta, { color: colors.nbOnFill, opacity: 0.8 }]} numberOfLines={2}>
              {heroMetaText}
            </Text>
          </View>
          {!isRest && (
            <SessionAccentPill label={sessionPillLabel} />
          )}
        </View>
        {!isRest && (
          // PNG: white/onFill CTA with 3px ink border + HardShadow (keeps onStartSession wiring)
          <HardShadow radius={borderRadius.nbButton} offset={nb.shadowOffset}>
            <TouchableOpacity
              onPress={() => {
                if (typeof onStartSession !== 'function') return;
                onStartSession(day);
              }}
              style={[
                styles.startBtn,
                {
                  backgroundColor: colors.nbOnFill,
                  borderColor: colors.nbBorder,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Start session"
              activeOpacity={0.88}
            >
              <Text style={[styles.startBtnText, { color: colors.nbFill }]}>Start session</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.nbFill} />
            </TouchableOpacity>
          </HardShadow>
        )}
      </View>
    </HardShadow>
  );
}

function RecoveryListRows({ items, colors }) {
  const rows = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const topBorder =
      index > 0
        ? { borderTopWidth: nb.borderWidthDivider, borderTopColor: colors.nbBorder }
        : null;
    rows.push(
      <View
        key={`${index}-${item.label.slice(0, 12)}`}
        style={[styles.exRow, topBorder]}
      >
        <View
          style={[
            styles.exNum,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip },
          ]}
        >
          <Text style={[styles.exNumText, { color: colors.nbInk }]}>{index + 1}</Text>
        </View>
        <View style={styles.exGrow}>
          <Text style={[styles.exName, { color: colors.nbInk }]} numberOfLines={2}>
            {item.label}
          </Text>
          {item.detail ? (
            <Text style={[styles.exMeta, { color: colors.nbMuted }]} numberOfLines={2}>
              {item.detail}
            </Text>
          ) : null}
        </View>
      </View>,
    );
  }
  return rows;
}

function TrainingExerciseRows({ exercises, onOpenExercise, colors }) {
  const rows = [];
  for (let index = 0; index < exercises.length; index += 1) {
    const exercise = exercises[index];
    const equipment = inferEquipment(exercise);
    const topBorder =
      index > 0
        ? { borderTopWidth: nb.borderWidthDivider, borderTopColor: colors.nbBorder }
        : null;
    let equipmentTag = null;
    if (equipment) {
      equipmentTag = (
        <View style={styles.tagRow}>
          <View
            style={[
              styles.miniTag,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft },
            ]}
          >
            <Text style={[styles.miniTagText, { color: colors.nbInk }]}>{equipment}</Text>
          </View>
        </View>
      );
    }
    rows.push(
      <TouchableOpacity
        key={`${exercise.name}-${index}`}
        onPress={() => onOpenExercise(index)}
        style={[styles.exRow, topBorder]}
        activeOpacity={0.82}
        accessibilityRole="button"
      >
        <View
          style={[
            styles.exNum,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip },
          ]}
        >
          <Text style={[styles.exNumText, { color: colors.nbInk }]}>{index + 1}</Text>
        </View>
        <View style={styles.exGrow}>
          <Text style={[styles.exName, { color: colors.nbInk }]} numberOfLines={2}>
            {exercise.name}
          </Text>
          <Text style={[styles.exMeta, { color: colors.nbMuted }]} numberOfLines={1}>
            {formatExerciseListMeta(exercise)}
          </Text>
          {equipmentTag}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
      </TouchableOpacity>,
    );
  }
  return rows;
}

function ExerciseListCard({ day, onOpenExercise, colors }) {
  const dayRecord = day || {};
  const exercises = dayRecord.exercises || [];

  if (dayRecord.rest) {
    const recoveryItems = toRecoveryItems(day);
    return (
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <NbCard noShadow style={styles.listCard}>
          <RecoveryListRows items={recoveryItems} colors={colors} />
        </NbCard>
      </HardShadow>
    );
  }

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <NbCard noShadow style={styles.listCard}>
        <TrainingExerciseRows
          exercises={exercises}
          onOpenExercise={onOpenExercise}
          colors={colors}
        />
      </NbCard>
    </HardShadow>
  );
}

function restOfWeekChipSource(isRest, rowIndex) {
  if (isRest) return iconSleeping;
  if (rowIndex % 2 === 0) return iconMuscle;
  return iconDumbbells;
}

function restOfWeekSubtitle(day, isRest) {
  const dayRecord = day || {};
  if (isRest) {
    const recoveryNote = String(dayRecord.recoveryNote || '').trim();
    if (recoveryNote) return recoveryNote;
    return 'Active recovery day. Focus on mobility and sleep.';
  }
  const exercises = dayRecord.exercises || [];
  const count = exercises.length;
  const exerciseWord = count === 1 ? 'exercise' : 'exercises';
  return `${count} ${exerciseWord}`;
}

function slotsAfterSelectedDay(slots, selectedIndex) {
  const upcoming = [];
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (slot.index <= selectedIndex) continue;
    upcoming.push(slot);
  }
  return upcoming;
}

function RestOfWeekCard({ slots, selectedIndex, onSelectDay, colors }) {
  const upcoming = slotsAfterSelectedDay(slots, selectedIndex);
  if (upcoming.length === 0) return null;

  const rows = [];
  for (let rowIndex = 0; rowIndex < upcoming.length; rowIndex += 1) {
    const slot = upcoming[rowIndex];
    const day = slot.day;
    const isRest = !day || day.rest;
    let title = 'Rest';
    if (day && !isRest) {
      title = sessionTitleLines(day).title;
    }
    const chipIndex = isRest ? 2 : rowIndex % accentGradients.length;
    const chipSource = restOfWeekChipSource(isRest, rowIndex);
    const subtitle = restOfWeekSubtitle(day, isRest);
    const showChevron = !isRest;
    const topBorder =
      rowIndex > 0
        ? { borderTopWidth: nb.borderWidthDivider, borderTopColor: colors.nbBorder }
        : null;

    rows.push(
      <TouchableOpacity
        key={slot.short}
        onPress={() => onSelectDay(slot.index)}
        style={[styles.weekAheadRow, topBorder]}
        activeOpacity={0.82}
      >
        <NbIconChip source={chipSource} index={chipIndex} size={44} />
        <View style={styles.exGrow}>
          <Text style={[styles.exName, { color: colors.nbInk }]} numberOfLines={1}>
            {WEEK_ABBR[slot.index]} · {title}
          </Text>
          <Text style={[styles.exMeta, { color: colors.nbMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        {showChevron ? (
          <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
        ) : null}
      </TouchableOpacity>,
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <SectionEyebrow label="Rest of the week" colors={colors} />
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <NbCard noShadow style={styles.listCard}>
          {rows}
        </NbCard>
      </HardShadow>
    </View>
  );
}

function TimelineStepRows({ steps, colors }) {
  const rows = [];
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const isFirst = index === 0;
    const isLast = index === steps.length - 1;
    const dotFill = isFirst ? colors.nbFill : colors.nbSurface;
    const stepNumberColor = isFirst ? colors.nbOnFill : colors.nbInk;
    let connectorLine = null;
    if (!isLast) {
      connectorLine = (
        <View style={[styles.timelineLine, { backgroundColor: colors.nbBorder }]} />
      );
    }
    rows.push(
      <View key={`${step.title}-${index}`} style={styles.timelineRow}>
        <View style={styles.timelineRail}>
          <View
            style={[
              styles.timelineDot,
              {
                borderColor: colors.nbBorder,
                backgroundColor: dotFill,
              },
            ]}
          >
            <Text
              style={{
                fontWeight: '900',
                fontSize: 12,
                color: stepNumberColor,
              }}
            >
              {index + 1}
            </Text>
          </View>
          {connectorLine}
        </View>
        <View style={styles.timelineCopy}>
          <Text style={[styles.timelineTitle, { color: colors.nbInk }]}>{step.title}</Text>
          <Text style={[styles.notesBody, { color: colors.nbMuted }]}>{step.body}</Text>
        </View>
      </View>,
    );
  }
  return <View style={styles.timeline}>{rows}</View>;
}

function NotesTab({
  timelineText,
  importantNotes,
  nutritionGuidance,
  onViewPdf,
  onShare,
  colors,
}) {
  const steps = useMemo(() => parseTimelineSteps(timelineText), [timelineText]);

  let timelineBody = (
    <Text style={[styles.notesBody, { color: colors.nbMuted }]}>
      No timeline was saved with this plan yet.
    </Text>
  );
  if (steps.length > 0) {
    timelineBody = <TimelineStepRows steps={steps} colors={colors} />;
  }

  let importantNotesText = 'No important notes were saved with this plan yet.';
  if (importantNotes) {
    const trimmedImportant = String(importantNotes).trim();
    if (trimmedImportant) importantNotesText = trimmedImportant;
  }
  let nutritionGuidanceText = 'No nutrition guidance was saved with this plan yet.';
  if (nutritionGuidance) {
    const trimmedNutrition = String(nutritionGuidance).trim();
    if (trimmedNutrition) nutritionGuidanceText = trimmedNutrition;
  }

  return (
    <View style={{ gap: 16 }}>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <NbCard noShadow style={styles.notesCard}>
          <View style={styles.notesHead}>
            <NbIconChip source={iconJourney} index={3} size={44} />
            <Text style={[styles.notesTitle, { color: colors.nbInk }]}>Expected timeline</Text>
          </View>
          {timelineBody}
        </NbCard>
      </HardShadow>

      <HardShadow offset={nb.shadowOffsetCard} radius={10}>
        <NbCard noShadow style={[styles.notesCard, styles.notesCardAccent]}>
          <View style={styles.notesHead}>
            <NbIconChip source={iconInjury} index={2} size={44} />
            <Text style={[styles.notesTitle, { color: colors.nbInk }]}>Important notes</Text>
          </View>
          <Text style={[styles.notesBody, { color: colors.nbInk }]}>
            {importantNotesText}
          </Text>
        </NbCard>
      </HardShadow>

      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <NbCard noShadow style={styles.notesCard}>
          <View style={styles.notesHead}>
            <NbIconChip source={iconProtein} index={0} size={44} />
            <Text style={[styles.notesTitle, { color: colors.nbInk }]}>Nutrition guidance</Text>
          </View>
          <Text style={[styles.notesBody, { color: colors.nbMuted }]}>
            {nutritionGuidanceText}
          </Text>
        </NbCard>
      </HardShadow>

      <View style={styles.notesActions}>
        <NbButton variant="ghost" onPress={onViewPdf} style={{ flex: 1 }}>
          View PDF
        </NbButton>
        <NbButton variant="ghost" onPress={onShare} style={{ flex: 1 }}>
          Share
        </NbButton>
      </View>
    </View>
  );
}

function exerciseStatBoxes(sets, reps, rest, colors) {
  const stats = [
    { label: 'SETS', value: sets },
    { label: 'REPS', value: reps },
    { label: 'REST', value: rest },
  ];
  const boxes = [];
  for (let index = 0; index < stats.length; index += 1) {
    const stat = stats[index];
    boxes.push(
      <View
        key={stat.label}
        style={[
          styles.statBox,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <Text style={[styles.statLabel, { color: colors.nbMuted }]}>{stat.label}</Text>
        <Text style={[styles.statValue, { color: colors.nbInk }]}>{stat.value}</Text>
      </View>,
    );
  }
  return boxes;
}

function exerciseTargetPills(targets, colors) {
  const pills = [];
  for (let index = 0; index < targets.length; index += 1) {
    const targetName = targets[index];
    pills.push(
      <View
        key={targetName}
        style={[styles.targetPill, { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft }]}
      >
        <Text style={[styles.targetPillText, { color: colors.nbInk }]}>{targetName}</Text>
      </View>,
    );
  }
  return pills;
}

function exerciseTipRows(tips, colors) {
  const rows = [];
  for (let index = 0; index < tips.length; index += 1) {
    const tip = tips[index];
    rows.push(
      <View
        key={index}
        style={[styles.tipRow, { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder }]}
      >
        <View style={[styles.exNum, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
          <Text style={[styles.exNumText, { color: colors.nbInk }]}>{index + 1}</Text>
        </View>
        <Text style={[styles.tipBody, { color: colors.nbInk }]}>{tip}</Text>
      </View>,
    );
  }
  return rows;
}

function ExerciseDetailModal({ visible, day, exerciseIndex, onClose, onChangeIndex, colors }) {
  const scrollBottomPad = useModalScrollBottomPad(40);
  const dayRecord = day || {};
  const exercises = dayRecord.exercises || [];
  const ex = exerciseIndex != null ? exercises[exerciseIndex] : null;
  const { title: sessionName } = day ? sessionTitleLines(day) : { title: '' };
  const { sets, reps, rest } = ex ? parseSetsRepsRest(ex) : { sets: '—', reps: '—', rest: '—' };
  const tips = ex ? splitTips(ex.notes) : [];
  const targets = ex ? muscleToTargets(ex.muscle) : [];
  const hasPrev = exerciseIndex > 0;
  const hasNext = exerciseIndex < exercises.length - 1;
  const prevOpacity = hasPrev ? 1 : 0.35;
  const nextOpacity = hasNext ? 1 : 0.35;
  const sheetMaxHeight = Dimensions.get('window').height * SHEET_HEIGHT_RATIO;
  const stepCounterLabel = `${String(exerciseIndex + 1).padStart(2, '0')} / ${String(exercises.length).padStart(2, '0')}`;

  if (!visible || !ex) return null;

  let targetsBlock = null;
  if (targets.length > 0) {
    targetsBlock = (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>TARGETS</Text>
        <View style={styles.pillWrap}>{exerciseTargetPills(targets, colors)}</View>
      </View>
    );
  }

  let tipsBlock = null;
  if (tips.length > 0) {
    tipsBlock = (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>TIPS</Text>
        {exerciseTipRows(tips, colors)}
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.nbBackground,
              borderColor: colors.nbBorder,
              maxHeight: sheetMaxHeight,
            },
          ]}
        >
          <View style={styles.sheetHero}>
            <View style={styles.sheetTopRow}>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.sheetIconBtn, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}
              >
                <Ionicons name="close" size={20} color={colors.nbInk} />
              </TouchableOpacity>
              <NbPill variant="brand">{stepCounterLabel}</NbPill>
              <View style={{ width: 36 }} />
            </View>
            <Text style={[styles.sheetKicker, { color: colors.nbMuted }]}>
              {day.short} · {sessionName}
            </Text>
            <Text style={[styles.sheetTitle, { color: colors.nbInk }]}>{ex.name}</Text>
          </View>

          <ScrollView
            contentContainerStyle={[styles.sheetBody, { paddingBottom: scrollBottomPad }]}
            {...FORM_SCROLL_PROPS}
          >
            <View style={styles.statRow}>
              {exerciseStatBoxes(sets, reps, rest, colors)}
            </View>

            {targetsBlock}
            {tipsBlock}

            <View style={styles.navRow}>
              <NbButton
                variant="ghost"
                onPress={() => {
                  if (!hasPrev) return;
                  onChangeIndex(exerciseIndex - 1);
                }}
                disabled={!hasPrev}
                style={{ flex: 1, opacity: prevOpacity }}
              >
                Previous
              </NbButton>
              <NbButton
                variant="fill"
                onPress={() => {
                  if (!hasNext) return;
                  onChangeIndex(exerciseIndex + 1);
                }}
                disabled={!hasNext}
                style={{ flex: 1, opacity: nextOpacity }}
              >
                Next
              </NbButton>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RecoveryGuidanceBody({ steps, itemDetail, recoveryType, colors }) {
  if (steps.length > 1) {
    const guidanceRows = [];
    for (let index = 0; index < steps.length; index += 1) {
      guidanceRows.push(
        <View
          key={index}
          style={[
            styles.tipRow,
            { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
          ]}
        >
          <View
            style={[
              styles.exNum,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
              },
            ]}
          >
            <Text style={[styles.exNumText, { color: colors.nbInk }]}>{index + 1}</Text>
          </View>
          <Text style={[styles.tipBody, { color: colors.nbInk }]}>{steps[index]}</Text>
        </View>,
      );
    }
    return (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>GUIDANCE</Text>
        {guidanceRows}
      </View>
    );
  }

  if (itemDetail) {
    return <Text style={[styles.notesBody, { color: colors.nbInk }]}>{itemDetail}</Text>;
  }

  return (
    <Text style={[styles.notesBody, { color: colors.nbMuted }]}>
      Focus on {String(recoveryType || '').toLowerCase()} and listen to your body.
    </Text>
  );
}

function RecoveryFocusModal({ visible, day, items, segmentIndex, onClose, onChangeIndex, colors }) {
  const scrollBottomPad = useModalScrollBottomPad(40);
  const item = segmentIndex != null ? items[segmentIndex] : null;
  const hasPrev = segmentIndex > 0;
  const hasNext = segmentIndex < items.length - 1;
  const displayName = day ? recoveryDayDisplayName(day) : '';
  const meta = item ? parseRecoveryMeta(item.label) : {};
  const steps = item ? splitDetailIntoSteps(item.detail) : [];

  if (!visible || item == null || !day) return null;

  const sheetMaxHeight = Dimensions.get('window').height * SHEET_HEIGHT_RATIO;
  const stepCounterLabel = `${String(segmentIndex + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
  const prevOpacity = hasPrev ? 1 : 0.35;
  const nextOpacity = hasNext ? 1 : 0.35;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.nbBackground,
              borderColor: colors.nbBorder,
              maxHeight: sheetMaxHeight,
            },
          ]}
        >
          <View style={styles.sheetHero}>
            <View style={styles.sheetTopRow}>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.sheetIconBtn,
                  { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                ]}
              >
                <Ionicons name="close" size={20} color={colors.nbInk} />
              </TouchableOpacity>
              <NbPill variant="brand">{stepCounterLabel}</NbPill>
              <View style={{ width: 36 }} />
            </View>
            <Text style={[styles.sheetKicker, { color: colors.nbMuted }]}>
              {day.short} · Rest · {displayName}
            </Text>
            <Text style={[styles.sheetTitle, { color: colors.nbInk }]}>{item.label}</Text>
          </View>

          <ScrollView
            contentContainerStyle={[styles.sheetBody, { paddingBottom: scrollBottomPad }]}
            {...FORM_SCROLL_PROPS}
          >
            <View style={styles.statRow}>
              <View
                style={[
                  styles.statBox,
                  { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                ]}
              >
                <Text style={[styles.statLabel, { color: colors.nbMuted }]}>TYPE</Text>
                <Text style={[styles.statValue, { color: colors.nbInk, fontSize: 15 }]}>
                  {meta.type}
                </Text>
              </View>
              {meta.duration ? (
                <View
                  style={[
                    styles.statBox,
                    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                  ]}
                >
                  <Text style={[styles.statLabel, { color: colors.nbMuted }]}>DURATION</Text>
                  <Text style={[styles.statValue, { color: colors.nbInk, fontSize: 15 }]}>
                    {meta.duration}
                  </Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.statBox,
                  { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                ]}
              >
                <Text style={[styles.statLabel, { color: colors.nbMuted }]}>FOCUS</Text>
                <Text style={[styles.statValue, { color: colors.nbInk, fontSize: 15 }]}>
                  {meta.focus}
                </Text>
              </View>
            </View>

            <RecoveryGuidanceBody
              steps={steps}
              itemDetail={item.detail}
              recoveryType={meta.type}
              colors={colors}
            />

            <View style={styles.navRow}>
              <NbButton
                variant="ghost"
                onPress={() => {
                  if (!hasPrev) return;
                  onChangeIndex(segmentIndex - 1);
                }}
                disabled={!hasPrev}
                style={{ flex: 1, opacity: prevOpacity }}
              >
                Previous
              </NbButton>
              <NbButton
                variant="fill"
                onPress={() => {
                  if (!hasNext) return;
                  onChangeIndex(segmentIndex + 1);
                }}
                disabled={!hasNext}
                style={{ flex: 1, opacity: nextOpacity }}
              >
                Next
              </NbButton>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ===== MAIN FUNCTION =====

function firstStringParam(routeParams, keys, fallbackText) {
  // Walk alias keys in order; first non-null wins. Keeps the screen under nesting depth 2.
  const params = routeParams || {};
  for (let index = 0; index < keys.length; index += 1) {
    const keyName = keys[index];
    if (params[keyName] == null) continue;
    return String(params[keyName]);
  }
  return fallbackText;
}

function resolveTimelineText(routeParams) {
  return firstStringParam(routeParams, ['timeline', 'expectedTimeline'], '');
}

function resolveImportantNotes(routeParams, overview) {
  return firstStringParam(routeParams, ['importantNotes', 'notes', 'generalNotes'], overview);
}

function resolveNutritionGuidance(routeParams) {
  return firstStringParam(routeParams, ['nutritionGuidance', 'nutrition', 'nutritionNotes'], '');
}

/**
 * Pull every route option into plain locals (no nested route?.params?. in the screen body).
 * Prop callbacks merge later in MyWorkoutPlanScreen — this only reads the route bag.
 */
function readPlanRouteBag(route) {
  const routeParams = route && route.params ? route.params : {};

  const reserveShellBottomNav = routeParams.reserveShellBottomNav === true;
  const isDarkOverride = routeParams.isDarkOverride;
  const routeOnBack = routeParams.onBack;
  const subViewBackRef = routeParams.subViewBackRef;
  const onSubViewActiveChange = routeParams.onSubViewActiveChange;

  let workoutPlan = [];
  if (routeParams.workoutPlan) {
    workoutPlan = routeParams.workoutPlan;
  }

  let overview = '';
  if (routeParams.overview) {
    overview = String(routeParams.overview);
  }

  let weeksRemaining = DEFAULT_WEEKS_REMAINING;
  if (routeParams.weeksRemaining != null) {
    weeksRemaining = routeParams.weeksRemaining;
  }

  let focusSummary = DEFAULT_FOCUS_SUMMARY;
  if (routeParams.focusSummary != null) {
    focusSummary = String(routeParams.focusSummary);
  }

  let heroTitle = DEFAULT_HERO_TITLE;
  if (routeParams.planHeroTitle != null) {
    heroTitle = String(routeParams.planHeroTitle);
  }

  let planWeek = routeParams.planWeek;
  if (planWeek == null) {
    planWeek = routeParams.currentWeek;
  }

  const timelineText = resolveTimelineText(routeParams);
  const importantNotes = resolveImportantNotes(routeParams, overview);
  const nutritionGuidance = resolveNutritionGuidance(routeParams);

  const routeStartSession = routeParams.onStartSession;
  const routeViewPdf = routeParams.onViewPdf;
  const routeSharePlan = routeParams.onSharePlan;
  const routeOnboardingData = routeParams.onboardingData;
  const routeVideosSlot = routeParams.videosSlot;

  return {
    routeParams,
    reserveShellBottomNav,
    isDarkOverride,
    routeOnBack,
    subViewBackRef,
    onSubViewActiveChange,
    workoutPlan,
    overview,
    weeksRemaining,
    focusSummary,
    heroTitle,
    planWeek,
    timelineText,
    importantNotes,
    nutritionGuidance,
    routeStartSession,
    routeViewPdf,
    routeSharePlan,
    routeOnboardingData,
    routeVideosSlot,
  };
}

function mondayBasedTodayIndex() {
  // vocab: getDay = 0 Sunday … 6 Saturday; our week strip is Mon=0 … Sun=6
  const jsDay = new Date().getDay();
  if (jsDay === 0) return 6;
  return jsDay - 1;
}

function firstTrainingDayIndex(weekSlots) {
  for (let index = 0; index < weekSlots.length; index += 1) {
    const slot = weekSlots[index];
    if (slot.day && !slot.day.rest) return index;
  }
  return -1;
}

function firstAnyDayIndex(weekSlots) {
  for (let index = 0; index < weekSlots.length; index += 1) {
    if (weekSlots[index].day) return index;
  }
  return -1;
}

function initialSelectedDayIndex(weekSlots, todayIndex) {
  const todaySlot = weekSlots[todayIndex];
  if (todaySlot && todaySlot.day) return todayIndex;
  const firstTraining = firstTrainingDayIndex(weekSlots);
  if (firstTraining >= 0) return firstTraining;
  const firstAny = firstAnyDayIndex(weekSlots);
  if (firstAny >= 0) return firstAny;
  return todayIndex;
}

function buildHeaderSubtitle(heroTitle, focusSummary, planWeek, weeksRemaining) {
  const name = heroTitle && heroTitle !== DEFAULT_HERO_TITLE ? heroTitle : focusSummary;
  if (planWeek != null && String(planWeek).trim()) {
    return `${name} · week ${planWeek}`;
  }
  return `${name} · ${weeksRemaining} weeks left`;
}

function workoutNameForSession(day) {
  const focusBits = trimmedNonEmptyParts(String(day.focus || '').split(/\s*·\s*/));
  if (focusBits[0]) return focusBits[0];
  const fromDay = String(day.day || day.short || 'Workout').trim();
  return fromDay || 'Workout';
}

function buildPlanShareMessage(headerSubtitle, overview, importantNotes, nutritionGuidance) {
  const parts = [headerSubtitle, overview, importantNotes, nutritionGuidance];
  const kept = [];
  for (let index = 0; index < parts.length; index += 1) {
    const trimmed = String(parts[index] || '').trim();
    if (!trimmed) continue;
    kept.push(trimmed);
  }
  if (kept.length === 0) return SCREEN_TITLE;
  return kept.join('\n\n');
}

function VideosTabPane({ videosSlotNode, isDark, videosOnboarding }) {
  if (videosSlotNode != null) {
    return videosSlotNode;
  }
  return (
    <View style={{ flex: 1 }}>
      {/* Videos agent may replace this embed — ExerciseVideosTab is the current library */}
      <ExerciseVideosTab isDark={isDark} onboardingData={videosOnboarding} />
    </View>
  );
}

function PlanTabBody({
  weekSlots,
  selectedIndex,
  todayIndex,
  setSelectedIndex,
  sectionLabel,
  selectedDay,
  workoutPlan,
  handleStartSession,
  setRecoveryModalIndex,
  setExerciseModal,
  emptyDayPlaceholder,
  colors,
}) {
  let daySection = emptyDayPlaceholder;
  if (selectedDay) {
    daySection = (
      <>
        <TodayHeroCard
          day={selectedDay}
          workoutPlan={workoutPlan}
          onStartSession={handleStartSession}
          colors={colors}
        />
        <ExerciseListCard
          day={selectedDay}
          onOpenExercise={(exerciseIndex) => {
            if (selectedDay.rest) {
              setRecoveryModalIndex(exerciseIndex);
              return;
            }
            setExerciseModal(exerciseIndex);
          }}
          colors={colors}
        />
      </>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <WeekStrip
        slots={weekSlots}
        selectedIndex={selectedIndex}
        todayIndex={todayIndex}
        onSelect={setSelectedIndex}
        colors={colors}
      />
      <SectionEyebrow label={sectionLabel} colors={colors} />
      {daySection}
      <RestOfWeekCard
        slots={weekSlots}
        selectedIndex={selectedIndex}
        onSelectDay={setSelectedIndex}
        colors={colors}
      />
    </View>
  );
}

/**
 * Design Law weekly plan viewer (Plan + Notes + Videos).
 * @param {object} props
 * @param {object} [props.route]
 * @param {object} [props.navigation]
 * @param {Function} [props.onBack]
 * @param {Function} [props.onStartSession] — opens Design Law session (day → or payload)
 * @param {Function} [props.onViewPdf]
 * @param {Function} [props.onSharePlan]
 * @param {object} [props.onboardingData] — optional corpus for Videos tab
 * @param {import('react').ReactNode} [props.videosSlot] — override Videos pane (Videos agent)
 */
export default function MyWorkoutPlanScreen({
  route,
  navigation,
  onBack,
  onStartSession,
  onViewPdf,
  onSharePlan,
  onboardingData,
  videosSlot,
}) {
  // 1. Theme + route bag → named locals (plain ifs, no route?.params?. chains).
  const theme = useTheme();
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET);
  const modalScrollBottomPad = useModalScrollBottomPad(MODAL_SCROLL_PAD);
  const routeBag = readPlanRouteBag(route);

  let scrollBottomPad = modalScrollBottomPad;
  if (routeBag.reserveShellBottomNav) {
    scrollBottomPad = shellBottomPad;
  }

  let isDark = theme.isDark;
  if (typeof routeBag.isDarkOverride === 'boolean') {
    isDark = routeBag.isDarkOverride;
  }
  const colors = paletteFor(isDark);

  const {
    routeOnBack,
    subViewBackRef,
    onSubViewActiveChange,
    workoutPlan,
    overview,
    weeksRemaining,
    focusSummary,
    heroTitle,
    planWeek,
    timelineText,
    importantNotes,
    nutritionGuidance,
  } = routeBag;

  let startSessionCb = onStartSession;
  if (!startSessionCb) startSessionCb = routeBag.routeStartSession;

  let viewPdfCb = onViewPdf;
  if (!viewPdfCb) viewPdfCb = routeBag.routeViewPdf;

  let sharePlanCb = onSharePlan;
  if (!sharePlanCb) sharePlanCb = routeBag.routeSharePlan;

  let videosOnboarding = onboardingData;
  if (!videosOnboarding) videosOnboarding = routeBag.routeOnboardingData;

  let videosSlotNode = videosSlot;
  if (videosSlotNode == null) videosSlotNode = routeBag.routeVideosSlot;
  if (videosSlotNode == null) videosSlotNode = null;

  // 2. Back: parent callback → route callback → stack goBack.
  const handleRootBack = useCallback(() => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    if (typeof routeOnBack === 'function') {
      routeOnBack();
      return;
    }
    if (!navigation) return;
    if (typeof navigation.canGoBack !== 'function') return;
    if (!navigation.canGoBack()) return;
    navigation.goBack();
  }, [onBack, routeOnBack, navigation]);

  const weekSlots = useMemo(() => buildWeekSlots(workoutPlan), [workoutPlan]);
  const todayIndex = useMemo(() => mondayBasedTodayIndex(), []);

  const [tab, setTab] = useState(TAB_PLAN);
  const [selectedIndex, setSelectedIndex] = useState(() =>
    initialSelectedDayIndex(weekSlots, todayIndex),
  );
  const [exerciseModal, setExerciseModal] = useState(null);
  const [recoveryModalIndex, setRecoveryModalIndex] = useState(null);

  const selectedSlot = weekSlots[selectedIndex] || weekSlots[0];
  let selectedDay = null;
  if (selectedSlot && selectedSlot.day) {
    selectedDay = selectedSlot.day;
  }
  const isSelectedToday = selectedIndex === todayIndex;

  const recoveryItems = useMemo(() => {
    if (!selectedDay) return [];
    if (!selectedDay.rest) return [];
    return toRecoveryItems(selectedDay);
  }, [selectedDay]);

  const headerSubtitle = useMemo(
    () => buildHeaderSubtitle(heroTitle, focusSummary, planWeek, weeksRemaining),
    [heroTitle, focusSummary, planWeek, weeksRemaining],
  );

  const sectionLabel = useMemo(() => {
    let fullName = '';
    if (selectedSlot) fullName = selectedSlot.fullName || '';
    if (isSelectedToday) return `Today, ${fullName}`;
    return fullName;
  }, [selectedSlot, isSelectedToday]);

  const inSubView = exerciseModal != null || recoveryModalIndex != null;

  useEffect(() => {
    if (typeof onSubViewActiveChange !== 'function') return;
    onSubViewActiveChange(inSubView);
  }, [inSubView, onSubViewActiveChange]);

  useEffect(() => {
    if (!subViewBackRef) return undefined;
    subViewBackRef.current = () => {
      if (exerciseModal != null) {
        setExerciseModal(null);
        return true;
      }
      if (recoveryModalIndex != null) {
        setRecoveryModalIndex(null);
        return true;
      }
      return false;
    };
    return () => {
      subViewBackRef.current = null;
    };
  }, [exerciseModal, recoveryModalIndex, subViewBackRef]);

  // 3. Start session — parent callback first, else push WorkoutSession.
  const handleStartSession = useCallback(
    (day) => {
      if (!day || day.rest) return;
      if (typeof startSessionCb === 'function') {
        startSessionCb(day);
        return;
      }
      let exercises = [];
      if (Array.isArray(day.exercises)) {
        exercises = day.exercises;
      }
      rootNavigate(CLIENT_ROUTES.WorkoutSession, {
        workoutName: workoutNameForSession(day),
        exercises,
      });
    },
    [startSessionCb],
  );

  // 4. PDF — parent callback or “not available yet” alert.
  const handleViewPdf = useCallback(() => {
    if (typeof viewPdfCb === 'function') {
      viewPdfCb();
      return;
    }
    Alert.alert('PDF', 'PDF export is not available for this plan yet.');
  }, [viewPdfCb]);

  // 5. Share — parent callback or native share sheet with notes text.
  const handleShare = useCallback(async () => {
    if (typeof sharePlanCb === 'function') {
      sharePlanCb();
      return;
    }
    try {
      const message = buildPlanShareMessage(
        headerSubtitle,
        overview,
        importantNotes,
        nutritionGuidance,
      );
      await Share.share({
        title: SCREEN_TITLE,
        message,
      });
    } catch {
      /* user dismissed the sheet — ignore */
    }
  }, [sharePlanCb, headerSubtitle, overview, importantNotes, nutritionGuidance]);

  let emptyDayName = 'this day';
  if (selectedSlot && selectedSlot.fullName) {
    emptyDayName = selectedSlot.fullName;
  }
  const emptyDayPlaceholder = (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <NbCard noShadow>
        <Text style={[styles.notesBody, { color: colors.nbMuted }]}>
          No session is planned for {emptyDayName}. Pick another day from the week strip.
        </Text>
      </NbCard>
    </HardShadow>
  );

  // 6. Named pane decisions above JSX (no nested ternaries in the return).
  const showVideosTab = tab === TAB_VIDEOS;
  const showPlanTab = tab === TAB_PLAN;
  const showNotesTab = tab === TAB_NOTES;
  const showExerciseModal = Boolean(selectedDay && !selectedDay.rest);
  let showRecoveryModal = false;
  if (selectedDay && selectedDay.rest) {
    showRecoveryModal = true;
  }

  let mainPane = (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
      {...FORM_SCROLL_PROPS}
    >
      {showPlanTab && (
        <PlanTabBody
          weekSlots={weekSlots}
          selectedIndex={selectedIndex}
          todayIndex={todayIndex}
          setSelectedIndex={setSelectedIndex}
          sectionLabel={sectionLabel}
          selectedDay={selectedDay}
          workoutPlan={workoutPlan}
          handleStartSession={handleStartSession}
          setRecoveryModalIndex={setRecoveryModalIndex}
          setExerciseModal={setExerciseModal}
          emptyDayPlaceholder={emptyDayPlaceholder}
          colors={colors}
        />
      )}
      {showNotesTab && (
        <NotesTab
          timelineText={timelineText}
          importantNotes={importantNotes}
          nutritionGuidance={nutritionGuidance}
          onViewPdf={handleViewPdf}
          onShare={handleShare}
          colors={colors}
        />
      )}
    </ScrollView>
  );
  if (showVideosTab) {
    mainPane = (
      <VideosTabPane
        videosSlotNode={videosSlotNode}
        isDark={isDark}
        videosOnboarding={videosOnboarding}
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.nbBackground }]}>
      <View style={styles.chromePad}>
        <PlanHeader
          title={SCREEN_TITLE}
          subtitle={headerSubtitle}
          onBack={handleRootBack}
          colors={colors}
        />
        <NbSegmented
          segments={TAB_SEGMENTS}
          selected={tab}
          onSelect={setTab}
          style={styles.segmented}
        />
      </View>

      {mainPane}

      {showExerciseModal && (
        <ExerciseDetailModal
          visible={exerciseModal != null}
          day={selectedDay}
          exerciseIndex={exerciseModal}
          onClose={() => setExerciseModal(null)}
          onChangeIndex={setExerciseModal}
          colors={colors}
        />
      )}
      {showRecoveryModal && (
        <RecoveryFocusModal
          visible={recoveryModalIndex != null}
          day={selectedDay}
          items={recoveryItems}
          segmentIndex={recoveryModalIndex}
          onClose={() => setRecoveryModalIndex(null)}
          onChangeIndex={setRecoveryModalIndex}
          colors={colors}
        />
      )}
    </View>
  );
}

// ===== PLUMBING — skip unless debugging layout tokens =====
// StyleSheet numbers stay inline (CODING_STYLE: layout StyleSheet.create values).

const styles = StyleSheet.create({
  container: { flex: 1 },
  chromePad: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backSq: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
    fontWeight: '500',
  },
  segmented: { marginBottom: 4 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 4,
  },
  weekCell: {
    flex: 1,
    minHeight: 64,
    borderWidth: nb.borderWidth,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  weekLetter: {
    fontSize: 13,
    fontWeight: '900',
  },
  weekDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
  },
  heroCard: {
    borderWidth: nb.borderWidth,
    // Manipulate here: corner accent 6 24 6 6 matches Design Law hero role
    borderRadius: 6,
    borderTopRightRadius: 24,
    padding: 14,
    gap: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroMeta: {
    fontSize: 15,
    marginTop: 4,
    fontWeight: '600',
  },
  sessionPill: {
    flexShrink: 0,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
    borderColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionPillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0A0A',
  },
  startBtn: {
    minHeight: 50,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '900',
  },
  listCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
  },
  exNum: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exNumText: {
    fontSize: 13,
    fontWeight: '900',
  },
  exGrow: { flex: 1, minWidth: 0 },
  exName: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  exMeta: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  miniTag: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: nb.borderWidthPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTagText: {
    fontSize: 12,
    fontWeight: '900',
  },
  weekAheadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
  },
  notesCard: {
    gap: 10,
  },
  notesCardAccent: {
    borderTopLeftRadius: 2,
    borderTopRightRadius: 14,
  },
  notesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notesTitle: {
    fontSize: 19,
    fontWeight: '900',
    flex: 1,
  },
  notesBody: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  timeline: { gap: 0 },
  timelineRow: {
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
  },
  timelineRail: {
    width: 28,
    alignItems: 'center',
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 12,
    marginVertical: 2,
  },
  timelineCopy: {
    flex: 1,
    paddingBottom: 14,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  notesActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  sheetHero: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
  },
  sheetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetKicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 20,
  },
  statRow: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: nb.borderWidth,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statValue: { fontSize: 20, fontWeight: '900' },
  sectionBlock: { gap: 10 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  targetPill: {
    borderRadius: 20,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  targetPillText: { fontSize: 12, fontWeight: '600' },
  tipRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
  },
  tipBody: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  navRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
