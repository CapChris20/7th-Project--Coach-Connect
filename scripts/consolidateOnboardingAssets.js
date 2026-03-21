/**
 * Copies all icons + lottie JSONs used by `src/auth/OnboardingScreen.js`
 * into a single folder for easier organization.
 *
 * Run:
 *   node scripts/consolidateOnboardingAssets.js
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const destDir = path.join(repoRoot, 'src/assets/onboarding-consolidated');

const assets = [
  // Icons (used by getOnboardingIconSource(...) in OnboardingScreen)
  { from: path.join(repoRoot, 'src/assets/icons/scales.png'), to: 'scales.png' },
  { from: path.join(repoRoot, 'src/assets/icons/height.png'), to: 'height.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/Age.png'), to: 'Age.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/male.png'), to: 'male.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/female.png'), to: 'female.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/Other.png'), to: 'Other.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/prefer not to say.png'), to: 'prefer not to say.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/Beginner.png'), to: 'Beginner.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/Intermediate.png'), to: 'Intermediate.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/Advanced.png'), to: 'Advanced.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/Full Gym.png'), to: 'Full Gym.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/dumbbells.png'), to: 'dumbbells.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/Resistance Bands.png'), to: 'Resistance Bands.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/Pull Up Bar.png'), to: 'Pull Up Bar.png' },
  { from: path.join(repoRoot, 'src/assets/icons/New Icons/Bodyweight Only.png'), to: 'Bodyweight Only.png' },

  // Lottie JSONs (used in OnboardingScreen - both client + trainer flows)
  { from: path.join(repoRoot, 'src/assets/lottie/personal-info.json'), to: 'personal-info.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/fitness-experience.json'), to: 'fitness-experience.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/fitness-goal.json'), to: 'fitness-goal.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/equipment.json'), to: 'equipment.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/training-frequency.json'), to: 'training-frequency.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/injuries.json'), to: 'injuries.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/trainer-code.json'), to: 'trainer-code.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/role-selection.json'), to: 'role-selection.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/certifications.json'), to: 'certifications.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/experience-timeline.json'), to: 'experience-timeline.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/specialties.json'), to: 'specialties.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/philosophy.json'), to: 'philosophy.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/rates.json'), to: 'rates.json' },
  { from: path.join(repoRoot, 'src/assets/lottie/invite-code.json'), to: 'invite-code.json' },
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyAsset({ from, to }) {
  if (!fs.existsSync(from)) {
    console.warn(`Missing asset: ${path.relative(repoRoot, from)}`);
    return;
  }
  const targetPath = path.join(destDir, to);
  fs.copyFileSync(from, targetPath);
}

function main() {
  ensureDir(destDir);
  let copied = 0;

  for (const a of assets) {
    const before = fs.existsSync(a.from);
    copyAsset(a);
    if (before) copied += 1;
  }

  // eslint-disable-next-line no-console
  console.log(`Copied ${copied} onboarding assets into: ${path.relative(repoRoot, destDir)}`);
}

main();

