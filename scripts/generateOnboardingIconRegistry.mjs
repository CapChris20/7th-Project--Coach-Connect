import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const iconsDir = path.join(projectRoot, 'src', 'assets', 'icons', 'New Icons');
const outFile = path.join(projectRoot, 'src', 'shared', 'assets', 'onboardingIconRegistry.generated.js');

const normalizeKey = (input) =>
  String(input || '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

if (!fs.existsSync(iconsDir)) {
  console.error(`Icon directory not found: ${iconsDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(iconsDir)
  .filter((f) => f.toLowerCase().endsWith('.png'))
  .sort((a, b) => a.localeCompare(b));

const lines = [];
lines.push('// AUTO-GENERATED (but checked in). Source icons live in `src/assets/icons/New Icons/`.');
lines.push('// If you add/remove icons, re-run: `npm run gen:onboarding-icons`');
lines.push('//');
lines.push('// Note: `require()` paths must be static strings for Metro bundler.');
lines.push('');
lines.push('export const onboardingIconRegistry = {');
lines.push('  // Inputs (existing)');
lines.push("  weight: require('../../assets/icons/scales.png'),");
lines.push("  height: require('../../assets/icons/height.png'),");
lines.push('');
lines.push('  // New Icons pack');

for (const filename of files) {
  const base = filename.replace(/\\.png$/i, '');
  const key = normalizeKey(base);
  const requirePath = `../../assets/icons/New Icons/${filename}`;
  lines.push(`  ${JSON.stringify(key)}: require(${JSON.stringify(requirePath)}),`);
}

lines.push('};');
lines.push('');

fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
console.log(`✅ Wrote ${path.relative(projectRoot, outFile)} with ${files.length} icons`);






