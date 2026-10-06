// Colors for the coach chat. Dark glass is the default. The light set is the small override.
// Flow: screens read AI_COACH_UI for the dark palette, or AI_COACH_LIGHT when the phone is in light mode.
// Used by the coach conversation and the coach home cards.

// ===== NAMED CONSTANTS =====

const AI_COACH_UI = {
  bg: '#0A0A0F',
  bgRoot: '#000000',
  surface: '#0A0A0F',
  surfaceElevated: '#141419',
  heroInner: ['#1a0a2e', '#0f0a1a'],
  glass: 'rgba(255,255,255,0.05)',
  glassStrong: 'rgba(255,255,255,0.08)',
  borderHairline: 'rgba(255,255,255,0.08)',
  borderGlassTop: 'rgba(255,255,255,0.15)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.60)',
  textMuted: 'rgba(255,255,255,0.45)',
  textLabel: 'rgba(255,255,255,0.45)',
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#06B6D4',
  orange: '#F97316',
  green: '#34D399',
  yellow: '#FBBF24',
  chip: {
    food: '#F97316',
    workout: '#C084FC',
    sleep: '#06B6D4',
    steps: '#34D399',
    energy: '#FBBF24',
    kcal: '#FB923C',
    program: '#A78BFA',
    muted: '#94A3B8',
  },
  gradient: {
    borderWarm: ['#BE185D', '#C2410C'],
    borderWarmSubtle: ['rgba(157,23,77,0.42)', 'rgba(154,52,18,0.36)'],
    borderBrand: ['#6D28D9', '#C2410C'],
    ctaWarm: ['#BE185D', '#C2410C'],
    ctaCool: ['#C084FC', '#FF6B9D'],
    borderCyanPink: ['#06B6D4', '#FF6B9D'],
    userBubble: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)'],
    borderPinkPurple: ['#FF6B9D', '#C084FC'],
    heroBorder: ['#BE185D', '#C2410C', '#BE185D'],
    categoryOrb: ['#BE185D', '#C2410C'],
    composerSend: ['#BE185D', '#C2410C'],
    composerSendLight: ['#DB2777', '#EA580C'],
  },
  composer: {
    iconAttach: '#BE185D',
    iconMic: '#C2410C',
    iconAttachLight: '#DB2777',
    iconMicLight: '#EA580C',
    micActiveBg: 'rgba(190,24,93,0.22)',
    micActiveBgLight: 'rgba(219,39,119,0.16)',
  },
};

const AI_COACH_LIGHT = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  textPrimary: '#0A0A0F',
  textSecondary: 'rgba(10,10,15,0.58)',
  textMuted: 'rgba(10,10,15,0.45)',
  borderHairline: 'rgba(0,0,0,0.08)',
  glass: 'rgba(0,0,0,0.04)',
};

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

export { AI_COACH_UI, AI_COACH_LIGHT };
