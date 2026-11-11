// New client home layout: header, session invites, workout, quick actions, vitals, check-in, trainer, notes.
// Flow: same props as the old layout → one scroll of seven clear sections in order of what the person does first.
// Used by TrainingHomeScreen. The workout logger still comes in as a ready-made piece until it is redesigned.

import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { NbPill } from '../../../look-and-feel/nb/NbAccentPieces';
import { NbSurface } from '../../../look-and-feel/nb/NbSurface';
import { NB_RADIUS, NB_SPACING, getNbAccent, getNbColors } from '../../../look-and-feel/nb/nbTokens';
import { FORM_SCROLL_PROPS } from '../../../navigation/bottomMenuSpacing';
import { UpcomingSessionCard } from '../../../for-both/home-cards/UpcomingSessionCard';
import { NewHomeCheckIn } from './NewHomeCheckIn';
import { NewHomeHeader } from './NewHomeHeader';
import { NewHomeNotes } from './NewHomeNotes';
import { NewHomeQuickActions } from './NewHomeQuickActions';
import { NewHomeTrainer } from './NewHomeTrainer';
import { NewHomeVitals } from './NewHomeVitals';

// ===== NAMED CONSTANTS =====

const DEFAULT_FIRST_NAME = 'Athlete';
const SCREEN_SIDE_PADDING = 20;
const EMBEDDED_TOP_PADDING = 16;
const ERROR_ACCENT_POSITION = 1;
const WARNING_ACCENT_POSITION = 4;
const SECTION_LABEL_FONT_SIZE = 12;

// ===== HELPER FUNCTIONS =====

/**
 * @param {object} currentUser
 * @returns {string} First word of the display name, or a friendly default.
 */
function firstNameOf(currentUser) {
  const firstWord = String(currentUser?.displayName || '').trim().split(' ')[0];
  return firstWord || DEFAULT_FIRST_NAME;
}

// ===== IN-FILE PIECES =====

/**
 * Small uppercase title above a section.
 * @param {object} props
 * @param {string} props.text
 * @returns {JSX.Element}
 */
function SectionLabel({ text }) {
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);
  return <Text style={[styles.sectionLabel, { color: colors.ink }]}>{text}</Text>;
}

/**
 * Message about the daily reset or a failed save, when there is one.
 * @param {object} props
 * @param {{text?: string, type?: string}} props.displayBanner
 * @param {boolean} props.pendingReset
 * @returns {JSX.Element|null}
 */
function NewHomeNotice({ displayBanner, pendingReset }) {
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);
  if (!displayBanner?.text) return null;
  const isError = displayBanner.type === 'error';
  const isWarning = displayBanner.type === 'warn';
  return (
    <NbSurface radius={NB_RADIUS.card} innerStyle={styles.noticeInner}>
      {isError ? <NbPill label="Problem" accent={getNbAccent(ERROR_ACCENT_POSITION)} /> : null}
      {isWarning ? <NbPill label="Heads up" accent={getNbAccent(WARNING_ACCENT_POSITION)} /> : null}
      <Text style={[styles.noticeText, { color: colors.ink }]}>{displayBanner.text}</Text>
      {pendingReset ? <Text style={[styles.noticeSub, { color: colors.muted }]}>Retrying every 30 seconds</Text> : null}
    </NbSurface>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} props The same props the old TrainingHomeScreenLayout received, plus workoutLogSlot.
 * @param {React.ReactNode} props.workoutLogSlot The workout logger, rendered in the Workout section.
 * @returns {JSX.Element}
 */
export function NewHomeLayout(props) {
  const {
    scrollRef,
    embedInLayout,
    shellBottomPad,
    isDark,
    displayBanner,
    pendingReset,
    currentUser,
    onOpenWeeklyReport,
    weeklyReportCard,
    weeklyReportCardLoading,
    untilResetMs,
    dashboardPendingSessions,
    dashboardReminderSessions,
    trainerName,
    respondToDashboardSession,
    onMetricsChange,
    workoutLogSlot,
  } = props;

  // 1. Page colors and the two session lists.
  const colors = getNbColors(isDark);
  const pendingSessions = dashboardPendingSessions || [];
  const reminderSessions = dashboardReminderSessions || [];
  const hasPendingInvites = pendingSessions.length > 0;
  const hasSessions = hasPendingInvites || reminderSessions.length > 0;

  // 2. Seven sections, top to bottom.
  return (
    <View style={[styles.page, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          embedInLayout ? { paddingTop: EMBEDDED_TOP_PADDING } : null,
          { paddingBottom: shellBottomPad },
        ]}
        {...FORM_SCROLL_PROPS}
      >
        <NewHomeNotice displayBanner={displayBanner} pendingReset={pendingReset} />

        <NewHomeHeader
          firstName={firstNameOf(currentUser)}
          onOpenWeeklyReport={onOpenWeeklyReport}
          weeklyReportCard={weeklyReportCard}
          weeklyReportCardLoading={weeklyReportCardLoading}
          untilResetMs={untilResetMs}
        />

        {hasSessions ? (
          <View style={styles.section}>
            <SectionLabel text={hasPendingInvites ? 'Session invites' : 'Upcoming sessions'} />
            {hasPendingInvites
              ? pendingSessions.map((session) => (
                  <UpcomingSessionCard
                    key={session.id}
                    mode="invite"
                    isDark={isDark}
                    coachName={trainerName}
                    session={session}
                    onRespond={respondToDashboardSession}
                  />
                ))
              : reminderSessions.map((session) => (
                  <UpcomingSessionCard
                    key={session.id}
                    mode="reminder"
                    isDark={isDark}
                    coachName={trainerName}
                    session={session}
                  />
                ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionLabel text="Today's workout" />
          {workoutLogSlot}
        </View>

        <NewHomeQuickActions
          unreadMessageCount={props.unreadMessageCount}
          photoGalleryBadgeCount={props.photoGalleryBadgeCount}
          aiWorkoutsBadgeCount={props.aiWorkoutsBadgeCount}
          onPressMessage={props.onPressMessage}
          onOpenPhotoGallery={props.onOpenPhotoGallery}
          onOpenAIWorkouts={props.onOpenAIWorkouts}
          trainerClientId={props.trainerClientId}
          trainerClientName={props.trainerClientName}
        />

        <View style={styles.section}>
          <SectionLabel text="Vitals" />
          <NewHomeVitals onMetricsChange={onMetricsChange} />
        </View>

        <View style={styles.section}>
          <SectionLabel text="Daily check-in" />
          <NewHomeCheckIn onMetricsChange={onMetricsChange} />
        </View>

        <View style={styles.section}>
          <SectionLabel text="Your trainer" />
          <NewHomeTrainer {...props} />
        </View>

        <View style={styles.section}>
          <SectionLabel text="Notes" />
          <NewHomeNotes />
        </View>
      </ScrollView>
    </View>
  );
}

export default NewHomeLayout;

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { paddingHorizontal: SCREEN_SIDE_PADDING, paddingTop: NB_SPACING.large, gap: NB_SPACING.huge },
  section: { gap: NB_SPACING.medium },
  sectionLabel: { fontSize: SECTION_LABEL_FONT_SIZE, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  noticeInner: { padding: NB_SPACING.medium, gap: NB_SPACING.small, alignItems: 'flex-start' },
  noticeText: { fontSize: 14, fontWeight: '700' },
  noticeSub: { fontSize: 12, fontWeight: '500' },
});
