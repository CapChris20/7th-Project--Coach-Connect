// Client "My workout plan" — Design Law Plan | Notes | Videos tabs.
// Flow: header + segmented → Plan (week strip, today hero, exercises, rest of week)
//       → Notes (timeline / important / nutrition + PDF + Share) → Videos slot.
// Used by CreateWorkoutPlanScreen / WorkoutPlanView when a client opens a saved plan.
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

function sessionTitleLines(day) {
  const rawDay = String(day?.day || '').trim();
  const focus = String(day?.focus || '').trim();
  const sep = dayTitleSeparator(rawDay);
  if (sep) {
    const parts = rawDay.split(sep).map((part) => part.trim()).filter(Boolean);
    return { title: parts[0] || rawDay, subtitle: parts.slice(1).join(' · ') || focus };
  }
  const bits = focus.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean);
  if (bits.length >= 2) {
    return { title: bits[0], subtitle: bits.slice(1).join(' · ') };
  }
  // Prefer focus as the hero title when it reads like "Lower body"
  if (focus && !/^rest/i.test(focus)) {
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

function splitTips(text) {
  const tipText = String(text || '').trim();
  if (!tipText) return [];
  const parts = tipText.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [tipText];
}

function splitLegacyNote(raw) {
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const byArrow = raw.split(/\s*(?:→|➝|->)\s*/).map((line) => line.trim()).filter(Boolean);
  if (byArrow.length > 1) return byArrow;
  const sentences = splitTips(raw);
  return sentences.length ? sentences : [raw];
}

function toRecoveryItems(day) {
  if (Array.isArray(day?.recoveryActivities) && day.recoveryActivities.length > 0) {
    return day.recoveryActivities
      .filter((activity) => activity && typeof activity === 'object' && typeof activity.label === 'string' && activity.label.trim())
      .map((activity) => ({ label: extractShortLabel(activity.label), detail: String(activity.detail || '').trim() }));
  }
  const raw = String(day?.recoveryNote || day?.focus || '').trim();
  if (!raw) return [{ label: DEFAULT_RECOVERY_FALLBACK, detail: '' }];
  return splitLegacyNote(raw).map((segment) => ({
    label: extractShortLabel(segment),
    detail: segment.trim(),
  }));
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
  return String(day?.day || '').replace(/^\?\s*/, '').trim() || String(day?.short || DEFAULT_REST_SHORT);
}

function muscleToTargets(muscle) {
  if (!muscle) return [];
  return String(muscle)
    .split(/[,/|]/)
    .map((part) => part.trim())
    .filter(Boolean);
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
  return detail.split(/(?<=[.!?])\s+/).filter((step) => step.trim().length > STEP_MIN_CHARS);
}

/** Build Mon–Sun slots so the week strip always has 7 cells. */
function buildWeekSlots(workoutPlan) {
  const byShort = new Map();
  (workoutPlan || []).forEach((day) => {
    const short = normalizeDayShort(day.short);
    if (short) byShort.set(short, day);
  });
  return WEEK_SHORTS.map((short, index) => ({
    letter: WEEK_LETTERS[index],
    short,
    fullName: WEEK_FULL[index],
    index,
    day: byShort.get(short) || null,
  }));
}

function estimateSessionMinutes(day) {
  const raw = day?.estimatedTime ?? day?.sessionDuration ?? day?.duration;
  if (raw != null && String(raw).trim()) {
    const asNum = parseInt(String(raw).replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    return String(raw).trim();
  }
  const count = (day?.exercises || []).length;
  if (!count) return null;
  return count * MIN_MINUTES_PER_EXERCISE;
}

function sessionOrdinal(day, workoutPlan) {
  const training = (workoutPlan || []).filter((d) => !d.rest);
  const idx = training.findIndex((d) => d === day || (normalizeDayShort(d.short) === normalizeDayShort(day?.short) && d.focus === day?.focus));
  if (idx < 0) return { n: 1, of: Math.max(1, training.length) };
  return { n: idx + 1, of: Math.max(1, training.length) };
}

/**
 * Turn timeline prose into { title, body } steps for the Notes card.
 * Accepts numbered lines, bullets, or blank-line paragraphs.
 */
function parseTimelineSteps(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const numbered = lines
    .map((line) => {
      const match = line.match(/^(?:step\s*)?(\d+)[.)\-:]?\s*(.+)$/i);
      if (!match) return null;
      const body = match[2].trim();
      const titleMatch = body.match(/^([^.:—–-]+)[.:—–-]\s*(.+)$/);
      if (titleMatch) {
        return { title: titleMatch[1].trim(), body: titleMatch[2].trim() };
      }
      // "Weeks 1 to 2 Learn the lifts..." — first clause as title when possible
      const weekMatch = body.match(/^(weeks?\s+[\d\s]+(?:to|-)\s*[\d]+|week\s+\d+)\s*[.:—–-]?\s*(.*)$/i);
      if (weekMatch) {
        return { title: weekMatch[1].trim(), body: weekMatch[2].trim() || weekMatch[1].trim() };
      }
      return { title: `Step ${match[1]}`, body };
    })
    .filter(Boolean);
  if (numbered.length >= 2) return numbered;

  if (lines.length >= 2) {
    return lines.map((line, i) => {
      const titleMatch = line.match(/^([^.:—–-]+)[.:—–-]\s*(.+)$/);
      if (titleMatch) return { title: titleMatch[1].trim(), body: titleMatch[2].trim() };
      return { title: `Step ${i + 1}`, body: line };
    });
  }

  const sentences = splitTips(text);
  if (sentences.length >= 2) {
    return sentences.map((sentence, i) => ({ title: `Step ${i + 1}`, body: sentence }));
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

function WeekStrip({ slots, selectedIndex, todayIndex, onSelect, colors }) {
  return (
    <View style={styles.weekStrip}>
      {slots.map((slot) => {
        const selected = slot.index === selectedIndex;
        const isToday = slot.index === todayIndex;
        const isRest = !!(slot.day?.rest || (!slot.day && slot.index >= 0));
        const isPast = slot.index < todayIndex;
        const hasTraining = slot.day && !slot.day.rest;
        // Status glyph under the letter — filled = done/today, dashed = rest, open = upcoming
        let status = 'open';
        if (selected || isToday) status = 'today';
        else if (hasTraining && isPast) status = 'done';
        else if (!hasTraining || isRest) status = 'rest';

        return (
          <TouchableOpacity
            key={slot.short}
            onPress={() => onSelect(slot.index)}
            style={[
              styles.weekCell,
              {
                borderColor: colors.nbBorder,
                backgroundColor: selected ? colors.nbFill : colors.nbSurfaceChip,
              },
              selected ? hardShadowStyle(colors, nb.shadowOffsetSmall) : null,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={slot.fullName}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.weekLetter,
                { color: selected ? colors.nbOnFill : colors.nbInk },
              ]}
            >
              {slot.letter}
            </Text>
            <View
              style={[
                styles.weekDot,
                {
                  borderColor: selected ? colors.nbOnFill : colors.nbBorder,
                  backgroundColor:
                    status === 'today' || status === 'done'
                      ? selected
                        ? colors.nbOnFill
                        : colors.nbFill
                      : 'transparent',
                  borderStyle: status === 'rest' ? 'dashed' : 'solid',
                },
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
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

function TodayHeroCard({ day, workoutPlan, onStartSession, colors }) {
  const { title } = sessionTitleLines(day);
  const isRest = !!day.rest;
  const exercises = day.exercises || [];
  const minutes = estimateSessionMinutes(day);
  const { n, of } = sessionOrdinal(day, workoutPlan);
  const metaParts = [];
  if (!isRest) {
    metaParts.push(`${exercises.length} exercise${exercises.length === 1 ? '' : 's'}`);
    if (minutes != null) {
      metaParts.push(typeof minutes === 'number' ? `about ${minutes} min` : String(minutes));
    }
  }

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
              {isRest ? 'Rest' : title}
            </Text>
            <Text style={[styles.heroMeta, { color: colors.nbOnFill, opacity: 0.8 }]} numberOfLines={2}>
              {isRest
                ? String(day.recoveryNote || recoveryDayDisplayName(day) || 'Active recovery day')
                : metaParts.join(' · ')}
            </Text>
          </View>
          {!isRest && (
            <SessionAccentPill label={`Session ${n} of ${of}`} />
          )}
        </View>
        {!isRest && (
          // PNG: white/onFill CTA with 3px ink border + HardShadow (keeps onStartSession wiring)
          <HardShadow radius={borderRadius.nbButton} offset={nb.shadowOffset}>
            <TouchableOpacity
              onPress={() => onStartSession?.(day)}
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

function ExerciseListCard({ day, onOpenExercise, colors }) {
  const exercises = day?.exercises || [];
  if (day?.rest) {
    const items = toRecoveryItems(day);
    return (
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <NbCard noShadow style={styles.listCard}>
          {items.map((item, i) => (
            <View
              key={`${i}-${item.label.slice(0, 12)}`}
              style={[
                styles.exRow,
                i > 0 && { borderTopWidth: nb.borderWidthDivider, borderTopColor: colors.nbBorder },
              ]}
            >
              <View style={[styles.exNum, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip }]}>
                <Text style={[styles.exNumText, { color: colors.nbInk }]}>{i + 1}</Text>
              </View>
              <View style={styles.exGrow}>
                <Text style={[styles.exName, { color: colors.nbInk }]} numberOfLines={2}>
                  {item.label}
                </Text>
                {!!item.detail && (
                  <Text style={[styles.exMeta, { color: colors.nbMuted }]} numberOfLines={2}>
                    {item.detail}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </NbCard>
      </HardShadow>
    );
  }

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <NbCard noShadow style={styles.listCard}>
        {exercises.map((ex, i) => {
          const equipment = inferEquipment(ex);
          return (
            <TouchableOpacity
              key={`${ex.name}-${i}`}
              onPress={() => onOpenExercise(i)}
              style={[
                styles.exRow,
                i > 0 && { borderTopWidth: nb.borderWidthDivider, borderTopColor: colors.nbBorder },
              ]}
              activeOpacity={0.82}
              accessibilityRole="button"
            >
              <View style={[styles.exNum, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip }]}>
                <Text style={[styles.exNumText, { color: colors.nbInk }]}>{i + 1}</Text>
              </View>
              <View style={styles.exGrow}>
                <Text style={[styles.exName, { color: colors.nbInk }]} numberOfLines={2}>
                  {ex.name}
                </Text>
                <Text style={[styles.exMeta, { color: colors.nbMuted }]} numberOfLines={1}>
                  {formatExerciseListMeta(ex)}
                </Text>
                {!!equipment && (
                  <View style={styles.tagRow}>
                    <View style={[styles.miniTag, { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft }]}>
                      <Text style={[styles.miniTagText, { color: colors.nbInk }]}>{equipment}</Text>
                    </View>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
            </TouchableOpacity>
          );
        })}
      </NbCard>
    </HardShadow>
  );
}

function RestOfWeekCard({ slots, selectedIndex, onSelectDay, colors }) {
  const upcoming = slots.filter((slot) => slot.index > selectedIndex);
  if (upcoming.length === 0) return null;

  return (
    <View style={{ gap: 10 }}>
      <SectionEyebrow label="Rest of the week" colors={colors} />
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <NbCard noShadow style={styles.listCard}>
          {upcoming.map((slot, i) => {
            const day = slot.day;
            const isRest = !day || day.rest;
            const { title } = day && !isRest ? sessionTitleLines(day) : { title: 'Rest' };
            const chipIndex = isRest ? 2 : i % accentGradients.length;
            const chipSource = isRest ? iconSleeping : i % 2 === 0 ? iconMuscle : iconDumbbells;
            let sub = '';
            if (isRest) {
              sub =
                String(day?.recoveryNote || '').trim() ||
                'Active recovery day. Focus on mobility and sleep.';
            } else {
              const count = (day?.exercises || []).length;
              sub = `${count} exercise${count === 1 ? '' : 's'}`;
            }
            return (
              <TouchableOpacity
                key={slot.short}
                onPress={() => onSelectDay(slot.index)}
                style={[
                  styles.weekAheadRow,
                  i > 0 && { borderTopWidth: nb.borderWidthDivider, borderTopColor: colors.nbBorder },
                ]}
                activeOpacity={0.82}
              >
                <NbIconChip source={chipSource} index={chipIndex} size={44} />
                <View style={styles.exGrow}>
                  <Text style={[styles.exName, { color: colors.nbInk }]} numberOfLines={1}>
                    {WEEK_ABBR[slot.index]} · {title}
                  </Text>
                  <Text style={[styles.exMeta, { color: colors.nbMuted }]} numberOfLines={2}>
                    {sub}
                  </Text>
                </View>
                {!isRest && <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />}
              </TouchableOpacity>
            );
          })}
        </NbCard>
      </HardShadow>
    </View>
  );
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

  return (
    <View style={{ gap: 16 }}>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <NbCard noShadow style={styles.notesCard}>
          <View style={styles.notesHead}>
            <NbIconChip source={iconJourney} index={3} size={44} />
            <Text style={[styles.notesTitle, { color: colors.nbInk }]}>Expected timeline</Text>
          </View>
          {steps.length === 0 ? (
            <Text style={[styles.notesBody, { color: colors.nbMuted }]}>
              No timeline was saved with this plan yet.
            </Text>
          ) : (
            <View style={styles.timeline}>
              {steps.map((step, i) => {
                const isFirst = i === 0;
                return (
                  <View key={`${step.title}-${i}`} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View
                        style={[
                          styles.timelineDot,
                          {
                            borderColor: colors.nbBorder,
                            backgroundColor: isFirst ? colors.nbFill : colors.nbSurface,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontWeight: '900',
                            fontSize: 12,
                            color: isFirst ? colors.nbOnFill : colors.nbInk,
                          }}
                        >
                          {i + 1}
                        </Text>
                      </View>
                      {i < steps.length - 1 && (
                        <View style={[styles.timelineLine, { backgroundColor: colors.nbBorder }]} />
                      )}
                    </View>
                    <View style={styles.timelineCopy}>
                      <Text style={[styles.timelineTitle, { color: colors.nbInk }]}>{step.title}</Text>
                      <Text style={[styles.notesBody, { color: colors.nbMuted }]}>{step.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </NbCard>
      </HardShadow>

      <HardShadow offset={nb.shadowOffsetCard} radius={10}>
        <NbCard noShadow style={[styles.notesCard, styles.notesCardAccent]}>
          <View style={styles.notesHead}>
            <NbIconChip source={iconInjury} index={2} size={44} />
            <Text style={[styles.notesTitle, { color: colors.nbInk }]}>Important notes</Text>
          </View>
          <Text style={[styles.notesBody, { color: colors.nbInk }]}>
            {importantNotes?.trim() || 'No important notes were saved with this plan yet.'}
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
            {nutritionGuidance?.trim() || 'No nutrition guidance was saved with this plan yet.'}
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

function ExerciseDetailModal({ visible, day, exerciseIndex, onClose, onChangeIndex, colors }) {
  const scrollBottomPad = useModalScrollBottomPad(40);
  const exercises = day?.exercises || [];
  const ex = exerciseIndex != null ? exercises[exerciseIndex] : null;
  const { title: sessionName } = day ? sessionTitleLines(day) : { title: '' };
  const { sets, reps, rest } = ex ? parseSetsRepsRest(ex) : { sets: '—', reps: '—', rest: '—' };
  const tips = ex ? splitTips(ex.notes) : [];
  const targets = ex ? muscleToTargets(ex.muscle) : [];
  const hasPrev = exerciseIndex > 0;
  const hasNext = exerciseIndex < exercises.length - 1;

  if (!visible || !ex) return null;

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
              maxHeight: Dimensions.get('window').height * SHEET_HEIGHT_RATIO,
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
              <NbPill variant="brand">
                {`${String(exerciseIndex + 1).padStart(2, '0')} / ${String(exercises.length).padStart(2, '0')}`}
              </NbPill>
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
              {[
                ['SETS', sets],
                ['REPS', reps],
                ['REST', rest],
              ].map(([label, value]) => (
                <View
                  key={label}
                  style={[
                    styles.statBox,
                    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                  ]}
                >
                  <Text style={[styles.statLabel, { color: colors.nbMuted }]}>{label}</Text>
                  <Text style={[styles.statValue, { color: colors.nbInk }]}>{value}</Text>
                </View>
              ))}
            </View>

            {targets.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>TARGETS</Text>
                <View style={styles.pillWrap}>
                  {targets.map((targetName) => (
                    <View
                      key={targetName}
                      style={[styles.targetPill, { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft }]}
                    >
                      <Text style={[styles.targetPillText, { color: colors.nbInk }]}>{targetName}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {tips.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>TIPS</Text>
                {tips.map((tip, i) => (
                  <View
                    key={i}
                    style={[styles.tipRow, { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder }]}
                  >
                    <View style={[styles.exNum, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
                      <Text style={[styles.exNumText, { color: colors.nbInk }]}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.tipBody, { color: colors.nbInk }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.navRow}>
              <NbButton
                variant="ghost"
                onPress={() => hasPrev && onChangeIndex(exerciseIndex - 1)}
                disabled={!hasPrev}
                style={{ flex: 1, opacity: hasPrev ? 1 : 0.35 }}
              >
                Previous
              </NbButton>
              <NbButton
                variant="fill"
                onPress={() => hasNext && onChangeIndex(exerciseIndex + 1)}
                disabled={!hasNext}
                style={{ flex: 1, opacity: hasNext ? 1 : 0.35 }}
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

function RecoveryFocusModal({ visible, day, items, segmentIndex, onClose, onChangeIndex, colors }) {
  const scrollBottomPad = useModalScrollBottomPad(40);
  const item = segmentIndex != null ? items[segmentIndex] : null;
  const hasPrev = segmentIndex > 0;
  const hasNext = segmentIndex < items.length - 1;
  const displayName = day ? recoveryDayDisplayName(day) : '';
  const meta = item ? parseRecoveryMeta(item.label) : {};
  const steps = item ? splitDetailIntoSteps(item.detail) : [];

  if (!visible || item == null || !day) return null;

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
              maxHeight: Dimensions.get('window').height * SHEET_HEIGHT_RATIO,
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
              <NbPill variant="brand">
                {`${String(segmentIndex + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`}
              </NbPill>
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
              <View style={[styles.statBox, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
                <Text style={[styles.statLabel, { color: colors.nbMuted }]}>TYPE</Text>
                <Text style={[styles.statValue, { color: colors.nbInk, fontSize: 15 }]}>{meta.type}</Text>
              </View>
              {meta.duration && (
                <View style={[styles.statBox, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
                  <Text style={[styles.statLabel, { color: colors.nbMuted }]}>DURATION</Text>
                  <Text style={[styles.statValue, { color: colors.nbInk, fontSize: 15 }]}>{meta.duration}</Text>
                </View>
              )}
              <View style={[styles.statBox, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
                <Text style={[styles.statLabel, { color: colors.nbMuted }]}>FOCUS</Text>
                <Text style={[styles.statValue, { color: colors.nbInk, fontSize: 15 }]}>{meta.focus}</Text>
              </View>
            </View>

            {steps.length > 1 ? (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>GUIDANCE</Text>
                {steps.map((step, i) => (
                  <View
                    key={i}
                    style={[styles.tipRow, { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder }]}
                  >
                    <View style={[styles.exNum, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
                      <Text style={[styles.exNumText, { color: colors.nbInk }]}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.tipBody, { color: colors.nbInk }]}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : item.detail ? (
              <Text style={[styles.notesBody, { color: colors.nbInk }]}>{item.detail}</Text>
            ) : (
              <Text style={[styles.notesBody, { color: colors.nbMuted }]}>
                Focus on {meta.type.toLowerCase()} and listen to your body.
              </Text>
            )}

            <View style={styles.navRow}>
              <NbButton
                variant="ghost"
                onPress={() => hasPrev && onChangeIndex(segmentIndex - 1)}
                disabled={!hasPrev}
                style={{ flex: 1, opacity: hasPrev ? 1 : 0.35 }}
              >
                Previous
              </NbButton>
              <NbButton
                variant="fill"
                onPress={() => hasNext && onChangeIndex(segmentIndex + 1)}
                disabled={!hasNext}
                style={{ flex: 1, opacity: hasNext ? 1 : 0.35 }}
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
  const theme = useTheme();
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET);
  const reserveShellBottomNav = route?.params?.reserveShellBottomNav === true;
  const modalScrollBottomPad = useModalScrollBottomPad(MODAL_SCROLL_PAD);
  const scrollBottomPad = reserveShellBottomNav ? shellBottomPad : modalScrollBottomPad;

  const isDarkOverride = route?.params?.isDarkOverride;
  const isDark = typeof isDarkOverride === 'boolean' ? isDarkOverride : theme.isDark;
  const colors = paletteFor(isDark);

  const handleRootBack = useCallback(() => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    if (typeof route?.params?.onBack === 'function') {
      route.params.onBack();
      return;
    }
    if (navigation?.canGoBack?.()) navigation.goBack();
  }, [onBack, route?.params, navigation]);

  const subViewBackRef = route?.params?.subViewBackRef;
  const onSubViewActiveChange = route?.params?.onSubViewActiveChange;

  const workoutPlan = route?.params?.workoutPlan || [];
  const overview = route?.params?.overview ? String(route.params.overview) : '';
  const weeksRemaining = route?.params?.weeksRemaining ?? DEFAULT_WEEKS_REMAINING;
  const focusSummary =
    route?.params?.focusSummary != null ? String(route.params.focusSummary) : DEFAULT_FOCUS_SUMMARY;
  const heroTitle =
    route?.params?.planHeroTitle != null ? String(route.params.planHeroTitle) : DEFAULT_HERO_TITLE;
  const planWeek = route?.params?.planWeek ?? route?.params?.currentWeek;

  const timelineText =
    route?.params?.timeline != null
      ? String(route.params.timeline)
      : route?.params?.expectedTimeline != null
        ? String(route.params.expectedTimeline)
        : '';
  const importantNotes =
    route?.params?.importantNotes != null
      ? String(route.params.importantNotes)
      : route?.params?.notes != null
        ? String(route.params.notes)
        : route?.params?.generalNotes != null
          ? String(route.params.generalNotes)
          : overview;
  const nutritionGuidance =
    route?.params?.nutritionGuidance != null
      ? String(route.params.nutritionGuidance)
      : route?.params?.nutrition != null
        ? String(route.params.nutrition)
        : route?.params?.nutritionNotes != null
          ? String(route.params.nutritionNotes)
          : '';

  const startSessionCb = onStartSession || route?.params?.onStartSession;
  const viewPdfCb = onViewPdf || route?.params?.onViewPdf;
  const sharePlanCb = onSharePlan || route?.params?.onSharePlan;
  const videosOnboarding = onboardingData || route?.params?.onboardingData;
  const videosSlotNode = videosSlot ?? route?.params?.videosSlot ?? null;

  const weekSlots = useMemo(() => buildWeekSlots(workoutPlan), [workoutPlan]);
  // JS getDay: 0=Sun → map to our WEEK_SHORTS index (Mon=0)
  const todayIndex = useMemo(() => {
    const jsDay = new Date().getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  }, []);

  const [tab, setTab] = useState(TAB_PLAN);
  const [selectedIndex, setSelectedIndex] = useState(() => {
    const todaySlot = weekSlots[todayIndex];
    if (todaySlot?.day) return todayIndex;
    const firstTraining = weekSlots.findIndex((s) => s.day && !s.day.rest);
    if (firstTraining >= 0) return firstTraining;
    const firstAny = weekSlots.findIndex((s) => s.day);
    return firstAny >= 0 ? firstAny : todayIndex;
  });
  const [exerciseModal, setExerciseModal] = useState(null);
  const [recoveryModalIndex, setRecoveryModalIndex] = useState(null);

  const selectedSlot = weekSlots[selectedIndex] || weekSlots[0];
  const selectedDay = selectedSlot?.day || null;
  const isSelectedToday = selectedIndex === todayIndex;

  const recoveryItems = useMemo(() => {
    if (!selectedDay?.rest) return [];
    return toRecoveryItems(selectedDay);
  }, [selectedDay]);

  const headerSubtitle = useMemo(() => {
    const name = heroTitle && heroTitle !== DEFAULT_HERO_TITLE ? heroTitle : focusSummary;
    if (planWeek != null && String(planWeek).trim()) {
      return `${name} · week ${planWeek}`;
    }
    return `${name} · ${weeksRemaining} weeks left`;
  }, [heroTitle, focusSummary, planWeek, weeksRemaining]);

  const sectionLabel = useMemo(() => {
    const full = selectedSlot?.fullName || '';
    if (isSelectedToday) return `Today, ${full}`;
    return full;
  }, [selectedSlot, isSelectedToday]);

  const inSubView = exerciseModal != null || recoveryModalIndex != null;

  useEffect(() => {
    onSubViewActiveChange?.(inSubView);
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

  const handleStartSession = useCallback(
    (day) => {
      if (!day || day.rest) return;

      // Parent may pass (day) or already expect { workoutName, exercises } — CreateWorkoutPlanScreen wraps either.
      if (typeof startSessionCb === 'function') {
        startSessionCb(day);
        return;
      }

      // Fallback: push Design Law session route directly (WorkoutPlanView / embeds without shell).
      const focusBits = String(day.focus || '')
        .split(/\s*·\s*/)
        .filter(Boolean);
      const workoutName =
        focusBits[0] || String(day.day || day.short || 'Workout').trim() || 'Workout';
      rootNavigate(CLIENT_ROUTES.WorkoutSession, {
        workoutName,
        exercises: Array.isArray(day.exercises) ? day.exercises : [],
      });
    },
    [startSessionCb],
  );

  const handleViewPdf = useCallback(() => {
    if (typeof viewPdfCb === 'function') {
      viewPdfCb();
      return;
    }
    Alert.alert('PDF', 'PDF export is not available for this plan yet.');
  }, [viewPdfCb]);

  const handleShare = useCallback(async () => {
    if (typeof sharePlanCb === 'function') {
      sharePlanCb();
      return;
    }
    try {
      const message = [headerSubtitle, overview, importantNotes, nutritionGuidance]
        .map((part) => String(part || '').trim())
        .filter(Boolean)
        .join('\n\n');
      await Share.share({
        title: SCREEN_TITLE,
        message: message || SCREEN_TITLE,
      });
    } catch (_) {
      /* user dismissed */
    }
  }, [sharePlanCb, headerSubtitle, overview, importantNotes, nutritionGuidance]);

  const emptyDayPlaceholder = (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <NbCard noShadow>
        <Text style={[styles.notesBody, { color: colors.nbMuted }]}>
          No session is planned for {selectedSlot?.fullName || 'this day'}. Pick another day from the week strip.
        </Text>
      </NbCard>
    </HardShadow>
  );

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

      {tab === TAB_VIDEOS ? (
        videosSlotNode != null ? (
          videosSlotNode
        ) : (
          <View style={{ flex: 1 }}>
            {/* Videos agent may replace this embed — ExerciseVideosTab is the current library */}
            <ExerciseVideosTab isDark={isDark} onboardingData={videosOnboarding} />
          </View>
        )
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
          {...FORM_SCROLL_PROPS}
        >
          {tab === TAB_PLAN && (
            <View style={{ gap: 16 }}>
              <WeekStrip
                slots={weekSlots}
                selectedIndex={selectedIndex}
                todayIndex={todayIndex}
                onSelect={setSelectedIndex}
                colors={colors}
              />
              <SectionEyebrow label={sectionLabel} colors={colors} />
              {selectedDay ? (
                <>
                  <TodayHeroCard
                    day={selectedDay}
                    workoutPlan={workoutPlan}
                    onStartSession={handleStartSession}
                    colors={colors}
                  />
                  <ExerciseListCard
                    day={selectedDay}
                    onOpenExercise={(idx) => {
                      if (selectedDay.rest) setRecoveryModalIndex(idx);
                      else setExerciseModal(idx);
                    }}
                    colors={colors}
                  />
                </>
              ) : (
                emptyDayPlaceholder
              )}
              <RestOfWeekCard
                slots={weekSlots}
                selectedIndex={selectedIndex}
                onSelectDay={setSelectedIndex}
                colors={colors}
              />
            </View>
          )}

          {tab === TAB_NOTES && (
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
      )}

      {selectedDay && !selectedDay.rest && (
        <ExerciseDetailModal
          visible={exerciseModal != null}
          day={selectedDay}
          exerciseIndex={exerciseModal}
          onClose={() => setExerciseModal(null)}
          onChangeIndex={setExerciseModal}
          colors={colors}
        />
      )}
      {selectedDay?.rest && (
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
