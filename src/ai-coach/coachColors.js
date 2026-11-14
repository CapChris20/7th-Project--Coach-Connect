// AI Coach visual aliases on top of the shared palette — no parallel palette.
// Flow: build chip colors → build gradients → build composer icons → dark tokens → light overrides.
// Used by coach home, conversation, and sidebar-adjacent chrome.
//
// Contract: docs/design/DESIGN.md — keep cool gradients; Nb structure; no purple glow; no flat solid fills.
// Export keys (bg, pink, gradient.*, composer.*) stay frozen — callers read those letters.

import { lightColors, darkColors, gradients } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// vocab: gradients.brand / .sleep / .energy / .water / .soft come from colorPalette — do not invent hex here.
// Manipulate here: alpha stops for borderWarmSubtle only — other keys alias palette gradients.
const BORDER_WARM_SUBTLE_STOPS = [
  'rgba(255,107,157,0.42)',
  'rgba(251,146,60,0.36)',
];

// Manipulate here: micActiveBg alphas when the recording pulse feels too strong / too faint.
const MIC_ACTIVE_BACKGROUND_DARK = 'rgba(255,107,157,0.22)';
const MIC_ACTIVE_BACKGROUND_LIGHT = 'rgba(255,107,157,0.16)';

// ===== HELPER FUNCTIONS =====

/**
 * Chip accent colors for quick-action categories (cool multi-stop pairs only).
 * @returns {object}
 */
function buildCoachChipColors() {
  const brandSecondStop = gradients.brand.colors[1];
  const brandFirstStop = gradients.brand.colors[0];
  const sleepSecondStop = gradients.sleep.colors[1];
  const energySecondStop = gradients.energy.colors[1];
  const energyFirstStop = gradients.energy.colors[0];
  const mutedLabelColor = lightColors.nbMuted;

  return {
    food: brandSecondStop,
    // Strip: ink purple (#E25588) off chrome — brand / energy only.
    workout: brandSecondStop,
    sleep: sleepSecondStop,
    steps: energySecondStop,
    energy: energyFirstStop,
    kcal: brandFirstStop,
    program: energyFirstStop,
    muted: mutedLabelColor,
  };
}

/**
 * Named gradient roles the coach screens import via AI_COACH_UI.gradient.
 * @returns {object}
 */
function buildCoachGradients() {
  const brandStops = gradients.brand.colors;
  const waterStops = gradients.water.colors;
  const softStops = gradients.soft.colors;
  const brandFirstStop = brandStops[0];
  const waterFirstStop = waterStops[0];

  // Hero border loops the first brand stop so LinearGradient can close the ring.
  const heroBorderStops = [];
  for (let stopIndex = 0; stopIndex < brandStops.length; stopIndex += 1) {
    heroBorderStops.push(brandStops[stopIndex]);
  }
  heroBorderStops.push(brandFirstStop);

  const cyanThenPinkStops = [waterFirstStop, brandFirstStop];

  return {
    borderWarm: brandStops,
    borderWarmSubtle: BORDER_WARM_SUBTLE_STOPS,
    borderBrand: brandStops,
    ctaWarm: brandStops,
    ctaCool: waterStops,
    borderCyanPink: cyanThenPinkStops,
    // Soft wash for coach bubbles (not glass blur).
    userBubble: softStops,
    borderPinkPurple: brandStops,
    heroBorder: heroBorderStops,
    categoryOrb: brandStops,
    composerSend: brandStops,
    composerSendLight: brandStops,
    coachBubbleWash: softStops,
  };
}

/**
 * Mic / attach icon colors + pressed mic washes (dark + light).
 * @returns {object}
 */
function buildCoachComposerIcons() {
  const brandFirstStop = gradients.brand.colors[0];
  const brandSecondStop = gradients.brand.colors[1];

  return {
    iconAttach: brandFirstStop,
    iconMic: brandSecondStop,
    iconAttachLight: brandFirstStop,
    iconMicLight: brandSecondStop,
    micActiveBg: MIC_ACTIVE_BACKGROUND_DARK,
    micActiveBgLight: MIC_ACTIVE_BACKGROUND_LIGHT,
  };
}

/**
 * Dark coach chrome — nb surfaces, no glass hairlines, no purple glow.
 * Key names stay short (bg, glass, pink) because screens already import those letters.
 * @returns {object}
 */
function buildDarkCoachUiTokens() {
  // 1. Chip + gradient + composer bundles.
  const chipColors = buildCoachChipColors();
  const gradientRoles = buildCoachGradients();
  const composerIcons = buildCoachComposerIcons();

  // 2. Hero fill: chip surface → page background (not a solid purple slab).
  const heroInnerColors = [darkColors.nbSurfaceChip, darkColors.nbBackground];

  // 3. Map every coach role onto nb / gradient tokens from the shared palette.
  const brandFirstStop = gradients.brand.colors[0];
  const brandSecondStop = gradients.brand.colors[1];
  const waterFirstStop = gradients.water.colors[0];
  const energySecondStop = gradients.energy.colors[1];
  const energyFirstStop = gradients.energy.colors[0];

  return {
    bg: darkColors.nbBackground,
    bgRoot: darkColors.nbBackground,
    surface: darkColors.nbSurface,
    surfaceElevated: darkColors.nbSurfaceChip,
    heroInner: heroInnerColors,
    surfaceChip: darkColors.nbSurfaceChip,
    surfaceStrong: darkColors.nbSurface,
    // Legacy aliases (strip: no glass naming in new code — values are nb surfaces).
    glass: darkColors.nbSurfaceChip,
    glassStrong: darkColors.nbSurface,
    borderHairline: darkColors.nbBorder,
    borderGlassTop: darkColors.nbBorder,
    textPrimary: darkColors.nbInk,
    textSecondary: darkColors.nbMuted,
    textMuted: darkColors.nbMuted,
    textLabel: darkColors.nbMuted,
    pink: brandFirstStop,
    // analysis chip — brand pink, not ink purple
    purple: brandFirstStop,
    cyan: waterFirstStop,
    orange: brandSecondStop,
    green: energySecondStop,
    yellow: energyFirstStop,
    chip: chipColors,
    gradient: gradientRoles,
    composer: composerIcons,
  };
}

/**
 * Light overrides for screens that merge onto AI_COACH_UI.
 * Only the keys that flip with theme — dark object stays the base.
 * @returns {object}
 */
function buildLightCoachUiOverrides() {
  return {
    bg: lightColors.nbBackground,
    surface: lightColors.nbSurface,
    textPrimary: lightColors.nbInk,
    textSecondary: lightColors.nbMuted,
    textMuted: lightColors.nbMuted,
    borderHairline: lightColors.nbBorder,
    glass: lightColors.nbSurfaceChip,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Build the exported dark + light coach UI token objects.
 * Flow: 1. dark tokens  2. light overrides  3. return both for callers
 * @returns {{ darkUi: object, lightOverrides: object }}
 */
function buildCoachColorExports() {
  // 1. Dark coach chrome is the base object screens import as AI_COACH_UI.
  const darkUi = buildDarkCoachUiTokens();

  // 2. Light overrides merge on top when the theme is light.
  const lightOverrides = buildLightCoachUiOverrides();

  // 3. Hand both objects to the frozen export names below.
  return { darkUi, lightOverrides };
}

const builtCoachColors = buildCoachColorExports();
const AI_COACH_UI = builtCoachColors.darkUi;
const AI_COACH_LIGHT = builtCoachColors.lightOverrides;

export { AI_COACH_UI, AI_COACH_LIGHT };
