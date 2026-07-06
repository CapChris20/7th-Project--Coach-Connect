/**
 * Coach Web Source Cards
 *
 * Collapsible source links under AI Coach web-search replies.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

  const panelBg = isDark ? 'rgba(20,20,25,0.92)' : '#FFFFFF';
  const rowDivider = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,15,0.06)';
  const textPrimary = isDark ? AI_COACH_UI.textPrimary : '#0A0A0F';
  const textMuted = isDark ? AI_COACH_UI.textSecondary : 'rgba(10,10,15,0.55)';
  const accent = isDark ? AI_COACH_UI.pink : '#BE185D';
  const accentSecondary = isDark ? AI_COACH_UI.orange : '#C2410C';

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${sources.length} sources`}
      >
        <LinearGradient
          colors={AI_COACH_UI.gradient.borderWarm}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.pillBorder}
        >
          <View style={[styles.pillInner, { backgroundColor: panelBg }]}>
            <View style={[styles.pillIcon, { backgroundColor: isDark ? 'rgba(190,24,93,0.18)' : 'rgba(219,39,119,0.10)' }]}>
              <Ionicons name="globe-outline" size={14} color={accent} />
            </View>
            <Text style={[styles.pillText, { color: textPrimary }]}>
              Sources
            </Text>
            <View style={[styles.countBadge, { backgroundColor: isDark ? 'rgba(194,65,12,0.22)' : 'rgba(194,65,12,0.12)' }]}>
              <Text style={[styles.countText, { color: accentSecondary }]}>{sources.length}</Text>
            </View>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={textMuted}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {expanded ? (
        <LinearGradient
          colors={isDark ? ['rgba(190,24,93,0.14)', 'rgba(194,65,12,0.10)'] : ['rgba(219,39,119,0.08)', 'rgba(234,88,12,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.listBorder}
        >
          <View style={[styles.list, { backgroundColor: panelBg }]}>
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
                  style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: rowDivider }]}
                  onPress={() => Linking.openURL(url).catch(() => {})}
                  activeOpacity={0.85}
                  accessibilityRole="link"
                  accessibilityLabel={`Open source ${title}`}
                >
                  <LinearGradient
                    colors={AI_COACH_UI.gradient.borderWarmSubtle}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.faviconRing}
                  >
                    {favicon ? (
                      <Image source={{ uri: favicon }} style={styles.favicon} />
                    ) : (
                      <View style={[styles.faviconFallback, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                        <Ionicons name="link-outline" size={14} color={accent} />
                      </View>
                    )}
                  </LinearGradient>
                  <View style={styles.textCol}>
                    <Text style={[styles.title, { color: textPrimary }]} numberOfLines={2}>
                      {title}
                    </Text>
                    <Text style={[styles.host, { color: textMuted }]} numberOfLines={snippet ? 2 : 1}>
                      {host}
                      {snippet ? ` · ${snippet}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={16} color={accentSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        </LinearGradient>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, maxWidth: '100%' },
  pillBorder: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    padding: 1,
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  faviconRing: {
    width: 34,
    height: 34,
    borderRadius: 10,
    padding: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
