// Neobrutalist design tokens: colors, gradients, outline width, hard-shadow offset, radii, spacing.
// Flow: a screen asks getNbColors(isDark) for its palette → reads gradients and sizes from the named lists below.
// Used by: every Nb component in this folder and every screen built on them. This is the only place these hex values live.

// ===== NAMED CONSTANTS =====

export const NB_BORDER_WIDTH = 2.5;
export const NB_SHADOW_OFFSET = 4;
export const MINIMUM_TOUCH_SIZE = 44;

export const NB_RADIUS = {
  chip: 12,
  card: 14,
  hero: 18,
  sheet: 20,
};

export const NB_SPACING = {
  tiny: 4,
  small: 8,
  medium: 12,
  large: 16,
  huge: 24,
};

// Every gradient runs from the top-left corner to the bottom-right corner.
export const NB_GRADIENT_START = { x: 0, y: 0 };
export const NB_GRADIENT_END = { x: 1, y: 1 };

export const NB_GRADIENTS = {
  brand: ['#FF6B9D', '#FB923C'],
  ink: ['#6B3AD9', '#BE185D'],
  water: ['#67E8F9', '#60A5FA'],
  sleep: ['#E9D5FF', '#A78BFA'],
  energy: ['#BBF7D0', '#5EEAD4'],
  soft: ['#FFF1F7', '#EDE4FF'],
};

// Text that sits on a gradient is always near-black, except on the ink gradient, which uses white.
export const NB_TEXT_ON_LIGHT_GRADIENT = '#0A0A0F';
export const NB_TEXT_ON_INK_GRADIENT = '#FFFFFF';

const LIGHT_COLORS = {
  background: '#F3EEFF',
  surface: '#FFFFFF',
  chip: '#FFFFFF',
  ink: '#0A0A0F',
  muted: '#55506B',
  border: '#0A0A0F',
  shadow: '#0A0A0F',
  danger: '#DC2626',
};

const DARK_COLORS = {
  background: '#0A0A0F',
  surface: '#17171F',
  chip: '#1F1F2A',
  ink: '#F3EEFF',
  muted: '#A7A1BE',
  border: '#F3EEFF',
  shadow: '#6B3AD9',
  danger: '#F87171',
};

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {boolean} isDark
 * @returns {object} Palette for the current theme. Gradients do not change between themes.
 */
export function getNbColors(isDark) {
  if (isDark) return DARK_COLORS;
  return LIGHT_COLORS;
}
