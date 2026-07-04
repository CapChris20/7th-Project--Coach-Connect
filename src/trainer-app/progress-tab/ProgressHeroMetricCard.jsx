import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const ACCENT_GRADIENT = ['#BE185D', '#C2410C'];

export default function ProgressHeroMetricCard({
  isDark,
  icon,
  metric,
  label,
  footer,
  style,
}) {
  const text = isDark ? '#FFFFFF' : '#0A0A0F';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)';
  const bg = isDark ? '#14141C' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: bg,
          borderColor: border,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: isDark ? 0.25 : 0.08,
              shadowRadius: 8,
            },
            android: { elevation: 2 },
          }),
        },
        style,
      ]}
    >
      <LinearGradient colors={ACCENT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBar} />
      <View style={styles.body}>
        <Ionicons name={icon} size={20} color="#FDBA74" style={styles.cornerIcon} />
        <Text style={[styles.metric, { color: text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {metric}
        </Text>
        <Text style={[styles.label, { color: muted }]} numberOfLines={1}>
          {label}
        </Text>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 118,
  },
  accentBar: {
    height: 3,
    width: '100%',
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    justifyContent: 'flex-end',
  },
  cornerIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    opacity: 0.9,
  },
  metric: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 38,
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 8,
  },
});
