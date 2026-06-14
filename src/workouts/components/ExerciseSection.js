import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ExerciseSection({ title, subtitle, accentGradient, children, style, colors, isDark }) {
  const titleColor = colors?.text || (isDark ? '#FFFFFF' : '#0A0A0F');
  const subtitleColor = colors?.textMuted || (isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)');
  const lineColors = accentGradient?.length >= 2 ? accentGradient : ['#FF6B9D', '#C2410C'];

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text> : null}
        <View style={styles.lineWrap}>
          <LinearGradient colors={[...lineColors, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.accentLine} />
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 28 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  lineWrap: { marginTop: 12, height: 2, borderRadius: 1, overflow: 'hidden' },
  accentLine: { flex: 1, height: 2, borderRadius: 1 },
});
