// BookSessionScreen.jsx
//
// The trainer's calendar screen. Shows every session for one client (or all clients) two ways:
// a month calendar you can tap a day on, or a flat upcoming list.
//
// Where the data comes from: useSessions() is a live Firestore listener (see mySessions.js).
// It watches trainer_clients/{trainerUid}/sessions and updates automatically — this screen
// never fetches anything itself, it just reads whatever useSessions() currently has.
//
// Used by: TrainerAppStart (the trainer's main "Sessions" tab) and the client detail screen
// (embedded=true, filtered to one clientId).
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
import { useSessions } from '../scheduling/mySessions';
import { MonthCalendar } from './MonthCalendar';
import { SessionCard } from './SessionCard';
import { formatDateLong } from '../../helpers/sessionTimeText';
import { FORM_SCROLL_PROPS, useEmbeddedScrollBottomPad } from '../../navigation/bottomMenuSpacing';

// ===== NAMED CONSTANTS =====

// Manipulate here: extra space below the last card so the bottom tab bar never covers it.
// Embedded (inside another screen) needs less — that screen already has its own bottom padding.
const SCROLL_BOTTOM_PAD_EMBEDDED = 24;
const SCROLL_BOTTOM_PAD_STANDALONE = 40;

// Every color this screen uses, grouped by theme. colors.text, colors.bg, etc. below all
// come from whichever of these two objects matches the current theme prop.
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

// ===== HELPER FUNCTIONS =====

// One pill in the Calendar/List switcher. "active" just means this is the tab currently showing.
const SegBtn = ({ active, onPress, icon, label, colors }) => (
  <TouchableOpacity style={[styles.segBtn, active && { backgroundColor: colors.primary }]} onPress={onPress} activeOpacity={0.7}>
    {icon}
    <Text style={[styles.segBtnText, { color: active ? 'white' : colors.textSecondary }]}>{label}</Text>
  </TouchableOpacity>
);

// A reusable "nothing here" card: icon, title, optional subtitle, optional call-to-action button.
// Used whenever a day or the whole list has zero sessions to show.
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

// Only shown when the screen is standalone (not embedded) — logo, app name, and screen subtitle.
const StandaloneHeaderBrand = ({ colors, title }) => (
  <View style={styles.headerContent}>
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
          {title}
        </Text>
      </View>
    </View>
    <View style={styles.themeToggle} />
  </View>
);

// The Calendar / List pill switcher at the top of the content area.
const TabSwitcher = ({ tab, onSelectTab, colors, embedded }) => (
  <View
    style={[
      styles.segmentedControl,
      embedded && styles.segmentedEmbedded,
      { backgroundColor: colors.glass, borderColor: colors.glassBorder },
    ]}
  >
    <SegBtn
      active={tab === 'calendar'}
      onPress={() => onSelectTab('calendar')}
      icon={<CalendarDays size={14} color={tab === 'calendar' ? 'white' : colors.textSecondary} />}
      label="Calendar"
      colors={colors}
    />
    <SegBtn
      active={tab === 'list'}
      onPress={() => onSelectTab('list')}
      icon={<ListIcon size={14} color={tab === 'list' ? 'white' : colors.textSecondary} />}
      label="List"
      colors={colors}
    />
  </View>
);

// The pink/purple "New session" button at the top of the scrollable content.
const NewSessionButton = ({ onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.newSessionRow}>
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
);

/**
 * The "Day List" area under the month calendar. Three states, checked in order:
 * no day tapped yet → prompt to tap one; a day tapped with no sessions → EmptyState;
 * a day tapped with sessions → the list of SessionCards for that day.
 */
