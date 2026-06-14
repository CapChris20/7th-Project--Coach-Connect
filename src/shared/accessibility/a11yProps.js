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
