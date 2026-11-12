// AI Coach visual aliases on top of the shared palette — no parallel palette.
// Flow: map coach UI roles → colorPalette gradients / nb tokens → screens import AI_COACH_UI.
// Used by coach home, conversation, and sidebar-adjacent chrome.
//
// Contract: docs/design/DESIGN.md — keep cool gradients; Nb structure; no purple glow; no flat solid fills.

import { lightColors, darkColors, gradients } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: chip accents for quick-action categories — cool multi-stop pairs only.
const AI_COACH_CHIP_COLORS = {
  food: gradients.brand.colors[1],
  // Strip: ink purple (#E25588) off chrome — brand / energy only.
  workout: gradients.brand.colors[1],
  sleep: gradients.sleep.colors[1],
  steps: gradients.energy.colors[1],
  energy: gradients.energy.colors[0],
  kcal: gradients.brand.colors[0],
  program: gradients.energy.colors[0],
  muted: lightColors.nbMuted,
};

// Manipulate here: coach gradients — all aliases of colorPalette.gradients (plus soft washes).
const AI_COACH_GRADIENTS = {
  borderWarm: gradients.brand.colors,
  borderWarmSubtle: [
    'rgba(255,107,157,0.42)',
    'rgba(251,146,60,0.36)',
  ],
  borderBrand: gradients.brand.colors,
  ctaWarm: gradients.brand.colors,
  ctaCool: gradients.water.colors,
  borderCyanPink: [gradients.water.colors[0], gradients.brand.colors[0]],
  // Soft wash for coach bubbles (not glass blur).
  userBubble: gradients.soft.colors,
  borderPinkPurple: gradients.brand.colors,
  heroBorder: [...gradients.brand.colors, gradients.brand.colors[0]],
  categoryOrb: gradients.brand.colors,
  composerSend: gradients.brand.colors,
  composerSendLight: gradients.brand.colors,
  coachBubbleWash: gradients.soft.colors,
};

const AI_COACH_COMPOSER_ICONS = {
  iconAttach: gradients.brand.colors[0],
  iconMic: gradients.brand.colors[1],
  iconAttachLight: gradients.brand.colors[0],
  iconMicLight: gradients.brand.colors[1],
  micActiveBg: 'rgba(255,107,157,0.22)',
  micActiveBgLight: 'rgba(255,107,157,0.16)',
};

/** Dark coach chrome — nb surfaces, no glass hairlines, no purple glow. */
const AI_COACH_UI = {
  bg: darkColors.nbBackground,
  bgRoot: darkColors.nbBackground,
  surface: darkColors.nbSurface,
  surfaceElevated: darkColors.nbSurfaceChip,
  heroInner: [darkColors.nbSurfaceChip, darkColors.nbBackground],
  surfaceChip: darkColors.nbSurfaceChip,
  surfaceStrong: darkColors.nbSurface,
  // Legacy aliases (strip: no glass naming in new code).
  glass: darkColors.nbSurfaceChip,
  glassStrong: darkColors.nbSurface,
  borderHairline: darkColors.nbBorder,
  borderGlassTop: darkColors.nbBorder,
  textPrimary: darkColors.nbInk,
  textSecondary: darkColors.nbMuted,
  textMuted: darkColors.nbMuted,
  textLabel: darkColors.nbMuted,
  pink: gradients.brand.colors[0],
  // analysis chip — brand pink, not ink purple
  purple: gradients.brand.colors[0],
  cyan: gradients.water.colors[0],
  orange: gradients.brand.colors[1],
  green: gradients.energy.colors[1],
  yellow: gradients.energy.colors[0],
  chip: AI_COACH_CHIP_COLORS,
  gradient: AI_COACH_GRADIENTS,
  composer: AI_COACH_COMPOSER_ICONS,
};

/** Light overrides for screens that merge onto AI_COACH_UI. */
const AI_COACH_LIGHT = {
  bg: lightColors.nbBackground,
  surface: lightColors.nbSurface,
  textPrimary: lightColors.nbInk,
  textSecondary: lightColors.nbMuted,
  textMuted: lightColors.nbMuted,
  borderHairline: lightColors.nbBorder,
  glass: lightColors.nbSurfaceChip,
};

// ===== MAIN FUNCTION =====

export { AI_COACH_UI, AI_COACH_LIGHT };
