// Neobrutalist welcome hero for client + trainer home (greeting, brand, quote, live clock).
// Flow: resolve day-part greeting → NbCard shell → brand title gradient → quote + clock.
// Used by client home and trainer home. STYLE only — same content order as before.

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { DailyQuotePill } from './DailyQuoteCard';
import ColorText from '../../look-and-feel/ColorText';
import NbCard from '../../look-and-feel/NbCard';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb, gradients, borderRadius, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_USER_NAME = 'User';
const FALLBACK_FIRST_NAME = 'User';
const LAYOUT_TRAINER = 'trainer';
const LAYOUT_CLIENT = 'client';

const MORNING_START_HOUR = 5;
const NOON_HOUR = 12;
const AFTERNOON_END_HOUR = 17;
const GREETING_EVENING_END_HOUR = 23;
const CLOCK_ICON_EVENING_END_HOUR = 21;
const HOURS_ON_CLOCK = 12;
const CLOCK_TICK_MS = 1000;

const WIDE_BANNER_MIN_WIDTH = 600;
const HERO_HORIZONTAL_PAD = 32;
const LOTTIE_MAX_WIDE = 150;
const LOTTIE_MAX_NARROW = 130;
const LOTTIE_MIN_SIZE = 96;
const LOTTIE_WIDTH_FRACTION = 0.36;
const TITLE_SIZE_WIDE = 38;
const TITLE_SIZE_NARROW = 34;
const WIDE_LEFT_FLEX = 0.6;
const WIDE_RIGHT_FLEX = 0.4;

const WEIGHTLIFTING_LOTTIE = require('../../assets/icons/weightlifting-competition.json');

const DAY_PART_MORNING = 'morning';
const DAY_PART_AFTERNOON = 'afternoon';
const DAY_PART_EVENING = 'evening';
const DAY_PART_NIGHT = 'night';

const GREETING_WORD_BY_DAY_PART = {
  [DAY_PART_MORNING]: 'Morning',
  [DAY_PART_AFTERNOON]: 'Afternoon',
  [DAY_PART_EVENING]: 'Evening',
  [DAY_PART_NIGHT]: 'Night',
};

const IONICON_BY_DAY_PART = {
  [DAY_PART_MORNING]: 'sunny-outline',
  [DAY_PART_AFTERNOON]: 'partly-sunny-outline',
  [DAY_PART_EVENING]: 'cloudy-night-outline',
  [DAY_PART_NIGHT]: 'moon-outline',
};

// ===== HELPER FUNCTIONS =====

/**
 * Day-part key for the greeting line (evening runs until 23).
 * @param {number} hour
 * @returns {'morning'|'afternoon'|'evening'|'night'}
 */
function dayPartForGreeting(hour) {
  if (hour >= MORNING_START_HOUR && hour < NOON_HOUR) return DAY_PART_MORNING;
  if (hour >= NOON_HOUR && hour < AFTERNOON_END_HOUR) return DAY_PART_AFTERNOON;
  if (hour >= AFTERNOON_END_HOUR && hour < GREETING_EVENING_END_HOUR) return DAY_PART_EVENING;
  return DAY_PART_NIGHT;
}

/**
 * One word for the "Good Morning," line from the current hour.
 * @returns {'Morning'|'Afternoon'|'Evening'|'Night'}
 */
export function getAuroraHeroGreeting() {
  const hour = new Date().getHours();
  const dayPart = dayPartForGreeting(hour);
  return GREETING_WORD_BY_DAY_PART[dayPart];
}

/**
 * Full phrase for AI Coach / copy: "Good morning"
 * @returns {string}
 */
export function getAuroraHeroGreetingPhrase() {
  return `Good ${getAuroraHeroGreeting().toLowerCase()}`;
}

/**
 * Day-part key for the clock icon (evening ends earlier than the greeting).
 * @param {number} hour
 * @returns {string}
 */
function dayPartForClockIcon(hour) {
  const clockHour = Number(hour);
  if (!Number.isFinite(clockHour)) return '';
  if (clockHour >= MORNING_START_HOUR && clockHour < NOON_HOUR) return DAY_PART_MORNING;
  if (clockHour >= NOON_HOUR && clockHour < AFTERNOON_END_HOUR) return DAY_PART_AFTERNOON;
  if (clockHour >= AFTERNOON_END_HOUR && clockHour < CLOCK_ICON_EVENING_END_HOUR) {
    return DAY_PART_EVENING;
  }
  return DAY_PART_NIGHT;
}

/**
 * Ionicons name for a day-part key.
 * @param {string} dayPart
 * @returns {string}
 */
function ioniconForDayPart(dayPart) {
  return IONICON_BY_DAY_PART[dayPart] || IONICON_BY_DAY_PART[DAY_PART_NIGHT];
}

