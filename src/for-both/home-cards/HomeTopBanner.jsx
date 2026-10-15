// Welcome hero at the top of client and trainer home: greeting, brand line, quote, live clock.
// Flow: pick morning/afternoon/evening/night → paint the gradient card → clock ticks every second.
// Used by client home, trainer home, and any screen that wants the same aurora banner.

import React, { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { DailyQuotePill } from './DailyQuoteCard';
import CardGlow from './CardGlow';
import ColorText from '../../look-and-feel/ColorText';
import { HERO_TITLE_TEXT_GRADIENT } from '../../look-and-feel/brandColors';

// ===== NAMED CONSTANTS =====

/** Dark purple → dark orange — Today/time card icon accent. */
export const TODAY_CARD_TOP_STRIPE = ['#6D28D9', '#C2410C'];

/** Hot pink → dark orange rim on welcome hero (client + trainer). */
export const AURORA_HERO_BORDER = ['#FF6B9D', '#C2410C'];

/** @deprecated Prefer AURORA_HERO_BORDER — kept so stale bundles/imports do not crash. */
export const HERO_TOP_STRIPE = AURORA_HERO_BORDER;

const HERO_INNER_BG_DARK = ['#1a0a2e', '#0f0a1a'];
const HERO_INNER_BG_LIGHT = ['#F8FAFF', '#FFFFFF'];
const DEFAULT_USER_NAME = 'User';
const FALLBACK_FIRST_NAME = 'User';

// Manipulate here: greeting windows. The clock icon uses a slightly earlier evening cutoff.
const MORNING_START_HOUR = 5;
const NOON_HOUR = 12;
const AFTERNOON_END_HOUR = 17;
const GREETING_EVENING_END_HOUR = 23;
const CLOCK_ICON_EVENING_END_HOUR = 21;
const HOURS_ON_CLOCK = 12;
// Manipulate here: how often the live clock redraws.
const CLOCK_TICK_MS = 1000;
const HERO_CORNER_RADIUS = 24;
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

function clockTextColors(isDark) {
  return {
    overline: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)',
    secondary: isDark ? 'rgba(255,255,255,0.60)' : 'rgba(10,10,15,0.58)',
    primary: isDark ? '#FFFFFF' : '#0A0A0F',
    clockBg: isDark ? '#0A0A0F' : '#FFFFFF',
    hairline: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.10)',
    secondsColor: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(10,10,15,0.40)',
  };
}

