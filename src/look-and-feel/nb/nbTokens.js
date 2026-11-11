// Neobrutalist design tokens: black/white/gray base for light and dark, plus a rotating palette of small gradient accents.
// Flow: a screen asks getNbColors(isDark) for its base palette → picks an accent pair with getNbAccent(index) for small details only.
// Used by: every Nb component in this folder and every screen built on them. This is the only place these hex values live.

// ===== NAMED CONSTANTS =====

export const NB_BORDER_WIDTH = 3;
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

// Text that sits on an accent gradient is always near-black, in light and dark mode.
export const NB_TEXT_ON_ACCENT = '#0A0A0A';

// Eleven gradient pairs. Color is for SMALL things only: avatars, pills, icon chips, bars, rings, strips.
// No green on purpose. Big surfaces stay black, white or gray.
export const NB_ACCENTS = [
  ['#FF6B9D', '#FB923C'], // orange to pink
  ['#FBBF24', '#EF4444'], // gold to red
  ['#A78BFA', '#E879F9'], // purple to magenta
  ['#60A5FA', '#818CF8'], // blue to indigo
  ['#FDE047', '#FB923C'], // gold to orange
  ['#FDA4AF', '#FB7185'], // rose
  ['#7DD3FC', '#A78BFA'], // sky to violet
  ['#FB7185', '#FBBF24'], // coral to gold
  ['#FDBA74', '#C4B5FD'], // peach to lilac
  ['#A78BFA', '#FB7185'], // violet to rose
  ['#FCD34D', '#F472B6'], // gold to pink
];

const LIGHT_COLORS = {
  background: '#F2F2F0',
  surface: '#FFFFFF',
  chip: '#FFFFFF',
  gray: '#E6E6E3',
  ink: '#0A0A0A',
  onInk: '#FFFFFF',
  muted: '#5C5C5C',
  border: '#0A0A0A',
  shadow: '#0A0A0A',
  line: 'rgba(10,10,10,0.16)',
  danger: '#DC2626',
};

const DARK_COLORS = {
  background: '#0B0B0B',
  surface: '#161616',
  chip: '#1F1F1F',
  gray: '#262626',
  ink: '#F2F2F2',
  onInk: '#0A0A0A',
  muted: '#A0A0A0',
  border: '#F2F2F2',
  shadow: '#8A8A8A',
  line: 'rgba(255,255,255,0.18)',
  danger: '#F87171',
};

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {boolean} isDark
 * @returns {object} Black/white/gray palette for the current theme.
 */
export function getNbColors(isDark) {
  if (isDark) return DARK_COLORS;
  return LIGHT_COLORS;
}

/**
 * Pick one gradient pair by position, wrapping around. Neighbors use a step of 3 so they look different.
 * @param {number} position
 * @returns {string[]} Two hex colors, start then end.
 */
export function getNbAccent(position) {
  const count = NB_ACCENTS.length;
  const wrapped = ((position % count) + count) % count;
  return NB_ACCENTS[wrapped];
}
