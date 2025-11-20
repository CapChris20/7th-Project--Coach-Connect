import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Modal from './Modal';

export default function CreateModal({ visible, onClose }) {
  const { colors, typography, spacing } = useTheme();

  const styles = StyleSheet.create({
    optionContainer: {
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionText: {
      ...typography.body,
      color: colors.text,
      fontSize: 16,
    },
    emptyState: {
      padding: spacing.xl,
      alignItems: 'center',
    },
    emptyStateText: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <Modal visible={visible} onClose={onClose} title="Create">
      <View style={styles.emptyState}>
        {/* Options will be added here */}
      </View>
    </Modal>
  );
}