/**
 * Split a Date into 12-hour main time, seconds, and AM/PM.
 * @param {Date} now
 * @returns {{ main: string, seconds: string, ampm: string }}
 */
function liveClockParts(now) {
  const hour24 = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();
  const hour12 = hour24 % HOURS_ON_CLOCK || HOURS_ON_CLOCK;
  const minuteText = String(minute).padStart(2, '0');
  const main = `${hour12}:${minuteText}`;
  const seconds = String(second).padStart(2, '0');
  const ampm = hour24 >= NOON_HOUR ? 'PM' : 'AM';
  return { main, seconds, ampm };
}

/**
 * First word of the display name, or "User".
 * @param {string|undefined} userName
 * @returns {string}
 */
function firstNameFromUserName(userName) {
  const trimmed = String(userName || DEFAULT_USER_NAME).trim();
  const firstWord = trimmed.split(/\s+/)[0];
  return firstWord || FALLBACK_FIRST_NAME;
}

/**
 * Title gradient colors for light vs dark (from shared tokens).
 * @param {boolean} isDark
 * @returns {string[]}
 */
function titleGradientColors(isDark) {
  if (isDark) return gradients.title.dark.colors;
  return gradients.title.light.colors;
}

/**
 * Lottie box size from window width and wide/narrow caps.
 * @param {number} windowWidth
 * @param {boolean} isWideLayout
 * @returns {number}
 */
function lottieSizeForWindow(windowWidth, isWideLayout) {
  const lottieMax = isWideLayout ? LOTTIE_MAX_WIDE : LOTTIE_MAX_NARROW;
  const lottieFromWidth = Math.round((windowWidth - HERO_HORIZONTAL_PAD) * LOTTIE_WIDTH_FRACTION);
  const atLeastMin = Math.max(LOTTIE_MIN_SIZE, lottieFromWidth);
  return Math.min(lottieMax, atLeastMin);
}

/**
 * Capitalize the first letter of a day-part label for the clock chip.
 * @param {string} dayPart
 * @returns {string}
 */
function capitalizeDayPartLabel(dayPart) {
  if (!dayPart) return '';
  return dayPart.charAt(0).toUpperCase() + dayPart.slice(1);
}

// ===== MAIN FUNCTION =====

/**
 * Welcome banner: Good {period}, {firstName} + Coach Connect + quote + live clock.
 * @param {object} props
 */
export default function HomeTopBanner({
  isDark: isDarkProp,
  userId,
  userName = DEFAULT_USER_NAME,
  greetingPeriod,
  textColor,
  showLiveClock = true,
  layout = LAYOUT_CLIENT,
}) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  // 1. Theme, layout width, and spoken greeting copy.
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : theme.isDark;
  const colors = theme.colors;
  const isWideLayout = windowWidth >= WIDE_BANNER_MIN_WIDTH;
  const firstName = firstNameFromUserName(userName);
  const period = greetingPeriod || getAuroraHeroGreeting();
  const greetingColor = textColor ?? colors.nbInk;
  const greetingLine = `Good ${period}, `;

  // 2. Hero type sizes and Lottie box — wide screens get a larger title and art cap.
  const titleSize = isWideLayout ? TITLE_SIZE_WIDE : TITLE_SIZE_NARROW;
  const lottieSize = lottieSizeForWindow(windowWidth, isWideLayout);

  // 3. Brand gradient tokens and outer margin for client vs trainer layout.
  const titleColors = titleGradientColors(isDark);
  const isTrainerLayout = layout === LAYOUT_TRAINER;
  const shellStyle = isTrainerLayout ? styles.outerTrainer : styles.outerClient;

  let nameStyle = [styles.greetingName];
  if (isTrainerLayout) {
    nameStyle = [styles.greetingName, styles.greetingNameTrainer];
  }

  const contentRowDirection = isWideLayout ? 'row' : 'column';
  const contentRowGap = isWideLayout ? spacing.lg : spacing.md;
  const leftColumnFlex = isWideLayout ? WIDE_LEFT_FLEX : 1;
  const rightColumnFlex = isWideLayout ? WIDE_RIGHT_FLEX : 1;
  const lottieBoxStyle = { width: lottieSize, height: lottieSize };
  const contentRowStyle = [
    styles.contentRow,
    { flexDirection: contentRowDirection, gap: contentRowGap },
  ];

  // 4. Paint NbCard: greeting → brand column → quote/lottie → optional live clock.
  let liveClockNode = null;
  if (showLiveClock) {
    liveClockNode = <HeroLiveClock isDark={isDark} colors={colors} />;
  }

  return (
    <NbCard style={[shellStyle, styles.card]}>
      <View style={styles.greetingRow}>
        <Text style={[styles.greetingTitle, { color: greetingColor }]}>
          {greetingLine}
        </Text>
        <ColorText colors={titleColors} style={nameStyle}>
          {firstName}!
        </ColorText>
      </View>

      <View style={contentRowStyle}>
        <View style={[styles.left, { flex: leftColumnFlex }]}>
          <Text style={[styles.welcomeKicker, { color: colors.nbMuted }]}>WELCOME TO</Text>
          <LinearGradient
            colors={titleColors}
            start={gradients.title.light.start}
            end={gradients.title.light.end}
            style={styles.welcomeUnderline}
          />

          <ColorText colors={titleColors} style={[styles.heroTitle, { fontSize: titleSize }]}>
            Coach Connect
          </ColorText>

          <Text style={[styles.heroTagline, { color: colors.nbMuted }]}>
            YOUR TRAINER-CLIENT RELATIONSHIP GETS BETTER WITH CC
          </Text>
        </View>

        <View style={[styles.right, { flex: rightColumnFlex }]}>
          <View style={styles.inlineRow}>
            <LottieView
              source={WEIGHTLIFTING_LOTTIE}
              autoPlay
              loop
              style={lottieBoxStyle}
            />
            <View style={styles.quoteWrap}>
              <DailyQuotePill userId={userId} isDarkOverride={isDark} embedded />
            </View>
          </View>
        </View>
      </View>

      {liveClockNode}
    </NbCard>
  );
}

