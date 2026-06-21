/**
 * Goals Targets Screen
 *
 * Purpose: UI screen or component: Goals Targets Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: EditFitnessGoalsScreen
 *
 * @file-header
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared-ui/ThemeContext';

export default function EditFitnessGoalsScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();

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
    settingItem: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: 12,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    settingItemText: {
      fontSize: 16,
      color: colors.text,
      fontWeight: '500',
    },
    settingItemArrow: {
      fontSize: 18,
      color: colors.textSecondary,
    },
  });

  const handlePress = (item) => {
    if (__DEV__) console.log(`Pressed: ${item}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Goals & Targets</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity 
          style={styles.settingItem} 
          activeOpacity={0.7}
          onPress={() => handlePress('Fitness Goals')}
        >
          <Text style={styles.settingItemText}>Fitness Goals</Text>
          <Text style={styles.settingItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem} 
          activeOpacity={0.7}
          onPress={() => handlePress('Nutrition Goals')}
        >
          <Text style={styles.settingItemText}>Nutrition Goals</Text>
          <Text style={styles.settingItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem} 
          activeOpacity={0.7}
          onPress={() => handlePress('Weekly Targets')}
        >
          <Text style={styles.settingItemText}>Weekly Targets</Text>
          <Text style={styles.settingItemArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}