function CalendarDayPanel({
  colors,
  embedded,
  dayListTitle,
  selectedDate,
  sessionsOnSelectedDate,
  clientLabel,
  clientId,
  theme,
  onClearDate,
  onOpenSession,
  onScheduleForDate,
}) {
  const dayListHeader = (
    <View style={styles.dayListHeader}>
      <Text style={[styles.dayListTitle, { color: colors.text }]}>{dayListTitle}</Text>
      {selectedDate && (
        <TouchableOpacity onPress={onClearDate}>
          <Text style={[styles.clearBtn, { color: colors.primary }]}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // State 1: nothing tapped yet — just a hint to tap a day.
  if (!selectedDate) {
    const promptText = clientId
      ? `Tap a day to see ${clientLabel}'s sessions for that date.`
      : 'Tap a day on the calendar to see sessions.';
    return (
      <View style={styles.dayListSection}>
        {dayListHeader}
        <View
          style={[
            styles.emptyPrompt,
            embedded && styles.emptyPromptEmbedded,
            !embedded && { backgroundColor: colors.glass, borderColor: colors.glassBorder, borderWidth: 1 },
          ]}
        >
          <Text style={[styles.emptyPromptText, { color: colors.textSecondary }]}>{promptText}</Text>
        </View>
      </View>
    );
  }

  // State 2: a day is tapped, but it has no sessions.
  if (sessionsOnSelectedDate.length === 0) {
    return (
      <View style={styles.dayListSection}>
        {dayListHeader}
        <EmptyState
          title="No sessions this day"
          subtitle={`Nothing scheduled with ${clientLabel} on this date.`}
          cta="Schedule one"
          onCta={() => onScheduleForDate(selectedDate)}
          colors={colors}
        />
      </View>
    );
  }

  // State 3: a day is tapped and it has sessions — show them.
  return (
    <View style={styles.dayListSection}>
      {dayListHeader}
      <View style={styles.sessionsList}>
        {sessionsOnSelectedDate.map((session) => (
          <TouchableOpacity key={session.id} onPress={() => onOpenSession(session.id)} activeOpacity={0.88}>
            <SessionCard session={session} theme={theme} showDate={false} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

/**
 * The "List" tab content: a header with a count, then either EmptyState or the next
 * 5 upcoming SessionCards.
 */
function UpcomingSessionsPanel({
  colors,
  clientLabel,
  clientId,
  upcomingSessions,
  theme,
  onOpenSession,
  onScheduleNew,
}) {
  const listHeader = (
    <View style={styles.listHeader}>
      <Text style={[styles.listTitle, { color: colors.text }]}>Upcoming · {clientLabel}</Text>
      <Text style={[styles.listCount, { color: colors.textSecondary }]}>
        Next {upcomingSessions.length} {upcomingSessions.length === 1 ? 'session' : 'sessions'}
      </Text>
    </View>
  );

  if (upcomingSessions.length === 0) {
    const emptySubtitle = clientId
      ? `Schedule a session with ${clientLabel}.`
      : 'Schedule your first session.';
    return (
      <>
        {listHeader}
        <EmptyState
          title="No sessions yet"
          subtitle={emptySubtitle}
          cta="New session"
          onCta={onScheduleNew}
          colors={colors}
        />
      </>
    );
  }

  return (
    <>
      {listHeader}
      <View style={styles.sessionsList}>
        {upcomingSessions.map((session) => (
          <TouchableOpacity key={session.id} onPress={() => onOpenSession(session.id)} activeOpacity={0.88}>
            <SessionCard session={session} theme={theme} showDate />
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

// ===== SCREEN LAYOUT (what the user sees — read this first) =====

/**
 * The whole visual screen: header, Calendar/List switcher, scroll area, and whichever
 * tab is active. Pure layout — it does not know about Firestore, hooks, or state. Everything
 * it needs (the session lists, the callbacks for tapping things) is already handed to it.
 * @param {object} props
 * @param {boolean} props.embedded - true when shown inside another screen (e.g. client detail)
 * @param {'dark'|'light'} props.theme
 * @param {object} props.colors - COLORS[theme], already picked by the caller
 * @param {number} props.scrollBottomPad - extra bottom space so the tab bar never covers a card
 * @param {string} [props.clientId]
 * @param {string} props.clientLabel
 * @param {'calendar'|'list'} props.tab
 * @param {(tab: string) => void} props.onSelectTab
 * @param {string|null} props.selectedDate
 * @param {(dateKey: string) => void} props.onSelectDate
 * @param {Array} props.sessionsForClient - every session for this screen's calendar month view
 * @param {string} props.dayListTitle
 * @param {Array} props.sessionsOnSelectedDate
 * @param {() => void} props.onClearDate
 * @param {(sessionId: string) => void} props.onOpenSession
 * @param {(dateKey: string) => void} props.onScheduleForDate
 * @param {Array} props.upcomingSessions
 * @param {() => void} props.onScheduleNew
 * @param {() => void} props.onNewSessionPress
 * @returns {JSX.Element}
 */
function ScreenLayout({
  embedded,
  theme,
  colors,
  scrollBottomPad,
  clientId,
  clientLabel,
  tab,
  onSelectTab,
  selectedDate,
  onSelectDate,
  sessionsForClient,
  dayListTitle,
  sessionsOnSelectedDate,
  onClearDate,
  onOpenSession,
  onScheduleForDate,
  upcomingSessions,
  onScheduleNew,
  onNewSessionPress,
}) {
  // Embedded (inside another screen) uses a plain View; standalone uses SafeAreaView for the notch.
  const Root = embedded ? View : SafeAreaView;

  // Everything below is just "what color / which style sits on this box" — pulled out of the
  // JSX so the return statement reads as a layout, not a wall of ternaries.
  const rootContainerStyle = [
    styles.container,
    embedded && styles.embeddedRoot,
    { backgroundColor: embedded ? 'transparent' : colors.bg },
  ];
  const headerBorderStyle = embedded
    ? null
    : { borderBottomColor: colors.glassBorder, borderBottomWidth: 1 };
  const headerContainerStyle = [
    styles.header,
    embedded && styles.headerEmbedded,
    { backgroundColor: embedded ? 'transparent' : colors.bg },
    headerBorderStyle,
  ];
  const screenTitleForHeader = clientId ? `Calendar · ${clientLabel}` : 'Trainer scheduling';
  const scrollContentStyle = [
    styles.scrollContent,
    embedded && styles.scrollContentEmbedded,
    { paddingBottom: scrollBottomPad },
  ];
  // Both tabs sit inside the same padded section — one style array, used twice below.
  const tabSectionStyle = [styles.section, embedded && styles.sectionEmbedded];

  return (
    <Root style={rootContainerStyle}>
      {!embedded && <View style={[styles.aurora, { backgroundColor: colors.bg }]} />}

      {/* Sticky header: brand row (standalone only) + the Calendar/List switcher */}
      <View style={headerContainerStyle}>
        {!embedded && <StandaloneHeaderBrand colors={colors} title={screenTitleForHeader} />}
        <TabSwitcher tab={tab} onSelectTab={onSelectTab} colors={colors} embedded={embedded} />
      </View>

      {/* Scrollable content: New-session button, then whichever tab is active */}
      <ScrollView style={styles.content} contentContainerStyle={scrollContentStyle} {...FORM_SCROLL_PROPS}>
        <NewSessionButton onPress={onNewSessionPress} />

        {tab === 'calendar' && (
          <View style={tabSectionStyle}>
            <MonthCalendar
              sessions={sessionsForClient}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
              theme={theme}
              borderless={embedded}
            />
            <CalendarDayPanel
              colors={colors}
              embedded={embedded}
              dayListTitle={dayListTitle}
              selectedDate={selectedDate}
              sessionsOnSelectedDate={sessionsOnSelectedDate}
              clientLabel={clientLabel}
              clientId={clientId}
              theme={theme}
              onClearDate={onClearDate}
              onOpenSession={onOpenSession}
              onScheduleForDate={onScheduleForDate}
            />
          </View>
        )}

        {tab === 'list' && (
          <View style={tabSectionStyle}>
            <UpcomingSessionsPanel
              colors={colors}
              clientLabel={clientLabel}
              clientId={clientId}
              upcomingSessions={upcomingSessions}
              theme={theme}
              onOpenSession={onOpenSession}
              onScheduleNew={onScheduleNew}
            />
          </View>
        )}
      </ScrollView>
    </Root>
  );
}

// ===== MAIN FUNCTION =====
// (where the data actually comes from — read this last; ScreenLayout above does the rendering)

/**
 * The trainer's session calendar — a month view plus an upcoming list, both backed by
 * the live useSessions() Firestore listener. Pass clientId to show only that client's sessions.
 * This function only wires data (Firestore, state, handlers); ScreenLayout above does the
 * actual rendering.
 * @param {object} props
 * @param {'dark'|'light'} [props.theme]
 * @param {boolean} [props.embedded] - true when shown inside another screen (e.g. client detail)
 * @param {(path: string) => void} [props.onNavigate]
 * @param {string} [props.clientId] - when set, only this client's sessions are shown
 * @param {string} [props.clientName]
 * @returns {JSX.Element}
 */
export const BookSessionScreen = ({ theme = 'dark', embedded = true, onNavigate, clientId, clientName }) => {
  const colors = COLORS[theme] || COLORS.dark;

  // Live data: whenever Firestore changes, useSessions() re-renders this screen automatically.
  const { sessions } = useSessions();

  // Which day is tapped on the calendar (null = none tapped yet), and which tab is showing.
  const [selectedDate, setSelectedDate] = useState(null);
  const [tab, setTab] = useState('calendar');

  // Not read directly below — calling this hook keeps the screen in sync if the device's
  // safe-area (notch/home-bar) size changes, e.g. on rotation.
  const insets = useSafeAreaInsets();
  const scrollBottomPad = useEmbeddedScrollBottomPad(
    embedded ? SCROLL_BOTTOM_PAD_EMBEDDED : SCROLL_BOTTOM_PAD_STANDALONE,
  );

  // Standalone Sessions tab has no single client — label the list as "all clients".
  const clientLabel = clientName || (clientId ? 'this client' : 'all clients');

  // When embedded on a client's detail page, only that client's sessions should show.
  // When this screen is the trainer's main "Sessions" tab (no clientId), show everyone's.
  const sessionsForClient = useMemo(() => {
    const allSessions = sessions || [];
    if (!clientId) return allSessions;
    const clientIdText = String(clientId);
    return allSessions.filter(
      (session) => session?.clientId != null && String(session.clientId) === clientIdText,
    );
  }, [sessions, clientId]);

  const todayKey = new Date().toISOString().slice(0, 10);

  // The next 5 sessions from today onward, earliest first — used by the "List" tab.
  const upcomingSessions = useMemo(
    () =>
      [...sessionsForClient]
        .filter((session) => (session.date || '') >= todayKey)
        .sort((sessionA, sessionB) =>
          (String(sessionA.date) + String(sessionA.time)).localeCompare(
            String(sessionB.date) + String(sessionB.time),
          ),
        )
        .slice(0, 5),
    [sessionsForClient, todayKey],
  );

  // Only filled in once the trainer taps a specific day on the calendar.
  const sessionsOnSelectedDate = selectedDate
    ? sessionsForClient
        .filter((session) => session.date === selectedDate)
        .sort((sessionA, sessionB) => String(sessionA.time).localeCompare(String(sessionB.time)))
    : [];

  // Heading above the day's session list: the tapped date, or a hint to tap one, or the list title.
  const dayListTitle =
    tab === 'list'
      ? `Upcoming · ${clientLabel}`
      : selectedDate
        ? formatDateLong(selectedDate)
        : 'Tap a day';

  // Where "New session" should navigate to — pre-fills the date if one is already selected.
  function newSessionPath(dateKey) {
    if (!dateKey) return '/sessions/new';
    return `/sessions/new?date=${encodeURIComponent(dateKey)}`;
  }

  // Tapping any session card in either tab opens that session's detail page.
  function goToSession(sessionId) {
    onNavigate?.(`/sessions/${sessionId}`);
  }

  // Hand everything off to the layout function above — it does all the actual rendering.
  return (
    <ScreenLayout
      embedded={embedded}
      theme={theme}
      colors={colors}
      scrollBottomPad={scrollBottomPad}
      clientId={clientId}
      clientLabel={clientLabel}
      tab={tab}
      onSelectTab={setTab}
      selectedDate={selectedDate}
      onSelectDate={(tappedDateKey) => setSelectedDate(tappedDateKey)}
      sessionsForClient={sessionsForClient}
      dayListTitle={dayListTitle}
      sessionsOnSelectedDate={sessionsOnSelectedDate}
      onClearDate={() => setSelectedDate(null)}
      onOpenSession={goToSession}
      onScheduleForDate={(dateKey) => onNavigate?.(newSessionPath(dateKey))}
      upcomingSessions={upcomingSessions}
      onScheduleNew={() => onNavigate?.(newSessionPath(null))}
      onNewSessionPress={() => onNavigate?.(newSessionPath(selectedDate))}
    />
  );
};

export default BookSessionScreen;

// Fixed layout numbers (sizes, spacing, radii) for every piece above. Colors are not in here —
// those come from COLORS[theme] above so dark/light mode can swap them live.
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

