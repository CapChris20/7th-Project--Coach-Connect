import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const SECTION_PAD = 20;

/**
 * Section wrapper for Exercise Library (title + optional subtitle + children).
 */
export function ExerciseLibrarySection({ title, subtitle, colors, style, children }) {
  const c = colors || {};
  return (
    <View style={[styles.section, { paddingHorizontal: SECTION_PAD }, style]}>
      <View style={styles.titleRow}>
        <Text style={[styles.sectionTitle, { color: c.text || '#FFF' }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.sectionSub, { color: c.textMuted || 'rgba(255,255,255,0.55)' }]}>{subtitle}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 22,
  },
  titleRow: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
});
