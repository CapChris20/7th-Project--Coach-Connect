import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, CalendarDays, List as ListIcon, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSessions } from '../../hooks/use-sessions';
import { MonthCalendar } from '../../components/MonthCalendar';
import { SessionCard } from '../../components/SessionCard';
import { formatDateLong } from '../../lib/sessions';

const COLORS = {
  dark: {
    bg: '#0A0A0F',
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
    bg: '#FFFFFF',
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

export const SessionSchedulingScreen = ({ theme = 'dark', onNavigate }) => {
  const colors = COLORS[theme] || COLORS.dark;
  const { sessions } = useSessions();
  const [selectedDate, setSelectedDate] = useState(null);
  const [tab, setTab] = useState('calendar');
  const insets = useSafeAreaInsets();
  // TrainerApp always shows a bottom tab bar; keep FAB fully above it.
  // (The 116px value was pushing the pill into the middle of the screen on smaller viewports.)
  const bottomNavClearance = 105;
  const fabBottom = 16 + insets.bottom + bottomNavClearance;

  const todayKey = new Date().toISOString().slice(0, 10);

  const upcoming = useMemo(
    () =>
      [...sessions]
        .filter((s) => (s.date || '') >= todayKey)
        .sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)))
        .slice(0, 5),
    [sessions, todayKey]
  );

  const dayList = selectedDate
    ? sessions
        .filter((s) => s.date === selectedDate)
        .sort((a, b) => String(a.time).localeCompare(String(b.time)))
    : [];

  const listTitle = tab === 'list' ? 'Upcoming' : selectedDate ? formatDateLong(selectedDate) : 'Tap a day';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Aurora background */}
      <View style={[styles.aurora, { backgroundColor: colors.bg }]} />

      {/* Sticky Header */}
      <View style={[styles.header, { borderBottomColor: colors.glassBorder }]}>
        <View style={styles.headerContent}>
          {/* Brand */}
          <View style={styles.brandContainer}>
            <LinearGradient
              colors={['#FF6B9D', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.brandIcon}
            >
              <Sparkles color="white" size={20} />
            </LinearGradient>
            <View>
              <Text style={[styles.appTitle, { color: colors.text }]}>CoachConnect</Text>
              <Text style={[styles.appSubtitle, { color: colors.textSecondary }]}>Trainer scheduling</Text>
            </View>
          </View>

          {/* Theme toggle (placeholder) */}
          <View style={styles.themeToggle} />
        </View>

        {/* Segmented Control */}
        <View style={[styles.segmentedControl, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
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
        contentContainerStyle={{ paddingBottom: fabBottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'calendar' && (
          <View style={styles.section}>
            <MonthCalendar
              sessions={sessions}
              selectedDate={selectedDate}
              onSelectDate={(d) => {
                setSelectedDate(d);
                onNavigate?.(`/sessions/new?date=${encodeURIComponent(d)}`);
              }}
              theme={theme}
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
                    cta="Schedule one"
                    onCta={() => onNavigate?.(`/sessions/new?date=${encodeURIComponent(selectedDate)}`)}
                    colors={colors}
                  />
                ) : (
                  <View style={styles.sessionsList}>
                    {dayList.map((s) => (
                      <TouchableOpacity key={s.id} onPress={() => onNavigate?.(`/sessions/${s.id}`)} activeOpacity={0.85}>
                        <SessionCard session={s} theme={theme} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )
              ) : (
                <View style={[styles.emptyPrompt, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
                  <Text style={[styles.emptyPromptText, { color: colors.textSecondary }]}>Tap a day on the calendar to see sessions.</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {tab === 'list' && (
          <View style={styles.section}>
            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: colors.text }]}>Upcoming</Text>
              <Text style={[styles.listCount, { color: colors.textSecondary }]}>
                Next {upcoming.length} {upcoming.length === 1 ? 'session' : 'sessions'}
              </Text>
            </View>

            {upcoming.length === 0 ? (
              <EmptyState
                title="No sessions yet"
                subtitle="Tap the + button to schedule your first session."
                cta="New session"
                onCta={() => onNavigate?.('/sessions/new')}
                colors={colors}
              />
            ) : (
              <View style={styles.sessionsList}>
                {upcoming.map((s) => (
                  <TouchableOpacity key={s.id} onPress={() => onNavigate?.(`/sessions/${s.id}`)} activeOpacity={0.85}>
                    <SessionCard session={s} theme={theme} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* FAB */}
      <View pointerEvents="box-none" style={[styles.fabWrap, { bottom: fabBottom }]}>
        <View
          pointerEvents="none"
          style={[
            styles.fabGlow,
            { backgroundColor: colors.primaryGlow },
          ]}
        />
        <TouchableOpacity onPress={() => onNavigate?.('/sessions/new')} activeOpacity={0.88}>
          <LinearGradient
            colors={['#FF6B9D', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.fab, { borderColor: colors.glassBorder }]}
          >
            <Plus color="white" size={18} />
            <Text style={styles.fabText}>New session</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default SessionSchedulingScreen;

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
  aurora: { position: 'absolute', inset: 0 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  segBtnText: { fontSize: 12, fontWeight: '600' },
  content: { flex: 1 },
  section: { padding: 16 },
  dayListSection: { marginTop: 20 },
  dayListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
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
  sessionsList: { gap: 12 },
  emptyPrompt: {
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
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
  fabWrap: {
    position: 'absolute',
    left: '50%',
    marginLeft: -86,
    width: 172,
    height: 56,
    zIndex: 50,
  },
  fabGlow: {
    position: 'absolute',
    left: -14,
    right: -14,
    top: -14,
    bottom: -14,
    borderRadius: 40,
    opacity: 0.28,
  },
  fab: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 10,
  },
  fabText: { color: 'white', fontSize: 14, fontWeight: '600' },
});

