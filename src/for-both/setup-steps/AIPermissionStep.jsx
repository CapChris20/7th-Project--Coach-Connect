// Onboarding step: ask whether to turn on optional AI tools (coach, generator, tracking, tips).
// Flow: show the lottie + feature list → Yes enables AI → No skips. This choice does not spend the monthly switch allowance.
// Used by: NewUserSetupScreen as one of the setup steps.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, gradients, spacing } from '../../look-and-feel/colorPalette';
import NbHero from '../../look-and-feel/NbHero';
import NbButton from '../../look-and-feel/NbButton';
import NbCard from '../../look-and-feel/NbCard';
import NbListRow from '../../look-and-feel/NbListRow';
import NbSwitch from '../../look-and-feel/NbSwitch';

// ===== NAMED CONSTANTS =====

const AI_LOTTIE = require('../../assets/animations/legacy/Artificial intelligence digital technology (1).json');

const AI_FEATURES = [
  {
    icon: 'chatbubble',
    title: 'AI fitness coach',
    description: 'Chat any time for personalized coaching',
  },
  {
    icon: 'flash',
    title: 'Workout generator',
    description: 'Plans built for you automatically',
  },
  {
    icon: 'locate',
    title: 'Smart progress tracking',
    description: 'Insights from your logs',
  },
  {
    icon: 'sparkles',
    title: 'Form and recovery tips',
    description: 'Daily suggestions to optimize training',
  },
];

// ===== HELPER FUNCTIONS =====

// No helper functions needed — using Neobrutalist components

// ===== MAIN FUNCTION =====

/**
 * Optional AI opt-in step during onboarding.
 * Redesigned with Neobrutalist components per docs/design/DESIGN.md.
 * @param {object} props
 */
export function AIPermissionStep({
  isDark,
  currentStep,
  totalSteps,
  onEnableAI,
  onSkipAI,
}) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;

  const features = useMemo(() => AI_FEATURES, []);
  const [enabled, setEnabled] = React.useState(true);

  return (
    <View style={{ width: '100%' }}>
      {/* Lottie animation in a soft gradient frame */}
      <View style={styles.animationContainer}>
        <LottieView source={AI_LOTTIE} autoPlay loop style={styles.lottie} />
      </View>

      <NbHero
        title="AI-powered features"
        subtitle="Optional. You can change this in settings."
      />

      <Text
        style={[
          styles.help,
          { color: colors.nbMuted, marginBottom: spacing.lg },
        ]}
      >
        All optional. You can change this in settings.
      </Text>

      {/* Feature list using NbListRow with switches */}
      <NbCard style={{ marginBottom: spacing.lg }}>
        {features.map((feature, index) => (
          <View key={feature.title}>
            <NbListRow
              title={feature.title}
              subtitle={feature.description}
              right={
                <NbSwitch
                  value={enabled}
                  onValueChange={setEnabled}
                />
              }
            />
            {index < features.length - 1 && <View style={{ height: 1, backgroundColor: colors.nbBorder }} />}
          </View>
        ))}
      </NbCard>

      <View style={[styles.buttonContainer, { gap: spacing.sm }]}>
        <NbButton variant="brand" onPress={onEnableAI} style={{ width: '100%' }}>
          Enable AI
        </NbButton>
        <NbButton variant="plain" onPress={onSkipAI} style={{ width: '100%' }}>
          No, skip
        </NbButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  animationContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  help: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
});
