// Turns an onboarding label into the generated icon file for that choice.
// Flow: clean the label → follow an alias → look up the generated image, with or without a _png suffix.
// Used by new-user setup and the profile card when a row needs an onboarding icon.

import { onboardingIconRegistry as generatedRegistry } from './onboardingIconRegistry.generated';

// ===== NAMED CONSTANTS =====

// App words that do not match the generated filename. The value is the real registry key.
// Manipulate here: add an alias when product copy says "bodyweight" but the asset key is bodyweight_only.
const ICON_KEY_ALIASES = {
  bodyweight: 'bodyweight_only',
};

// Apostrophes and "&" are words, not separators. Everything else between letters becomes one underscore.
const APOSTROPHE_PATTERN = /['’]/g;
const AMPERSAND_PATTERN = /&/g;
const NON_ALNUM_PATTERN = /[^a-z0-9]+/g;
const EDGE_UNDERSCORE_PATTERN = /^_+|_+$/g;
const PNG_SUFFIX_PATTERN = /_png$/;
const PNG_KEY_SUFFIX = '_png';

// ===== MAIN FUNCTION =====

/**
 * Make a stable icon key from a label: lower case, "&" to "and", spaces and punctuation to underscores.
 * @param {string} rawLabel
 * @returns {string}
 */
export function normalizeOnboardingIconKey(rawLabel) {
  if (!rawLabel) return '';

  // 1. Trim + lower case so "Full Body" and "full body" share a key.
  let cleanedKey = String(rawLabel).trim().toLowerCase();

  // 2. Drop apostrophes (don't → dont). Keep letters stuck together.
  cleanedKey = cleanedKey.replace(APOSTROPHE_PATTERN, '');

  // 3. Turn "&" into the word "and" before we crush other punctuation.
  cleanedKey = cleanedKey.replace(AMPERSAND_PATTERN, 'and');

  // 4. Any leftover non-letter/digit run becomes one underscore.
  cleanedKey = cleanedKey.replace(NON_ALNUM_PATTERN, '_');

  // 5. Strip leading/trailing underscores so keys stay tidy.
  cleanedKey = cleanedKey.replace(EDGE_UNDERSCORE_PATTERN, '');

  return cleanedKey;
}

/**
 * Icon module for an onboarding key or a human label. Null when nothing in the registry matches.
 * @param {string} keyOrLabel
 * @returns {*|null}
 */
export function getOnboardingIconSource(keyOrLabel) {
  // 1. Normalize whatever the caller passed (label or key).
  const normalizedKey = normalizeOnboardingIconKey(keyOrLabel);

  // 2. Resolve alias / generated / public-registry fallbacks.
  return findIconSourceForKey(normalizedKey);
}

// Public registry = generated assets + alias shortcuts callers can ask for by short name.
export const onboardingIconRegistry = {
  ...generatedRegistry,
  ...buildAliasRegistryEntries(),
};

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging registry keys or _png fallbacks

/**
 * Read one key from the generated map. Missing keys return null (not undefined).
 */
function registryEntry(iconKey) {
  if (!iconKey) return null;
  const generatedEntry = generatedRegistry[iconKey];
  if (!generatedEntry) return null;
  return generatedEntry;
}

/**
 * Generated keys have been saved both as `male` and `male_png`. Try both before giving up.
 */
function resolveGenerated(iconKey) {
  if (!iconKey) return null;

  const directMatch = registryEntry(iconKey);
  if (directMatch) return directMatch;

  const pngMatch = registryEntry(`${iconKey}${PNG_KEY_SUFFIX}`);
  if (pngMatch) return pngMatch;

  const keyAlreadyHasPngSuffix = iconKey.endsWith(PNG_KEY_SUFFIX);
  if (!keyAlreadyHasPngSuffix) return null;

  const keyWithoutPng = iconKey.replace(PNG_SUFFIX_PATTERN, '');
  return registryEntry(keyWithoutPng);
}

/**
 * Alias keys are copied onto the public registry so callers can ask for `bodyweight` by name.
 * Plain loop (no Object.fromEntries) so the recipe stays junior-readable.
 */
function buildAliasRegistryEntries() {
  const aliasEntries = {};
  const aliasKeys = Object.keys(ICON_KEY_ALIASES);

  for (let i = 0; i < aliasKeys.length; i += 1) {
    const aliasKey = aliasKeys[i];
    const targetKey = ICON_KEY_ALIASES[aliasKey];
    aliasEntries[aliasKey] = resolveGenerated(targetKey);
  }

  return aliasEntries;
}

/**
 * Walk alias → generated → public registry until something matches.
 */
function findIconSourceForKey(normalizedKey) {
  const aliasTarget = ICON_KEY_ALIASES[normalizedKey];
  const lookupKey = aliasTarget || normalizedKey;

  const fromAliasOrLookup = resolveGenerated(lookupKey);
  if (fromAliasOrLookup) return fromAliasOrLookup;

  const fromNormalizedKey = resolveGenerated(normalizedKey);
  if (fromNormalizedKey) return fromNormalizedKey;

  const fromPublicRegistry = onboardingIconRegistry[normalizedKey];
  if (fromPublicRegistry) return fromPublicRegistry;

  return null;
}
