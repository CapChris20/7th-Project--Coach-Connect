// Home quote card and the smaller pill. One quote per user per local day, cached on the device.
// Flow: first card visit pins quote 0 → later visits reuse today's saved index → a new day picks day-of-year.
// Used on client and trainer home screens. Quote text lives in dailyQuotes.json (keys `q` and `a`).

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import dailyQuotesData from '../../daily-stats/dailyQuotes.json';
import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const QUOTE_LIST = Array.isArray(dailyQuotesData?.quotes) ? dailyQuotesData.quotes : [];
// vocab: `q` is the sentence and `a` is the author — those keys come from dailyQuotes.json.
const FALLBACK_QUOTE = { q: 'Keep showing up.', a: 'Daily Motivation' };
const FALLBACK_AUTHOR = 'Daily Motivation';
const UNKNOWN_AUTHOR = 'unknown';
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
// Manipulate here: milliseconds in a day, used to turn "now" into a day-of-year index.
const MILLISECONDS_PER_DAY = MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
const ISO_DATE_LENGTH = 10;
const CARD_MIN_HEIGHT_DEFAULT = 96;
const STARTER_QUOTE_INDEX = 0;
const SEEN_FLAG_VALUE = 'true';

// Embedded / standalone fill colors (keep these letters — screens depend on the look).
const EMBEDDED_TEXT_LIGHT = '#111827';
const AUTHOR_LIGHT = 'rgba(17,24,39,0.70)';
const AUTHOR_DARK = 'rgba(255,255,255,0.78)';
const CARD_FILL_DARK = 'rgba(10,10,15,0.78)';
const CARD_FILL_LIGHT = 'rgba(255,255,255,0.92)';
const CARD_BORDER_DARK = 'rgba(255,255,255,0.12)';
const CARD_BORDER_LIGHT = 'rgba(17,24,39,0.10)';
const PILL_FILL_DARK = 'rgba(10,10,15,0.80)';
const PILL_FILL_LIGHT = 'rgba(255,255,255,0.92)';
const PILL_BORDER_DARK = 'rgba(255,255,255,0.08)';
const PILL_BORDER_LIGHT = 'rgba(10,10,15,0.06)';
const PILL_EMBEDDED_BORDER_DARK = 'rgba(255,255,255,0.12)';
const PILL_EMBEDDED_BORDER_LIGHT = 'rgba(10,10,15,0.10)';
const PILL_AUTHOR_DARK = 'rgba(255,255,255,0.65)';
const PILL_AUTHOR_LIGHT = 'rgba(10,10,15,0.55)';
const PILL_RADIUS_EMBEDDED = 14;
const PILL_RADIUS_STANDALONE = 26;

// ===== HELPER FUNCTIONS =====

function quoteAtIndex(quoteIndex) {
  return QUOTE_LIST[quoteIndex] || QUOTE_LIST[0] || FALLBACK_QUOTE;
}

function clampQuoteIndex(index) {
  const lastIndex = QUOTE_LIST.length - 1;
  return Math.max(0, Math.min(lastIndex, Number(index)));
}

function displayAuthor(author) {
  const authorText = (author || '').trim();
  if (!authorText) {
    return FALLBACK_AUTHOR;
  }
  const authorLooksUnknown = authorText.toLowerCase() === UNKNOWN_AUTHOR;
  if (authorLooksUnknown) {
    return FALLBACK_AUTHOR;
  }
  return authorText;
}

function dayOfYearNumber(now) {
  const startOfYear = new Date(now.getFullYear(), 0, 0);
  const elapsedMs = now - startOfYear;
  return Math.floor(elapsedMs / MILLISECONDS_PER_DAY);
}

function getTodayQuote() {
  if (!QUOTE_LIST.length) {
    return FALLBACK_QUOTE;
  }
  const dayOfYear = dayOfYearNumber(new Date());
  const indexInList = (dayOfYear - 1) % QUOTE_LIST.length;
  return QUOTE_LIST[indexInList];
}

