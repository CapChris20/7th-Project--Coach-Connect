/** Shared colors for trainer session scheduling (calendar + form). */

export const DARK_ORANGE = '#EA580C';
export const DARK_PINK = '#D91E63';
export const DARK_PURPLE = '#7C3AED';
export const GOLD = '#F59E0B';

export const SESSION_GRADIENT = [DARK_PINK, DARK_PURPLE];
export const ACCENT_GRADIENT = [GOLD, DARK_ORANGE];

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