/** @deprecated Prefer gradients.brand — kept so stale imports do not crash. */
export const TODAY_CARD_TOP_STRIPE = gradients.ink.colors;
/** @deprecated Prefer gradients.brand — kept so stale imports do not crash. */
export const AURORA_HERO_BORDER = gradients.brand.colors;
/** @deprecated Prefer AURORA_HERO_BORDER */
export const HERO_TOP_STRIPE = AURORA_HERO_BORDER;

// PLUMBING — skip unless debugging the ticking live clock sub-tree.

/**
 * Live clock strip under the hero: date + day-part chip + ticking time.
 * Hook order frozen: useState(now) then useEffect(interval).
 * @param {{ isDark: boolean, colors: object }} props
 */
function HeroLiveClock({ isDark, colors }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tickId = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => clearInterval(tickId);
  }, []);

  const { main, seconds, ampm } = liveClockParts(now);
  const dateLine = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const dayPart = dayPartForClockIcon(now.getHours());
  const dayPartLabel = capitalizeDayPartLabel(dayPart);
  const clockIconName = ioniconForDayPart(dayPart);
  const frameStyle = [
    clockStyles.frame,
    {
      backgroundColor: colors.nbSurfaceChip,
      borderWidth: nb.borderWidth,
      borderColor: colors.nbBorder,
    },
  ];
  const secondsText = `:${seconds}`;

  return (
    <View style={frameStyle}>
      <View style={clockStyles.body}>
        <View style={clockStyles.dateCol}>
          <Text style={[clockStyles.overline, { color: colors.nbMuted }]}>Today</Text>
          <Text style={[clockStyles.dateText, { color: colors.nbInk }]} numberOfLines={2}>
            {dateLine}
          </Text>
          <View style={clockStyles.segRow}>
            <LinearGradient
              colors={gradients.ink.colors}
              start={gradients.ink.start}
              end={gradients.ink.end}
              style={clockStyles.iconCircle}
            >
              <Ionicons name={clockIconName} size={20} color={colors.white} />
            </LinearGradient>
            <Text style={[clockStyles.segText, { color: colors.nbMuted }]}>{dayPartLabel}</Text>
          </View>
        </View>

        <View style={clockStyles.timeCol}>
          <View style={clockStyles.timeRow}>
            <Text
              style={[clockStyles.timeMain, { color: colors.nbInk }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {main}
            </Text>
            <Text style={[clockStyles.timeSec, { color: colors.nbMuted }]}>
              {secondsText}
            </Text>
          </View>
          <Text style={[clockStyles.timeAmPm, { color: colors.nbMuted }]}>{ampm}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  outerClient: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  outerTrainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  greetingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  greetingName: {
    fontWeight: '800',
    fontSize: 20,
  },
  greetingNameTrainer: {
    fontWeight: '900',
    fontSize: 22,
  },
  contentRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    alignItems: 'center',
  },
  welcomeKicker: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  welcomeUnderline: {
    marginTop: spacing.xs,
    width: 72,
    height: 3,
    borderRadius: borderRadius.round,
  },
  heroTitle: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  heroTagline: {
    marginTop: spacing.xs,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1.2,
  },
  right: {
    alignItems: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  quoteWrap: {
    flex: 1,
    minWidth: 120,
    maxWidth: 200,
  },
});

const clockStyles = StyleSheet.create({
  frame: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    marginBottom: 2,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  dateCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  overline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: 2,
  },
  segRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeCol: {
    alignItems: 'flex-end',
    minWidth: 108,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
  },
  timeMain: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  timeSec: {
    fontSize: 16,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    marginLeft: 1,
  },
  timeAmPm: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
});
