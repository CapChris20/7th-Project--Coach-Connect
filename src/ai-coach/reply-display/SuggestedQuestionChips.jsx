// Follow-up question chips under an AI coach reply (neobrutalist NbChip row).
// Flow: drop blanks → cap at three → hide if nothing to tap → paint one chip per prompt.
// Used below coach replies that suggest a next question the user can send.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import NbChip from '../../look-and-feel/NbChip';

// ===== NAMED CONSTANTS =====

// Manipulate here: max chips in the row (short stack, not a scrolling list)
const MAX_FOLLOW_UP_CHIPS = 3;
const PROMPT_KEY_PREFIX_LENGTH = 24;
const CHIP_ROW_ACCESSIBILITY_ROLE = 'list';
const CHIP_ROW_ACCESSIBILITY_LABEL = 'Suggested follow-up questions';

// ===== HELPER FUNCTIONS =====

function promptsThatAreNotBlank(promptList) {
  const safeList = promptList || [];
  const nonBlankPrompts = [];

  for (let promptIndex = 0; promptIndex < safeList.length; promptIndex += 1) {
    const prompt = safeList[promptIndex];
    if (!prompt) {
      continue;
    }
    nonBlankPrompts.push(prompt);
  }

  return nonBlankPrompts;
}

function followUpPromptsToShow(prompts) {
  const nonBlankPrompts = promptsThatAreNotBlank(prompts);
  return nonBlankPrompts.slice(0, MAX_FOLLOW_UP_CHIPS);
}

function chipRowShouldRender(visiblePrompts, onPress) {
  if (visiblePrompts.length === 0) {
    return false;
  }
  if (typeof onPress !== 'function') {
    return false;
  }
  return true;
}

function followUpChipKey(prompt, promptIndex) {
  const promptPrefix = prompt.slice(0, PROMPT_KEY_PREFIX_LENGTH);
  return `fu-${promptIndex}-${promptPrefix}`;
}

function FollowUpQuestionChip({ prompt, onPress }) {
  function handleChipPress() {
    onPress(prompt);
  }

  // selected={false}: these are suggestions, not a multi-select filter.
  return (
    <NbChip onPress={handleChipPress} selected={false}>
      {prompt}
    </NbChip>
  );
}

function chipElementsForPrompts(visiblePrompts, onPress) {
  const chipElements = [];

  for (let promptIndex = 0; promptIndex < visiblePrompts.length; promptIndex += 1) {
    const prompt = visiblePrompts[promptIndex];
    const chipKey = followUpChipKey(prompt, promptIndex);
    chipElements.push(
      <FollowUpQuestionChip
        key={chipKey}
        prompt={prompt}
        onPress={onPress}
      />,
    );
  }

  return chipElements;
}

function FollowUpChipRow({ visiblePrompts, onPress }) {
  const chipElements = chipElementsForPrompts(visiblePrompts, onPress);

  return (
    <View
      style={styles.wrap}
      accessibilityRole={CHIP_ROW_ACCESSIBILITY_ROLE}
      accessibilityLabel={CHIP_ROW_ACCESSIBILITY_LABEL}
    >
      {chipElements}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Neobrutalist follow-up chips. Renders nothing when there is no prompt or no press handler.
 * @param {object} [props]
 * @param {string[]} [props.prompts]
 * @param {Function} [props.onPress] Called with the prompt text.
 * @param {boolean} [props.isDark] Unused — NbChip reads theme itself; kept for call-site API.
 * @returns {JSX.Element|null}
 */
export default function SuggestedQuestionChips({ prompts = [], onPress, isDark = true }) {
  // Call sites still pass isDark; NbChip owns theme. Acknowledge so linters stay quiet.
  void isDark;

  // 1. Build the short list the row is allowed to show.
  const visiblePrompts = followUpPromptsToShow(prompts);

  // 2. No prompts or no handler → empty / dead row; hide it.
  const shouldShowChipRow = chipRowShouldRender(visiblePrompts, onPress);
  if (!shouldShowChipRow) {
    return null;
  }

  // 3. Paint one chip per prompt with stable keys.
  return <FollowUpChipRow visiblePrompts={visiblePrompts} onPress={onPress} />;
}

// ===== PLUMBING — skip unless debugging =====

// Manipulate here: gap / top / bottom spacing of the chip stack under the reply
const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 14, marginBottom: 4 },
});
