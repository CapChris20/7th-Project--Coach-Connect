/**
 * Session Card
 *
 * Purpose: UI screen or component: Session Card. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/components
 * Key exports: SessionCard
 *
 * @file-header
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatTime12 } from '../../lib/sessions';

const BORDER_GRADIENT = ['#9333EA', '#DB2777'];
const BG_GRADIENT_DARK = ['#12081f', '#08050f'];
const BG_GRADIENT_LIGHT = ['#F3F0FA', '#FFFFFF'];

const STATUS_META = {
  accepted: {
    label: 'Confirmed',
    icon: 'checkmark-circle',
    dark: { text: '#6EE7B7', bg: 'rgba(16,185,129,0.16)', border: 'rgba(52,211,153,0.35)' },
    light: { text: '#047857', bg: 'rgba(16,185,129,0.1)', border: 'rgba(5,150,105,0.22)' },
  },
  declined: {
    label: 'Declined',
    icon: 'close-circle',
    dark: { text: '#FCA5A5', bg: 'rgba(239,68,68,0.14)', border: 'rgba(248,113,113,0.3)' },
    light: { text: '#B91C1C', bg: 'rgba(239,68,68,0.08)', border: 'rgba(220,38,38,0.18)' },
  },
  pending: {
    label: 'Pending',
    icon: 'time-outline',
    dark: { text: '#FDE68A', bg: 'rgba(245,158,11,0.14)', border: 'rgba(251,191,36,0.3)' },
    light: { text: '#B45309', bg: 'rgba(245,158,11,0.1)', border: 'rgba(217,119,6,0.2)' },
  },
};

function formatDateChip(dateKey) {
  if (!dateKey) return '';
  const d = new Date(`${String(dateKey).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(dateKey);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function resolveStatusMeta(status, isDark) {
  const key = ['accepted', 'declined'].includes(status) ? status : 'pending';
  const meta = STATUS_META[key];
  return { ...meta, colors: isDark ? meta.dark : meta.light };
}

/**
 * Premium session row for trainer calendar / list views.
 * `showDate` — include date chip (useful in upcoming list across multiple days).
 */
export const SessionCard = ({ session, theme = 'dark', showDate = false }) => {
  const isDark = theme === 'dark';
  const innerBg = isDark ? '#0A0812' : '#FFFFFF';
  const headlineColor = isDark ? '#FFFFFF' : '#0A0A0F';
  const subColor = isDark ? 'rgba(255,255,255,0.58)' : 'rgba(15,23,42,0.55)';
  const kickerColor = isDark ? 'rgba(233,213,255,0.72)' : 'rgba(109,40,217,0.75)';
  const detailBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const detailBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const iconInnerBg = isDark ? 'rgba(14,12,22,0.98)' : 'rgba(255,255,255,0.98)';
  const iconColor = isDark ? '#E9D5FF' : '#7C3AED';
  const bgGrad = isDark ? BG_GRADIENT_DARK : BG_GRADIENT_LIGHT;

  const time = useMemo(() => formatTime12(session?.time), [session?.time]);
  const durationMin = session?.durationMin || session?.duration || 60;
  const dateChip = useMemo(() => formatDateChip(session?.date), [session?.date]);
  const statusMeta = resolveStatusMeta(session?.status, isDark);

  const notePreview = session?.notes
    ? session.notes
    : session?.zoomLink
      ? 'Video link attached'
      : 'No notes yet';

  const noteIcon = session?.notes ? 'document-text-outline' : session?.zoomLink ? 'videocam-outline' : 'ellipsis-horizontal';

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={BORDER_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderRing, isDark ? styles.shadowDark : styles.shadowLight]}
      >
        <View style={[styles.innerClip, { backgroundColor: innerBg }]}>
          <LinearGradient colors={bgGrad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
            <LinearGradient
              colors={BORDER_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topAccent}
            />

            <View style={styles.body}>
              <View style={styles.topRow}>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor: statusMeta.colors.bg,
                      borderColor: statusMeta.colors.border,
                    },
                  ]}
                >
                  <Ionicons name={statusMeta.icon} size={12} color={statusMeta.colors.text} />
                  <Text style={[styles.statusText, { color: statusMeta.colors.text }]}>{statusMeta.label}</Text>
                </View>

                <LinearGradient
                  colors={BORDER_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconRing}
                >
                  <View style={[styles.iconInner, { backgroundColor: iconInnerBg }]}>
                    <Ionicons name="calendar" size={20} color={iconColor} />
                  </View>
                </LinearGradient>
              </View>

              <Text style={[styles.kicker, { color: kickerColor }]}>SESSION</Text>
              <Text style={[styles.title, { color: headlineColor }]} numberOfLines={1}>
                {session?.clientName || 'Client'}
              </Text>

              <View style={[styles.detailPanel, { backgroundColor: detailBg, borderColor: detailBorder }]}>
                <View style={styles.detailRow}>
                  {showDate && dateChip ? (
                    <>
                      <View style={styles.detailItem}>
                        <Ionicons name="calendar-outline" size={16} color={iconColor} />
                        <Text style={[styles.detailValue, { color: headlineColor }]} numberOfLines={1}>
                          {dateChip}
                        </Text>
                      </View>
                      <View style={[styles.dot, { backgroundColor: subColor }]} />
                    </>
                  ) : null}
                  <View style={styles.detailItem}>
                    <Ionicons name="time-outline" size={16} color="#DB2777" />
                    <Text style={[styles.detailValue, { color: headlineColor }]}>{time || '—'}</Text>
                  </View>
                  <View style={[styles.dot, { backgroundColor: subColor }]} />
                  <View style={styles.detailItem}>
                    <Ionicons name="fitness-outline" size={16} color="#9333EA" />
                    <Text style={[styles.detailValue, { color: headlineColor }]}>{durationMin} min</Text>
                  </View>
                </View>
              </View>

              <View style={styles.footerRow}>
                <View style={styles.noteRow}>
                  <Ionicons name={noteIcon} size={14} color={subColor} style={styles.noteIcon} />
                  <Text style={[styles.noteText, { color: subColor }]} numberOfLines={2}>
                    {notePreview}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.35)'} />
              </View>
            </View>
          </LinearGradient>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    marginBottom: 2,
  },
  borderRing: {
    borderRadius: 20,
    padding: 2,
  },
  shadowDark: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  shadowLight: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  innerClip: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  topAccent: {
    height: 3,
    width: '100%',
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  iconRing: {
    width: 40,
    height: 40,
    borderRadius: 14,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  detailPanel: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  noteRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    minWidth: 0,
  },
  noteIcon: {
    marginTop: 2,
    marginRight: 6,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
