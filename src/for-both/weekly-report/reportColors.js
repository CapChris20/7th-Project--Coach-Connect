// Color tokens for the weekly report. Screens read these names.
// Flow: pick a gradient or a light/dark palette. Nothing in this file computes a number.
// Used by: weekly report charts and cards.

// ===== NAMED CONSTANTS =====

const GRADIENTS = {
  g1: ['#ff6b35', '#ff1493'],
  g2: ['#ffd700', '#ff1493'],
  g3: ['#ffd700', '#ff1493'],
  g4: ['#00bfff', '#ff1493'],
  g5: ['#ff6b35', '#ff1493'],
};

const DARK_COLORS = {
  background: '#0a0a0f',
  backgroundGradient: ['#0a0a0f', '#12121c'],
  surfacePrimary: 'rgba(20, 20, 30, 0.55)',
  surfaceSecondary: 'rgba(30, 30, 45, 0.4)',
  textPrimary: '#ffffff',
  textSecondary: '#b4b4c0',
  textMuted: '#8e8e93',
  border: 'rgba(255, 255, 255, 0.08)',
  blurTint: 'dark',
};

const LIGHT_COLORS = {
  background: '#f4f4f6',
  backgroundGradient: ['#f7f7fa', '#eaeaf0'],
  surfacePrimary: 'rgba(255, 255, 255, 0.85)',
  surfaceSecondary: 'rgba(240, 240, 245, 0.6)',
  textPrimary: '#111111',
  textSecondary: '#444455',
  textMuted: '#80808a',
  border: 'rgba(0, 0, 0, 0.06)',
  blurTint: 'light',
};

const TREND_POSITIVE = '#34d399';
const TREND_NEGATIVE = '#f87171';
const STORAGE_KEY = 'coachconnect.theme.mode';

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

export {
  GRADIENTS,
  DARK_COLORS,
  LIGHT_COLORS,
  TREND_POSITIVE,
  TREND_NEGATIVE,
  STORAGE_KEY,
};
