/**
 * a11y Props
 *
 * Purpose: a11y Props — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: a11yButton, a11yTextField, a11yHeader, MIN_TOUCH_HIT_SLOP
 *
 * @file-header
 */
/**
 * Shared accessibility props for Coach Connect core flows.
 * Use on Pressable / TouchableOpacity / TextInput so VoiceOver/TalkBack get clear names.
 */

export function a11yButton(label, hint) {
  const props = {
    accessibilityRole: 'button',
    accessibilityLabel: String(label || '').trim() || 'Button',
  };
  if (hint) props.accessibilityHint = String(hint);
  return props;
}

export function a11yTextField(label, hint) {
  const props = {
    accessibilityLabel: String(label || '').trim() || 'Text field',
  };
  if (hint) props.accessibilityHint = String(hint);
  return props;
}

export function a11yHeader(label) {
  return {
    accessibilityRole: 'header',
    accessibilityLabel: String(label || '').trim(),
  };
}

/** Minimum touch target — use on icon-only controls (44pt). */
export const MIN_TOUCH_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
