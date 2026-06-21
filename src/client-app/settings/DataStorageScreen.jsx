/**
 * Data Storage Screen
 *
 * Purpose: UI screen or component: Data Storage Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: DataStorageScreen
 *
 * @file-header
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared-ui/ThemeContext';

export default function DataStorageScreen({ onClose }) {
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
    console.log(`Pressed: ${item}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Data & Storage</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* <TouchableOpacity 
          style={styles.settingItem} 
          activeOpacity={0.7}
          onPress={() => handlePress('Export Data')}
        >
          <Text style={styles.settingItemText}>Export Data</Text>
          <Text style={styles.settingItemArrow}>›</Text>
        </TouchableOpacity> */}

        <TouchableOpacity 
          style={styles.settingItem} 
          activeOpacity={0.7}
          onPress={() => handlePress('Backup & Sync')}
        >
          <Text style={styles.settingItemText}>Backup & Sync</Text>
          <Text style={styles.settingItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem} 
          activeOpacity={0.7}
          onPress={() => handlePress('Clear Cache')}
        >
          <Text style={styles.settingItemText}>Clear Cache</Text>
          <Text style={styles.settingItemArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.settingItem} 
          activeOpacity={0.7}
          onPress={() => handlePress('Storage Usage')}
        >
          <Text style={styles.settingItemText}>Storage Usage</Text>
          <Text style={styles.settingItemArrow}>›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}











