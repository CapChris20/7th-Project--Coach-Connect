import { onboardingIconRegistry as generatedRegistry } from './onboardingIconRegistry.generated.js';

// Manual aliases so app domain keys don't have to match filename keys.
const aliases = {
  // Equipment values used in onboarding data
  bodyweight: 'bodyweight_only',
};

export const normalizeOnboardingIconKey = (input) => {
  if (!input) return '';
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

const resolveGenerated = (key) => {
  if (!key) return null;
  // Support both styles: `male` and `male_png` (in case generated keys were edited)
  const direct = generatedRegistry[key];
  if (direct) return direct;
  const withPng = generatedRegistry[`${key}_png`];
  if (withPng) return withPng;
  if (key.endsWith('_png')) {
    const without = generatedRegistry[key.replace(/_png$/, '')];
    if (without) return without;
  }
  return null;
};

export const onboardingIconRegistry = {
  ...generatedRegistry,
  // Alias keys also directly available as keys (nice DX)
  ...(Object.fromEntries(
    Object.entries(aliases).map(([aliasKey, targetKey]) => [aliasKey, resolveGenerated(targetKey)])
  )),
};

export const getOnboardingIconSource = (keyOrLabel) => {
  const normalized = normalizeOnboardingIconKey(keyOrLabel);
  const aliasTarget = aliases[normalized];
  const key = aliasTarget || normalized;
  return resolveGenerated(key) || resolveGenerated(normalized) || onboardingIconRegistry[normalized] || null;
};


