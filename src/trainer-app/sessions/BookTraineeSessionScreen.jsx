/**
 * Session Scheduling Screen
 *
 * Purpose: UI screen or component: Session Scheduling Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: BookTraineeSessionScreen
 *
 * @file-header
 */
import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, CalendarDays, List as ListIcon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSessions } from '../hooks/useMyTrainingSessions';
import { MonthCalendar } from '../components/sessions/MonthCalendar';
import { SessionCard } from '../components/sessions/SessionCard';
import { formatDateLong } from '../../lib/sessions';
import { FORM_SCROLL_PROPS, useEmbeddedScrollBottomPad } from '../../navigation/bottomNavMetrics';

const COLORS = {
  dark: {
    bg: '#0c0c0e',
    surface: '#141418',
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.10)',
    glass: 'rgba(255,255,255,0.04)',
    glassBorder: 'rgba(255,255,255,0.08)',
    primary: '#FF6B9D',
    primaryLight: 'rgba(255,107,157,0.15)',
    primaryGlow: 'rgba(255,107,157,0.4)',
  },
  light: {
    bg: '#f5f5f7',
    surface: '#FFFFFF',
    text: '#0A0A0F',
    textSecondary: 'rgba(10,10,15,0.55)',
    border: 'rgba(10,10,15,0.10)',
    glass: '#FFFFFF',
    glassBorder: 'rgba(10,10,15,0.10)',
    primary: '#FF6B9D',
    primaryLight: 'rgba(255,107,157,0.12)',
    primaryGlow: 'rgba(255,107,157,0.4)',
  },
};

