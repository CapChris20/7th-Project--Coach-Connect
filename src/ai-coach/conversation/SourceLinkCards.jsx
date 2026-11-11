// Collapsible source links under AI Coach web-search replies (neobrutalist design).
// Flow: prefer message.webSources → else parse URLs out of reply text → junk-filter → NbChip + expandable NbCard list.
// Used by: AI Coach conversation thread under internet answers.
//
// vocab: NbChip = neobrutalist chip for the toggle pill
// vocab: NbCard = neobrutalist card for the expanded source list

import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { lightColors, darkColors, spacing, borderRadius, nb } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import NbChip from '../../look-and-feel/NbChip';
import { hostLabel, faviconUrl } from './sourceLinkPreview';

// ===== NAMED CONSTANTS =====

const MAX_SOURCE_CARDS = 6;
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
const PLAIN_URL_RE = /https?:\/\/[^\s)\]"']+/gi;
const TRAILING_PUNCTUATION_RE = /[.,;:!?)]+$/;

const JUNK_SOURCE_RES = [
  /how to search the web/i,
  /search the web in chrome/i,
  /support\.google\.com/i,
  /advanced search\s*-\s*google/i,
];

const SOURCES_PILL_LABEL = 'Sources';
const CHEVRON_WHEN_EXPANDED = 'chevron-up';
const CHEVRON_WHEN_COLLAPSED = 'chevron-down';
const GLOBE_ICON_NAME = 'globe-outline';
const LINK_ICON_NAME = 'link-outline';
const OPEN_ICON_NAME = 'open-outline';
const HOST_SNIPPET_SEPARATOR = ' · ';
const SNIPPET_LINE_COUNT = 2;
const HOST_ONLY_LINE_COUNT = 1;
const ROW_DIVIDER_WIDTH = 1;


// ===== HELPER FUNCTIONS =====

function textOrBlank(value) {
  if (!value) return '';
  return String(value);
}

/**
 * Google "how to search" help pages show up as "sources" when the model cites the search UI itself.
 * @param {object} source
 * @returns {boolean}
 */
function isJunkSource(source) {
  const titleText = textOrBlank(source && source.title);
  const snippetText = textOrBlank(source && source.snippet);
  const urlText = textOrBlank(source && source.url);
  const sourceSearchText = `${titleText} ${snippetText} ${urlText}`;
  for (let index = 0; index < JUNK_SOURCE_RES.length; index += 1) {
    if (JUNK_SOURCE_RES[index].test(sourceSearchText)) return true;
  }
  return false;
}

function markdownTitleOrHost(titleFromMarkdown, url) {
  if (titleFromMarkdown) return titleFromMarkdown;
  return hostLabel(url);
}

/**
 * Add a URL once. urlsAlreadyListed stops markdown + plain passes from double-listing the same link.
 * @param {Array} sources
 * @param {Set<string>} urlsAlreadyListed
 * @param {string} url
 * @param {string} title
 */
/**
 * Dedupe key for a source URL: ignores protocol, "www.", trailing slash, and
 * case, so the same page cited twice (once as a markdown link, once bare)
 * does not produce two near-identical rows in the Sources list.
 * @param {string} url
 * @returns {string}
 */
