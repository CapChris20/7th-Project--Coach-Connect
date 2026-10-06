// Home quote card and the smaller pill. One quote per user per local day, cached on the device.
// Flow: first visit pins quote 0 → later visits reuse today's saved index → a new day picks the day-of-year quote.
// Used on the client and trainer home screens. Quote text lives in dailyQuotes.json (keys `q` and `a`).

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import dailyQuotesData from '../../daily-stats/dailyQuotes.json';

// ===== NAMED CONSTANTS =====

const QUOTE_LIST = Array.isArray(dailyQuotesData?.quotes) ? dailyQuotesData.quotes : [];
// vocab: `q` is the sentence and `a` is the author. Those keys come from dailyQuotes.json.
const FALLBACK_QUOTE = { q: 'Keep showing up.', a: 'Daily Motivation' };
const FALLBACK_AUTHOR = 'Daily Motivation';
const UNKNOWN_AUTHOR = 'unknown';
// Manipulate here: milliseconds in a day, used to turn "now" into a day-of-year index.
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

// ===== HELPER FUNCTIONS =====

function dailyQuoteStorageKey(userId) {
  return `coachconnect_daily_quote_v2:${userId}`;
}

function dailyQuoteSeenKey(userId) {
  return `coachconnect_daily_quote_seen_v1:${userId}`;
}

function todayKeyLocal() {
  return new Date().toISOString().slice(0, 10);
}

function dayOfYearNumber(now) {
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const elapsedMs = now - startOfYear;
  return Math.floor(elapsedMs / MILLISECONDS_PER_DAY);
}

function getTodayQuote() {
  if (!QUOTE_LIST.length) return FALLBACK_QUOTE;
  const dayOfYear = dayOfYearNumber(new Date());
  const index = (dayOfYear - 1) % QUOTE_LIST.length;
  return QUOTE_LIST[index];
}

function quoteIndexForToday() {
  const todayQuote = getTodayQuote();
  const index = QUOTE_LIST.findIndex((quote) => quote?.q === todayQuote?.q && quote?.a === todayQuote?.a);
  return index >= 0 ? index : 0;
}

function clampQuoteIndex(index) {
  return Math.max(0, Math.min(QUOTE_LIST.length - 1, Number(index)));
}

function displayAuthor(author) {
  const authorText = (author || '').trim();
  if (!authorText) return FALLBACK_AUTHOR;
  if (authorText.toLowerCase() === UNKNOWN_AUTHOR) return FALLBACK_AUTHOR;
  return authorText;
}

function quoteAtIndex(quoteIndex) {
  return QUOTE_LIST[quoteIndex] || QUOTE_LIST[0] || FALLBACK_QUOTE;
}

async function readCachedQuoteRecord(userId) {
  const raw = await AsyncStorage.getItem(dailyQuoteStorageKey(userId));
  return raw ? JSON.parse(raw) : null;
}

function cachedIndexForToday(parsed, today) {
  if (parsed?.date === today && Number.isFinite(parsed?.index)) {
    return clampQuoteIndex(parsed.index);
  }
  return null;
}

async function saveQuoteIndex(userId, today, index) {
  await AsyncStorage.setItem(dailyQuoteStorageKey(userId), JSON.stringify({ date: today, index }));
}

// Card-only: the first time this user opens the card, pin index 0, then rotate on later days.
// onIndex runs at the same moment the screen used to set state, before the storage writes finish.
async function resolveQuoteIndexForCard(userId, onIndex) {
  const today = todayKeyLocal();
  const parsed = await readCachedQuoteRecord(userId);
  const hasSeenQuote = await AsyncStorage.getItem(dailyQuoteSeenKey(userId));
  if (!hasSeenQuote) {
    const starterIndex = 0;
    onIndex(starterIndex);
    await AsyncStorage.setItem(dailyQuoteSeenKey(userId), 'true');
    await saveQuoteIndex(userId, today, starterIndex);
    return;
  }

  const cachedIndex = cachedIndexForToday(parsed, today);
  if (cachedIndex !== null) {
    onIndex(cachedIndex);
    return;
  }

  const todayIndex = quoteIndexForToday();
  onIndex(todayIndex);
  await saveQuoteIndex(userId, today, todayIndex);
}

