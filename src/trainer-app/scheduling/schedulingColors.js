// Single color source for the trainer's session-scheduling UI (month calendar + booking form).
// Flow: screens import the named brand colors / gradients directly, and call
// getSessionSchedulingColors(isDark) for everything that flips with light vs dark mode.
// Why it exists: keeps two screens from drifting into slightly different pinks and greys.

// Brand palette for this flow. Manipulate here: change a hex once and every session-scheduling
// surface follows — do NOT hardcode these values inside screens or they'll fall out of sync.
export const DARK_ORANGE = '#EA580C';
export const DARK_PINK = '#D91E63';
export const DARK_PURPLE = '#7C3AED';
export const GOLD = '#F59E0B';

// Gradients are plain arrays because the gradient component takes `colors={[from, to]}`.
// Manipulate here: order matters — index 0 renders first (top/left), last renders last.
export const SESSION_GRADIENT = [DARK_PINK, DARK_PURPLE];
export const ACCENT_GRADIENT = [GOLD, DARK_ORANGE];

// Theme-dependent colors. Returning a fresh object per call (instead of two frozen constant
// objects) keeps call sites to one line: `const c = getSessionSchedulingColors(isDark)`.
// Manipulate here: each line is `isDark ? <dark value> : <light value>` — edit the side you
// want to change. rgba(...) values are intentionally translucent so they sit on top of the
// card background; raising the last number (alpha) makes them more solid/heavier.
export function getSessionSchedulingColors(isDark) {
  return {
    bg: isDark ? '#0A0A0F' : '#FAFAF9',
    cardBg: isDark ? '#1A1A1F' : '#F5F5F3',
    text: isDark ? '#FFFFFF' : '#0A0A0F',
    label: isDark ? '#FFFFFF' : '#0A0A0F',
    muted: isDark ? 'rgba(255,255,255,0.62)' : 'rgba(10,10,15,0.55)',
    divider: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,15,0.1)',
    border: DARK_PINK,
    wheelShell: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(10,10,15,0.04)',
    wheelInactive: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(10,10,15,0.45)',
    inputBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
  };
}