function normalizedSourceKey(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

function pushUniqueSource(sources, urlsAlreadyListed, url, title) {
  const key = normalizedSourceKey(url);
  if (!key || urlsAlreadyListed.has(key)) return;
  urlsAlreadyListed.add(key);
  sources.push({ url, title });
}

/**
 * Markdown links `[title](url)` first so the title the model wrote wins over a bare hostname.
 * @param {string} rawText
 * @param {Array} sources
 * @param {Set<string>} urlsAlreadyListed
 */
function collectMarkdownLinks(rawText, sources, urlsAlreadyListed) {
  const markdownMatcher = new RegExp(MARKDOWN_LINK_RE.source, MARKDOWN_LINK_RE.flags);
  let matchResult = markdownMatcher.exec(rawText);
  while (matchResult !== null) {
    const url = matchResult[2];
    const title = markdownTitleOrHost(matchResult[1], url);
    pushUniqueSource(sources, urlsAlreadyListed, url, title);
    matchResult = markdownMatcher.exec(rawText);
  }
}

/**
 * Bare http(s) URLs that were not already captured as markdown links.
 * Trailing punctuation is stripped so "see https://x.com)." does not keep the paren.
 * @param {string} rawText
 * @param {Array} sources
 * @param {Set<string>} urlsAlreadyListed
 */
function collectPlainUrls(rawText, sources, urlsAlreadyListed) {
  const plainMatcher = new RegExp(PLAIN_URL_RE.source, PLAIN_URL_RE.flags);
  let matchResult = plainMatcher.exec(rawText);
  while (matchResult !== null) {
    const url = matchResult[0].replace(TRAILING_PUNCTUATION_RE, '');
    pushUniqueSource(sources, urlsAlreadyListed, url, hostLabel(url));
    matchResult = plainMatcher.exec(rawText);
  }
}

/**
 * Last-resort parse when the message has no structured sources array.
 * @param {string} text
 * @returns {Array}
 */
function extractSourcesFromText(text) {
  const rawText = textOrBlank(text);
  const sources = [];
  const urlsAlreadyListed = new Set();
  collectMarkdownLinks(rawText, sources, urlsAlreadyListed);
  collectPlainUrls(rawText, sources, urlsAlreadyListed);
  return sources.slice(0, MAX_SOURCE_CARDS);
}

/**
 * Prefer the structured arrays the coach already attached. Only scrape the reply text when
 * searchedWeb is true — otherwise a casual URL in chat would grow a Sources pill.
 * @param {object} message
 * @returns {Array}
 */
function sourcesForMessage(message) {
  if (!message) return [];
  if (Array.isArray(message.webSources)) return message.webSources;
  if (Array.isArray(message.sources)) return message.sources;
  return [];
}

/**
 * Drop junk rows and cap how many cards we show.
 * @param {Array} fromMessage
 * @returns {Array}
 */
function nonJunkSourcesCapped(fromMessage) {
  const filtered = [];
  const seenKeys = new Set();
  for (let index = 0; index < fromMessage.length; index += 1) {
    const source = fromMessage[index];
    if (isJunkSource(source)) continue;
    // Structured sources can also repeat a page (provider + scraped copy).
    const key = normalizedSourceKey(source?.url || source?.link);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    filtered.push(source);
  }
  return filtered.slice(0, MAX_SOURCE_CARDS);
}

/**
 * @param {object} message
 * @returns {Array}
 */
function visibleSourcesForMessage(message) {
  const fromMessage = sourcesForMessage(message);
  if (fromMessage.length) return nonJunkSourcesCapped(fromMessage);
  if (message && message.searchedWeb) return extractSourcesFromText(message.text);
  return [];
}

/**
 * Neobrutalist color palette for source cards.
 * @param {object} colors - light or dark color tokens
 * @returns {object}
 */
function sourceCardColors(colors) {
  return {
    panelBackground: colors.nbSurface,
    rowDivider: colors.nbBorder,
    textPrimary: colors.nbInk,
    textMuted: colors.nbMuted,
    accent: '#FF6B9D', // brand gradient start
    accentSecondary: '#FB923C', // brand gradient end
    faviconFallback: colors.nbSurfaceChip,
  };
}

/**
 * Open the URL; a rejected Linking call is ignored so a bad link cannot crash the thread.
 * @param {string} url
 */
function openSourceUrl(url) {
  Linking.openURL(url).catch(() => {});
}

function chevronIconName(isExpanded) {
  if (isExpanded) return CHEVRON_WHEN_EXPANDED;
  return CHEVRON_WHEN_COLLAPSED;
}

function sourcesToggleAccessibilityLabel(isExpanded, sourceCount) {
  if (isExpanded) return `Hide ${sourceCount} sources`;
  return `Show ${sourceCount} sources`;
}

/**
 * Collapsed NbChip that toggles the source list.
 * @param {{ expanded: boolean, sourceCount: number, colors: object, onToggle: Function }} props
 */
function SourcesTogglePill({ expanded, sourceCount, colors, onToggle }) {
  const chevronName = chevronIconName(expanded);
  const accessibilityLabel = sourcesToggleAccessibilityLabel(expanded, sourceCount);

  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.pillInner,
          {
            backgroundColor: colors.panelBackground,
            borderColor: colors.rowDivider,
            borderWidth: nb.borderWidth,
            borderRadius: borderRadius.nbChip,
          },
        ]}
      >
        <Ionicons name={GLOBE_ICON_NAME} size={14} color={colors.accent} />
        <Text style={[styles.pillText, { color: colors.textPrimary }]}>{SOURCES_PILL_LABEL}</Text>
        <Text style={[styles.countText, { color: colors.textMuted }]}>{sourceCount}</Text>
        <Ionicons name={chevronName} size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function urlFromSource(source) {
  if (source.url) return source.url;
  if (source.link) return source.link;
  return '';
}

