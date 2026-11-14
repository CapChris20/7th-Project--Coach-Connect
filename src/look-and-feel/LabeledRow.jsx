// Form section chrome: optional uppercase label, hairline divider, then the fields.
// Flow: ask if the label string is real → paint label+divider row → stack section children under it.
// Used by: schedule-session form sections (and any screen that wants the same labeled block).
//
// vocab: hairline = 1px full-width divider that fills leftover space after the label
// Manipulate here: label fontSize 11 / letterSpacing 1.2 in styles.label; section gap 8

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// ===== NAMED CONSTANTS =====

// Manipulate here: space between the label row and the first field
const SECTION_INNER_GAP = 8;
// Manipulate here: gap under the label+divider before children feel cramped
const LABEL_ROW_BOTTOM_GAP = 4;
// Manipulate here: space between uppercase text and the hairline
const DIVIDER_LEFT_GAP = 12;

// ===== HELPER FUNCTIONS =====

// Empty / missing label would draw a lonely divider — skip the whole row.
function sectionHasARealLabel(labelText) {
  return Boolean(labelText);
}

function buildLabelTextStyle(mutedColor) {
  return [styles.label, { color: mutedColor }];
}

function buildHairlineStyle(borderColor) {
  return [styles.divider, { backgroundColor: borderColor }];
}

// ===== SMALL UI PIECES =====

/**
 * Uppercase label on the left; hairline takes the rest of the horizontal row.
 * Exported for callers that want the label row without the section wrapper.
 * @param {{ children: import('react').ReactNode, mutedColor: string, borderColor: string }} props
 */
function FieldLabel({ children, mutedColor, borderColor }) {
  const labelTextStyle = buildLabelTextStyle(mutedColor);
  const hairlineStyle = buildHairlineStyle(borderColor);

  return (
    <View style={styles.labelRow}>
      <Text style={labelTextStyle}>{children}</Text>
      <View style={hairlineStyle} />
    </View>
  );
}

function OptionalLabelRow({ labelText, mutedColor, borderColor }) {
  const labelIsPresent = sectionHasARealLabel(labelText);
  if (!labelIsPresent) {
    return null;
  }

  return (
    <FieldLabel mutedColor={mutedColor} borderColor={borderColor}>
      {labelText}
    </FieldLabel>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Vertical section with an optional label row above its children.
 * @param {object} props
 * @param {*} [props.label] Omitted or empty skips the label row.
 * @param {import('react').ReactNode} props.children
 * @param {string} props.mutedColor
 * @param {string} props.borderColor
 * @param {object} [props.style]
 * @returns {JSX.Element}
 */
export default function LabeledRow({
  label,
  children,
  mutedColor,
  borderColor,
  style,
}) {
  // 1. Combine default section stack with any caller override style.
  const sectionStyle = [styles.section, style];

  // 2. Paint optional label+divider, then the fields that belong to this section.
  return (
    <View style={sectionStyle}>
      <OptionalLabelRow
        labelText={label}
        mutedColor={mutedColor}
        borderColor={borderColor}
      />
      {children}
    </View>
  );
}

export { FieldLabel };

// PLUMBING — skip unless debugging (static StyleSheet tokens)

const styles = StyleSheet.create({
  section: {
    gap: SECTION_INNER_GAP,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: LABEL_ROW_BOTTOM_GAP,
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
    marginLeft: DIVIDER_LEFT_GAP,
  },
});
