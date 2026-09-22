import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Section label row: uppercase label + thin divider (web ScheduleSessionScreen pattern).
 */
export function FieldLabel({ children, mutedColor, borderColor }) {
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, { color: mutedColor }]}>{children}</Text>
      <View style={[styles.divider, { backgroundColor: borderColor }]} />
    </View>
  );
}

/**
 * Vertical section wrapper with optional bottom spacing.
 */
export default function FormRow({ label, children, mutedColor, borderColor, style }) {
  return (
    <View style={[styles.section, style]}>
      {label ? <FieldLabel mutedColor={mutedColor} borderColor={borderColor}>{label}</FieldLabel> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    flex: 1,
    marginLeft: 12,
  },
});
