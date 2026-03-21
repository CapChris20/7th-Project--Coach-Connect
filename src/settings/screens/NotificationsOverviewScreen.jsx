import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';
import {
  getNotificationPermissionsAsync,
  requestNotificationPermissionsAsync,
  openSystemSettingsAsync,
  getExpoPushTokenAsync,
  sendTestLocalNotificationAsync,
} from '../../shared/services/notificationsService';

export default function NotificationsOverviewScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [loading, setLoading] = useState(true);
  const [pushToken, setPushToken] = useState(null);
  const [working, setWorking] = useState(false);

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
    notificationRow: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: 12,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.border,
    },
    notificationTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    notificationDesc: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    card: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: 12,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.border,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    rowValue: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    buttonSecondary: {
      backgroundColor: isDark ? 'rgba(88, 86, 214, 0.18)' : 'rgba(88, 86, 214, 0.12)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(88, 86, 214, 0.35)' : 'rgba(88, 86, 214, 0.25)',
    },
    buttonText: {
      color: colors.white,
      fontWeight: '700',
      fontSize: 15,
    },
    buttonTextSecondary: {
      color: colors.primary,
    },
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const perm = await getNotificationPermissionsAsync();
      setPermissionStatus(perm?.status || (perm?.granted ? 'granted' : 'unknown'));
    } catch {
      setPermissionStatus('unknown');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleEnable = async () => {
    setWorking(true);
    try {
      const perm = await requestNotificationPermissionsAsync();
      setPermissionStatus(perm?.status || (perm?.granted ? 'granted' : 'unknown'));
      if (perm?.status !== 'granted' && !perm?.granted) {
        Alert.alert(
          'Notifications Disabled',
          'To enable notifications, allow them in iOS Settings for CoachConnect.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => openSystemSettingsAsync() },
          ]
        );
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to request notification permission.');
    } finally {
      setWorking(false);
    }
  };

  const handleTest = async () => {
    setWorking(true);
    try {
      await sendTestLocalNotificationAsync();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to schedule a test notification.');
    } finally {
      setWorking(false);
    }
  };

  const handleGetToken = async () => {
    setWorking(true);
    try {
      const token = await getExpoPushTokenAsync();
      setPushToken(token);
      Alert.alert('Expo Push Token', token);
    } catch (e) {
      Alert.alert('Push Token Error', e?.message || 'Failed to get push token.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Manage your notification preferences. The app supports various types of notifications to keep you informed about your fitness journey.
        </Text>

        <View style={styles.card}>
          <Text style={styles.rowTitle}>Current Permission</Text>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <Text style={styles.rowValue}>{permissionStatus}</Text>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleEnable}
            activeOpacity={0.8}
            disabled={working}
          >
            <Text style={styles.buttonText}>{working ? 'Working…' : 'Enable Notifications'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={() => openSystemSettingsAsync()}
            activeOpacity={0.8}
            disabled={working}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Open System Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.rowTitle}>Test</Text>
          <Text style={styles.rowValue}>Sends a local notification in ~1 second.</Text>
        <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleTest}
            activeOpacity={0.8}
            disabled={working}
        >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.rowTitle}>Push Token (Expo)</Text>
          <Text style={styles.rowValue}>
            {pushToken ? pushToken : 'Tap below to generate an Expo push token (physical device required).'}
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.buttonSecondary]}
            onPress={handleGetToken}
            activeOpacity={0.8}
            disabled={working}
          >
            <Text style={[styles.buttonText, styles.buttonTextSecondary]}>Get Expo Push Token</Text>
        </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.notificationRow}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Text style={styles.notificationTitle}>Achievement Alerts</Text>
          <Text style={styles.notificationDesc}>
            Get notified when you reach milestones, complete challenges, or achieve new personal records.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.notificationRow}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Text style={styles.notificationTitle}>Message Notifications</Text>
          <Text style={styles.notificationDesc}>
            Stay connected with notifications for new messages from your trainer or other users.
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}











