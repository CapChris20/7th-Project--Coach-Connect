// Shared VoiceOver and TalkBack labels for buttons, text fields, and headers.
// Flow: a screen passes the words the person should hear → this returns the accessibility props.
// Used by: Pressable, TouchableOpacity, and TextInput in the main flows.

// ===== NAMED CONSTANTS =====

const DEFAULT_BUTTON_LABEL = 'Button';
const DEFAULT_TEXT_FIELD_LABEL = 'Text field';
const BUTTON_ROLE = 'button';
const HEADER_ROLE = 'header';

/** Minimum extra hit area for an icon-only control. */
const MIN_TOUCH_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} label
 * @param {string} fallbackLabel
 * @returns {string}
 */
function spokenLabel(label, fallbackLabel) {
  return String(label || '').trim() || fallbackLabel;
}

// ===== MAIN FUNCTION =====

/**
 * VoiceOver / TalkBack props for a button.
 * @param {string} label
 * @param {string} [hint]
 * @returns {object}
 */
export function a11yButton(label, hint) {
  // 1. VoiceOver / TalkBack should hear a real name, not "Button".
  const spokenName = spokenLabel(label, DEFAULT_BUTTON_LABEL);
  const props = {
    accessibilityRole: BUTTON_ROLE,
    accessibilityLabel: spokenName,
  };
  if (hint) props.accessibilityHint = String(hint);
  return props;
}

/**
 * VoiceOver / TalkBack props for a text field.
 * @param {string} label
 * @param {string} [hint]
 * @returns {object}
 */
export function a11yTextField(label, hint) {
  // 1. Name the field. Hint is optional ("what this box is for").
  const props = {
    accessibilityLabel: spokenLabel(label, DEFAULT_TEXT_FIELD_LABEL),
  };
  if (hint) props.accessibilityHint = String(hint);
  return props;
}

/**
 * VoiceOver / TalkBack props for a screen or section header.
 * @param {string} label
 * @returns {object}
 */
export function a11yHeader(label) {
  // 1. Mark this text as a header so the rotor can jump to it.
  return {
    accessibilityRole: HEADER_ROLE,
    accessibilityLabel: String(label || '').trim(),
  };
}

export { MIN_TOUCH_HIT_SLOP };
