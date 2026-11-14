// Design Law “Building your plan” wait screen (workouts PNG 15–16).
// Flow: title → Lottie HardShadow → Almost there → NbProgressBar → checklist → Back to Today.
// Used by CreateWorkoutPlanScreen while isGenerating. Leaving does not cancel generation.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NbButton from '../../look-and-feel/NbButton';
import NbProgressBar from '../../look-and-feel/NbProgressBar';
import HardShadow from '../../look-and-feel/HardShadow';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: Lottie inside the hero card (Design Law handoff diet loop)
const BUILDING_PLAN_LOTTIE = require('../../assets/animations/handoff/diet.json');

// Manipulate here: checklist copy — 4 steps matching PNG 15 (equipment/injury rows get personalized labels)
const DEFAULT_CHECKLIST_STEPS = [
  { id: 'profile', label: 'Reading your profile' },
  { id: 'exercises', label: 'Choosing exercises for your equipment' },
  { id: 'injuries', label: 'Working around your injuries' },
  { id: 'notes', label: 'Writing notes and nutrition guidance' },
];

// vocab: checklist row status — done | current | pending (drives filled / dashed / empty circles)
const CHECKLIST_STATUS_DONE = 'done';
const CHECKLIST_STATUS_CURRENT = 'current';
const CHECKLIST_STATUS_PENDING = 'pending';

// Half-fill on the active step so the bar moves before the step flips to done
const PROGRESS_HALF_STEP = 0.55;

// ===== HELPER FUNCTIONS =====

/**
 * Short equipment phrase for the “Choosing exercises for …” checklist row.
 * @param {unknown} equipmentAccess
 * @returns {string}
 */
function equipmentPhraseForChecklist(equipmentAccess) {
  const equipmentIsArray = Array.isArray(equipmentAccess);
  const equipmentNames = equipmentIsArray
    ? equipmentAccess.filter(Boolean)
    : [];

  if (equipmentNames.length === 0) {
    return 'your equipment';
  }

  // Show at most two names so the row stays one line on phone widths.
  const firstTwoNames = equipmentNames.slice(0, 2);
  const spokenNames = firstTwoNames.map((item) => String(item).replace(/_/g, ' '));
  return spokenNames.join(' and ');
}

/**
 * Injury checklist label — personalize when the user typed something other than “none”.
 * @param {object | null | undefined} onboardingData
 * @returns {string}
 */
function injuryChecklistLabelFromProfile(onboardingData) {
  const injuriesRaw = String(onboardingData?.injuries || '').trim();
  const userReportedInjury = Boolean(injuriesRaw) && !/^none/i.test(injuriesRaw);

  if (userReportedInjury) {
    return `Working around ${injuriesRaw}`;
  }
  return 'Working around your injuries';
}

/**
 * Build the four checklist rows with equipment + injury personalization.
 * @param {object | null | undefined} onboardingData
 * @returns {Array<{ id: string, label: string }>}
 */
function buildPersonalizedChecklistSteps(onboardingData) {
  const equipmentLabel = equipmentPhraseForChecklist(onboardingData?.equipmentAccess);
  const injuryLabel = injuryChecklistLabelFromProfile(onboardingData);

  return [
    DEFAULT_CHECKLIST_STEPS[0],
    {
      ...DEFAULT_CHECKLIST_STEPS[1],
      label: `Choosing exercises for ${equipmentLabel}`,
    },
    { ...DEFAULT_CHECKLIST_STEPS[2], label: injuryLabel },
    DEFAULT_CHECKLIST_STEPS[3],
  ];
}

/**
 * Map rotating status-message index → which checklist step is current (0 … stepCount-1).
 * @param {number} messageIndex
 * @param {number} stepCount
 * @returns {number}
 */
function activeChecklistIndexFromMessage(messageIndex, stepCount) {
  // vocab: messageIndex — CreateWorkoutPlanScreen rotates status copy while Claude works; reuse as progress proxy
  const safeIndex = Math.max(0, Number(messageIndex) || 0);
  const rawStep = Math.floor(safeIndex % (stepCount + 1));
  return Math.min(stepCount - 1, rawStep);
}

/**
 * done / current / pending for one checklist row relative to the active index.
 * @param {number} rowIndex
 * @param {number} activeIndex
 * @returns {string}
 */
function checklistStatusForRowIndex(rowIndex, activeIndex) {
  if (rowIndex < activeIndex) {
    return CHECKLIST_STATUS_DONE;
  }
  if (rowIndex === activeIndex) {
    return CHECKLIST_STATUS_CURRENT;
  }
  return CHECKLIST_STATUS_PENDING;
}

/**
 * Filled check, dashed ring, or empty ring for one checklist row.
 */
