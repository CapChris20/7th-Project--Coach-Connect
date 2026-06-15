/**
 * Session Meeting Card
 *
 * Purpose: UI screen or component: Session Meeting Card. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: SessionMeetingCard
 *
 * @file-header
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatTime12, formatDateLong } from '../../lib/sessions';

const PINK = '#FF6B9D';
const PURPLE = '#C084FC';

const glass = (isDark) => ({
  surface: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)',
  border: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)',
  text: isDark ? '#FFFFFF' : '#0F172A',
  muted: isDark ? 'rgba(255,255,255,0.58)' : 'rgba(15,23,42,0.55)',
  dim: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(15,23,42,0.42)',
  detailBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
});

/**
 * Glass-style session card (matches PremiumWelcomeCard / app chrome — no rainbow frame).
 * mode="invite" — Pass + I'm in
 * mode="reminder" — optional View / Log Workout when onPressViewWorkout provided
 */
export function SessionMeetingCard({
  mode = 'invite',
  isDark,
  coachName,
  session,
  onRespond,
  onPressViewWorkout,
}) {
  const s = session;
  const t = glass(isDark);

  const coachFirst = useMemo(() => {
    const n = String(coachName || 'Your coach').trim();
    return n.split(/\s+/)[0] || n;
  }, [coachName]);

  if (!s) return null;

  const dur = s.durationMin || s.duration || 60;
  const dateKey = (s.date || '').slice(0, 10);
  const dateHuman = dateKey ? formatDateLong(dateKey) : '—';
  const timeStr = formatTime12(s.time) || '—';

  return (
    <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
      <LinearGradient
        colors={[`${PINK}20`, 'transparent', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 0.85 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'transparent', `${PURPLE}0D`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.topRow}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: mode === 'reminder' ? (isDark ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.1)') : (isDark ? 'rgba(255,107,157,0.12)' : 'rgba(255,107,157,0.1)'),
              borderColor: mode === 'reminder' ? (isDark ? 'rgba(6,182,212,0.25)' : 'rgba(6,182,212,0.2)') : (isDark ? 'rgba(255,107,157,0.22)' : 'rgba(255,107,157,0.2)'),
            },
          ]}
        >
          <Ionicons
            name={mode === 'reminder' ? 'checkmark-circle' : 'mail-unread-outline'}
            size={14}
            color={mode === 'reminder' ? '#22D3EE' : PINK}
          />
          <Text
            style={[
              styles.badgeText,
              { color: mode === 'reminder' ? '#22D3EE' : PINK },
            ]}
          >
            {mode === 'reminder' ? 'UP NEXT' : 'NEW INVITE'}
          </Text>
        </View>
        <View style={[styles.iconBubble, { borderColor: t.border, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)' }]}>
          <Ionicons name="calendar" size={20} color={PURPLE} />
        </View>
      </View>

      <Text style={[styles.kicker, { color: t.dim }]}>SESSION WITH YOUR COACH</Text>

      {mode === 'reminder' ? (
        <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
          <Text style={{ color: PINK, fontWeight: '900' }}>{coachFirst}</Text>
          <Text>{` · here’s your time`}</Text>
        </Text>
      ) : (
        <Text style={[styles.title, { color: t.text }]} numberOfLines={3}>
          <Text style={{ color: PINK, fontWeight: '900' }}>{coachFirst}</Text>
          <Text style={{ fontWeight: '800' }}>{` invited you to a session`}</Text>
        </Text>
      )}

      <View style={[styles.detailPanel, { backgroundColor: t.detailBg, borderColor: t.border }]}>
        <View style={styles.detailLine}>
          <Ionicons name="calendar-outline" size={18} color={PINK} style={styles.detailIcon} />
          <Text style={[styles.detailPrimary, { color: t.text }]} numberOfLines={2}>
            {dateHuman}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: t.border }]} />
        <View style={styles.timeRow}>
          <View style={styles.timeItem}>
            <Ionicons name="time-outline" size={18} color={PURPLE} />
            <Text style={[styles.timeValue, { color: t.text }]}>{timeStr}</Text>
          </View>
          <View style={[styles.dot, { backgroundColor: t.dim }]} />
          <View style={styles.timeItem}>
            <Ionicons name="fitness-outline" size={18} color={PINK} />
            <Text style={[styles.timeValue, { color: t.text }]}>{dur} min</Text>
          </View>
        </View>
      </View>

      {s.notes ? (
        <View style={[styles.noteBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)', borderColor: t.border }]}>
          <Text style={[styles.noteLabel, { color: t.muted }]}>Note from coach</Text>
          <Text style={[styles.noteBody, { color: isDark ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.85)' }]} numberOfLines={4}>
            {s.notes}
          </Text>
        </View>
      ) : null}

      {mode === 'invite' ? (
        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => onRespond?.({ sessionId: s.id, status: 'declined' })}
            style={[
              styles.outlineBtn,
              { borderColor: t.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' },
            ]}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Text style={[styles.outlineBtnText, { color: t.muted }]}>Pass</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => onRespond?.({ sessionId: s.id, status: 'accepted' })}
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={[PINK, PURPLE]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <Text style={styles.primaryBtnText}>I’m in</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : onPressViewWorkout ? (
        <TouchableOpacity activeOpacity={0.92} onPress={onPressViewWorkout} style={{ marginTop: 4 }}>
          <LinearGradient colors={[PINK, PURPLE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnFull}>
            <Text style={styles.primaryBtnText}>View / Log Workout</Text>
            <Ionicons name="barbell-outline" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  detailPanel: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  detailLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIcon: { marginRight: 10, marginTop: 2 },
  detailPrimary: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.85,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  noteBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  noteBody: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  outlineBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnFull: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
