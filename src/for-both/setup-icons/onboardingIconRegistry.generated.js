// Maps onboarding answer ids to the pictures in src/assets/onboarding-consolidated.
// Flow: a step looks up a key in this object. Metro needs each require() path to be a literal string.
// Used by: the setup wizard. If you add an icon, re-run npm run gen:onboarding-icons.

// ===== NAMED CONSTANTS =====

// AUTO-GENERATED (but checked in). Source icons live in `src/assets/onboarding-consolidated/`.
// If you add/remove icons, re-run: `npm run gen:onboarding-icons`
//
// Note: `require()` paths must be static strings for Metro bundler.

const onboardingIconRegistry = {
  // Step 1 inputs
  weight: require('../../assets/onboarding-consolidated/scales.png'),
  scales: require('../../assets/onboarding-consolidated/scales.png'),
  height: require('../../assets/onboarding-consolidated/height.png'),
  age: require('../../assets/onboarding-consolidated/Age.png'),

  advanced: require('../../assets/onboarding-consolidated/Advanced.png'),
  adv: require('../../assets/icons/handoff/adv.png'),
  beginner: require('../../assets/onboarding-consolidated/Beginner.png'),
  bodyweight_only: require('../../assets/onboarding-consolidated/bodyweight_only.png'),
  bodyweight: require('../../assets/onboarding-consolidated/bodyweight_only.png'),
  body: require('../../assets/icons/handoff/body.png'),
  dumbbells: require('../../assets/onboarding-consolidated/dumbbells.png'),
  female: require('../../assets/onboarding-consolidated/female.png'),
  full_gym: require('../../assets/onboarding-consolidated/full_gym.png'),
  gym: require('../../assets/icons/handoff/gym.png'),
  intermediate: require('../../assets/onboarding-consolidated/Intermediate.png'),
  inter: require('../../assets/icons/handoff/inter.png'),
  male: require('../../assets/onboarding-consolidated/male.png'),
  other: require('../../assets/onboarding-consolidated/Other.png'),
  prefer_not_to_say: require('../../assets/onboarding-consolidated/prefer_not_to_say.png'),
  pull_up_bar: require('../../assets/onboarding-consolidated/pull_up_bar.png'),
  pullup: require('../../assets/icons/handoff/pullup.png'),
  resistance_bands: require('../../assets/onboarding-consolidated/resistance_bands.png'),
  bands: require('../../assets/icons/handoff/bands.png'),
  // Goal tiles (steps 2–3) — Design Law iconKeys → owner handoff art
  muscle: require('../../assets/icons/handoff/muscle.png'),
  hydration: require('../../assets/icons/handoff/hydration.png'),
  energy: require('../../assets/icons/handoff/energy.png'),
  stress: require('../../assets/icons/handoff/stress.png'),
  schedule: require('../../assets/icons/handoff/schedule.png'),
};

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

export { onboardingIconRegistry };
