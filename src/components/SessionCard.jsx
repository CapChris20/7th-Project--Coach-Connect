import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Video } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatTime12 } from '../lib/sessions';

const COLORS = {
  dark: {
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.1)',
    glass: 'rgba(255,255,255,0.04)',
    glassBorder: 'rgba(255,255,255,0.08)',
    primary: '#FF6B9D',
    primaryLight: 'rgba(255,107,157,0.15)',
    primaryGlow: 'rgba(255,107,157,0.4)',
  },
  light: {
    text: '#000000',
    textSecondary: 'rgba(0,0,0,0.6)',
    border: 'rgba(0,0,0,0.1)',
    glass: 'rgba(0,0,0,0.04)',
    glassBorder: 'rgba(0,0,0,0.08)',
    primary: '#FF6B9D',
    primaryLight: 'rgba(255,107,157,0.15)',
    primaryGlow: 'rgba(255,107,157,0.4)',
  },
};

export const SessionCard = ({ session, theme = 'dark' }) => {
  const colors = COLORS[theme] || COLORS.dark;
  const time = useMemo(() => formatTime12(session?.time), [session?.time]);
  const duration = session?.durationMin ? `${session.durationMin}m` : '';

  return (
    <View style={styles.outer}>
      {/* glow */}
      <LinearGradient
        colors={[colors.primaryGlow, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={[styles.card, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
        <View style={[styles.accent, { backgroundColor: colors.primary }]} />

        <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
          <Video size={16} color={colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.topRow}>
            <Text style={[styles.client, { color: colors.text }]} numberOfLines={1}>
              {session?.clientName || 'Client'}
            </Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {[time, duration].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Text style={[styles.notes, { color: colors.textSecondary }]} numberOfLines={2}>
            {session?.notes ? session.notes : session?.zoomLink ? 'Video link attached' : 'No notes'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    left: -6,
    right: -6,
    top: -6,
    bottom: -6,
    borderRadius: 22,
    opacity: 0.35,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 3,
    opacity: 0.9,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  client: { fontSize: 14, fontWeight: '700', flex: 1 },
  meta: { fontSize: 11, fontWeight: '600' },
  notes: { fontSize: 12, marginTop: 6, lineHeight: 16 },
});

