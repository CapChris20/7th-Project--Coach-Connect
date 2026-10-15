// One coaching-session row for the trainer calendar and upcoming-session lists.
// Flow: map status → chip colors → show client, time, duration, and a notes/Zoom preview.
// Used by trainer scheduling screens. `showDate` adds a date chip when the list spans several days.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatTime12 } from '../../helpers/sessionTimeText';

// ===== NAMED CONSTANTS =====

const BORDER_GRADIENT = ['#9333EA', '#DB2777'];
const BG_GRADIENT_DARK = ['#12081f', '#08050f'];
const BG_GRADIENT_LIGHT = ['#F3F0FA', '#FFFFFF'];
const CLIENT_NAME_DEFAULT = 'Client';
const DEFAULT_DURATION_MIN = 60;
const STATUS_ACCEPTED = 'accepted';
const STATUS_DECLINED = 'declined';
const STATUS_PENDING = 'pending';
const NOON_CLOCK_SUFFIX = 'T12:00:00';

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

// ===== HELPER FUNCTIONS =====

/**
 * Noon local time avoids a YYYY-MM-DD string sliding to the previous day in US timezones.
 * @param {string} dateKey
 * @returns {string}
 */
function formatDateChip(dateKey) {
  if (!dateKey) return '';
  const dateAtNoon = new Date(`${String(dateKey).slice(0, 10)}${NOON_CLOCK_SUFFIX}`);
  if (Number.isNaN(dateAtNoon.getTime())) return String(dateKey);
  return dateAtNoon.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Unknown statuses look like pending so a typo in Firestore still shows a chip, not a crash.
 * @param {string} status
 * @param {boolean} isDark
 */
function resolveStatusMeta(status, isDark) {
  const isKnownStatus = status === STATUS_ACCEPTED || status === STATUS_DECLINED;
  const statusKey = isKnownStatus ? status : STATUS_PENDING;
  const meta = STATUS_META[statusKey];
  return { ...meta, colors: isDark ? meta.dark : meta.light };
}

/**
 * @param {boolean} isDark
 */
function sessionCardPalette(isDark) {
  if (isDark) {
    return {
      innerBackground: '#0A0812',
      headlineColor: '#FFFFFF',
      subColor: 'rgba(255,255,255,0.58)',
      kickerColor: 'rgba(233,213,255,0.72)',
      detailBackground: 'rgba(255,255,255,0.04)',
      detailBorder: 'rgba(255,255,255,0.08)',
      iconInnerBackground: 'rgba(14,12,22,0.98)',
      iconColor: '#E9D5FF',
      backgroundGradient: BG_GRADIENT_DARK,
      chevronColor: 'rgba(255,255,255,0.35)',
    };
  }
  return {
    innerBackground: '#FFFFFF',
    headlineColor: '#0A0A0F',
    subColor: 'rgba(15,23,42,0.55)',
    kickerColor: 'rgba(109,40,217,0.75)',
    detailBackground: 'rgba(15,23,42,0.04)',
    detailBorder: 'rgba(15,23,42,0.08)',
    iconInnerBackground: 'rgba(255,255,255,0.98)',
    iconColor: '#7C3AED',
    backgroundGradient: BG_GRADIENT_LIGHT,
    chevronColor: 'rgba(15,23,42,0.35)',
  };
}

/**
 * Footer line: real notes win, else a Zoom hint, else a placeholder so the row height stays even.
 * @param {object} session
 * @returns {{ preview: string, icon: string }}
 */
function sessionNotePreview(session) {
  if (session?.notes) {
    return { preview: session.notes, icon: 'document-text-outline' };
  }
  if (session?.zoomLink) {
    return { preview: 'Video link attached', icon: 'videocam-outline' };
  }
  return { preview: 'No notes yet', icon: 'ellipsis-horizontal' };
}

/**
 * Date chip only when the parent list spans more than one day.
 * @param {object} props
 */
function SessionDateTimeRow({ showDate, dateChip, time, durationMin, palette }) {
  const shouldShowDate = Boolean(showDate && dateChip);
  return (
    <View style={[styles.detailPanel, { backgroundColor: palette.detailBackground, borderColor: palette.detailBorder }]}>
      <View style={styles.detailRow}>
        {shouldShowDate ? (
          <>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color={palette.iconColor} />
              <Text style={[styles.detailValue, { color: palette.headlineColor }]} numberOfLines={1}>
                {dateChip}
              </Text>
            </View>
            <View style={[styles.dot, { backgroundColor: palette.subColor }]} />
          </>
        ) : null}
        <View style={styles.detailItem}>
          <Ionicons name="time-outline" size={16} color="#DB2777" />
          <Text style={[styles.detailValue, { color: palette.headlineColor }]}>{time || '—'}</Text>
        </View>
        <View style={[styles.dot, { backgroundColor: palette.subColor }]} />
        <View style={styles.detailItem}>
          <Ionicons name="fitness-outline" size={16} color="#9333EA" />
          <Text style={[styles.detailValue, { color: palette.headlineColor }]}>{durationMin} min</Text>
        </View>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Premium session row for trainer calendar / list views.
 * `showDate` — include date chip (useful in upcoming list across multiple days).
 * @param {{ session: object, theme?: string, showDate?: boolean }} props
 */
export const SessionCard = ({ session, theme = 'dark', showDate = false }) => {
  const isDark = theme === 'dark';
  const palette = sessionCardPalette(isDark);

  // Hook order: formatted clock first, then the date chip. Duration sits between them as plain data.
  const time = useMemo(() => formatTime12(session?.time), [session?.time]);
  const durationMin = session?.durationMin || session?.duration || DEFAULT_DURATION_MIN;
  const dateChip = useMemo(() => formatDateChip(session?.date), [session?.date]);
  const statusMeta = resolveStatusMeta(session?.status, isDark);
  const note = sessionNotePreview(session);

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={BORDER_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderRing, isDark ? styles.shadowDark : styles.shadowLight]}
      >
        <View style={[styles.innerClip, { backgroundColor: palette.innerBackground }]}>
          <LinearGradient colors={palette.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
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
                  <View style={[styles.iconInner, { backgroundColor: palette.iconInnerBackground }]}>
                    <Ionicons name="calendar" size={20} color={palette.iconColor} />
                  </View>
                </LinearGradient>
              </View>

              <Text style={[styles.kicker, { color: palette.kickerColor }]}>SESSION</Text>
              <Text style={[styles.title, { color: palette.headlineColor }]} numberOfLines={1}>
                {session?.clientName || CLIENT_NAME_DEFAULT}
              </Text>

              <SessionDateTimeRow
                showDate={showDate}
                dateChip={dateChip}
                time={time}
                durationMin={durationMin}
                palette={palette}
              />

              <View style={styles.footerRow}>
                <View style={styles.noteRow}>
                  <Ionicons name={note.icon} size={14} color={palette.subColor} style={styles.noteIcon} />
                  <Text style={[styles.noteText, { color: palette.subColor }]} numberOfLines={2}>
                    {note.preview}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.chevronColor} />
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
