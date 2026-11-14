// Web-research source cards under coach replies (Design Law ai-coach screen 05).
// Flow: merge webSources + URLs from reply text → drop junk links → SOURCES header + SAMPLE pill + card stack.
// Used by CoachConversationScreen under internet-backed answers.

import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { lightColors, darkColors, spacing, borderRadius, nb, accentGradients } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { hostLabel, faviconUrl } from './sourceLinkPreview';

// ===== NAMED CONSTANTS =====

// Manipulate here: max cards so the bubble does not grow endlessly.
const MAX_SOURCE_CARDS = 6;
// vocab: SAMPLE pill = Design Law badge when links are illustrative / fetched snippets, not live proof.
const SOURCES_HEADER_LABEL = 'SOURCES';
const SAMPLE_PILL_LABEL = 'SAMPLE';
const DEFAULT_SOURCE_KIND = 'SOURCE';

// ===== HELPER FUNCTIONS =====

function openExternalLinkInBrowser(url) {
  Linking.openURL(url).catch(() => {});
}

function stringOrEmpty(value) {
  if (!value) return '';
  return String(value);
}

function kindLabelFromSource(source) {
  if (source && source.type) return String(source.type).toUpperCase();
  if (source && source.kind) return String(source.kind).toUpperCase();
  return DEFAULT_SOURCE_KIND;
}

function sourceKindAndHostLine(source, url) {
  const kindLabel = kindLabelFromSource(source);
  const hostLabelUpper = hostLabel(url).toUpperCase();
  return `${kindLabel} • ${hostLabelUpper}`;
}

function linkUrlFromSource(source) {
  if (!source) return '';
  if (source.url) return source.url;
  if (source.link) return source.link;
  return '';
}

function titleFromSource(source, linkUrl) {
  if (source && source.title) return source.title;
  if (source && source.name) return source.name;
  return hostLabel(linkUrl);
}

function snippetFromSource(source) {
  if (!source) return '';
  if (source.snippet) return String(source.snippet).trim();
  return '';
}

function paletteForSourceCards(isDarkProp, themeDark) {
  const callerForcedDarkOrLight = typeof isDarkProp === 'boolean';
  let useDarkPalette = themeDark;
  if (callerForcedDarkOrLight) {
    useDarkPalette = isDarkProp;
  }
  if (useDarkPalette) return darkColors;
  return lightColors;
}

function gradientColorsForCardIndex(index) {
  const gradientCount = accentGradients.length;
  const gradientIndex = index % gradientCount;
  return accentGradients[gradientIndex];
}

function SourceLinkCard({ source, colors, gradientColors }) {
  const linkUrl = linkUrlFromSource(source);
  if (!linkUrl) return null;

  const cardTitle = titleFromSource(source, linkUrl);
  const cardSnippet = snippetFromSource(source);
  const faviconImageUrl = faviconUrl(linkUrl);
  // vocab: useState = local flag so a broken favicon falls back to the location icon
  const [faviconLoadFailed, setFaviconLoadFailed] = useState(false);

  const showFavicon = Boolean(faviconImageUrl) && !faviconLoadFailed;
  const cardBorderColor = colors.nbBorder;
  const cardSurfaceColor = colors.nbSurface;
  const cardShadowColor = colors.nbShadow;
  const mutedTextColor = colors.nbMuted;
  const inkTextColor = colors.nbInk;

  function handleFaviconError() {
    setFaviconLoadFailed(true);
  }

  function handleCardPress() {
    openExternalLinkInBrowser(linkUrl);
  }

  let faviconOrFallbackIcon = (
    <Ionicons name="location" size={16} color={lightColors.nbInk} />
  );
  if (showFavicon) {
    faviconOrFallbackIcon = (
      <Image
        source={{ uri: faviconImageUrl }}
        style={styles.favicon}
        onError={handleFaviconError}
      />
    );
  }

  let snippetBlock = null;
  if (cardSnippet) {
    snippetBlock = (
      <Text style={[styles.snippet, { color: mutedTextColor }]} numberOfLines={2}>
        {cardSnippet}
      </Text>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleCardPress}
      activeOpacity={0.9}
      accessibilityRole="link"
      accessibilityLabel={`Open source ${cardTitle}`}
      style={[
        styles.card,
        {
          borderColor: cardBorderColor,
          backgroundColor: cardSurfaceColor,
          shadowColor: cardShadowColor,
        },
      ]}
    >
      <View style={[styles.iconTile, { borderColor: cardBorderColor }]}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        {faviconOrFallbackIcon}
      </View>
      <View style={styles.cardTextColumn}>
        <Text style={[styles.meta, { color: mutedTextColor }]} numberOfLines={1}>
          {sourceKindAndHostLine(source, linkUrl)}
        </Text>
        <Text style={[styles.title, { color: inkTextColor }]} numberOfLines={2}>
          {cardTitle}
        </Text>
        {snippetBlock}
      </View>
    </TouchableOpacity>
  );
}

