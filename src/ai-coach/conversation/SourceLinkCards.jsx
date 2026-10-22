// Collapsible source links under AI Coach web-search replies.
// Flow: prefer message.webSources → else parse URLs out of the reply text → junk-filter → pill + expandable list.
// Used by: the AI Coach conversation thread under internet answers.

import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AI_COACH_UI } from '../coachColors';
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

const DARK_PANEL_BACKGROUND = 'rgba(20,20,25,0.92)';
const LIGHT_PANEL_BACKGROUND = '#FFFFFF';
const DARK_ROW_DIVIDER = 'rgba(255,255,255,0.06)';
const LIGHT_ROW_DIVIDER = 'rgba(10,10,15,0.06)';
const LIGHT_TEXT_PRIMARY = '#0A0A0F';
const LIGHT_TEXT_MUTED = 'rgba(10,10,15,0.55)';
const LIGHT_ACCENT = '#BE185D';
const LIGHT_ACCENT_SECONDARY = '#C2410C';
const DARK_PILL_ICON_FILL = 'rgba(190,24,93,0.18)';
const LIGHT_PILL_ICON_FILL = 'rgba(219,39,119,0.10)';
const DARK_COUNT_BADGE_FILL = 'rgba(194,65,12,0.22)';
const LIGHT_COUNT_BADGE_FILL = 'rgba(194,65,12,0.12)';
const DARK_LIST_BORDER = ['rgba(190,24,93,0.14)', 'rgba(194,65,12,0.10)'];
const LIGHT_LIST_BORDER = ['rgba(219,39,119,0.08)', 'rgba(234,88,12,0.06)'];
const DARK_FAVICON_FALLBACK = 'rgba(255,255,255,0.06)';
const LIGHT_FAVICON_FALLBACK = 'rgba(0,0,0,0.04)';

const PILL_GRADIENT_START = { x: 0, y: 0.5 };
const PILL_GRADIENT_END = { x: 1, y: 0.5 };
const LIST_GRADIENT_START = { x: 0, y: 0 };
const LIST_GRADIENT_END = { x: 1, y: 1 };

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

function darkSourceCardColors() {
  return {
    panelBackground: DARK_PANEL_BACKGROUND,
    rowDivider: DARK_ROW_DIVIDER,
    textPrimary: AI_COACH_UI.textPrimary,
    textMuted: AI_COACH_UI.textSecondary,
    accent: AI_COACH_UI.pink,
    accentSecondary: AI_COACH_UI.orange,
    pillIconFill: DARK_PILL_ICON_FILL,
    countBadgeFill: DARK_COUNT_BADGE_FILL,
    listBorder: DARK_LIST_BORDER,
    faviconFallback: DARK_FAVICON_FALLBACK,
  };
}

function lightSourceCardColors() {
  return {
    panelBackground: LIGHT_PANEL_BACKGROUND,
    rowDivider: LIGHT_ROW_DIVIDER,
    textPrimary: LIGHT_TEXT_PRIMARY,
    textMuted: LIGHT_TEXT_MUTED,
    accent: LIGHT_ACCENT,
    accentSecondary: LIGHT_ACCENT_SECONDARY,
    pillIconFill: LIGHT_PILL_ICON_FILL,
    countBadgeFill: LIGHT_COUNT_BADGE_FILL,
    listBorder: LIGHT_LIST_BORDER,
    faviconFallback: LIGHT_FAVICON_FALLBACK,
  };
}

/**
 * @param {boolean} isDark
 */
function sourceCardColors(isDark) {
  if (isDark) return darkSourceCardColors();
  return lightSourceCardColors();
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
 * Collapsed pill that toggles the source list.
 * @param {{ expanded: boolean, sourceCount: number, colors: object, onToggle: Function }} props
 */
function SourcesTogglePill({ expanded, sourceCount, colors, onToggle }) {
  const chevronName = chevronIconName(expanded);
  const accessibilityLabel = sourcesToggleAccessibilityLabel(expanded, sourceCount);

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={accessibilityLabel}
    >
      {/* Flat chip, deliberately quiet: the old gradient border + filled icon
          circle + orange count badge stacked three decorations on one small
          button and read as visual noise under an answer. */}
      <View
        style={[
          styles.pillInner,
          { backgroundColor: colors.panelBackground, borderColor: colors.rowDivider, borderWidth: 1 },
        ]}
      >
        <Ionicons name={GLOBE_ICON_NAME} size={14} color={colors.accent} />
        <Text style={[styles.pillText, { color: colors.textPrimary }]}>{SOURCES_PILL_LABEL}</Text>
        <Text style={[styles.countText, { color: colors.textMuted }]}>{sourceCount}</Text>
        <Ionicons name={chevronName} size={16} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
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
    <LinearGradient
      colors={colors.listBorder}
      start={LIST_GRADIENT_START}
      end={LIST_GRADIENT_END}
      style={styles.listBorder}
    >
      <View style={[styles.list, { backgroundColor: colors.panelBackground }]}>
        {sources.map((source, index) => (
          <SourceLinkRow
            key={sourceRowKey(source, index)}
            source={source}
            colors={colors}
            isLastRow={index === sources.length - 1}
          />
        ))}
      </View>
    </LinearGradient>
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
  const [expanded, setExpanded] = useState(false);

  const sources = useMemo(() => visibleSourcesForMessage(message), [message]);

  if (!sources.length) return null;

  const colors = sourceCardColors(isDark);

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
  wrap: { marginTop: 12, maxWidth: '100%' },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  countText: { fontSize: 12, fontWeight: '800' },
  listBorder: {
    marginTop: 10,
    borderRadius: 16,
    padding: 1,
  },
  list: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  favicon: { width: 30, height: 30, borderRadius: 8 },
  faviconFallback: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '700', lineHeight: 19 },
  host: { fontSize: 12, marginTop: 3, lineHeight: 16 },
});
