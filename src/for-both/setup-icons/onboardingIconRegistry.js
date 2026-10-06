// Turns an onboarding label into the generated icon file for that choice.
// Flow: clean the label → follow an alias → look up the generated image, with or without a _png suffix.
// Used by new-user setup and the profile card when a row needs an onboarding icon.

import { onboardingIconRegistry as generatedRegistry } from './onboardingIconRegistry.generated';

// ===== NAMED CONSTANTS =====

// App words that do not match the generated filename. The value is the real registry key.
const ICON_KEY_ALIASES = {
  bodyweight: 'bodyweight_only',
};

// Apostrophes and "&" are words, not separators. Everything else between letters becomes one underscore.
const APOSTROPHE_PATTERN = /['’]/g;
const AMPERSAND_PATTERN = /&/g;
const NON_ALNUM_PATTERN = /[^a-z0-9]+/g;
const EDGE_UNDERSCORE_PATTERN = /^_+|_+$/g;
const PNG_SUFFIX_PATTERN = /_png$/;

// ===== HELPER FUNCTIONS =====

// Generated keys have been saved both as `male` and `male_png`. Try both before giving up.
function registryEntry(iconKey) {
  if (!iconKey) return null;
  return generatedRegistry[iconKey] || null;
}

function resolveGenerated(iconKey) {
  if (!iconKey) return null;

  const directMatch = registryEntry(iconKey);
  if (directMatch) return directMatch;

  const pngMatch = registryEntry(`${iconKey}_png`);
  if (pngMatch) return pngMatch;

  if (!iconKey.endsWith('_png')) return null;
  return registryEntry(iconKey.replace(PNG_SUFFIX_PATTERN, ''));
}

// Alias keys are copied onto the public registry so callers can ask for `bodyweight` by name.
function aliasIconEntries() {
  return Object.fromEntries(
    Object.entries(ICON_KEY_ALIASES).map(([aliasKey, targetKey]) => [
      aliasKey,
      resolveGenerated(targetKey),
    ]),
  );
}

// ===== MAIN FUNCTION =====

/**
 * Make a stable icon key from a label: lower case, "&" to "and", spaces and punctuation to underscores.
 * @param {string} rawLabel
 * @returns {string} Empty string when the label is missing.
 */
export const normalizeOnboardingIconKey = (rawLabel) => {
  if (!rawLabel) return '';
  return String(rawLabel)
    .trim()
    .toLowerCase()
    .replace(APOSTROPHE_PATTERN, '')
    .replace(AMPERSAND_PATTERN, 'and')
    .replace(NON_ALNUM_PATTERN, '_')
    .replace(EDGE_UNDERSCORE_PATTERN, '');
};

export const onboardingIconRegistry = {
  ...generatedRegistry,
  ...aliasIconEntries(),
};

// Alias first, then the cleaned key, then the public registry (which already includes aliases).
function iconSourceForNormalizedKey(normalizedKey) {
  const aliasTarget = ICON_KEY_ALIASES[normalizedKey];
  const lookupKey = aliasTarget || normalizedKey;
  return (
    resolveGenerated(lookupKey) ||
    resolveGenerated(normalizedKey) ||
    onboardingIconRegistry[normalizedKey] ||
    null
  );
}

/**
 * Icon module for an onboarding key or a human label. Null when nothing in the registry matches.
 * @param {string} keyOrLabel
 * @returns {object|null}
 */
export const getOnboardingIconSource = (keyOrLabel) => {
  const normalizedKey = normalizeOnboardingIconKey(keyOrLabel);
  return iconSourceForNormalizedKey(normalizedKey);
};
