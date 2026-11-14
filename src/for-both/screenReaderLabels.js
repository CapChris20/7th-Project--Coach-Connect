// Shared VoiceOver and TalkBack labels for buttons, text fields, and headers.
// Flow: take the words the person should hear → trim empty → attach role / hint → return props.
// Used by: Pressable, TouchableOpacity, and TextInput across the main client and trainer flows.

// ===== NAMED CONSTANTS =====

const DEFAULT_BUTTON_LABEL = 'Button';
const DEFAULT_TEXT_FIELD_LABEL = 'Text field';
const BUTTON_ROLE = 'button';
const HEADER_ROLE = 'header';

// Manipulate here: extra hit padding around icon-only controls (top/bottom/left/right).
/** Minimum extra hit area for an icon-only control. */
const MIN_TOUCH_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

// ===== MAIN FUNCTION =====

/**
 * VoiceOver / TalkBack props for a button.
 * @param {string} label
 * @param {string} [hint]
 * @returns {object}
 */
export function a11yButton(label, hint) {
  // 1. Prefer a real spoken name; fall back to "Button" so the rotor never hears silence.
  const spokenName = labelOrFallback(label, DEFAULT_BUTTON_LABEL);

  // 2. Mark the control as a button so TalkBack / VoiceOver announce the role.
  // vocab: accessibilityRole = what kind of control this is for the screen reader
  // vocab: accessibilityLabel = the spoken name; accessibilityHint = optional “what happens if you tap”
  const buttonProps = {
    accessibilityRole: BUTTON_ROLE,
    accessibilityLabel: spokenName,
  };

  // 3. Hint is optional — only attach when the caller passed one.
  return withOptionalHint(buttonProps, hint);
}

/**
 * VoiceOver / TalkBack props for a text field.
 * @param {string} label
 * @param {string} [hint]
 * @returns {object}
 */
export function a11yTextField(label, hint) {
  // 1. Name the field. Empty label becomes "Text field" so the box is still findable.
  const fieldProps = {
    accessibilityLabel: labelOrFallback(label, DEFAULT_TEXT_FIELD_LABEL),
  };

  // 2. Hint is optional (“email address”, “search foods”, …).
  return withOptionalHint(fieldProps, hint);
}

/**
 * VoiceOver / TalkBack props for a screen or section header.
 * @param {string} label
 * @returns {object}
 */
export function a11yHeader(label) {
  // 1. Trim the title. Empty string is allowed — callers that pass nothing get an empty label.
  const spokenName = String(label || '').trim();

  // 2. Header role lets the rotor jump between section titles.
  // vocab: accessibilityRole "header" = rotor landmark for section titles
  return {
    accessibilityRole: HEADER_ROLE,
    accessibilityLabel: spokenName,
  };
}

export { MIN_TOUCH_HIT_SLOP };

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging label fallbacks =====

/**
 * Use the trimmed label when it has real text; otherwise the fallback word.
 * @param {string} label
 * @param {string} fallbackLabel
 * @returns {string}
 */
function labelOrFallback(label, fallbackLabel) {
  const trimmedLabel = String(label || '').trim();
  if (trimmedLabel) return trimmedLabel;
  return fallbackLabel;
}

/**
 * Copy props and, when hint is truthy, add accessibilityHint as a string.
 * @param {object} baseProps
 * @param {string} [hint]
 * @returns {object}
 */
function withOptionalHint(baseProps, hint) {
  if (!hint) return baseProps;
  return {
    ...baseProps,
    accessibilityHint: String(hint),
  };
}
