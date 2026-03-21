import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../ui/ThemeContext';

const GRADIENTS = {
  bluePurple: ['#5B86E5', '#A855F7'],
};

export default function OnboardingProgress({ currentStep, totalSteps = 6, title }) {
  const { isDark } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [currentStep, pulse]);

  const currentScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const currentGlowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.25] });

  const pillBase = useMemo(
    () => ({
      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
      borderColor: isDark ? 'rgba(255,255,255,0.18)' : '#E2E8F0',
    }),
    [isDark]
  );

  return (
    <View style={styles.container}>
      <View style={styles.progressContainer}>
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          if (isCompleted) {
            return (
              <View key={index} style={styles.pillShell}>
                <LinearGradient colors={GRADIENTS.bluePurple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pillFill}>
                  <Text style={styles.checkmark}>✓</Text>
                </LinearGradient>
              </View>
            );
          }

          if (isCurrent) {
            return (
              <Animated.View
                key={index}
                style={[
                  styles.pillShell,
                  {
                    transform: [{ scale: currentScale }],
                    shadowColor: '#5B86E5',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: currentGlowOpacity,
                    shadowRadius: 12,
                    elevation: 6,
                  },
                ]}
              >
                <LinearGradient colors={GRADIENTS.bluePurple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pillBorder}>
                  <View style={[styles.pillInner, pillBase]} />
                </LinearGradient>
              </Animated.View>
            );
          }

          return (
            <View key={index} style={[styles.pillShell, styles.pillUpcoming, { opacity: 0.5 }]}>
              <View style={[styles.pillInner, pillBase]} />
            </View>
          );
        })}
      </View>

      <Text style={[styles.stepText, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.55)' }]}>
        Step {currentStep} of {totalSteps}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pillShell: {
    width: 40,
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  pillFill: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBorder: {
    flex: 1,
    borderRadius: 999,
    padding: 2,
  },
  pillInner: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillUpcoming: {
    backgroundColor: 'transparent',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 10,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