function buildSourceCardViews(visibleSources, colors) {
  const cardViews = [];
  for (let index = 0; index < visibleSources.length; index += 1) {
    const source = visibleSources[index];
    const cardKey = `${linkUrlFromSource(source)}-${index}`;
    cardViews.push(
      <SourceLinkCard
        key={cardKey}
        source={source}
        colors={colors}
        gradientColors={gradientColorsForCardIndex(index)}
      />,
    );
  }
  return cardViews;
}

function SourceCardStack({ visibleSources, colors }) {
  const cardViews = buildSourceCardViews(visibleSources, colors);
  return <View style={styles.cardStack}>{cardViews}</View>;
}

function webSourcesArrayFromMessage(message) {
  if (!message) return [];
  if (!Array.isArray(message.webSources)) return [];
  return message.webSources;
}

function replyBodyFromMessage(message) {
  if (!message) return '';
  if (message.text) return String(message.text);
  if (message.content) return String(message.content);
  return '';
}

function snippetOrDescriptionFromItem(item) {
  if (!item) return '';
  if (item.snippet) return item.snippet;
  if (item.description) return item.description;
  return '';
}

function addOneStructuredSource(item, collectedSources, urlsAlreadySeen) {
  const url = linkUrlFromSource(item);
  if (!url) return;
  const title = titleFromSource(item, url);
  const snippet = snippetOrDescriptionFromItem(item);
  addSourceIfNew(collectedSources, urlsAlreadySeen, url, title, snippet);
}

function addStructuredSourcesFromMessage(message, collectedSources, urlsAlreadySeen) {
  const structuredSources = webSourcesArrayFromMessage(message);
  for (let index = 0; index < structuredSources.length; index += 1) {
    addOneStructuredSource(structuredSources[index], collectedSources, urlsAlreadySeen);
  }
}

function dropJunkSourcesAndCap(collectedSources) {
  const keptSources = [];
  for (let index = 0; index < collectedSources.length; index += 1) {
    const source = collectedSources[index];
    if (isSearchHelpJunkSource(source)) continue;
    keptSources.push(source);
    if (keptSources.length >= MAX_SOURCE_CARDS) break;
  }
  return keptSources;
}

function buildVisibleSourceListForMessage(message) {
  const urlsAlreadySeen = new Set();
  const collectedSources = [];

  // 1. Prefer structured webSources from the API when present.
  addStructuredSourcesFromMessage(message, collectedSources, urlsAlreadySeen);

  // 2. Scan reply text for markdown links and bare URLs.
  const replyBody = replyBodyFromMessage(message);
  if (replyBody) {
    collectMarkdownLinksFromText(replyBody, collectedSources, urlsAlreadySeen);
    collectPlainUrlsFromText(replyBody, collectedSources, urlsAlreadySeen);
  }

  // 3. Drop Google-help junk and cap count for layout.
  return dropJunkSourcesAndCap(collectedSources);
}

