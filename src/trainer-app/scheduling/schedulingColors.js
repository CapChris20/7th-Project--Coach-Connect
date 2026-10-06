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

// ===== HELPER FUNCTIONS =====

/**
 * @param {boolean} isDark
 * @param {string} darkValue
 * @param {string} lightValue
 * @returns {string}
 */
function colorForTheme(isDark, darkValue, lightValue) {
  if (isDark) return darkValue;
  return lightValue;
}

// ===== MAIN FUNCTION =====

/**
 * Returned keys are the names the scheduling screens already read.
 * @param {boolean} isDark
 * @returns {object}
 */
export function getSessionSchedulingColors(isDark) {
  return {
    bg: colorForTheme(isDark, '#0A0A0F', '#FAFAF9'),
    cardBg: colorForTheme(isDark, '#1A1A1F', '#F5F5F3'),
    text: colorForTheme(isDark, '#FFFFFF', '#0A0A0F'),
    label: colorForTheme(isDark, '#FFFFFF', '#0A0A0F'),
    muted: colorForTheme(isDark, 'rgba(255,255,255,0.62)', 'rgba(10,10,15,0.55)'),
    divider: colorForTheme(isDark, 'rgba(255,255,255,0.12)', 'rgba(10,10,15,0.1)'),
    border: DARK_PINK,
    wheelShell: colorForTheme(isDark, 'rgba(255,255,255,0.04)', 'rgba(10,10,15,0.04)'),
    wheelInactive: colorForTheme(isDark, 'rgba(255,255,255,0.5)', 'rgba(10,10,15,0.45)'),
    inputBg: colorForTheme(isDark, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.9)'),
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
