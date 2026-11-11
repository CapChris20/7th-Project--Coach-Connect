// Neobrutalist welcome hero for client + trainer home (greeting, brand, quote, live clock).
// Flow: resolve day-part greeting → NbCard shell → brand title gradient → quote + clock.
// Used by client home and trainer home. STYLE only — same content order as before.
//
// vocab: NbCard = thick ink border + hard 4/4 shadow (no glow, no aurora rim, no CardGlow)
// Manipulate here: title sizes / lottie max — keep one gradient moment (Coach Connect title)

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

// Manipulate here: greeting windows. Clock icon uses a slightly earlier evening cutoff.
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

// ===== HELPER FUNCTIONS =====

/**
 * One word for the "Good Morning," line from the current hour.
 * @returns {'Morning'|'Afternoon'|'Evening'|'Night'}
 */
export function getAuroraHeroGreeting() {
  const hour = new Date().getHours();
  if (hour >= MORNING_START_HOUR && hour < NOON_HOUR) return 'Morning';
  if (hour >= NOON_HOUR && hour < AFTERNOON_END_HOUR) return 'Afternoon';
  if (hour >= AFTERNOON_END_HOUR && hour < GREETING_EVENING_END_HOUR) return 'Evening';
  return 'Night';
}

/**
 * Full phrase for AI Coach / copy: "Good morning"
 * @returns {string}
 */
export function getAuroraHeroGreetingPhrase() {
  return `Good ${getAuroraHeroGreeting().toLowerCase()}`;
}

function dayPartForClockIcon(hour) {
  const clockHour = Number(hour);
  if (!Number.isFinite(clockHour)) return '';
  if (clockHour >= MORNING_START_HOUR && clockHour < NOON_HOUR) return 'morning';
  if (clockHour >= NOON_HOUR && clockHour < AFTERNOON_END_HOUR) return 'afternoon';
  if (clockHour >= AFTERNOON_END_HOUR && clockHour < CLOCK_ICON_EVENING_END_HOUR) return 'evening';
  return 'night';
}

function ioniconForDayPart(dayPart) {
  if (dayPart === 'morning') return 'sunny-outline';
  if (dayPart === 'afternoon') return 'partly-sunny-outline';
  if (dayPart === 'evening') return 'cloudy-night-outline';
  return 'moon-outline';
}

function liveClockParts(now) {
  const hour24 = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();
  const hour12 = hour24 % HOURS_ON_CLOCK || HOURS_ON_CLOCK;
  const main = `${hour12}:${String(minute).padStart(2, '0')}`;
  const seconds = String(second).padStart(2, '0');
  const ampm = hour24 >= NOON_HOUR ? 'PM' : 'AM';
  return { main, seconds, ampm };
}

function firstNameFromUserName(userName) {
  const trimmed = String(userName || DEFAULT_USER_NAME).trim();
  return trimmed.split(/\s+/)[0] || FALLBACK_FIRST_NAME;
}

/**
 * Title gradient colors for light vs dark (from shared tokens).
 * @param {boolean} isDark
 * @returns {string[]}
 */
function titleGradientColors(isDark) {
  return isDark ? gradients.title.dark.colors : gradients.title.light.colors;
}

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
  const dayPartLabel = dayPart.charAt(0).toUpperCase() + dayPart.slice(1);

  return (
    <View
      style={[
        clockStyles.frame,
        {
          backgroundColor: colors.nbSurfaceChip,
          borderWidth: nb.borderWidth,
          borderColor: colors.nbBorder,
        },
      ]}
    >
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
              <Ionicons name={ioniconForDayPart(dayPart)} size={20} color={colors.white} />
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
              :{seconds}
            </Text>
          </View>
          <Text style={[clockStyles.timeAmPm, { color: colors.nbMuted }]}>{ampm}</Text>
        </View>
      </View>
    </View>
  );
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
  layout = 'client',
}) {
  const theme = useTheme();
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : theme.isDark;
  const colors = theme.colors;
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BANNER_MIN_WIDTH;
  const titleSize = isWide ? TITLE_SIZE_WIDE : TITLE_SIZE_NARROW;
  const lottieSize = Math.min(
    isWide ? LOTTIE_MAX_WIDE : LOTTIE_MAX_NARROW,
    Math.max(LOTTIE_MIN_SIZE, Math.round((width - HERO_HORIZONTAL_PAD) * LOTTIE_WIDTH_FRACTION)),
  );
  const firstName = firstNameFromUserName(userName);
  const period = greetingPeriod || getAuroraHeroGreeting();
  const greetingColor = textColor ?? colors.nbInk;
  const titleColors = titleGradientColors(isDark);
  const shellStyle = layout === 'trainer' ? styles.outerTrainer : styles.outerClient;

  // Solid NbCard — same language as Settings. No CardGlow / neon rim / soft orange shadow.
  return (
    <NbCard style={[shellStyle, styles.card]}>
      <View style={styles.greetingRow}>
        <Text style={[styles.greetingTitle, { color: greetingColor }]}>
          Good {period},{' '}
        </Text>
        <ColorText
          colors={titleColors}
          style={[styles.greetingName, layout === 'trainer' && styles.greetingNameTrainer]}
        >
          {firstName}!
        </ColorText>
      </View>

      <View
        style={[
          styles.contentRow,
          { flexDirection: isWide ? 'row' : 'column', gap: isWide ? spacing.lg : spacing.md },
        ]}
      >
        <View style={[styles.left, { flex: isWide ? 0.6 : 1 }]}>
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

        <View style={[styles.right, { flex: isWide ? 0.4 : 1 }]}>
          <View style={styles.inlineRow}>
            <LottieView
              source={require('../../assets/icons/weightlifting-competition.json')}
              autoPlay
              loop
              style={{ width: lottieSize, height: lottieSize }}
            />
            <View style={styles.quoteWrap}>
              <DailyQuotePill userId={userId} isDarkOverride={isDark} embedded />
            </View>
          </View>
        </View>
      </View>

      {showLiveClock ? <HeroLiveClock isDark={isDark} colors={colors} /> : null}
    </NbCard>
  );
}

/** @deprecated Prefer gradients.brand — kept so stale imports do not crash. */
export const TODAY_CARD_TOP_STRIPE = gradients.ink.colors;
/** @deprecated Prefer gradients.brand — kept so stale imports do not crash. */
export const AURORA_HERO_BORDER = gradients.brand.colors;
/** @deprecated Prefer AURORA_HERO_BORDER */
export const HERO_TOP_STRIPE = AURORA_HERO_BORDER;

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
