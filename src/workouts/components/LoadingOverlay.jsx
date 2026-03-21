/**
 * Loading Overlay Component
 * 
 * Shows progress messages during workout plan generation.
 * Reusable for both initial generation and regeneration flows.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '../../shared/ui/ThemeContext';

const PROGRESS_MESSAGES = [
  "Analyzing your goals and limitations…",
  "Structuring weekly training split…",
  "Balancing volume and recovery…",
  "Selecting exercises based on equipment…",
  "Adjusting intensity and progression…",
  "Finalizing your program…",
];

const PROGRESS_PERCENTAGES = [
  { message: "Plan creation: 15%", index: 0 },
  { message: "Plan creation: 40%", index: 2 },
  { message: "Plan creation: 65%", index: 4 },
  { message: "Almost done…", index: 5 },
];

export default function LoadingOverlay({ visible, error = null, title = "Building Your Workout Plan", onErrorDismiss = null }) {
  const { colors, spacing, isDark } = useTheme();
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [showPercentage, setShowPercentage] = useState(false);

  const styles = createStyles(spacing, colors, isDark);

  useEffect(() => {
    if (!visible || error) {
      setCurrentMessageIndex(0);
      setShowPercentage(false);
      return;
    }

    // Cycle through messages every 1.8 seconds (only when no error)
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => {
        const next = (prev + 1) % PROGRESS_MESSAGES.length;
        return next;
      });
    }, 1800);

    // Show percentage updates at specific intervals
    const percentageInterval = setInterval(() => {
      setShowPercentage(true);
      setTimeout(() => setShowPercentage(false), 1500);
    }, 3000);

    return () => {
      clearInterval(messageInterval);
      clearInterval(percentageInterval);
    };
  }, [visible, error]);

  if (!visible) return null;

  // If error exists, show error message instead of cycling
  const currentMessage = error 
    ? error
    : PROGRESS_MESSAGES[currentMessageIndex];

  const percentageMessage = error 
    ? null
    : PROGRESS_PERCENTAGES.find(
        p => p.index === currentMessageIndex
      );

  return (
    <Modal transparent visible={visible} animationType="fade" presentationStyle="overFullScreen">
      <View style={styles.overlay} pointerEvents={error ? "auto" : "box-none"}>
        <View style={styles.container} pointerEvents="auto">
          <Text style={styles.title}>{title}</Text>
          
          <ActivityIndicator 
            size="large" 
            color={colors.primary} 
            style={styles.spinner}
          />

          <Text style={styles.message}>{currentMessage}</Text>
          
          {showPercentage && percentageMessage && !error && (
            <Text style={styles.percentage}>{percentageMessage.message}</Text>
          )}

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>❌ Error</Text>
              <Text style={styles.errorText} selectable={true}>{error}</Text>
              <TouchableOpacity
                style={styles.errorButton}
                onPress={() => {
                  // Allow parent to handle error dismissal
                  if (onErrorDismiss) {
                    onErrorDismiss();
                  }
                }}
              >
                <Text style={styles.errorButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      backgroundColor: isDark ? '#FFFFFF' : '#FFFFFF',
      borderRadius: 20,
      padding: spacing.xl,
      alignItems: 'center',
      minWidth: 280,
      maxWidth: 320,
    },
    title: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    spinner: {
      marginBottom: spacing.lg,
    },
    message: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.xs,
      lineHeight: 22,
    },
    percentage: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.xs,
      fontWeight: '500',
    },
    errorContainer: {
      marginTop: spacing.md,
      width: '100%',
    },
    errorTitle: {
      fontSize: 18,
      color: '#ef4444',
      textAlign: 'center',
      marginBottom: spacing.sm,
      fontWeight: '700',
    },
    errorText: {
      fontSize: 14,
      color: '#ef4444',
      textAlign: 'center',
      marginBottom: spacing.sm,
      fontWeight: '600',
      lineHeight: 20,
    },
    errorButton: {
      backgroundColor: '#ef4444',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 8,
      marginTop: spacing.xs,
    },
    errorButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

