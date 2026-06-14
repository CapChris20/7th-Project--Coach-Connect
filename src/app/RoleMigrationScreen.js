import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../shared/ui/ThemeContext';
// import { migrateUserRoles, setTrainersByEmail } from '../utils/migrateUserRoles'; // File is missing

export default function RoleMigrationScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [trainerEmails, setTrainerEmails] = useState('');
  const [result, setResult] = useState(null);

  const handleMigrateAll = async () => {
    Alert.alert(
      'Migrate All Users',
      'This will set all users without roles to "client". Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Migrate',
          onPress: async () => {
            setLoading(true);
            try {
              // const migrationResult = await migrateUserRoles('client'); // Function is unavailable
              setResult(migrationResult);
              Alert.alert(
                'Success',
                `Updated ${migrationResult.updated} users\nSkipped ${migrationResult.skipped} users\nErrors: ${migrationResult.errors.length}`
              );
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSetTrainers = async () => {
    const emails = trainerEmails
      .split('\n')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emails.length === 0) {
      Alert.alert('Error', 'Please enter at least one email address');
      return;
    }

    setLoading(true);
    try {
      // const trainerResult = await setTrainersByEmail(emails); // Function is unavailable
      setResult(trainerResult);
      Alert.alert(
        'Success',
        `Updated ${trainerResult.updated} trainers\nNot found: ${trainerResult.notFound.length}`
      );
      setTrainerEmails('');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md + 8,
      paddingBottom: spacing.md,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.9)' 
        : 'rgba(255, 255, 255, 0.9)',
      borderBottomWidth: 1,
      borderBottomColor: isDark 
        ? 'rgba(88, 86, 214, 0.15)' 
        : 'rgba(88, 86, 214, 0.1)',
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
      borderRadius: 16,
      backgroundColor: isDark 
        ? 'rgba(88, 86, 214, 0.15)' 
        : 'rgba(88, 86, 214, 0.1)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(88, 86, 214, 0.3)' 
        : 'rgba(88, 86, 214, 0.2)',
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
    },
    sectionDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 16,
      alignItems: 'center',
      marginBottom: spacing.md,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 6,
    },
    buttonText: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '700',
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    textArea: {
      backgroundColor: isDark 
        ? 'rgba(88, 86, 214, 0.1)' 
        : 'rgba(255, 255, 255, 0.9)',
      borderRadius: 16,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(88, 86, 214, 0.25)' 
        : 'rgba(88, 86, 214, 0.2)',
      minHeight: 120,
      textAlignVertical: 'top',
      marginBottom: spacing.md,
    },
    resultContainer: {
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.5)' 
        : 'rgba(255, 255, 255, 0.6)',
      borderRadius: 16,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    resultText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    warningBox: {
      backgroundColor: isDark 
        ? 'rgba(255, 193, 7, 0.2)' 
        : 'rgba(255, 193, 7, 0.1)',
      borderRadius: 12,
      padding: spacing.md,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(255, 193, 7, 0.3)' 
        : 'rgba(255, 193, 7, 0.2)',
    },
    warningText: {
      fontSize: 13,
      color: colors.text,
      lineHeight: 18,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} selectable={true}>Role Migration</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText} selectable={true}>Close</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollContent}>
        <View style={styles.warningBox}>
          <Text style={styles.warningText} selectable={true}>
            ⚠️ This is an admin tool. Use it to add roles to existing user accounts.
          </Text>
        </View>

        {/* Migrate All Users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} selectable={true}>1. Set Default Role for All Users</Text>
          <Text style={styles.sectionDescription} selectable={true}>
            This will set all users without a role to "client". Users who already have a role will be skipped.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={handleMigrateAll}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.buttonText} selectable={true}>Set All Users to Client</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Set Specific Trainers */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} selectable={true}>2. Set Specific Users as Trainers</Text>
          <Text style={styles.sectionDescription} selectable={true}>
            Enter email addresses (one per line) of users who should be trainers. These users will be updated to have role: "trainer".
          </Text>
          <Text style={styles.inputLabel} selectable={true}>Trainer Email Addresses:</Text>
          <TextInput
            style={styles.textArea}
            value={trainerEmails}
            onChangeText={setTrainerEmails}
            placeholder="trainer1@example.com&#10;trainer2@example.com&#10;trainer3@example.com"
            placeholderTextColor={colors.textSecondary}
            multiline
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity
            style={styles.button}
            onPress={handleSetTrainers}
            disabled={loading || !trainerEmails.trim()}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.buttonText} selectable={true}>Set as Trainers</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Results */}
        {result && (
          <View style={styles.resultContainer}>
            <Text style={[styles.resultText, { fontWeight: '700', marginBottom: spacing.xs }]} selectable={true}>
              Last Result:
            </Text>
            <Text style={styles.resultText} selectable={true}>
              {JSON.stringify(result, null, 2)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

