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

const BUILD_LOTTIE = require('../../assets/animations/handoff/diet.json');

// Manipulate here: checklist copy — 4 steps matching PNG 15
const CHECKLIST_BASE = [
  { id: 'profile', label: 'Reading your profile' },
  { id: 'exercises', label: 'Choosing exercises for your equipment' },
  { id: 'injuries', label: 'Working around your injuries' },
  { id: 'notes', label: 'Writing notes and nutrition guidance' },
];

// vocab: status = done | current | pending — drives filled / dashed / empty circles
const STATUS_DONE = 'done';
const STATUS_CURRENT = 'current';
const STATUS_PENDING = 'pending';

// ===== HELPER FUNCTIONS =====

function checklistWithEquipment(onboardingData) {
  const equipment = Array.isArray(onboardingData?.equipmentAccess)
    ? onboardingData.equipmentAccess.filter(Boolean)
    : [];
  const equipmentLabel =
    equipment.length > 0
      ? equipment
          .slice(0, 2)
          .map((item) => String(item).replace(/_/g, ' '))
          .join(' and ')
      : 'your equipment';

  const injuryRaw = String(onboardingData?.injuries || '').trim();
  const injuryLabel =
    injuryRaw && !/^none/i.test(injuryRaw)
      ? `Working around ${injuryRaw}`
      : 'Working around your injuries';

  return [
    CHECKLIST_BASE[0],
    { ...CHECKLIST_BASE[1], label: `Choosing exercises for ${equipmentLabel}` },
    { ...CHECKLIST_BASE[2], label: injuryLabel },
    CHECKLIST_BASE[3],
  ];
}

/**
 * Map rotating message index → which checklist step is current (0–3).
 * Progress bar fills as steps complete.
 */
function stepStateFromMessageIndex(messageIndex, stepCount) {
  // vocab: messageIndex advances while Claude generates — reuse as progress proxy
  const capped = Math.max(0, Number(messageIndex) || 0);
  const currentStep = Math.min(stepCount - 1, Math.floor(capped % (stepCount + 1)));
  return currentStep;
}

function ChecklistDot({ status, colors }) {
  if (status === STATUS_DONE) {
    return (
      <View style={[styles.dotFill, { backgroundColor: colors.nbFill }]}>
        <Ionicons name="checkmark" size={14} color={colors.nbOnFill} />
      </View>
    );
  }
  if (status === STATUS_CURRENT) {
    // Dashed ring = in progress (PNG 15)
    return (
      <View
        style={[
          styles.dotOutline,
          {
            borderColor: colors.nbBorder,
            borderStyle: 'dashed',
            backgroundColor: 'transparent',
          },
        ]}
      />
    );
  }
  return (
    <View
      style={[
        styles.dotOutline,
        { borderColor: colors.nbBorder, borderStyle: 'solid', backgroundColor: 'transparent' },
      ]}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ onboardingData?: object, messageIndex?: number, onBackToToday?: Function, contentContainerStyle?: object }} props
 */
export default function BuildingYourPlanView({
  onboardingData,
  messageIndex = 0,
  onBackToToday,
  contentContainerStyle,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const steps = useMemo(() => checklistWithEquipment(onboardingData), [onboardingData]);
  const currentStep = stepStateFromMessageIndex(messageIndex, steps.length);
  // Progress: fill past steps + half of current
  const progress = Math.min(1, (currentStep + 0.55) / steps.length);
  // Shell SafeArea is left/right only — pad under status bar / Dynamic Island
  const topPad = Math.max(insets.top, 0) + spacing.sm;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scroll, { paddingTop: topPad }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.title, { color: colors.nbInk }]}>Building your plan</Text>

      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.lottieWrap}>
        <View
          style={[
            styles.lottieCard,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          <LottieView source={BUILD_LOTTIE} autoPlay loop style={styles.lottie} />
        </View>
      </HardShadow>

      <Text style={[styles.almost, { color: colors.nbInk }]}>Almost there</Text>
      <Text style={[styles.minute, { color: colors.nbMuted }]}>This takes about a minute.</Text>

      {/* Accent gradient fill only — track stays soft/surface */}
      <NbProgressBar
        progress={progress}
        colors={accentGradients[9]}
        index={9}
        style={styles.bar}
      />

      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
        <View
          style={[
            styles.checkCard,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          {steps.map((step, index) => {
            let status = STATUS_PENDING;
            if (index < currentStep) status = STATUS_DONE;
            else if (index === currentStep) status = STATUS_CURRENT;
            return (
              <View key={step.id} style={styles.checkRow}>
                <ChecklistDot status={status} colors={colors} />
                <Text style={[styles.checkLabel, { color: colors.nbInk }]}>{step.label}</Text>
              </View>
            );
          })}
        </View>
      </HardShadow>

      <Text style={[styles.leaveHint, { color: colors.nbMuted }]}>
        You can leave this screen. Your plan keeps building and shows up in Saved plans.
      </Text>

      {typeof onBackToToday === 'function' ? (
        <NbButton variant="plain" onPress={onBackToToday} style={{ marginTop: 16 }}>
          Back to Today
        </NbButton>
      ) : null}
    </ScrollView>
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
