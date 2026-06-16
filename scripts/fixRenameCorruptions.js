#!/usr/bin/env node
/**
 * Revert over-aggressive import rewrites from rename passes.
 * Safe to run after applyFileRenames if package names or Firestore keys were corrupted.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const REVERTS = [
  ['@react-native-async-storageHelpers/async-storageHelpers', '@react-native-async-storage/async-storage'],
  ["from 'firebase/storageHelpers'", "from 'firebase/storage'"],
  ['jest.mock(\'firebase/storageHelpers\'', 'jest.mock(\'firebase/storage\''],
  ['../../ActiveWorkoutScreens/', '../../workouts/'],
  ['../ActiveWorkoutScreens/', '../workouts/'],
  ['src/ActiveWorkoutScreens/', 'src/workouts/'],
  ['active-ActiveWorkoutScreen', 'active-workout'],
  ['fitness-calculateFitnessMetrics', 'fitness-calculations'],
  ['../../../firebaseConfig/pushNotificationCopy.json', '../../../config/pushNotificationCopy.json'],
  ['server/lib/gatherCoachContextFromUser.js', 'server/lib/coachPersonalDataRouting.js'],
  ['server/lib/validateCoachToolProposal.js', 'server/lib/coachToolProposalGuards.js'],
  ['dashboard_ActiveWorkoutScreens', 'dashboard_workouts'],
  ['ActiveWorkoutScreensPerWeek', 'workoutsPerWeek'],
  ['ActiveWorkoutScreensLogged', 'workoutsLogged'],
  ['main_ActiveWorkoutScreens', 'main_workouts'],
  // React Navigation API — never rename `routes` property to `routeNames`
  ['CommonActions.reset({ index: 0, routeNames:', 'CommonActions.reset({ index: 0, routes:'],
  ['state?.routeNames?.length', 'state?.routes?.length'],
];

function walkFiles(dir, out = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  const stat = fs.statSync(full);
  if (stat.isFile()) {
    if (/\.(js|jsx|mjs|cjs|md|json|sh)$/.test(dir) || !path.basename(dir).includes('.')) out.push(full);
    return out;
  }
  for (const name of fs.readdirSync(full)) {
    if (name === 'node_modules' || name === '.git') continue;
    walkFiles(path.join(dir, name), out);
  }
  return out;
}

let updated = 0;
for (const r of ['src', 'server', 'scripts', 'App.js', 'utils']) {
  for (const file of walkFiles(r)) {
    if (file.endsWith('fixRenameCorruptions.js')) continue;
    let content = fs.readFileSync(file, 'utf8');
    let next = content;
    for (const [bad, good] of REVERTS) next = next.split(bad).join(good);
    if (next !== content) {
      fs.writeFileSync(file, next);
      updated += 1;
    }
  }
}
console.log(`Corruption fix: ${updated} files updated.`);
