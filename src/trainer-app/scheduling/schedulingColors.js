// Single color source for the trainer's session calendar and booking form.
// Flow: screens import the brand colors, or call getSessionSchedulingColors for light versus dark.
// Used by: the scheduling screens. One list of hex values keeps the pinks from drifting.

// ===== NAMED CONSTANTS =====

// Manipulate here: change a hex once. Every scheduling screen reads these names.
const DARK_ORANGE = '#EA580C';
const DARK_PINK = '#D91E63';
const DARK_PURPLE = '#7C3AED';
const GOLD = '#F59E0B';

const SESSION_GRADIENT = [DARK_PINK, DARK_PURPLE];
const ACCENT_GRADIENT = [GOLD, DARK_ORANGE];

const DARK_THEME_COLORS = {
  bg: '#0A0A0F',
  cardBg: '#1A1A1F',
  text: '#FFFFFF',
  label: '#FFFFFF',
  muted: 'rgba(255,255,255,0.62)',
  divider: 'rgba(255,255,255,0.12)',
  wheelShell: 'rgba(255,255,255,0.04)',
  wheelInactive: 'rgba(255,255,255,0.5)',
  inputBg: 'rgba(255,255,255,0.04)',
};

const LIGHT_THEME_COLORS = {
  bg: '#FAFAF9',
  cardBg: '#F5F5F3',
  text: '#0A0A0F',
  label: '#0A0A0F',
  muted: 'rgba(10,10,15,0.55)',
  divider: 'rgba(10,10,15,0.1)',
  wheelShell: 'rgba(10,10,15,0.04)',
  wheelInactive: 'rgba(10,10,15,0.45)',
  inputBg: 'rgba(255,255,255,0.9)',
};

// ===== HELPER FUNCTIONS =====

/**
 * Pick the dark or light palette object. Border always stays brand pink.
 * @param {boolean} isDark
 * @returns {object}
 */
function themePalette(isDark) {
  if (isDark) return DARK_THEME_COLORS;
  return LIGHT_THEME_COLORS;
}

// ===== MAIN FUNCTION =====

/**
 * Returned keys are the names the scheduling screens already read (bg, cardBg, text, …).
 * @param {boolean} isDark
 * @returns {object}
 */
export function getSessionSchedulingColors(isDark) {
  const palette = themePalette(isDark);
  return {
    bg: palette.bg,
    cardBg: palette.cardBg,
    text: palette.text,
    label: palette.label,
    muted: palette.muted,
    divider: palette.divider,
    border: DARK_PINK,
    wheelShell: palette.wheelShell,
    wheelInactive: palette.wheelInactive,
    inputBg: palette.inputBg,
  };
}

export {
  DARK_ORANGE,
  DARK_PINK,
  DARK_PURPLE,
  GOLD,
  SESSION_GRADIENT,
  ACCENT_GRADIENT,
};