function quoteIndexForToday() {
  const todayQuote = getTodayQuote();
  const matchingIndex = QUOTE_LIST.findIndex((quote) => {
    const sameSentence = quote?.q === todayQuote?.q;
    const sameAuthor = quote?.a === todayQuote?.a;
    return sameSentence && sameAuthor;
  });
  if (matchingIndex >= 0) {
    return matchingIndex;
  }
  return 0;
}

function embeddedCardThemeColors(isDark) {
  let textColor = EMBEDDED_TEXT_LIGHT;
  let authorColor = AUTHOR_LIGHT;
  if (isDark) {
    textColor = lightColors.white;
    authorColor = AUTHOR_DARK;
  }
  return {
    cardBackground: 'transparent',
    borderColor: 'transparent',
    textColor,
    authorColor,
  };
}

function standaloneCardThemeColors(isDark) {
  if (isDark) {
    return {
      cardBackground: CARD_FILL_DARK,
      borderColor: CARD_BORDER_DARK,
      textColor: lightColors.white,
      authorColor: AUTHOR_DARK,
    };
  }
  return {
    cardBackground: CARD_FILL_LIGHT,
    borderColor: CARD_BORDER_LIGHT,
    textColor: EMBEDDED_TEXT_LIGHT,
    authorColor: AUTHOR_LIGHT,
  };
}

function cardThemeColors(isDark, embedded) {
  if (embedded) {
    return embeddedCardThemeColors(isDark);
  }
  return standaloneCardThemeColors(isDark);
}

function embeddedPillSurfaceColors(isDark) {
  let borderColor = PILL_EMBEDDED_BORDER_LIGHT;
  if (isDark) {
    borderColor = PILL_EMBEDDED_BORDER_DARK;
  }
  return {
    backgroundColor: 'transparent',
    borderColor,
    borderRadius: PILL_RADIUS_EMBEDDED,
  };
}

function standalonePillSurfaceColors(isDark) {
  if (isDark) {
    return {
      backgroundColor: PILL_FILL_DARK,
      borderColor: PILL_BORDER_DARK,
      borderRadius: PILL_RADIUS_STANDALONE,
    };
  }
  return {
    backgroundColor: PILL_FILL_LIGHT,
    borderColor: PILL_BORDER_LIGHT,
    borderRadius: PILL_RADIUS_STANDALONE,
  };
}

function pillSurfaceColors(isDark, embedded) {
  if (embedded) {
    return embeddedPillSurfaceColors(isDark);
  }
  return standalonePillSurfaceColors(isDark);
}

function lineLimitPropsForPill(maxLines) {
  const hasLineLimit = typeof maxLines === 'number' && maxLines > 0;
  if (!hasLineLimit) {
    return {};
  }
  return { numberOfLines: maxLines, ellipsizeMode: 'tail' };
}

function quoteSentenceText(quote) {
  return `"${quote.q}"`;
}

function authorLineText(quote) {
  return `— ${displayAuthor(quote.a)}`;
}

function borderWidthForCard(embedded) {
  if (embedded) {
    return 0;
  }
  return 1;
}

function resolveDarkFlag(isDarkOverride, themeIsDark) {
  if (typeof isDarkOverride === 'boolean') {
    return isDarkOverride;
  }
  return themeIsDark;
}

function pillQuoteTextColor(isDark) {
  if (isDark) {
    return lightColors.white;
  }
  return lightColors.nbInk;
}

function pillAuthorTextColor(isDark) {
  if (isDark) {
    return PILL_AUTHOR_DARK;
  }
  return PILL_AUTHOR_LIGHT;
}

// ===== MAIN FUNCTION =====

/**
 * Large daily quote card.
 * @param {{ userId?: string, cardWidth?: number|string, cardMinHeight?: number, embedded?: boolean }} props
 */
