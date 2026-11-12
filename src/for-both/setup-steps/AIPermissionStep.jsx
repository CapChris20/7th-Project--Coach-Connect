// Design Law AI opt-in step — hero Lottie, feature list, Turn on / Not now.
// Flow: show features → Turn on sets aiEnabled true → Not now skips. Does not spend monthly switch allowance.
// Used by NewUserSetupScreen client step 9. PNG: client-onboarding 13/14.

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

const AI_LOTTIE = require('../../assets/animations/handoff/robot.json');

const AI_FEATURES = [
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

// ===== MAIN FUNCTION =====

/**
 * Optional AI opt-in step during onboarding.
 * @param {object} props
 */
export function AIPermissionStep({
  isDark,
  currentStep,
  totalSteps,
  onEnableAI,
  onSkipAI,
  // Design Law footer owns Not now / Turn on when true (side-by-side in bnav).
  hideActions = false,
}) {
  const { colors } = useTheme();
  const features = useMemo(() => AI_FEATURES, []);

  return (
    <View style={{ width: '100%' }}>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbHero} style={{ marginBottom: spacing.md }}>
        <View
          style={[
            styles.heroFrame,
            {
              borderColor: colors.nbBorder,
              backgroundColor: colors.nbSurface,
            },
          ]}
        >
          <LottieView source={AI_LOTTIE} autoPlay loop style={styles.lottie} />
        </View>
      </HardShadow>

      <Text style={[styles.title, { color: colors.nbInk }]}>Turn on AI features?</Text>

      <NbCard style={{ marginBottom: spacing.md, paddingHorizontal: 4 }}>
        {features.map((feature, index) => (
          <View key={feature.title}>
            <View style={styles.featureRow}>
              <View style={[styles.iconChip, { borderColor: colors.nbBorder }]}>
                <LinearGradient
                  colors={feature.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconChipFill}
                >
                  <Image source={feature.icon} style={{ width: 26, height: 26 }} resizeMode="contain" />
                </LinearGradient>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.featureTitle, { color: colors.nbInk }]}>{feature.title}</Text>
                <Text style={[styles.featureSub, { color: colors.nbMuted }]}>{feature.description}</Text>
              </View>
            </View>
            {index < features.length - 1 ? (
              <View style={{ height: 2, backgroundColor: colors.nbBorder, marginHorizontal: 10 }} />
            ) : null}
          </View>
        ))}
      </NbCard>

      <Text style={[styles.help, { color: colors.nbMuted }]}>
        Replies are suggestions, not medical advice. You can switch this off any time in Settings.
      </Text>

      {hideActions ? null : (
        <View style={[styles.buttonContainer, { flexDirection: 'row', gap: spacing.sm }]}>
          <NbButton variant="ghost" onPress={onSkipAI} style={{ flex: 1 }}>
            Not now
          </NbButton>
          <NbButton variant="fill" onPress={onEnableAI} style={{ flex: 1 }}>
            Turn on
          </NbButton>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  heroFrame: {
    height: 180,
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
