// Top of the client home: date, greeting, the weekly report button, and the countdown to the daily reset.
// Flow: pick a greeting for the hour → show the date and first name → show the report button and reset timer.
// Used by NewHomeLayout as the first section.

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { ChartColumn, Clock } from 'lucide-react-native';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { NbSurface } from '../../../look-and-feel/nb/NbSurface';
import { MINIMUM_TOUCH_SIZE, NB_RADIUS, NB_SPACING, getNbColors } from '../../../look-and-feel/nb/nbTokens';

// ===== NAMED CONSTANTS =====

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const MORNING_ENDS_HOUR = 12;
const AFTERNOON_ENDS_HOUR = 17;
const TITLE_FONT_SIZE = 28;
const EYEBROW_FONT_SIZE = 12;
const BUTTON_ICON_SIZE = 18;

// ===== HELPER FUNCTIONS =====

/**
 * @param {number} hourOfDay 0 to 23.
 * @returns {string} Morning, afternoon or evening greeting start.
 */
function greetingForHour(hourOfDay) {
  if (hourOfDay < MORNING_ENDS_HOUR) return 'Good morning';
  if (hourOfDay < AFTERNOON_ENDS_HOUR) return 'Good afternoon';
  return 'Good evening';
}

/**
 * @param {number} milliseconds
 * @returns {string} Hours, minutes and seconds as HH:MM:SS.
 */
function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / MS_PER_SECOND));
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const twoDigits = (part) => String(part).padStart(2, '0');
  return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {string} props.firstName
 * @param {Function} [props.onOpenWeeklyReport]
 * @param {{weekRangeLabel: string}} props.weeklyReportCard
 * @param {boolean} props.weeklyReportCardLoading
 * @param {number} props.untilResetMs
 * @returns {JSX.Element}
 */
export function NewHomeHeader({
  firstName,
  onOpenWeeklyReport,
  weeklyReportCard,
  weeklyReportCardLoading,
  untilResetMs,
}) {
  // 1. Colors for the current theme.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);

  // 2. Text for the top of the screen.
  const now = new Date();
  const dateLabel = format(now, 'EEEE, MMM d');
  const greeting = `${greetingForHour(now.getHours())}, ${firstName}`;
  const rangeLabel = weeklyReportCard?.weekRangeLabel || '';
  const showReportButton = typeof onOpenWeeklyReport === 'function';

  // 3. Date and greeting, then the report button and the reset timer side by side.
  return (
    <View style={styles.wrapper}>
      <View>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>{dateLabel}</Text>
        <Text style={[styles.title, { color: colors.ink }]}>{greeting}</Text>
      </View>

      <View style={styles.row}>
        {showReportButton ? (
          <Pressable
            style={styles.reportHit}
            onPress={() => onOpenWeeklyReport()}
            accessibilityRole="button"
            accessibilityLabel="Week in review"
          >
            <NbSurface radius={NB_RADIUS.chip} innerStyle={styles.reportInner}>
              <ChartColumn color={colors.ink} size={BUTTON_ICON_SIZE} />
              <View style={styles.reportText}>
                <Text style={[styles.reportTitle, { color: colors.ink }]}>Week in review</Text>
                {rangeLabel ? (
                  <Text numberOfLines={1} style={[styles.reportRange, { color: colors.muted }]}>
                    {rangeLabel}
                  </Text>
                ) : null}
              </View>
              {weeklyReportCardLoading ? <ActivityIndicator size="small" color={colors.ink} /> : null}
            </NbSurface>
          </Pressable>
        ) : null}

        <NbSurface radius={NB_RADIUS.chip} hasShadow={false} innerStyle={styles.timerInner}>
          <Clock color={colors.muted} size={BUTTON_ICON_SIZE - 2} />
          <Text style={[styles.timerText, { color: colors.ink }]}>{formatCountdown(untilResetMs)}</Text>
        </NbSurface>
      </View>
    </View>
  );
}

export default NewHomeHeader;

const styles = StyleSheet.create({
  wrapper: { gap: NB_SPACING.large },
  eyebrow: { fontSize: EYEBROW_FONT_SIZE, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: TITLE_FONT_SIZE, fontWeight: '800', letterSpacing: -0.5, marginTop: NB_SPACING.tiny },
  row: { flexDirection: 'row', alignItems: 'center', gap: NB_SPACING.medium },
  reportHit: { flex: 1, minHeight: MINIMUM_TOUCH_SIZE },
  reportInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NB_SPACING.small,
    minHeight: MINIMUM_TOUCH_SIZE,
    paddingHorizontal: NB_SPACING.medium,
    paddingVertical: NB_SPACING.small,
  },
  reportText: { flex: 1 },
  reportTitle: { fontSize: 14, fontWeight: '800' },
  reportRange: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  timerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NB_SPACING.small,
    minHeight: MINIMUM_TOUCH_SIZE,
    paddingHorizontal: NB_SPACING.medium,
  },
  timerText: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
});