export default function DailyQuoteCard({ userId, cardWidth, cardMinHeight, embedded = false }) {
  // vocab: useTheme = light/dark tokens for the current app theme
  const { isDark } = useTheme();
  const [quoteIndex, setQuoteIndex] = useState(STARTER_QUOTE_INDEX);

  const outerWidth = cardWidth ?? '100%';
  const outerMinHeight = cardMinHeight ?? CARD_MIN_HEIGHT_DEFAULT;
  const themeColors = cardThemeColors(isDark, embedded);

  // 1. When userId appears, read AsyncStorage and set today's quote index.
  // 2. On unmount, ignore late callbacks so we never set state on a dead tree.
  useEffect(() => {
    let effectIsActive = true;

    const loadQuoteIndexForCard = async () => {
      if (!userId) {
        return;
      }
      try {
        await resolveQuoteIndexForCard(userId, (index) => {
          if (effectIsActive) {
            setQuoteIndex(index);
          }
        });
      } catch (storageError) {
        // If AsyncStorage fails, keep the default index on screen.
      }
    };

    loadQuoteIndexForCard();

    return () => {
      effectIsActive = false;
    };
  }, [userId]);

  // 3. Resolve the quote object and paint the card chrome.
  const quote = quoteAtIndex(quoteIndex);
  const borderWidth = borderWidthForCard(embedded);
  const quoteSentence = quoteSentenceText(quote);
  const authorLine = authorLineText(quote);

  return (
    <View style={[styles.outer, { width: outerWidth, minHeight: outerMinHeight }]}>
      <View style={[styles.border, { borderColor: themeColors.borderColor, borderWidth }]}>
        <View
          style={[
            styles.card,
            { backgroundColor: themeColors.cardBackground, minHeight: outerMinHeight },
          ]}
        >
          <View style={styles.content}>
            <Text style={[styles.quoteText, { color: themeColors.textColor }]}>
              {quoteSentence}
            </Text>
            <Text style={styles.inspirationLabel}>DAILY INSPIRATION</Text>
            <Text style={[styles.authorText, { color: themeColors.authorColor }]}>
              {authorLine}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Hook for Design Law hero — same pin/rotate rules as DailyQuoteCard.
 * @param {string|undefined} userId
 * @returns {{ q: string, a: string }}
 */
export function useDailyQuote(userId) {
  const [quoteIndex, setQuoteIndex] = useState(STARTER_QUOTE_INDEX);

  // 1. Load the card's pin/rotate index when userId is set.
  // 2. Ignore late storage callbacks after unmount.
  useEffect(() => {
    let effectIsActive = true;

    const loadQuoteIndexForHook = async () => {
      if (!userId) {
        return;
      }
      try {
        await resolveQuoteIndexForCard(userId, (index) => {
          if (effectIsActive) {
            setQuoteIndex(index);
          }
        });
      } catch (storageError) {
        // Keep default index when storage is unavailable.
      }
    };

    loadQuoteIndexForHook();

    return () => {
      effectIsActive = false;
    };
  }, [userId]);

  // 3. Hand the sentence + cleaned author to the hero.
  const quote = quoteAtIndex(quoteIndex);
  const sentence = quote?.q || FALLBACK_QUOTE.q;
  const authorName = displayAuthor(quote?.a);
  return { q: sentence, a: authorName };
}

/**
 * Compact quote. `maxLines` truncates; omit it and the quote wraps.
 * @param {{ userId?: string, isDarkOverride?: boolean, maxLines?: number, embedded?: boolean }} props
 */
export function DailyQuotePill({ userId, isDarkOverride, maxLines, embedded = false }) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = resolveDarkFlag(isDarkOverride, themeIsDark);
  const [quoteIndex, setQuoteIndex] = useState(STARTER_QUOTE_INDEX);

  // 1. Pill never pins a starter — load cache or day-of-year when userId is set.
  // 2. Ignore late storage callbacks after unmount.
  useEffect(() => {
    let effectIsActive = true;

    const loadQuoteIndexForPill = async () => {
      if (!userId) {
        return;
      }
      try {
        await resolveQuoteIndexForPill(userId, (index) => {
          if (effectIsActive) {
            setQuoteIndex(index);
          }
        });
      } catch (storageError) {
        // Ignore — pill keeps whatever index was already showing.
      }
    };

    loadQuoteIndexForPill();

    return () => {
      effectIsActive = false;
    };
  }, [userId]);

  // 3. Name surface + text colors, then paint.
  const quote = quoteAtIndex(quoteIndex);
  const surface = pillSurfaceColors(isDark, embedded);
  const quoteTextColor = pillQuoteTextColor(isDark);
  const authorTextColor = pillAuthorTextColor(isDark);
  const lineLimitProps = lineLimitPropsForPill(maxLines);
  const quoteSentence = quoteSentenceText(quote);
  const authorLine = authorLineText(quote);

  let wrapStyle = [pillStyles.wrap];
  if (embedded) {
    wrapStyle = [pillStyles.wrap, pillStyles.wrapEmbedded];
  }

  const innerStyle = [
    pillStyles.inner,
    {
      backgroundColor: surface.backgroundColor,
      borderColor: surface.borderColor,
      borderWidth: 1,
      borderRadius: surface.borderRadius,
    },
  ];

  return (
    <View style={wrapStyle}>
      <View style={innerStyle}>
        <Text style={[pillStyles.text, { color: quoteTextColor }]} {...lineLimitProps}>
          {quoteSentence}
        </Text>
        <Text
          style={[pillStyles.author, { color: authorTextColor }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {authorLine}
        </Text>
      </View>
    </View>
  );
}

// PLUMBING — skip unless debugging AsyncStorage keys and cache shape.

function dailyQuoteStorageKey(userId) {
  // Freeze: storage key letters must stay exactly this string.
  return `coachconnect_daily_quote_v2:${userId}`;
}

function dailyQuoteSeenKey(userId) {
  // Freeze: first-visit flag key letters must stay exactly this string.
  return `coachconnect_daily_quote_seen_v1:${userId}`;
}

function todayKeyLocal() {
  // vocab: toISOString = UTC stamp; first 10 chars are YYYY-MM-DD
  return new Date().toISOString().slice(0, ISO_DATE_LENGTH);
}

async function readCachedQuoteRecord(userId) {
  // vocab: AsyncStorage = on-device key/value store (survives app restarts)
  const jsonFromStorage = await AsyncStorage.getItem(dailyQuoteStorageKey(userId));
  if (!jsonFromStorage) {
    return null;
  }
  return JSON.parse(jsonFromStorage);
}

function cachedIndexForToday(savedRecord, today) {
  const dateMatchesToday = savedRecord?.date === today;
  const indexIsANumber = Number.isFinite(savedRecord?.index);
  if (dateMatchesToday && indexIsANumber) {
    return clampQuoteIndex(savedRecord.index);
  }
  return null;
}

async function saveQuoteIndex(userId, today, index) {
  const recordForToday = { date: today, index };
  await AsyncStorage.setItem(dailyQuoteStorageKey(userId), JSON.stringify(recordForToday));
}

/**
 * Card-only: first open pins index 0; onIndex fires before writes finish (same timing as old setState).
 * @param {string} userId
 * @param {(index: number) => void} onIndex
 */
async function resolveQuoteIndexForCard(userId, onIndex) {
  const today = todayKeyLocal();
  const savedRecord = await readCachedQuoteRecord(userId);
  const hasSeenQuote = await AsyncStorage.getItem(dailyQuoteSeenKey(userId));

  if (!hasSeenQuote) {
    onIndex(STARTER_QUOTE_INDEX);
    await AsyncStorage.setItem(dailyQuoteSeenKey(userId), SEEN_FLAG_VALUE);
    await saveQuoteIndex(userId, today, STARTER_QUOTE_INDEX);
    return;
  }

  const cachedIndex = cachedIndexForToday(savedRecord, today);
  if (cachedIndex !== null) {
    onIndex(cachedIndex);
    return;
  }

  const todayIndex = quoteIndexForToday();
  onIndex(todayIndex);
  await saveQuoteIndex(userId, today, todayIndex);
}

/**
 * Pill never pins a starter quote — only today's cache or the day-of-year pick.
 * @param {string} userId
 * @param {(index: number) => void} onIndex
 */
async function resolveQuoteIndexForPill(userId, onIndex) {
  const today = todayKeyLocal();
  const savedRecord = await readCachedQuoteRecord(userId);
  const cachedIndex = cachedIndexForToday(savedRecord, today);

  if (cachedIndex !== null) {
    onIndex(cachedIndex);
    return;
  }

  const todayIndex = quoteIndexForToday();
  onIndex(todayIndex);
  await saveQuoteIndex(userId, today, todayIndex);
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
    color: lightColors.primary,
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
