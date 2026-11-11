// Follow-up question chips under an AI coach reply (neobrutalist design).
// Flow: drop blank prompts → stop at three → hide the row if nothing to press → paint NbChip for each.
// Used by: coach reply display after an answer that suggests a next question.
//
// vocab: NbChip = neobrutalist chip component with thick border and hard shadow

import React from 'react';
import { View, StyleSheet } from 'react-native';
import NbChip from '../../look-and-feel/NbChip';

// ===== NAMED CONSTANTS =====

// Manipulate here: how many follow-up chips to show. The row is built for a short stack, not a long list.
const MAX_VISIBLE_PROMPTS = 3;
// The key uses a short prefix of the prompt so two identical starts still differ by index.
const CHIP_KEY_PREFIX_LENGTH = 24;

// ===== HELPER FUNCTIONS =====

/**
 * Blank strings from the model are dropped. Then the row is capped so it cannot grow with the reply.
 * @param {Array|null|undefined} prompts
 * @returns {Array}
 */
function promptsToShow(prompts) {
  const promptList = prompts || [];
  const nonBlankPrompts = promptList.filter(Boolean);
  return nonBlankPrompts.slice(0, MAX_VISIBLE_PROMPTS);
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
 * One neobrutalist follow-up chip. Kept in-file so the main export stays a short checklist.
 * @param {{ prompt: string, onPress: Function }} props
 */
function FollowUpQuestionChip({ prompt, onPress }) {
  const handlePress = () => onPress(prompt);

  return (
    <NbChip
      onPress={handlePress}
      selected={false}
    >
      {prompt}
    </NbChip>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Neobrutalist follow-up chips. Renders nothing when there is no prompt or no press handler.
 * @param {object} [props]
 * @param {string[]} [props.prompts]
 * @param {Function} [props.onPress] Called with the prompt text.
 * @param {boolean} [props.isDark] - Not used (NbChip handles theme internally)
 * @returns {JSX.Element|null}
 */
export default function SuggestedQuestionChips({ prompts = [], onPress, isDark = true }) {
  const visiblePrompts = promptsToShow(prompts);
  if (!canShowSuggestedChips(visiblePrompts, onPress)) return null;

  return (
    <View style={styles.wrap} accessibilityRole="list" accessibilityLabel="Suggested follow-up questions">
      {visiblePrompts.map((prompt, promptIndex) => (
        <FollowUpQuestionChip
          key={chipKey(prompt, promptIndex)}
          prompt={prompt}
          onPress={onPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 14, marginBottom: 4 },
});
