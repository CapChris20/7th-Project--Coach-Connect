/**
 * Editor Status Pill
 *
 * Purpose: Editor Status Pill — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: EditorStatusPill
 *
 * @file-header
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EditorGradientDot } from './editorGradients';

export default function EditorStatusPill({ status, theme }) {
  const map = {
    idle: { label: 'Draft', color: theme.textMuted, gradient: false },
    saved: { label: 'Saved', color: theme.success, gradient: false },
    saving: { label: 'Saving…', color: theme.warning, gradient: false },
    unsaved: { label: 'Unsaved', color: null, gradient: true },
  };
  const { label, color, gradient } = map[status] || map.idle;
  return (
    <View style={styles.pill}>
      {gradient ? (
        <EditorGradientDot size={6} />
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text style={[styles.text, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, height: 28 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});
