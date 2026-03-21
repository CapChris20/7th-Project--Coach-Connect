import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { lightColors, typography, spacing } from '../shared/ui/theme';

export default function ForgotPasswordScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} selectable={true}>Forgot Password</Text>
        <Text style={styles.subtitle} selectable={true}>Reset your password</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: lightColors.text,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
});
