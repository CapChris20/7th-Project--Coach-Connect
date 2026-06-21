/**
 * SuppCo-style follow-up suggestion chips — lavender pills, context from the thread.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

const BUBBLE_BG_DARK = 'rgba(196, 132, 252, 0.14)';
const BUBBLE_BG_LIGHT = 'rgba(196, 132, 252, 0.12)';
const BUBBLE_BORDER_DARK = 'rgba(196, 132, 252, 0.28)';
const BUBBLE_BORDER_LIGHT = 'rgba(167, 139, 250, 0.35)';

export default function CoachFollowUpBubbles({ prompts = [], onPress, isDark = true }) {
  const items = (prompts || []).filter(Boolean).slice(0, 3);
  if (!items.length || typeof onPress !== 'function') return null;

  const bg = isDark ? BUBBLE_BG_DARK : BUBBLE_BG_LIGHT;
  const border = isDark ? BUBBLE_BORDER_DARK : BUBBLE_BORDER_LIGHT;
  const textColor = isDark ? 'rgba(255,255,255,0.92)' : '#1F1633';

  return (
    <View style={styles.wrap} accessibilityRole="list" accessibilityLabel="Suggested follow-up questions">
      {items.map((prompt, i) => (
        <Pressable
          key={`fu-${i}-${prompt.slice(0, 24)}`}
          onPress={() => onPress(prompt)}
          style={({ pressed }) => [
            styles.chip,
            { backgroundColor: bg, borderColor: border, opacity: pressed ? 0.88 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={prompt}
        >
          <Text style={[styles.chipText, { color: textColor }]}>{prompt}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 14, marginBottom: 4 },
  chip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
