import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

export default function SettingsScreen({ onClose }) {
  const { colors, typography, spacing, isDark, toggleTheme, themeMode } = useTheme();

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
      borderBottomColor: isDark ? 'rgba(139, 92, 246, 0.2)' : colors.border,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 0.5,
    },
    closeButton: {
      padding: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.2)' : colors.purple[100],
    },
    closeButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '700',
    },
    scrollContent: {
      padding: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.md,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      padding: spacing.md,
      marginBottom: spacing.sm,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 8,
      elevation: 5,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(139, 92, 246, 0.2)' : colors.border,
    },
    themeToggle: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      gap: spacing.sm,
    },
    themeButton: {
      flex: 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      borderRadius: 12,
      backgroundColor: isDark ? colors.surfaceSecondary : colors.surface,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(139, 92, 246, 0.2)' : colors.border,
    },
    themeButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 4,
      elevation: 4,
    },
    themeButtonText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    themeButtonTextActive: {
      color: colors.white,
      fontWeight: '700',
    },
    settingItem: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: 12,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(139, 92, 246, 0.2)' : colors.border,
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Theme Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎨 Theme</Text>
          <View style={styles.card}>
            <View style={styles.themeToggle}>
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  themeMode === 'light' && styles.themeButtonActive,
                ]}
                onPress={() => toggleTheme('light')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    themeMode === 'light' && styles.themeButtonTextActive,
                  ]}
                >
                  Light
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  themeMode === 'dark' && styles.themeButtonActive,
                ]}
                onPress={() => toggleTheme('dark')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    themeMode === 'dark' && styles.themeButtonTextActive,
                  ]}
                >
                  Dark
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.themeButton,
                  themeMode === 'system' && styles.themeButtonActive,
                ]}
                onPress={() => toggleTheme('system')}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.themeButtonText,
                    themeMode === 'system' && styles.themeButtonTextActive,
                  ]}
                >
                  System
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Preferences</Text>
          <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
            <Text style={styles.settingItemText}>🔔 Notifications</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
            <Text style={styles.settingItemText}>🔒 Privacy</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
            <Text style={styles.settingItemText}>📱 Account</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ About</Text>
          <View style={styles.card}>
            <View style={[styles.settingItem, { marginBottom: 0, borderWidth: 0 }]}>
              <Text style={styles.settingItemText}>Version</Text>
              <Text style={[styles.settingItemText, { color: colors.textSecondary, fontSize: 14 }]}>1.0.0</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
            <Text style={styles.settingItemText}>📄 Terms of Service</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} activeOpacity={0.7}>
            <Text style={styles.settingItemText}>🔐 Privacy Policy</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

