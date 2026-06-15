/**
 * Aurora Hero Banner
 *
 * Purpose: UI screen or component: Aurora Hero Banner. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: getAuroraHeroGreeting, TODAY_CARD_TOP_STRIPE, AURORA_HERO_BORDER, AuroraHeroBanner
 *
 * @file-header
 */
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

/** Dark purple → dark orange — Today/time card icon accent. */
export const TODAY_CARD_TOP_STRIPE = ['#6D28D9', '#C2410C'];

/** Hot pink → dark orange rim on welcome hero (client + trainer). */
export const AURORA_HERO_BORDER = ['#FF6B9D', '#C2410C'];

export function getAuroraHeroGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function auroraHeroDaySegment(hour) {
  const h = Number(hour);
  if (!Number.isFinite(h)) return '';
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

function auroraHeroSegmentIcon(seg) {
  if (seg === 'morning') return 'sunny-outline';
  if (seg === 'afternoon') return 'partly-sunny-outline';
  if (seg === 'evening') return 'cloudy-night-outline';
  return 'moon-outline';
}

function auroraLiveClockParts(now) {
  const h = now.getHours();
  const m = now.getMinutes();
  const s = now.getSeconds();
  const hour12 = h % 12 || 12;
  const main = `${hour12}:${String(m).padStart(2, '0')}`;
  const seconds = String(s).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return { main, seconds, ampm };
}

function AuroraHeroLiveClock({ isDark }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { main, seconds, ampm } = auroraLiveClockParts(now);
  const dateLine = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const seg = auroraHeroDaySegment(now.getHours());
  const segLabel = seg.charAt(0).toUpperCase() + seg.slice(1);
  const overline = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)';
  const secondary = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(10,10,15,0.58)';
  const primary = isDark ? '#FFFFFF' : '#0A0A0F';
  const clockBg = isDark ? '#0A0A0F' : '#FFFFFF';
  const hairline = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.10)';

  return (
    <View style={[clockStyles.wrap, isDark ? clockStyles.wrapGlowDark : clockStyles.wrapGlowLight]}>
      <View
        style={[
          clockStyles.frame,
          {
            backgroundColor: clockBg,
            borderWidth: 1,
            borderColor: hairline,
          },
        ]}
      >
        <View style={clockStyles.body}>
            <View style={clockStyles.dateCol}>
              <Text style={[clockStyles.overline, { color: overline }]}>Today</Text>
              <Text style={[clockStyles.dateText, { color: primary }]} numberOfLines={2}>
                {dateLine}
              </Text>
              <View style={clockStyles.segRow}>
                <LinearGradient
                  colors={TODAY_CARD_TOP_STRIPE}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={clockStyles.iconCircle}
                >
                  <Ionicons name={auroraHeroSegmentIcon(seg)} size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={[clockStyles.segText, { color: secondary }]}>{segLabel}</Text>
              </View>
            </View>

            <View style={clockStyles.timeCol}>
              <View style={clockStyles.timeRow}>
                <Text
                  style={[clockStyles.timeMain, { color: primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                >
                  {main}
                </Text>
                <Text style={[clockStyles.timeSec, { color: isDark ? 'rgba(255,255,255,0.40)' : 'rgba(10,10,15,0.40)' }]}>
                  :{seconds}
                </Text>
              </View>
              <Text style={[clockStyles.timeAmPm, { color: overline }]}>{ampm}</Text>
            </View>
        </View>
      </View>
    </View>
  );
}

/** Welcome shell — hot pink → dark orange gradient rim. */
function HeroGradientFrame({ isDark, layout, children }) {
  const outerStyle = layout === 'trainer' ? styles.outerTrainer : styles.outerClient;
  const innerBg = isDark ? '#0A0A0F' : '#FFFFFF';
  const radius = outerStyle.borderRadius ?? 24;

  return (
    <LinearGradient
      colors={AURORA_HERO_BORDER}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        outerStyle,
        {
          padding: 1.5,
          shadowColor: '#FF6B9D',
          shadowOpacity: isDark ? 0.24 : 0.16,
        },
      ]}
    >
      <View style={[styles.inner, { backgroundColor: innerBg, borderRadius: radius - 1.5 }]}>
        {children}
      </View>
    </LinearGradient>
  );
}

export default function AuroraHeroBanner({
  isDark,
  userId,
  userName = 'User',
  greetingPeriod,
  textColor,
  showLiveClock = true,
  layout = 'client',
}) {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  const titleSize = isWide ? 38 : 34;
  const lottieSize = Math.min(isWide ? 150 : 130, Math.max(96, Math.round((width - 32) * 0.36)));
  const firstName = String(userName || 'User').trim().split(/\s+/)[0] || 'User';
  const period = greetingPeriod || getAuroraHeroGreeting();
  const greetingColor = textColor ?? (isDark ? '#FFFFFF' : '#111827');

  return (
    <HeroGradientFrame isDark={isDark} layout={layout}>
      <View style={{ marginBottom: layout === 'trainer' ? 6 : 4, alignItems: 'center' }}>
        <Text
          style={[
            styles.greetingTitle,
            { color: greetingColor, textAlign: 'center', fontWeight: layout === 'trainer' ? '900' : '800' },
          ]}
        >
          Good {period},{' '}
          <Text style={{ color: '#FF6B9D', fontWeight: layout === 'trainer' ? '900' : '800' }}>{firstName}!</Text>
        </Text>
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
              colors={['#FF6B9D', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.welcomeUnderline}
            />
          </View>

          <Text style={[styles.heroTitle, { fontSize: titleSize, color: '#FF6B9D' }]}>Coach Connect</Text>

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
  outerClient: {
    marginHorizontal: 22,
    marginTop: 0,
    marginBottom: 6,
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 24,
    elevation: 10,
    position: 'relative',
  },
  outerTrainer: {
    marginTop: 4,
    marginBottom: 0,
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 24,
    elevation: 10,
    position: 'relative',
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
