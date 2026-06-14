import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EditorGradientDot } from './editorGradients';

export default function EditorStatusPill({ status, theme }) {
  const map = {
    saved: { label: 'Saved', color: theme.success, gradient: false },
    saving: { label: 'Saving…', color: theme.warning, gradient: false },
    unsaved: { label: 'Unsaved', color: null, gradient: true },
  };
  const { label, color, gradient } = map[status] || map.saved;
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
