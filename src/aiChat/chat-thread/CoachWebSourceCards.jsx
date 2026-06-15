/**
 * Coach Web Source Cards
 *
 * Rich web source preview row for AI Coach replies (after web search).
 */
import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  hostLabel,
  faviconUrl,
  resolveSourcePreviewUri,
} from './renderSourcePreview';

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
  return out.slice(0, 4);
}

export default function CoachWebSourceCards({ message, isDark = true }) {
  const sources = useMemo(() => {
    const fromMsg = Array.isArray(message?.webSources)
      ? message.webSources
      : Array.isArray(message?.sources)
        ? message.sources
        : [];
    if (fromMsg.length) return fromMsg.slice(0, 4);
    if (message?.searchedWeb) return extractSourcesFromText(message?.text);
    return [];
  }, [message]);

  if (!sources.length) return null;

  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,15,0.04)';
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,15,0.08)';
  const textPrimary = isDark ? '#FFFFFF' : '#0A0A0F';
  const textMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: textMuted }]}>Sources</Text>
      {sources.map((source, idx) => {
        const url = source.url || source.link;
        if (!url) return null;
        const title = source.title || source.name || hostLabel(url);
        const preview = resolveSourcePreviewUri(source);
        const favicon = faviconUrl(url);
        return (
          <TouchableOpacity
            key={`${url}-${idx}`}
            style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
            onPress={() => Linking.openURL(url).catch(() => {})}
            activeOpacity={0.85}
            accessibilityRole="link"
            accessibilityLabel={`Open source ${title}`}
          >
            {preview ? (
              <Image source={{ uri: preview }} style={styles.preview} resizeMode="cover" />
            ) : null}
            <View style={styles.meta}>
              {favicon ? (
                <Image source={{ uri: favicon }} style={styles.favicon} />
              ) : (
                <Ionicons name="globe-outline" size={14} color={textMuted} />
              )}
              <View style={styles.textCol}>
                <Text style={[styles.title, { color: textPrimary }]} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={[styles.host, { color: textMuted }]} numberOfLines={1}>
                  {hostLabel(url)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={textMuted} />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 8, maxWidth: '100%' },
  heading: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  preview: { width: '100%', height: 72 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  favicon: { width: 16, height: 16, borderRadius: 4 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  host: { fontSize: 11, marginTop: 2 },
});