export const BookTraineeSessionScreen = ({ theme = 'dark', embedded = true, onNavigate, clientId, clientName }) => {
  const colors = COLORS[theme] || COLORS.dark;
  const { sessions } = useSessions();
  const [selectedDate, setSelectedDate] = useState(null);
  const [tab, setTab] = useState('calendar');
  const insets = useSafeAreaInsets();
  const scrollBottomPad = useEmbeddedScrollBottomPad(embedded ? 24 : 40);

  const clientLabel = clientName || 'this client';

  const sessionsForClient = useMemo(() => {
    if (!clientId) return [];
    const cid = String(clientId);
    return (sessions || []).filter((s) => s?.clientId != null && String(s.clientId) === cid);
  }, [sessions, clientId]);

  const todayKey = new Date().toISOString().slice(0, 10);

  const upcoming = useMemo(
    () =>
      [...sessionsForClient]
        .filter((s) => (s.date || '') >= todayKey)
        .sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)))
        .slice(0, 5),
    [sessionsForClient, todayKey]
  );

  const dayList = selectedDate
    ? sessionsForClient
        .filter((s) => s.date === selectedDate)
        .sort((a, b) => String(a.time).localeCompare(String(b.time)))
    : [];

  const listTitle =
    tab === 'list'
      ? `Upcoming · ${clientLabel}`
      : selectedDate
        ? formatDateLong(selectedDate)
        : 'Tap a day';

  const newSessionPath = (dateKey) => {
    if (!dateKey) return '/sessions/new';
    return `/sessions/new?date=${encodeURIComponent(dateKey)}`;
  };

  const Root = embedded ? View : SafeAreaView;

  return (
    <Root style={[styles.container, embedded ? styles.embeddedRoot : null, { backgroundColor: embedded ? 'transparent' : colors.bg }]}>
      {!embedded ? <View style={[styles.aurora, { backgroundColor: colors.bg }]} /> : null}

      {/* Sticky Header */}
      <View style={[styles.header, embedded ? styles.headerEmbedded : null, { backgroundColor: embedded ? 'transparent' : colors.bg }, !embedded && { borderBottomColor: colors.glassBorder, borderBottomWidth: 1 }]}>
        {!embedded ? (
          <>
        <View style={styles.headerContent}>
          {/* Brand */}
          <View style={styles.brandContainer}>
            <LinearGradient
              colors={['#FF6B9D', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.brandIcon}
            >
              <CalendarDays color="white" size={20} />
            </LinearGradient>
            <View>
              <Text style={[styles.appTitle, { color: colors.text }]}>CoachConnect</Text>
              <Text style={[styles.appSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {clientId ? `Calendar · ${clientLabel}` : 'Trainer scheduling'}
              </Text>
            </View>
          </View>

          <View style={styles.themeToggle} />
        </View>
          </>
        ) : null}

        {/* Segmented Control */}
        <View style={[styles.segmentedControl, embedded && styles.segmentedEmbedded, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
          <SegBtn
            active={tab === 'calendar'}
            onPress={() => setTab('calendar')}
            icon={<CalendarDays size={14} color={tab === 'calendar' ? 'white' : colors.textSecondary} />}
            label="Calendar"
            colors={colors}
          />
          <SegBtn
            active={tab === 'list'}
            onPress={() => setTab('list')}
            icon={<ListIcon size={14} color={tab === 'list' ? 'white' : colors.textSecondary} />}
            label="List"
            colors={colors}
          />
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollContent, embedded && styles.scrollContentEmbedded, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        <TouchableOpacity
          onPress={() => onNavigate?.(newSessionPath(selectedDate))}
          activeOpacity={0.88}
          style={styles.newSessionRow}
        >
          <LinearGradient
            colors={['#E94EAD', '#A348D0', '#6B3AD9']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.newSessionBtn}
          >
            <Plus color="#FFFFFF" size={18} />
            <Text style={styles.newSessionText}>New session</Text>
          </LinearGradient>
        </TouchableOpacity>

        {tab === 'calendar' && (
          <View style={[styles.section, embedded && styles.sectionEmbedded]}>
            <MonthCalendar
              sessions={sessionsForClient}
              selectedDate={selectedDate}
              onSelectDate={(d) => setSelectedDate(d)}
              theme={theme}
              borderless={embedded}
            />

            {/* Day List */}
            <View style={styles.dayListSection}>
              <View style={styles.dayListHeader}>
                <Text style={[styles.dayListTitle, { color: colors.text }]}>{listTitle}</Text>
                {selectedDate && (
                  <TouchableOpacity onPress={() => setSelectedDate(null)}>
                    <Text style={[styles.clearBtn, { color: colors.primary }]}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>

              {selectedDate ? (
                dayList.length === 0 ? (
                  <EmptyState
                    title="No sessions this day"
                    subtitle={`Nothing scheduled with ${clientLabel} on this date.`}
                    cta="Schedule one"
                    onCta={() => onNavigate?.(newSessionPath(selectedDate))}
                    colors={colors}
                  />
                ) : (
                  <View style={styles.sessionsList}>
                    {dayList.map((s) => (
                      <TouchableOpacity key={s.id} onPress={() => onNavigate?.(`/sessions/${s.id}`)} activeOpacity={0.88}>
                        <SessionCard session={s} theme={theme} showDate={false} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              ) : (
                <View style={[styles.emptyPrompt, embedded && styles.emptyPromptEmbedded, !embedded && { backgroundColor: colors.glass, borderColor: colors.glassBorder, borderWidth: 1 }]}>
                  <Text style={[styles.emptyPromptText, { color: colors.textSecondary }]}>
                    {clientId
                      ? `Tap a day to see ${clientLabel}'s sessions for that date.`
                      : 'Tap a day on the calendar to see sessions.'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {tab === 'list' && (
          <View style={[styles.section, embedded && styles.sectionEmbedded]}>
            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: colors.text }]}>Upcoming · {clientLabel}</Text>
              <Text style={[styles.listCount, { color: colors.textSecondary }]}>
                Next {upcoming.length} {upcoming.length === 1 ? 'session' : 'sessions'}
              </Text>
            </View>

            {upcoming.length === 0 ? (
              <EmptyState
                title="No sessions yet"
                subtitle={
                  clientId
                    ? `Schedule a session with ${clientLabel}.`
                    : 'Schedule your first session.'
                }
                cta="New session"
                onCta={() => onNavigate?.(newSessionPath(null))}
                colors={colors}
              />
            ) : (
              <View style={styles.sessionsList}>
                {upcoming.map((s) => (
                  <TouchableOpacity key={s.id} onPress={() => onNavigate?.(`/sessions/${s.id}`)} activeOpacity={0.88}>
                    <SessionCard session={s} theme={theme} showDate />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </Root>
  );
};

export default BookTraineeSessionScreen;

const SegBtn = ({ active, onPress, icon, label, colors }) => (
  <TouchableOpacity style={[styles.segBtn, active && { backgroundColor: colors.primary }]} onPress={onPress} activeOpacity={0.7}>
    {icon}
    <Text style={[styles.segBtnText, { color: active ? 'white' : colors.textSecondary }]}>{label}</Text>
  </TouchableOpacity>
);

const EmptyState = ({ title, subtitle, cta, onCta, colors }) => (
  <View style={[styles.emptyState, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
    <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
      <CalendarDays color={colors.primary} size={20} />
    </View>
    <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
    {subtitle ? <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
    {cta && onCta ? (
      <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={onCta} activeOpacity={0.8}>
        <Plus color="white" size={14} />
        <Text style={styles.emptyBtnText}>{cta}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  embeddedRoot: { flexGrow: 0, flexShrink: 0 },
  aurora: { position: 'absolute', inset: 0 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerEmbedded: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 10,
    marginTop: 2,
  },
  themeToggle: { width: 44, height: 32 },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 4,
    borderWidth: 1,
    gap: 4,
  },
  segmentedEmbedded: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
    gap: 8,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segBtnText: { fontSize: 12, fontWeight: '600' },
  content: { flexGrow: 0 },
  scrollContent: { gap: 0 },
  scrollContentEmbedded: { gap: 12 },
  newSessionRow: { marginBottom: 4 },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  newSessionText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  section: { padding: 16, paddingTop: 0 },
  sectionEmbedded: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  dayListSection: { marginTop: 14 },
  dayListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 0,
  },
  dayListTitle: { fontSize: 14, fontWeight: '700' },
  clearBtn: { fontSize: 12, fontWeight: '600' },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  listTitle: { fontSize: 14, fontWeight: '700' },
  listCount: { fontSize: 12 },
  sessionsList: { gap: 14 },
  emptyPrompt: {
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyPromptEmbedded: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    alignItems: 'flex-start',
  },
  emptyPromptText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyState: {
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  emptySubtitle: { fontSize: 12, marginBottom: 16, textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyBtnText: { color: 'white', fontSize: 14, fontWeight: '600' },
});

