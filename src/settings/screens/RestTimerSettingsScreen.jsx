import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';

export default function RestTimerSettingsScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();
  const [selectedTime, setSelectedTime] = useState(60);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md + 8,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    backButton: {
      padding: spacing.sm,
    },
    backButtonText: {
      fontSize: 18,
      color: colors.primary,
      fontWeight: '600',
    },
    scrollContent: {
      padding: spacing.lg,
    },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.xl,
      lineHeight: 20,
    },
    timeButton: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: 12,
      marginBottom: spacing.sm,
      borderWidth: 2,
      borderColor: 'transparent',
      alignItems: 'center',
    },
    timeButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.purple[100],
    },
    timeButtonText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    timeButtonTextSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rest Timer</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Choose your default rest timer duration. This will be used between sets during your workouts.
        </Text>

        <TouchableOpacity
          style={[styles.timeButton, selectedTime === 30 && styles.timeButtonSelected]}
          onPress={() => setSelectedTime(30)}
          activeOpacity={0.7}
        >
          <Text style={[styles.timeButtonText, selectedTime === 30 && styles.timeButtonTextSelected]}>30s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.timeButton, selectedTime === 60 && styles.timeButtonSelected]}
          onPress={() => setSelectedTime(60)}
          activeOpacity={0.7}
        >
          <Text style={[styles.timeButtonText, selectedTime === 60 && styles.timeButtonTextSelected]}>60s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.timeButton, selectedTime === 90 && styles.timeButtonSelected]}
          onPress={() => setSelectedTime(90)}
          activeOpacity={0.7}
        >
          <Text style={[styles.timeButtonText, selectedTime === 90 && styles.timeButtonTextSelected]}>90s</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}











