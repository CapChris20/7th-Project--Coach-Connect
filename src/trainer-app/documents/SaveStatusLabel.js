// Small "save state" badge (dot + label) shown in the document editor header.
// Flow: parent passes a status string → we look up its label/color → render dot + text.
// Used by the document and spreadsheet editor headers so save state is always visible.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EditorGradientDot } from './editorAccent';

export default function SaveStatusLabel({ status, theme }) {
  // Status → appearance lookup table. A plain object beats a switch here because it doubles as
  // the list of every state the editor can be in, all readable at a glance.
  // `gradient: true` means "draw the animated gradient dot instead of a flat colored one" —
  // that's why those rows have color: null.
  // Manipulate here: the `label` strings are the exact user-facing copy, and `color` pulls from
  // the theme so light/dark stay consistent. Add a row to support a new save state.
  const map = {
    idle: { label: 'Draft', color: theme.textMuted, gradient: false },
    saved: { label: 'All changes saved', color: theme.success, gradient: false },
    saving: { label: 'Saving…', color: theme.warning, gradient: false },
    unsaved: { label: 'Edited', color: null, gradient: true },
    // Manipulate here: amber is hardcoded because "offline" is a warning that shouldn't shift
    // with theme tweaks — the user needs to notice it in both light and dark.
    offline: { label: 'Saved locally', color: '#f59e0b', gradient: false },
  };
  // Unknown/undefined status falls back to `idle` so a typo or a not-yet-set state renders
  // "Draft" instead of crashing on a destructure of undefined.
  const { label, color, gradient } = map[status] || map.idle;
  return (
    <View style={styles.pill}>
      {/* Unsaved edits get the eye-catching gradient dot; every other state is a flat dot.
          The color is applied inline (not in the stylesheet) because it's data-driven. */}
      {gradient ? (
        <EditorGradientDot size={6} />
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      {/* Label text is always muted — the DOT carries the urgency, so the text stays quiet. */}
      <Text style={[styles.text, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

// Manipulate here: `gap` is the dot-to-text spacing, `height: 28` keeps the pill aligned with
// the other header controls, and `letterSpacing` on the text is what gives it the small-caps
// label feel. Changing `dot` width/height requires changing borderRadius to half to stay round.
const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, height: 28 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});
