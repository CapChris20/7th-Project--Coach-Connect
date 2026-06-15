/**
 * ai Coach Ui Tokens
 *
 * Purpose: ai Coach Ui Tokens — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: AI_COACH_UI, AI_COACH_LIGHT
 *
 * @file-header
 */
/**
 * AI Coach UI tokens — aligned with design-system.md (premium dark neon glass).
 * Use only inside src/aiChat/*
 */

export const AI_COACH_UI = {
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
    /** Dashboard / original coach card border — dark pink → dark orange */
    borderWarm: ['#BE185D', '#C2410C'],
    /** Muted pink → orange for chips / accents */
    borderWarmSubtle: ['rgba(157,23,77,0.42)', 'rgba(154,52,18,0.36)'],
    /** Legacy brand — deep purple → dark orange */
    borderBrand: ['#6D28D9', '#C2410C'],
    /** Primary CTA buttons */
    ctaWarm: ['#BE185D', '#C2410C'],
    /** @deprecated rainbow — do not use for coach card borders */
    ctaCool: ['#C084FC', '#FF6B9D'],
    borderCyanPink: ['#06B6D4', '#FF6B9D'],
    userBubble: ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.06)'],
    borderPinkPurple: ['#FF6B9D', '#C084FC'],
    heroBorder: ['#BE185D', '#C2410C', '#BE185D'],
    categoryOrb: ['#BE185D', '#C2410C'],
    /** Input bar — dark pink → dark orange */
    composerSend: ['#BE185D', '#C2410C'],
    composerSendLight: ['#DB2777', '#EA580C'],
  },
  /** Bottom composer row (+ attach, mic, send) */
  composer: {
    iconAttach: '#BE185D',
    iconMic: '#C2410C',
    iconAttachLight: '#DB2777',
    iconMicLight: '#EA580C',
    micActiveBg: 'rgba(190,24,93,0.22)',
    micActiveBgLight: 'rgba(219,39,119,0.16)',
  },
};

export const AI_COACH_LIGHT = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  textPrimary: '#0A0A0F',
  textSecondary: 'rgba(10,10,15,0.58)',
  textMuted: 'rgba(10,10,15,0.45)',
  borderHairline: 'rgba(0,0,0,0.08)',
  glass: 'rgba(0,0,0,0.04)',
};
