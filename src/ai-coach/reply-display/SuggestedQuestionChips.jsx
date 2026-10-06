// Follow-up question chips under an AI coach reply. Lavender pills, up to three.
// Flow: drop blank prompts → stop at three → hide the row if there is nothing to press → paint one chip each.
// Used by the coach reply display after an answer that suggests a next question.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

// ===== NAMED CONSTANTS =====

const BUBBLE_BG_DARK = 'rgba(196, 132, 252, 0.14)';
const BUBBLE_BG_LIGHT = 'rgba(196, 132, 252, 0.12)';
const BUBBLE_BORDER_DARK = 'rgba(196, 132, 252, 0.28)';
const BUBBLE_BORDER_LIGHT = 'rgba(167, 139, 250, 0.35)';
const CHIP_TEXT_DARK = 'rgba(255,255,255,0.92)';
const CHIP_TEXT_LIGHT = '#1F1633';
// Manipulate here: how many follow-up chips to show. The row is built for a short stack, not a long list.
const MAX_VISIBLE_PROMPTS = 3;
// The key uses a short prefix of the prompt so two identical starts still differ by index.
const CHIP_KEY_PREFIX_LENGTH = 24;
// Manipulate here: how far a chip fades while the finger is down.
const CHIP_PRESSED_OPACITY = 0.88;
const CHIP_IDLE_OPACITY = 1;

// ===== HELPER FUNCTIONS =====

/**
 * Blank strings from the model are dropped. Then the row is capped so it cannot grow with the reply.
 * @param {Array|null|undefined} prompts
 * @returns {Array}
 */
function promptsToShow(prompts) {
  const promptList = prompts || [];
  return promptList.filter(Boolean).slice(0, MAX_VISIBLE_PROMPTS);
}

/**
 * A row with no prompts, or no handler, would be a dead list. Hide it.
 * @param {Array} visiblePrompts
 * @param {Function|undefined} onPress
 * @returns {boolean}
 */
function canShowSuggestedChips(visiblePrompts, onPress) {
  const hasPrompts = visiblePrompts.length > 0;
  const hasPressHandler = typeof onPress === 'function';
  return hasPrompts && hasPressHandler;
}

/**
 * @param {boolean} isDark
 * @returns {{ backgroundColor: string, borderColor: string, textColor: string }}
 */
function chipPalette(isDark) {
  if (isDark) {
    return {
      backgroundColor: BUBBLE_BG_DARK,
      borderColor: BUBBLE_BORDER_DARK,
      textColor: CHIP_TEXT_DARK,
    };
  }
  return {
    backgroundColor: BUBBLE_BG_LIGHT,
    borderColor: BUBBLE_BORDER_LIGHT,
    textColor: CHIP_TEXT_LIGHT,
  };
}

/**
 * Index stays in the key so two prompts that share a prefix do not collide.
 * @param {string} prompt
 * @param {number} promptIndex
 * @returns {string}
 */
function chipKey(prompt, promptIndex) {
  const promptPrefix = prompt.slice(0, CHIP_KEY_PREFIX_LENGTH);
  return `fu-${promptIndex}-${promptPrefix}`;
}

/**
 * @param {{ backgroundColor: string, borderColor: string }} palette
 * @param {boolean} isPressed
 * @returns {Array}
 */
function chipPressStyle(palette, isPressed) {
  const opacity = isPressed ? CHIP_PRESSED_OPACITY : CHIP_IDLE_OPACITY;
  return [
    styles.chip,
    {
      backgroundColor: palette.backgroundColor,
      borderColor: palette.borderColor,
      opacity,
    },
  ];
}

// ===== MAIN FUNCTION =====

/**
 * Lavender follow-up chips. Renders nothing when there is no prompt or no press handler.
 * @param {object} [props]
 * @param {string[]} [props.prompts]
 * @param {Function} [props.onPress] Called with the prompt text.
 * @param {boolean} [props.isDark]
 * @returns {JSX.Element|null}
 */
export default function SuggestedQuestionChips({ prompts = [], onPress, isDark = true }) {
  const visiblePrompts = promptsToShow(prompts);
  if (!canShowSuggestedChips(visiblePrompts, onPress)) return null;

  const palette = chipPalette(isDark);

  return (
    <View style={styles.wrap} accessibilityRole="list" accessibilityLabel="Suggested follow-up questions">
      {visiblePrompts.map((prompt, promptIndex) => (
        <Pressable
          key={chipKey(prompt, promptIndex)}
          onPress={() => onPress(prompt)}
          // vocab: Pressable's style function receives pressed so the chip can fade only while the finger is down.
          style={({ pressed: isPressed }) => chipPressStyle(palette, isPressed)}
          accessibilityRole="button"
          accessibilityLabel={prompt}
        >
          <Text style={[styles.chipText, { color: palette.textColor }]}>{prompt}</Text>
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
