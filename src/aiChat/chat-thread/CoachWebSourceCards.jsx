/**
 * Coach Web Source Cards
 *
 * Collapsible source links under AI Coach web-search replies.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AI_COACH_UI } from '../aiCoachUiTokens';
import { hostLabel, faviconUrl } from './renderSourcePreview';

const JUNK_SOURCE_RES = [
  /how to search the web/i,
  /search the web in chrome/i,
  /support\.google\.com/i,
  /advanced search\s*-\s*google/i,
];

function isJunkSource(source) {
  const blob = `${source?.title || ''} ${source?.snippet || ''} ${source?.url || ''}`;
  return JUNK_SOURCE_RES.some((re) => re.test(blob));
}

function extractSourcesFromText(text) {
  const raw = String(text || '');
  const out = [];
  const seen = new Set();
  const md = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;
  let m;
  while ((m = md.exec(raw)) !== null) {
    const url = m[2];
    if (!seen.has(url)) {
      seen.add(url);
      out.push({ url, title: m[1] || hostLabel(url) });
    }
  }
  const plain = /https?:\/\/[^\s)\]"']+/gi;
  while ((m = plain.exec(raw)) !== null) {
    const url = m[0].replace(/[.,;:!?)]+$/, '');
    if (!seen.has(url)) {
      seen.add(url);
      out.push({ url, title: hostLabel(url) });
    }
  }
  return out.slice(0, 6);
}

export default function CoachWebSourceCards({ message, isDark = true }) {
  const [expanded, setExpanded] = useState(false);

  const sources = useMemo(() => {
    const fromMsg = Array.isArray(message?.webSources)
      ? message.webSources
      : Array.isArray(message?.sources)
        ? message.sources
        : [];
    if (fromMsg.length) return fromMsg.filter((s) => !isJunkSource(s)).slice(0, 6);
    if (message?.searchedWeb) return extractSourcesFromText(message?.text);
    return [];
  }, [message]);

  if (!sources.length) return null;

  const border = isDark ? AI_COACH_UI.borderHairline : 'rgba(10,10,15,0.1)';
  const textPrimary = isDark ? AI_COACH_UI.textPrimary : '#0A0A0F';
  const textMuted = isDark ? AI_COACH_UI.textSecondary : 'rgba(10,10,15,0.55)';
  const accent = AI_COACH_UI.cyan;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.85}
        style={[styles.pill, { borderColor: border }]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${sources.length} sources`}
      >
        <Ionicons name="globe-outline" size={14} color={accent} />
        <Text style={[styles.pillText, { color: textPrimary }]}>
          Sources · {sources.length}
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={textMuted}
        />
      </TouchableOpacity>

      {expanded ? (
        <View style={[styles.list, { borderColor: border }]}>
          {sources.map((source, idx) => {
            const url = source.url || source.link;
            if (!url) return null;
            const title = source.title || source.name || hostLabel(url);
            const host = hostLabel(url);
            const favicon = faviconUrl(url);
            const snippet = String(source.snippet || '').trim();
            const isLast = idx === sources.length - 1;
            return (
              <TouchableOpacity
                key={`${url}-${idx}`}
                style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: border }]}
                onPress={() => Linking.openURL(url).catch(() => {})}
                activeOpacity={0.85}
                accessibilityRole="link"
                accessibilityLabel={`Open source ${title}`}
              >
                {favicon ? (
                  <Image source={{ uri: favicon }} style={styles.favicon} />
                ) : (
                  <Ionicons name="link-outline" size={14} color={textMuted} style={styles.faviconFallback} />
                )}
                <View style={styles.textCol}>
                  <Text style={[styles.title, { color: textPrimary }]} numberOfLines={2}>
                    {title}
                  </Text>
                  <Text style={[styles.host, { color: textMuted }]} numberOfLines={1}>
                    {host}
                    {snippet ? ` · ${snippet}` : ''}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={14} color={textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, maxWidth: '100%' },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  list: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  favicon: { width: 18, height: 18, borderRadius: 4 },
  faviconFallback: { width: 18 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  host: { fontSize: 11, marginTop: 2, lineHeight: 15 },
});
