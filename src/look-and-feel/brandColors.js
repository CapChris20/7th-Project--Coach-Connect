/**
 * brand Gradients
 *
 * Purpose: brand Gradients — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: BRAND_NAV_ICON_GRADIENT, BRAND_NAV_ICON_GRADIENT_LOCATIONS, BRAND_ICON_GRADIENT_START, BRAND_ICON_GRADIENT_END
 *
 * @file-header
 */
/**
 * Brand gradient aligned with cg logo (pink → purple → indigo), top → bottom.
 */
export const BRAND_NAV_ICON_GRADIENT = ['#E94EAD', '#A348D0', '#6B3AD9'];

/** Even stops for expo-linear-gradient when using 3 colors. */
export const BRAND_NAV_ICON_GRADIENT_LOCATIONS = [0, 0.5, 1];

export const BRAND_ICON_GRADIENT_START = { x: 0.5, y: 0 };
export const BRAND_ICON_GRADIENT_END = { x: 0.5, y: 1 };

/** Dark pink → dark orange for hero titles and accent text. */
export const HERO_TITLE_TEXT_GRADIENT = ['#BE185D', '#C2410C'];
