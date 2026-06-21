/**
 * Premium food card design tokens — gold, dark orange, dark pink palette.
 */

export const brandGradients = {
  /** Dark gold → bright gold */
  gold: ['#A67C00', '#FFD86B'],
  /** Dark orange → warm orange */
  orange: ['#C2410C', '#FF8C42'],
  /** Dark pink → vivid pink */
  pink: ['#9D174D', '#FF3D8A'],
};

/** Macro mapping: carbs = gold, protein = orange, fat = pink */
export const gradients = {
  carbs: brandGradients.gold,
  protein: brandGradients.orange,
  fat: brandGradients.pink,
};

export const colors = {
  background: '#1A1B20',
  surface: '#23252C',
  surfaceElevated: '#2B2D35',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  foreground: '#FAFAFB',
  mutedForeground: '#A8ACB8',
  subtle: '#6F7480',
};

export const radii = {
  card: 22,
  pill: 16,
  chip: 12,
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

/** @param {string} hex @param {number} alpha */
export function hexToRgba(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  if (h.length < 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Pill background: 135° gradient at 14% → 10% opacity — never full saturation. */
export function pillBackgroundGradient(stops, { strong = false } = {}) {
  const a0 = strong ? 0.28 : 0.14;
  const a1 = strong ? 0.2 : 0.1;
  return [hexToRgba(stops[0], a0), hexToRgba(stops[1], a1)];
}

const borderStops = [brandGradients.gold[1], brandGradients.orange[1], brandGradients.pink[1]];
const titleGradient = [brandGradients.gold[0], brandGradients.pink[1]];
const ruleGradient = [brandGradients.orange[0], brandGradients.pink[1]];

/** Opaque, high-contrast palette for the expanded nutrition facts panel. */
export function getNutritionPanelPalette(isDark, { embedded = false } = {}) {
  const sharedAccents = {
    borderStops,
    titleGradient,
    ruleGradient,
    breakdownGradient: brandGradients.orange,
    microGradients: [brandGradients.gold, brandGradients.orange, brandGradients.pink],
  };

  // Light mode — warm cream panel, dark text (not a dark box on pink meals)
  if (embedded && !isDark) {
    return {
      ...sharedAccents,
      panelBg: '#FFFBF5',
      tileBg: '#FFFFFF',
      tileBorder: hexToRgba(brandGradients.pink[0], 0.14),
      trackBg: 'rgba(10,10,15,0.08)',
      text: '#0A0A0F',
      textMuted: '#5C4A42',
      textSubtle: '#8A7268',
      badgeBg: hexToRgba(brandGradients.gold[0], 0.12),
      badgeBorder: hexToRgba(brandGradients.orange[0], 0.22),
      iconOnGradient: '#FFFFFF',
    };
  }

  if (embedded && isDark) {
    return {
      ...sharedAccents,
      panelBg: '#14110F',
      tileBg: '#1E1916',
      tileBorder: hexToRgba(brandGradients.orange[0], 0.22),
      trackBg: 'rgba(255,255,255,0.12)',
      text: '#FFFFFF',
      textMuted: 'rgba(255,255,255,0.82)',
      textSubtle: 'rgba(255,255,255,0.58)',
      badgeBg: hexToRgba(brandGradients.gold[0], 0.18),
      badgeBorder: hexToRgba(brandGradients.pink[0], 0.28),
      iconOnGradient: '#FFFFFF',
    };
  }

  return {
    ...sharedAccents,
    panelBg: '#181410',
    tileBg: '#221E1A',
    tileBorder: hexToRgba(brandGradients.gold[0], 0.2),
    trackBg: 'rgba(255,255,255,0.1)',
    text: colors.foreground,
    textMuted: colors.mutedForeground,
    textSubtle: colors.subtle,
    badgeBg: hexToRgba(brandGradients.orange[0], 0.15),
    badgeBorder: colors.borderStrong,
    iconOnGradient: '#FFFFFF',
  };
}

/**
 * Palette for FoodCard — standalone (dark premium) vs embedded in meal sections.
 * @param {boolean} isDark
 * @param {{ embedded?: boolean }} [opts]
 */
export function getFoodCardPalette(isDark, { embedded = false } = {}) {
  if (embedded) {
    return isDark
      ? {
          background: 'transparent',
          surface: 'transparent',
          surfaceElevated: 'rgba(255,255,255,0.08)',
          expandedSurface: 'rgba(255,255,255,0.05)',
          border: 'rgba(255,255,255,0.12)',
          borderStrong: 'rgba(255,255,255,0.2)',
          foreground: '#FFFFFF',
          mutedForeground: 'rgba(255,255,255,0.62)',
          subtle: 'rgba(255,255,255,0.45)',
          innerHighlight: 'rgba(255,255,255,0.08)',
          microDivider: 'rgba(255,255,255,0.07)',
          iconPressBg: 'rgba(255,255,255,0.08)',
        }
      : {
          background: 'transparent',
          surface: 'transparent',
          surfaceElevated: 'rgba(0,0,0,0.04)',
          expandedSurface: 'rgba(0,0,0,0.025)',
          border: 'rgba(0,0,0,0.08)',
          borderStrong: 'rgba(0,0,0,0.14)',
          foreground: '#0A0A0F',
          mutedForeground: '#666666',
          subtle: 'rgba(10,10,15,0.5)',
          innerHighlight: 'rgba(0,0,0,0.05)',
          microDivider: 'rgba(0,0,0,0.07)',
          iconPressBg: 'rgba(0,0,0,0.05)',
        };
  }

  return {
    ...colors,
    expandedSurface: colors.surface,
    innerHighlight: 'rgba(255,255,255,0.06)',
    microDivider: 'rgba(255,255,255,0.05)',
    iconPressBg: 'rgba(255,255,255,0.06)',
  };
}