function ChecklistStatusDot({ status, colors }) {
  if (status === CHECKLIST_STATUS_DONE) {
    return (
      <View style={[styles.dotFill, { backgroundColor: colors.nbFill }]}>
        <Ionicons name="checkmark" size={14} color={colors.nbOnFill} />
      </View>
    );
  }

  const isInProgress = status === CHECKLIST_STATUS_CURRENT;
  let borderStyle = 'solid';
  if (isInProgress) {
    borderStyle = 'dashed';
  }

  return (
    <View
      style={[
        styles.dotOutline,
        {
          borderColor: colors.nbBorder,
          borderStyle,
          backgroundColor: 'transparent',
        },
      ]}
    />
  );
}

/**
 * Pure layout — no hooks. Parent owns theme, padding, and progress numbers.
 */
function BuildingYourPlanScrollBody({
  colors,
  topPad,
  contentContainerStyle,
  checklistSteps,
  activeStepIndex,
  progressRatio,
  showBackToToday,
  onBackToToday,
}) {
  const titleColor = { color: colors.nbInk };
  const mutedColor = { color: colors.nbMuted };
  const lottieCardChrome = {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder,
  };
  const checkCardChrome = {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder,
  };
  const scrollPadStyle = { paddingTop: topPad };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scroll, scrollPadStyle, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, titleColor]}>Building your plan</Text>

      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.lottieWrap}>
        <View style={[styles.lottieCard, lottieCardChrome]}>
          <LottieView source={BUILDING_PLAN_LOTTIE} autoPlay loop style={styles.lottie} />
        </View>
      </HardShadow>

      <Text style={[styles.almost, titleColor]}>Almost there</Text>
      <Text style={[styles.minute, mutedColor]}>This takes about a minute.</Text>

      <NbProgressBar
        progress={progressRatio}
        colors={accentGradients[9]}
        index={9}
        style={styles.bar}
      />

      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
        <View style={[styles.checkCard, checkCardChrome]}>
          {checklistSteps.map((step, rowIndex) => {
            const rowStatus = checklistStatusForRowIndex(rowIndex, activeStepIndex);
            return (
              <View key={step.id} style={styles.checkRow}>
                <ChecklistStatusDot status={rowStatus} colors={colors} />
                <Text style={[styles.checkLabel, titleColor]}>{step.label}</Text>
              </View>
            );
          })}
        </View>
      </HardShadow>

      <Text style={[styles.leaveHint, mutedColor]}>
        You can leave this screen. Your plan keeps building and shows up in Saved plans.
      </Text>

      {showBackToToday ? (
        <NbButton variant="plain" onPress={onBackToToday} style={{ marginTop: 16 }}>
          Back to Today
        </NbButton>
      ) : null}
    </ScrollView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Wait screen while Claude builds the plan. Props drive personalization + progress proxy.
 * Flow: 1. theme + safe area  2. personalized checklist  3. progress from messageIndex  4. layout
 * @param {{ onboardingData?: object, messageIndex?: number, onBackToToday?: Function, contentContainerStyle?: object }} props
 */
export default function BuildingYourPlanView({
  onboardingData,
  messageIndex = 0,
  onBackToToday,
  contentContainerStyle,
}) {
  // 1. Theme + shell safe area (status bar / Dynamic Island).
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // 2. Checklist rows (equipment + injury labels) — memoized so onboardingData swaps don’t rebuild every paint.
  // vocab: useMemo — only recompute when onboardingData identity changes
  const checklistSteps = useMemo(
    () => buildPersonalizedChecklistSteps(onboardingData),
    [onboardingData],
  );

  // 3. Active step + progress bar ratio (half-step on the current row).
  const activeStepIndex = activeChecklistIndexFromMessage(
    messageIndex,
    checklistSteps.length,
  );
  const progressRatio = Math.min(
    1,
    (activeStepIndex + PROGRESS_HALF_STEP) / checklistSteps.length,
  );

  // Shell SafeArea is left/right only — pad under status bar / Dynamic Island
  const topPad = Math.max(insets.top, 0) + spacing.sm;
  const showBackToToday = typeof onBackToToday === 'function';

  // 4. Hand numbers to the pure layout body.
  return (
    <BuildingYourPlanScrollBody
      colors={colors}
      topPad={topPad}
      contentContainerStyle={contentContainerStyle}
      checklistSteps={checklistSteps}
      activeStepIndex={activeStepIndex}
      progressRatio={progressRatio}
      showBackToToday={showBackToToday}
      onBackToToday={onBackToToday}
    />
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 28,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: 14,
  },
  lottieWrap: {
    marginBottom: 16,
  },
  lottieCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 8,
  },
  lottie: {
    width: '100%',
    height: 144,
  },
  almost: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  minute: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 14,
  },
  bar: {
    marginBottom: 16,
  },
  checkCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingVertical: 6,
  },
  checkLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  // Manipulate here: checklist circle size (PNG ~22)
  dotFill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOutline: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: nb.borderWidth,
  },
  leaveHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: 14,
  },
});
