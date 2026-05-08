import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ExerciseSection({ title, subtitle, accentGradient, children, style, colors, isDark }) {
  const titleColor = colors?.text || (isDark ? '#FFFFFF' : '#0A0A0F');
  const subtitleColor = colors?.textMuted || (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(10,10,15,0.55)');

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: titleColor }]}>{String(title || '').toUpperCase()}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text> : null}
        <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentLine} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 32 },
  header: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '700',
  },
  accentLine: { marginTop: 12, width: 60, height: 2, borderRadius: 2 },
});

