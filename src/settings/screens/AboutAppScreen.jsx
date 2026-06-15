/**
 * About App Screen
 *
 * Purpose: UI screen or component: About App Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/settings
 * Key exports: AboutAppScreen
 *
 * @file-header
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';

export default function AboutAppScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();
  const appVersion = '1.0.0';

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
    section: {
      marginBottom: spacing.xl,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.md,
    },
    description: {
      fontSize: 16,
      color: colors.textSecondary,
      lineHeight: 24,
      marginBottom: spacing.md,
    },
    versionContainer: {
      backgroundColor: colors.surface,
      padding: spacing.md,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.border,
    },
    versionLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    versionValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.primary,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About CoachConnect</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.title}>CoachConnect</Text>
          <Text style={styles.description}>
            CoachConnect is your personal AI fitness coach, designed to help you achieve your health and fitness goals. 
            With intelligent workout planning, nutrition tracking, and personalized guidance, we're here to support 
            your fitness journey every step of the way.
          </Text>
          <Text style={styles.description}>
            Our mission is to make professional-grade fitness coaching accessible to everyone, powered by cutting-edge 
            AI technology and backed by certified trainers.
          </Text>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionLabel}>App Version</Text>
          <Text style={styles.versionValue}>{appVersion}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}











