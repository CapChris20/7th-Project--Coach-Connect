// Design Law AI opt-in step — hero Lottie, feature list, Turn on / Not now (PNG 13/14).
// Flow: hero → three feature rows → disclaimer → optional footer buttons.
// Used by NewUserSetupScreen client step 7. hideActions=true lets the wizard footer own the CTAs.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import NbButton from '../../look-and-feel/NbButton';
import NbCard from '../../look-and-feel/NbCard';
import HardShadow from '../../look-and-feel/HardShadow';

// ===== NAMED CONSTANTS =====

// Manipulate here: Lottie JSON for the robot hero (Design-Law handoff asset).
const ROBOT_LOTTIE = require('../../assets/animations/handoff/robot.json');

const FEATURE_ICON_SIZE = 26;
const DIVIDER_HEIGHT = 2;
const DIVIDER_SIDE_MARGIN = 10;

// Each row gets its own small gradient chip icon (matches onboarding macro pills).
// Manipulate here: titles / blurbs / icons / which accentGradients index each chip uses.
const AI_OPT_IN_FEATURES = [
  {
    title: 'Ask the coach anything',
    description: 'Training, food and recovery questions',
    icon: require('../../assets/icons/handoff/people.png'),
    gradient: accentGradients[2],
  },
  {
    title: 'Plan changes you approve',
    description: 'Nothing changes until you tap apply',
    icon: require('../../assets/icons/handoff/workout.png'),
    gradient: accentGradients[0],
  },
  {
    title: 'Your answers personalize it',
    description: 'Sent to the AI provider to tailor replies',
    icon: require('../../assets/icons/handoff/week.png'),
    gradient: accentGradients[4],
  },
];

const DISCLAIMER_COPY =
  'Replies are suggestions, not medical advice. You can switch this off any time in Settings.';

// ===== HELPER FUNCTIONS =====

/** Tall framed Lottie hero — Design Law PNG 13 robot. */
function AiHeroRobot({ borderColor, surfaceColor }) {
  const heroFrameStyle = [
    styles.heroFrame,
    {
      borderColor,
      backgroundColor: surfaceColor,
    },
  ];

  return (
    <HardShadow
      offset={nb.shadowOffsetCard}
      radius={borderRadius.nbHero}
      style={{ marginBottom: spacing.md }}
    >
      <View style={heroFrameStyle}>
        {/* vocab: LottieView = plays the JSON animation; autoPlay + loop keep the robot moving */}
        <LottieView source={ROBOT_LOTTIE} autoPlay loop style={styles.lottie} />
      </View>
    </HardShadow>
  );
}

/** Thin rule between feature rows (not after the last one). */
function AiFeatureDivider({ borderColor }) {
  return (
    <View
      style={{
        height: DIVIDER_HEIGHT,
        backgroundColor: borderColor,
        marginHorizontal: DIVIDER_SIDE_MARGIN,
      }}
    />
  );
}

/** One benefit row: gradient chip + title + short blurb. */
function AiFeatureRow({ feature, inkColor, mutedColor, borderColor }) {
  const titleStyle = [styles.featureTitle, { color: inkColor }];
  const subtitleStyle = [styles.featureSub, { color: mutedColor }];
  const chipBorderStyle = [styles.iconChip, { borderColor }];

  return (
    <View style={styles.featureRow}>
      <View style={chipBorderStyle}>
        <LinearGradient
          colors={feature.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconChipFill}
        >
          <Image
            source={feature.icon}
            style={{ width: FEATURE_ICON_SIZE, height: FEATURE_ICON_SIZE }}
            resizeMode="contain"
          />
        </LinearGradient>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={titleStyle}>{feature.title}</Text>
        <Text style={subtitleStyle}>{feature.description}</Text>
      </View>
    </View>
  );
}

/**
 * Inline Turn on / Not now. Hidden when the parent wizard footer owns those CTAs.
 */
function AiOptInActionRow({ onSkipAI, onEnableAI, showActions }) {
  if (!showActions) return null;

  return (
    <View style={[styles.buttonContainer, { flexDirection: 'row', gap: spacing.sm }]}>
      <NbButton variant="ghost" onPress={onSkipAI} style={{ flex: 1 }}>
        Not now
      </NbButton>
      <NbButton variant="fill" onPress={onEnableAI} style={{ flex: 1 }}>
        Turn on
      </NbButton>
    </View>
  );
}

/** Build the feature list with dividers between rows (not after the last). */
function AiFeatureListCard({ featureRows, inkColor, mutedColor, borderColor }) {
  const featureNodes = [];

  for (let rowIndex = 0; rowIndex < featureRows.length; rowIndex += 1) {
    const feature = featureRows[rowIndex];
    const isLastRow = rowIndex === featureRows.length - 1;

    featureNodes.push(
      <View key={feature.title}>
        <AiFeatureRow
          feature={feature}
          inkColor={inkColor}
          mutedColor={mutedColor}
          borderColor={borderColor}
        />
        {isLastRow ? null : <AiFeatureDivider borderColor={borderColor} />}
      </View>,
    );
  }

  return <NbCard style={{ marginBottom: spacing.md, paddingHorizontal: 4 }}>{featureNodes}</NbCard>;
}

// ===== MAIN FUNCTION =====

/**
 * Optional AI opt-in during client onboarding (step 7).
 * Props isDark / currentStep / totalSteps stay on the signature for the wizard parent even if unused here.
 */
export function AIPermissionStep({
  isDark,
  currentStep,
  totalSteps,
  onEnableAI,
  onSkipAI,
  hideActions = false,
}) {
  // Keep unused wizard props referenced so freeze / lint stays quiet without changing call sites.
  void isDark;
  void currentStep;
  void totalSteps;

  // 1. Theme colors for ink / muted / border / surface.
  // vocab: useTheme = Design Law nb* colors for light/dark
  const { colors } = useTheme();

  // 2. Stable feature list — parent re-renders should not rebuild feature objects.
  // vocab: useMemo = keep the same array reference unless deps change (deps are empty → forever)
  const featureRows = useMemo(() => AI_OPT_IN_FEATURES, []);

  // 3. Name the decisions before JSX (inline CTAs vs wizard footer owns them).
  const showInlineActions = !hideActions;
  const inkColor = colors.nbInk;
  const mutedColor = colors.nbMuted;
  const borderColor = colors.nbBorder;
  const surfaceColor = colors.nbSurface;
  const titleStyle = [styles.title, { color: inkColor }];
  const helpStyle = [styles.help, { color: mutedColor }];

  // 4. Hero → title → feature card → disclaimer → optional Turn on / Not now.
  return (
    <View style={{ width: '100%' }}>
      <AiHeroRobot borderColor={borderColor} surfaceColor={surfaceColor} />

      <Text style={titleStyle}>Turn on AI features?</Text>

      <AiFeatureListCard
        featureRows={featureRows}
        inkColor={inkColor}
        mutedColor={mutedColor}
        borderColor={borderColor}
      />

      <Text style={helpStyle}>{DISCLAIMER_COPY}</Text>

      <AiOptInActionRow
        onSkipAI={onSkipAI}
        onEnableAI={onEnableAI}
        showActions={showInlineActions}
      />
    </View>
  );
}

// PLUMBING — skip unless debugging Design Law hero / chip sizes

const styles = StyleSheet.create({
  heroFrame: {
    // Manipulate here: PNG 13 hero height — keep tall enough for robot Lottie
    height: 200,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbHero,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginBottom: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.nbIconChip,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  iconChipFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 2,
  },
  featureSub: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  help: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  buttonContainer: {
    marginTop: spacing.sm,
  },
});
