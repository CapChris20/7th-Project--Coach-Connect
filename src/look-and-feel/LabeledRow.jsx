// Section block: an uppercase label, a thin divider, then the fields under it.
// Flow: skip the label row when there is no label → otherwise paint the label and divider → render children.
// Used by the schedule-session screen for its form sections.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

/**
 * An empty label would draw a divider with no words. Only a real label gets the row.
 * @param {*} label
 * @returns {boolean}
 */
function hasSectionLabel(label) {
  return Boolean(label);
}

/**
 * Uppercase label plus a hairline that fills the rest of the row.
 * @param {object} props
 * @param {React.ReactNode} props.children Label text.
 * @param {string} props.mutedColor
 * @param {string} props.borderColor
 * @returns {JSX.Element}
 */
export function FieldLabel({ children, mutedColor, borderColor }) {
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, { color: mutedColor }]}>{children}</Text>
      <View style={[styles.divider, { backgroundColor: borderColor }]} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Vertical section with an optional label row above its children.
 * @param {object} props
 * @param {*} [props.label] Omitted or empty skips the label row.
 * @param {React.ReactNode} props.children
 * @param {string} props.mutedColor
 * @param {string} props.borderColor
 * @param {object} [props.style]
 * @returns {JSX.Element}
 */
export default function LabeledRow({ label, children, mutedColor, borderColor, style }) {
  return (
    <View style={[styles.section, style]}>
      {hasSectionLabel(label) ? (
        <FieldLabel mutedColor={mutedColor} borderColor={borderColor}>{label}</FieldLabel>
      ) : null}
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