function addSourceIfNew(list, seenKeys, url, title, snippet) {
  const dedupeKey = normalizeUrlForDedupe(url);
  if (!dedupeKey) return;
  if (seenKeys.has(dedupeKey)) return;
  seenKeys.add(dedupeKey);
  list.push({ url, title, snippet });
}

function normalizeUrlForDedupe(url) {
  let cleaned = String(url || '').trim().toLowerCase();
  cleaned = cleaned.replace(/^https?:\/\//, '');
  cleaned = cleaned.replace(/^www\./, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

function haystackFromSource(source) {
  const titleText = stringOrEmpty(source && source.title);
  const snippetText = stringOrEmpty(source && source.snippet);
  const urlText = stringOrEmpty(source && source.url);
  return `${titleText} ${snippetText} ${urlText}`;
}

function isSearchHelpJunkSource(source) {
  const haystack = haystackFromSource(source);
  for (let index = 0; index < JUNK_SOURCE_PATTERNS.length; index += 1) {
    const pattern = JUNK_SOURCE_PATTERNS[index];
    if (pattern.test(haystack)) return true;
  }
  return false;
}

// ===== MAIN FUNCTION =====

/**
 * SOURCES header + SAMPLE pill + up to MAX_SOURCE_CARDS under a web-backed coach reply.
 * Hook order frozen: useTheme → useMemo(visibleSources).
 */
export default function SourceLinkCards({ message, isDark: isDarkProp }) {
  // 1. Resolve palette — caller can force dark; otherwise follow app theme.
  // vocab: useTheme = app light/dark; isDarkProp overrides when the bubble already knows its mode
  const { isDark: themeDark } = useTheme();
  const colors = paletteForSourceCards(isDarkProp, themeDark);

  // 2. Build the deduped, filtered list once per message object.
  // vocab: useMemo = recompute only when `message` identity changes
  const visibleSources = useMemo(() => buildVisibleSourceListForMessage(message), [message]);

  if (!visibleSources.length) return null;

  const headerMutedColor = colors.nbMuted;
  const pillBorderColor = colors.nbBorder;
  const pillSurfaceColor = colors.nbSurface;
  const pillInkColor = colors.nbInk;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.header, { color: headerMutedColor }]}>{SOURCES_HEADER_LABEL}</Text>
        <View
          style={[
            styles.samplePill,
            { borderColor: pillBorderColor, backgroundColor: pillSurfaceColor },
          ]}
        >
          <Text style={[styles.sampleText, { color: pillInkColor }]}>{SAMPLE_PILL_LABEL}</Text>
        </View>
      </View>
      <SourceCardStack visibleSources={visibleSources} colors={colors} />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging URL extraction regexes =====

const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
const PLAIN_URL_RE = /https?:\/\/[^\s)\]"']+/gi;
const JUNK_SOURCE_PATTERNS = [
  /how to search the web/i,
  /search the web in chrome/i,
  /support\.google\.com/i,
  /advanced search\s*-\s*google/i,
];

function collectMarkdownLinksFromText(rawText, list, seenKeys) {
  // vocab: new RegExp(source, flags) = fresh matcher so lastIndex does not leak across calls
  const matcher = new RegExp(MARKDOWN_LINK_RE.source, MARKDOWN_LINK_RE.flags);
  let match = matcher.exec(rawText);
  while (match !== null) {
    const url = match[2];
    let title = match[1];
    if (!title) title = hostLabel(url);
    addSourceIfNew(list, seenKeys, url, title);
    match = matcher.exec(rawText);
  }
}

function collectPlainUrlsFromText(rawText, list, seenKeys) {
  const matcher = new RegExp(PLAIN_URL_RE.source, PLAIN_URL_RE.flags);
  let match = matcher.exec(rawText);
  while (match !== null) {
    const matchedText = String(match[0] || '');
    const rawUrl = matchedText.replace(/[.,;:!?)]+$/, '');
    addSourceIfNew(list, seenKeys, rawUrl, hostLabel(rawUrl));
    match = matcher.exec(rawText);
  }
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
  cardStack: { gap: 10 },
  cardTextColumn: { flex: 1, minWidth: 0 },
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
