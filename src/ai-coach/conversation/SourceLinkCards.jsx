// Design Law sources under web-research coach replies (screens/ai-coach/05).
// Flow: collect webSources / parse URLs → junk-filter → always-visible SOURCES + SAMPLE + stacked cards.
// Used by: CoachConversationScreen under internet answers.
//
// vocab: SAMPLE pill = Design Law badge when sources are illustrative / fetched snippets

import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { lightColors, darkColors, spacing, borderRadius, nb, accentGradients } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { hostLabel, faviconUrl } from './sourceLinkPreview';

// ===== NAMED CONSTANTS =====

const MAX_SOURCE_CARDS = 6;
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
const PLAIN_URL_RE = /https?:\/\/[^\s)\]"']+/gi;
const JUNK_SOURCE_RES = [
  /how to search the web/i,
  /search the web in chrome/i,
  /support\.google\.com/i,
  /advanced search\s*-\s*google/i,
];

// ===== HELPERS =====

function textOrBlank(value) {
  if (!value) return '';
  return String(value);
}

function isJunkSource(source) {
  const sourceSearchText = `${textOrBlank(source?.title)} ${textOrBlank(source?.snippet)} ${textOrBlank(source?.url)}`;
  return JUNK_SOURCE_RES.some((re) => re.test(sourceSearchText));
}

function normalizedSourceKey(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

function pushUniqueSource(sources, urlsAlreadyListed, url, title, snippet) {
  const key = normalizedSourceKey(url);
  if (!key || urlsAlreadyListed.has(key)) return;
  urlsAlreadyListed.add(key);
  sources.push({ url, title, snippet });
}

function collectMarkdownLinks(rawText, sources, urlsAlreadyListed) {
  const markdownMatcher = new RegExp(MARKDOWN_LINK_RE.source, MARKDOWN_LINK_RE.flags);
  let matchResult = markdownMatcher.exec(rawText);
  while (matchResult !== null) {
    const url = matchResult[2];
    const title = matchResult[1] || hostLabel(url);
    pushUniqueSource(sources, urlsAlreadyListed, url, title);
    matchResult = markdownMatcher.exec(rawText);
  }
}

function collectPlainUrls(rawText, sources, urlsAlreadyListed) {
  const plainMatcher = new RegExp(PLAIN_URL_RE.source, PLAIN_URL_RE.flags);
  let matchResult = plainMatcher.exec(rawText);
  while (matchResult !== null) {
    const url = String(matchResult[0] || '').replace(/[.,;:!?)]+$/, '');
    pushUniqueSource(sources, urlsAlreadyListed, url, hostLabel(url));
    matchResult = plainMatcher.exec(rawText);
  }
}

function visibleSourcesForMessage(message) {
  const urlsAlreadyListed = new Set();
  const sources = [];
  const webSources = Array.isArray(message?.webSources) ? message.webSources : [];
  webSources.forEach((source) => {
    const url = source?.url || source?.link;
    if (!url) return;
    pushUniqueSource(
      sources,
      urlsAlreadyListed,
      url,
      source.title || source.name || hostLabel(url),
      source.snippet || source.description,
    );
  });
  const rawText = String(message?.text || message?.content || '');
  if (rawText) {
    collectMarkdownLinks(rawText, sources, urlsAlreadyListed);
    collectPlainUrls(rawText, sources, urlsAlreadyListed);
  }
  return sources.filter((source) => !isJunkSource(source)).slice(0, MAX_SOURCE_CARDS);
}

function openSourceUrl(url) {
  Linking.openURL(url).catch(() => {});
}

function metaLine(source, url) {
  const kind = String(source?.type || source?.kind || 'SOURCE').toUpperCase();
  const host = hostLabel(url).toUpperCase();
  return `${kind} • ${host}`;
}

function SourceCard({ source, colors, gradient }) {
  const url = source.url || source.link;
  if (!url) return null;
  const title = source.title || source.name || hostLabel(url);
  const snippet = String(source.snippet || '').trim();
  const favicon = faviconUrl(url);
  const [failed, setFailed] = useState(false);

  return (
    <TouchableOpacity
      onPress={() => openSourceUrl(url)}
      activeOpacity={0.9}
      accessibilityRole="link"
      accessibilityLabel={`Open source ${title}`}
      style={[
        styles.card,
        {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface,
          shadowColor: colors.nbShadow,
        },
      ]}
    >
      <View style={[styles.iconTile, { borderColor: colors.nbBorder }]}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {favicon && !failed ? (
          <Image source={{ uri: favicon }} style={styles.favicon} onError={() => setFailed(true)} />
        ) : (
          <Ionicons name="link-outline" size={16} color={lightColors.nbInk} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.meta, { color: colors.nbMuted }]} numberOfLines={1}>
          {metaLine(source, url)}
        </Text>
        <Text style={[styles.title, { color: colors.nbInk }]} numberOfLines={2}>
          {title}
        </Text>
        {snippet ? (
          <Text style={[styles.snippet, { color: colors.nbMuted }]} numberOfLines={2}>
            {snippet}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Always-open SOURCES block (Design Law PNG 05) — not a collapsed pill.
 */
export default function SourceLinkCards({ message, isDark: isDarkProp }) {
  const { isDark: themeDark } = useTheme();
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : themeDark;
  const colors = isDark ? darkColors : lightColors;
  const sources = useMemo(() => visibleSourcesForMessage(message), [message]);

  if (!sources.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: colors.nbMuted }]}>SOURCES</Text>
        <View
          style={[
            styles.samplePill,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
        >
          <Text style={[styles.sampleText, { color: colors.nbInk }]}>SAMPLE</Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        {sources.map((source, index) => (
          <SourceCard
            key={`${source.url || source.link}-${index}`}
            source={source}
            colors={colors}
            gradient={accentGradients[index % accentGradients.length]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, maxWidth: '100%' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  header: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  samplePill: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sampleText: {
    fontSize: 11,
    fontWeight: '900',
  },
  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 12,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favicon: { width: 18, height: 18 },
  meta: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
  },
  snippet: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
