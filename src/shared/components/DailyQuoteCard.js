/**
 * Daily Quote Card
 *
 * Purpose: UI screen or component: Daily Quote Card. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: DailyQuotePill, DailyQuoteCard
 *
 * @file-header
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../ui/ThemeContext';
import dailyQuotesData from '../data/dailyQuotesList.json';

/** Curated quotes from `dailyQuotesList.json` (nutrition, training, discipline). */
const quotes = Array.isArray(dailyQuotesData?.quotes) ? dailyQuotesData.quotes : [];

// Helper: get today's quote based on day of year
const getTodayQuote = () => {
  if (!quotes.length) return { q: 'Keep showing up.', a: 'Daily Motivation' };
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay); // 1–365
  const index = (dayOfYear - 1) % quotes.length;
  return quotes[index];
};

// Helper: get random quote (for refresh button)
const getRandomQuote = () => {
  if (!quotes.length) return { q: 'Keep showing up.', a: 'Daily Motivation' };
  return quotes[Math.floor(Math.random() * quotes.length)];
};

function withAlpha(hex, alpha) {
  const clean = (hex || '').replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const ACCENT = '#7C3AED';

const todayKeyLocal = () => new Date().toISOString().slice(0, 10);

const quoteIndexForToday = () => {
  const q = getTodayQuote();
  const idx = quotes.findIndex((x) => x?.q === q?.q && x?.a === q?.a);
  return idx >= 0 ? idx : 0;
};

const displayAuthor = (a) => {
  const s = (a || '').trim();
  if (!s) return 'Daily Motivation';
  if (s.toLowerCase() === 'unknown') return 'Daily Motivation';
  return s;
};

export default function DailyQuoteCard({ userId, cardWidth, cardMinHeight, embedded = false }) {
  const { colors, isDark } = useTheme();
  const outerWidth = cardWidth ?? '100%';
  const outerMinHeight = cardMinHeight ?? 96;

  const [quoteIndex, setQuoteIndex] = useState(0);

  // High-contrast typography; when embedded, let the parent handle border/background.
  const cardBg = embedded
    ? 'transparent'
    : (isDark ? 'rgba(10,10,15,0.78)' : 'rgba(255,255,255,0.92)');
  const borderColor = embedded
    ? 'transparent'
    : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.10)');
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const authorColor = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(17,24,39,0.70)';

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!userId) return;

      try {
        // Per-user, per-day cache so the quote rotates once per day (local date).
        const baseKey = `coachconnect_daily_quote_v2:${userId}`;
        const today = todayKeyLocal();

        const raw = await AsyncStorage.getItem(baseKey);
        const parsed = raw ? JSON.parse(raw) : null;

        // First-ever quote experience (per-user) should be your chosen “starter” quote,
        // but it must still rotate the next day.
        const seenKey = `coachconnect_daily_quote_seen_v1:${userId}`;
        const hasSeen = await AsyncStorage.getItem(seenKey);
        if (!hasSeen) {
          const idx = 0;
          if (!cancelled) setQuoteIndex(idx);
          await AsyncStorage.setItem(seenKey, 'true');
          await AsyncStorage.setItem(baseKey, JSON.stringify({ date: today, index: idx }));
          return;
        }

        if (parsed?.date === today && Number.isFinite(parsed?.index)) {
          const idx = Math.max(0, Math.min(quotes.length - 1, Number(parsed.index)));
          if (!cancelled) setQuoteIndex(idx);
          return;
        }

        const idx = quoteIndexForToday();
        if (!cancelled) setQuoteIndex(idx);
        await AsyncStorage.setItem(baseKey, JSON.stringify({ date: today, index: idx }));
      } catch (e) {
        // If AsyncStorage fails, do nothing and keep default
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const quote = quotes[quoteIndex] || quotes[0] || { q: 'Keep showing up.', a: 'Daily Motivation' };

  // Refresh to a random quote on tap
  
  return (
    <View style={[styles.outer, { width: outerWidth, minHeight: outerMinHeight }]}>
      <View style={[styles.border, { borderColor, borderWidth: embedded ? 0 : 1 }]}>
        <View style={[styles.card, { backgroundColor: cardBg, minHeight: outerMinHeight }]}>
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

/** `maxLines` only when you want truncation; omit for full quote (wraps). */
export function DailyQuotePill({ userId, isDarkOverride, maxLines, embedded = false }) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = typeof isDarkOverride === 'boolean' ? isDarkOverride : themeIsDark;

  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!userId) return;
      try {
        const baseKey = `coachconnect_daily_quote_v2:${userId}`;
        const today = todayKeyLocal();
        const raw = await AsyncStorage.getItem(baseKey);
        const parsed = raw ? JSON.parse(raw) : null;

        if (parsed?.date === today && Number.isFinite(parsed?.index)) {
          const idx = Math.max(0, Math.min(quotes.length - 1, Number(parsed.index)));
          if (!cancelled) setQuoteIndex(idx);
          return;
        }

        const idx = quoteIndexForToday();
        if (!cancelled) setQuoteIndex(idx);
        await AsyncStorage.setItem(baseKey, JSON.stringify({ date: today, index: idx }));
      } catch (_) {
        // ignore
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const quote = quotes[quoteIndex] || quotes[0] || { q: 'Keep showing up.', a: 'Daily Motivation' };

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
          {...(typeof maxLines === 'number' && maxLines > 0
            ? { numberOfLines: maxLines, ellipsizeMode: 'tail' }
            : {})}
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
