/**
 * Premium food card design tokens — Coach Connect macro palette.
 */

export const brandGradients = {
  /** dark orange → pink */
  orangePink: ['#9A3412', '#FF3D8A'],
  /** dark orange → purple */
  orangePurple: ['#9A3412', '#8B5CF6'],
  /** gold → pink */
  goldPink: ['#A67C00', '#FF6B9D'],
  /** cyan → purple */
  cyanPurple: ['#0891B2', '#8B5CF6'],
};

/** Macro mapping — full stops for accents (dots, thin bars) */
export const gradients = {
  protein: brandGradients.orangePink,
  carbs: brandGradients.goldPink,
  fat: brandGradients.cyanPurple,
  calories: brandGradients.orangePurple,
};

/** Same hues, pulled back for large surfaces (less neon on dark UI) */
export const gradientsSoft = {
  protein: ['#9A3412', '#BE185D'],
  carbs: ['#8B6914', '#B84D6F'],
  fat: ['#0E7490', '#6D28D9'],
  calories: ['#9A3412', '#7C3AED'],
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
  const a0 = strong ? 0.2 : 0.1;
  const a1 = strong ? 0.14 : 0.06;
  return [hexToRgba(stops[0], a0), hexToRgba(stops[1], a1)];
}

/** Single accent at low alpha — icon wells, badges */
export function accentTint(hex, alpha = 0.14) {
  return hexToRgba(hex, alpha);
}

const titleGradient = brandGradients.orangePink;
const ruleColor = hexToRgba(brandGradients.orangePurple[1], 0.28);

/** Opaque, high-contrast palette for the expanded nutrition facts panel. */
export function getNutritionPanelPalette(isDark, { embedded = false } = {}) {
  const sharedAccents = {
    titleGradient,
    ruleColor,
    breakdownGradient: brandGradients.orangePink,
    microGradients: [
      brandGradients.goldPink,
      brandGradients.orangePink,
      brandGradients.cyanPurple,
      brandGradients.orangePurple,
    ],
  };

  if (embedded && !isDark) {
    return {
      ...sharedAccents,
      panelBg: '#FFFBF5',
      panelBorder: hexToRgba(brandGradients.orangePink[0], 0.12),
      tileBg: '#FFFFFF',
      tileBorder: hexToRgba(brandGradients.orangePink[0], 0.1),
      trackBg: 'rgba(10,10,15,0.06)',
      text: '#0A0A0F',
      textMuted: '#5C4A42',
      textSubtle: '#8A7268',
      badgeBg: hexToRgba(brandGradients.goldPink[0], 0.08),
      badgeBorder: hexToRgba(brandGradients.orangePurple[0], 0.14),
      iconOnGradient: brandGradients.orangePink[0],
    };
  }

  if (embedded && isDark) {
    return {
      ...sharedAccents,
      panelBg: '#14110F',
      panelBorder: 'rgba(255,255,255,0.1)',
      tileBg: '#1A1714',
      tileBorder: 'rgba(255,255,255,0.08)',
      trackBg: 'rgba(255,255,255,0.08)',
      text: '#F4F2EF',
      textMuted: 'rgba(255,255,255,0.68)',
      textSubtle: 'rgba(255,255,255,0.45)',
      badgeBg: 'rgba(255,255,255,0.06)',
      badgeBorder: 'rgba(255,255,255,0.1)',
      iconOnGradient: '#E8B4C8',
    };
  }

  return {
    ...sharedAccents,
    panelBg: '#181410',
    panelBorder: 'rgba(255,255,255,0.1)',
    tileBg: '#1E1B18',
    tileBorder: 'rgba(255,255,255,0.08)',
    trackBg: 'rgba(255,255,255,0.08)',
    text: colors.foreground,
    textMuted: colors.mutedForeground,
    textSubtle: colors.subtle,
    badgeBg: 'rgba(255,255,255,0.06)',
    badgeBorder: 'rgba(255,255,255,0.1)',
    iconOnGradient: '#E8B4C8',
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