function titleFromSource(source, url) {
  if (source.title) return source.title;
  if (source.name) return source.name;
  return hostLabel(url);
}

function snippetFromSource(source) {
  if (!source.snippet) return '';
  return String(source.snippet).trim();
}

function rowBorderStyle(isLastRow, colors) {
  if (isLastRow) return null;
  return { borderBottomWidth: ROW_DIVIDER_WIDTH, borderBottomColor: colors.rowDivider };
}

function sourceRowKey(source, index) {
  if (source.url) return `${source.url}-${index}`;
  return `${source.link}-${index}`;
}

function SourceFavicon({ favicon, colors }) {
  // vocab: a failed favicon request used to leave a blank/broken square —
  // track the error and swap in the link-icon tile instead.
  const [loadFailed, setLoadFailed] = useState(false);
  if (favicon && !loadFailed) {
    return <Image source={{ uri: favicon }} style={styles.favicon} onError={() => setLoadFailed(true)} />;
  }
  return (
    <View style={[styles.faviconFallback, { backgroundColor: colors.faviconFallback }]}>
      <Ionicons name={LINK_ICON_NAME} size={14} color={colors.accent} />
    </View>
  );
}

/**
 * One row in the expanded list.
 * @param {{ source: object, colors: object, isLastRow: boolean }} props
 */
function SourceLinkRow({ source, colors, isLastRow }) {
  const url = urlFromSource(source);
  if (!url) return null;

  const title = titleFromSource(source, url);
  const host = hostLabel(url);
  const favicon = faviconUrl(url);
  const snippet = snippetFromSource(source);
  const openSourceLabel = `Open source ${title}`;

  return (
    <TouchableOpacity
      style={[styles.row, rowBorderStyle(isLastRow, colors)]}
      onPress={() => openSourceUrl(url)}
      activeOpacity={0.85}
      accessibilityRole="link"
      accessibilityLabel={openSourceLabel}
    >
      <SourceFavicon favicon={favicon} colors={colors} />
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>
        {/* Host on its own line, snippet below it — the old "host · snippet"
            single line truncated mid-sentence and read as one long URL. */}
        <Text style={[styles.host, { color: colors.textMuted }]} numberOfLines={1}>
          {host}
        </Text>
        {snippet ? (
          <Text style={[styles.host, { color: colors.textMuted }]} numberOfLines={2}>
            {snippet}
          </Text>
        ) : null}
      </View>
      <Ionicons name={OPEN_ICON_NAME} size={16} color={colors.accentSecondary} />
    </TouchableOpacity>
  );
}

/**
 * @param {{ sources: object[], colors: object }} props
 */
function ExpandedSourceList({ sources, colors }) {
  return (
    <NbCard noShadow>
      <View>
        {sources.map((source, index) => (
          <SourceLinkRow
            key={sourceRowKey(source, index)}
            source={source}
            colors={colors}
            isLastRow={index === sources.length - 1}
          />
        ))}
      </View>
    </NbCard>
  );
}

function SourceListIfOpen({ isExpanded, sources, colors }) {
  if (!isExpanded) return null;
  return <ExpandedSourceList sources={sources} colors={colors} />;
}

// ===== MAIN FUNCTION =====

/**
 * Sources pill under a web-search coach reply. Hidden entirely when there is nothing to show.
 * vocab: useState holds whether the list is expanded (starts collapsed).
 * @param {{ message: object, isDark?: boolean }} props
 */
export default function SourceLinkCards({ message, isDark = true }) {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? darkColors : lightColors;
  const [expanded, setExpanded] = useState(false);

  const sources = useMemo(() => visibleSourcesForMessage(message), [message]);

  if (!sources.length) return null;

  const colors = sourceCardColors(themeColors);

  function handleToggleExpanded() {
    setExpanded((isOpen) => !isOpen);
  }

  return (
    <View style={styles.wrap}>
      <SourcesTogglePill
        expanded={expanded}
        sourceCount={sources.length}
        colors={colors}
        onToggle={handleToggleExpanded}
      />
      <SourceListIfOpen isExpanded={expanded} sources={sources} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md, maxWidth: '100%' },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 0.2,
  },
  countText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  favicon: { width: 30, height: 30, borderRadius: borderRadius.md },
  faviconFallback: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    lineHeight: 19,
  },
  host: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginTop: 3,
    lineHeight: 16,
  },
});