function AuroraHeroLiveClock({ isDark }) {
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
  const colors = clockTextColors(isDark);

  return (
    <View style={[clockStyles.wrap, isDark ? clockStyles.wrapGlowDark : clockStyles.wrapGlowLight]}>
      <View
        style={[
          clockStyles.frame,
          {
            backgroundColor: colors.clockBg,
            borderWidth: 1,
            borderColor: colors.hairline,
          },
        ]}
      >
        <View style={clockStyles.body}>
            <View style={clockStyles.dateCol}>
              <Text style={[clockStyles.overline, { color: colors.overline }]}>Today</Text>
              <Text style={[clockStyles.dateText, { color: colors.primary }]} numberOfLines={2}>
                {dateLine}
              </Text>
              <View style={clockStyles.segRow}>
                <LinearGradient
                  colors={TODAY_CARD_TOP_STRIPE}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={clockStyles.iconCircle}
                >
                  <Ionicons name={ioniconForDayPart(dayPart)} size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[clockStyles.segText, { color: colors.secondary }]}>{dayPartLabel}</Text>
              </View>
            </View>

            <View style={clockStyles.timeCol}>
              <View style={clockStyles.timeRow}>
                <Text
                  style={[clockStyles.timeMain, { color: colors.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {main}
                </Text>
                <Text style={[clockStyles.timeSec, { color: colors.secondsColor }]}>
                  :{seconds}
                </Text>
              </View>
              <Text style={[clockStyles.timeAmPm, { color: colors.overline }]}>{ampm}</Text>
            </View>
        </View>
      </View>
    </View>
  );
}

function HeroGradientFrame({ isDark, layout, children }) {
  const shellStyle = layout === 'trainer' ? styles.outerTrainer : styles.outerClient;
  const radius = shellStyle.borderRadius ?? HERO_CORNER_RADIUS;
  const innerBg = isDark ? HERO_INNER_BG_DARK : HERO_INNER_BG_LIGHT;

  return (
    <View style={[shellStyle, styles.heroShell]}>
      <CardGlow isDark={isDark} borderRadius={radius} />

      <View
        style={[
          styles.cardShadow,
          { borderRadius: radius },
          Platform.select({
            ios: {
              shadowColor: '#C2410C',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: isDark ? 0.38 : 0.22,
              shadowRadius: 18,
            },
            android: { elevation: 10 },
          }),
        ]}
      >
        <View style={[styles.cardClip, { borderRadius: radius }]}>
          <LinearGradient
            colors={AURORA_HERO_BORDER}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ padding: 1.5, borderRadius: radius }}
          >
            <View style={[styles.innerClip, { borderRadius: radius - 1.5 }]}>
              <LinearGradient
                colors={innerBg}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.inner}
              >
                {children}
              </LinearGradient>
            </View>
          </LinearGradient>
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
  isDark,
  userId,
  userName = DEFAULT_USER_NAME,
  greetingPeriod,
  textColor,
  showLiveClock = true,
  layout = 'client',
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BANNER_MIN_WIDTH;
  const titleSize = isWide ? TITLE_SIZE_WIDE : TITLE_SIZE_NARROW;
  const lottieSize = Math.min(
    isWide ? LOTTIE_MAX_WIDE : LOTTIE_MAX_NARROW,
    Math.max(LOTTIE_MIN_SIZE, Math.round((width - HERO_HORIZONTAL_PAD) * LOTTIE_WIDTH_FRACTION)),
  );
  const firstName = firstNameFromUserName(userName);
  const period = greetingPeriod || getAuroraHeroGreeting();
  const greetingColor = textColor ?? (isDark ? '#FFFFFF' : '#111827');

  // 1. Greeting line, then the brand block, then the quote animation.
  return (
    <HeroGradientFrame isDark={isDark} layout={layout}>
      <View style={{ marginBottom: layout === 'trainer' ? 6 : 4, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
          <Text
            style={[
              styles.greetingTitle,
              { color: greetingColor, textAlign: 'center', fontWeight: layout === 'trainer' ? '900' : '800' },
            ]}
          >
            Good {period},{' '}
          </Text>
          <ColorText
            colors={HERO_TITLE_TEXT_GRADIENT}
            style={{ fontWeight: layout === 'trainer' ? '900' : '800', fontSize: layout === 'trainer' ? 22 : 20 }}
          >
            {firstName}!
          </ColorText>
        </View>
      </View>

      <View
        style={[
          styles.contentRow,
          { flexDirection: isWide ? 'row' : 'column', gap: isWide ? 28 : 18 },
        ]}
      >
        <View style={[styles.left, { flex: isWide ? 0.6 : 1 }]}>
          <View style={styles.welcomeWrap}>
            <Text style={[styles.welcomeKicker, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(10,10,15,0.65)' }]}>
              WELCOME TO
            </Text>
            <LinearGradient
              colors={HERO_TITLE_TEXT_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.welcomeUnderline}
            />
          </View>

          <ColorText
            colors={HERO_TITLE_TEXT_GRADIENT}
            style={[styles.heroTitle, { fontSize: titleSize }]}
          >
            Coach Connect
          </ColorText>

          <Text style={[styles.heroTagline, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }]}>
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

      {showLiveClock ? <AuroraHeroLiveClock isDark={isDark} /> : null}
    </HeroGradientFrame>
  );
}

const styles = StyleSheet.create({
  heroShell: {
    position: 'relative',
    overflow: 'visible',
  },
  cardShadow: {
    position: 'relative',
    zIndex: 1,
    borderRadius: 24,
  },
  cardClip: {
    overflow: 'hidden',
  },
  innerClip: {
    overflow: 'hidden',
  },
  outerClient: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    borderRadius: 24,
  },
  outerTrainer: {
    marginTop: 10,
    marginBottom: 8,
    borderRadius: 24,
  },
  inner: {
    overflow: 'hidden',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  contentRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    alignItems: 'center',
  },
  welcomeWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  welcomeKicker: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  welcomeUnderline: {
    marginTop: 6,
    width: 72,
    height: 3,
    borderRadius: 99,
    opacity: 0.9,
  },
  heroTitle: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroTagline: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  right: {
    alignItems: 'center',
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  quoteWrap: {
    flex: 1,
    minWidth: 120,
    maxWidth: 200,
  },
  greetingTitle: {
    fontSize: 22,
    letterSpacing: -0.3,
  },
});

const clockStyles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
    marginTop: 14,
    marginBottom: 2,
  },
  wrapGlowDark: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  wrapGlowLight: {
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  frame: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  inner: {
    overflow: 'hidden',
  },
  topStripe: {
    height: 3,
    width: '100%',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 12,
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
    gap: 10,
    marginTop: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