// Pill does not pin a starter quote. It only reads today's cache or writes the day-of-year pick.
async function resolveQuoteIndexForPill(userId, onIndex) {
  const today = todayKeyLocal();
  const parsed = await readCachedQuoteRecord(userId);
  const cachedIndex = cachedIndexForToday(parsed, today);
  if (cachedIndex !== null) {
    onIndex(cachedIndex);
    return;
  }

  const todayIndex = quoteIndexForToday();
  onIndex(todayIndex);
  await saveQuoteIndex(userId, today, todayIndex);
}

// ===== MAIN FUNCTION =====

/**
 * Large daily quote card.
 * @param {{ userId?: string, cardWidth?: number|string, cardMinHeight?: number, embedded?: boolean }} props
 */
export default function DailyQuoteCard({ userId, cardWidth, cardMinHeight, embedded = false }) {
  const { isDark } = useTheme();
  const outerWidth = cardWidth ?? '100%';
  const outerMinHeight = cardMinHeight ?? 96;
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Embedded cards sit on a parent surface, so this card drops its own fill and border.
  const cardBackground = embedded
    ? 'transparent'
    : (isDark ? 'rgba(10,10,15,0.78)' : 'rgba(255,255,255,0.92)');
  const borderColor = embedded
    ? 'transparent'
    : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.10)');
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const authorColor = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(17,24,39,0.70)';

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      if (!userId) return;
      try {
        await resolveQuoteIndexForCard(userId, (index) => {
          if (!isCancelled) setQuoteIndex(index);
        });
      } catch (error) {
        // If AsyncStorage fails, do nothing and keep default
      }
    };

    run();

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  const quote = quoteAtIndex(quoteIndex);

  return (
    <View style={[styles.outer, { width: outerWidth, minHeight: outerMinHeight }]}>
      <View style={[styles.border, { borderColor, borderWidth: embedded ? 0 : 1 }]}>
        <View style={[styles.card, { backgroundColor: cardBackground, minHeight: outerMinHeight }]}>
          <View style={styles.content}>
            <Text style={[styles.quoteText, { color: textColor }]}>
              "{quote.q}"
            </Text>
            <Text style={styles.inspirationLabel}>DAILY INSPIRATION</Text>
            <Text style={[styles.authorText, { color: authorColor }]}>
              — {displayAuthor(quote.a)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Compact quote. `maxLines` truncates; omit it and the quote wraps.
 * @param {{ userId?: string, isDarkOverride?: boolean, maxLines?: number, embedded?: boolean }} props
 */
export function DailyQuotePill({ userId, isDarkOverride, maxLines, embedded = false }) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = typeof isDarkOverride === 'boolean' ? isDarkOverride : themeIsDark;
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    const run = async () => {
      if (!userId) return;
      try {
        await resolveQuoteIndexForPill(userId, (index) => {
          if (!isCancelled) setQuoteIndex(index);
        });
      } catch (_) {
        // ignore
      }
    };
    run();
    return () => {
      isCancelled = true;
    };
  }, [userId]);

  const quote = quoteAtIndex(quoteIndex);
  const hasLineLimit = typeof maxLines === 'number' && maxLines > 0;

  return (
    <View style={[pillStyles.wrap, embedded && pillStyles.wrapEmbedded]}>
      <View
        style={[
          pillStyles.inner,
          {
            backgroundColor: embedded
              ? 'transparent'
              : isDark
                ? 'rgba(10,10,15,0.80)'
                : 'rgba(255,255,255,0.92)',
            borderColor: embedded
              ? isDark
                ? 'rgba(255,255,255,0.12)'
                : 'rgba(10,10,15,0.10)'
              : isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(10,10,15,0.06)',
            borderWidth: 1,
            borderRadius: embedded ? 14 : 26,
          },
        ]}
      >
        <Text
          style={[pillStyles.text, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}
          {...(hasLineLimit ? { numberOfLines: maxLines, ellipsizeMode: 'tail' } : {})}
        >
          "{quote.q}"
        </Text>
        <Text
          style={[pillStyles.author, { color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.55)' }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          — {displayAuthor(quote.a)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 260,
    minHeight: 120,
  },
  border: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 96,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  quoteText: {
    textAlign: 'left',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    letterSpacing: 0.1,
  },
  inspirationLabel: {
    marginTop: 10,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#FF6B9D',
  },
  authorText: {
    marginTop: 4,
    textAlign: 'left',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
});

const pillStyles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: 28,
    overflow: 'hidden',
  },
  wrapEmbedded: {
    borderRadius: 0,
  },
  inner: {
    borderRadius: 26,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
  },
  author: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
