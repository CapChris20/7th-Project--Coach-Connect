#!/usr/bin/env node
/** Fix import paths broken by src/ folder rename. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Dirs where files are one level deeper than ai-coach root (need ../../../ for src siblings). */
const NESTED_AI_COACH_DIRS = [
  'src/ai-coach/server-logic/tools',
  'src/ai-coach/server-logic/context',
  'src/ai-coach/server-logic/chat-api',
  'src/ai-coach/server-logic/services',
  'src/ai-coach/server-logic/trainer-messaging',
  'src/ai-coach/server-logic/macro-recalibration',
  'src/ai-coach/chat-ui/chat-thread',
  'src/ai-coach/chat-ui/screens',
  'src/ai-coach/chat-ui/persistence',
  'src/ai-coach/chat-ui/tool-modals',
  'src/ai-coach/chat-ui/components',
  'src/ai-coach/chat-ui/lib',
  'src/ai-coach/chat-ui/voice',
  'src/ai-coach/chat-ui/chat-home',
];

const GLOBAL_REPLACEMENTS = [
  { dir: 'src/ai-coach', from: "from '../../app-start/", to: "from '../../../app-start/" },
  { dir: 'src/ai-coach', from: "from '../../ai-coach/tools/", to: "from '../../tools/" },
  { dir: 'src/ai-coach', from: "require('../../ai-coach/tools/", to: "require('../../tools/" },
  { dir: 'src/ai-coach', from: "from '../../ai-coach/chat-ui/", to: "from '../../chat-ui/" },
  { dir: 'src/metrics', from: "from '../utils/", to: "from '../../shared-utils/" },
  { dir: 'src/metrics', from: "require('../utils/", to: "require('../../shared-utils/" },
];

const NESTED_REPLACEMENTS = [
  ['../../shared/', '../../../shared/'],
  ['../../shared-utils/', '../../../shared-utils/'],
  ['../../shared-ui/', '../../../shared-ui/'],
  ['../../metrics/', '../../../metrics/'],
  ['../../nutrition/', '../../../nutrition/'],
  ['../../notifications/', '../../../notifications/'],
  ['../../messaging/', '../../../messaging/'],
  ['../../auth/', '../../../auth/'],
  ['../../client-app/', '../../../client-app/'],
  ['../../trainer-app/', '../../../trainer-app/'],
  ['../../workouts/', '../../../workouts/'],
];

function walk(dir, out = []) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return out;
  for (const name of fs.readdirSync(full)) {
    if (name === 'node_modules') continue;
    const rel = path.join(dir, name);
    const abs = path.join(ROOT, rel);
    if (fs.statSync(abs).isDirectory()) walk(rel, out);
    else if (/\.(js|jsx|mjs|cjs)$/.test(name)) out.push(abs);
  }
  return out;
}

function applyReplacements(file, pairs) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of pairs) {
    const re = new RegExp(`from '${from.replace(/\//g, '\\/')}`, 'g');
    if (!re.test(content)) continue;
    content = content.replace(re, `from '${to}`);
    changed = true;
  }
  if (changed) fs.writeFileSync(file, content);
  return changed;
}

const MESSAGING_REPLACEMENTS = [
  ['../../server-logic/', '../ai-coach/server-logic/'],
  ['../../app-start/', '../app-start/'],
  ['../../shared-ui/', '../shared-ui/'],
  ['../../shared/', '../shared/'],
  ['../../trainer-app/', '../trainer-app/'],
  ['../../navigation/', '../navigation/'],
  ['../../metrics/', '../metrics/'],
  ['../../notifications/', '../notifications/'],
];

const TOP_LEVEL_SRC_REPLACEMENTS = [
  ['../../server-logic/', '../../ai-coach/server-logic/'],
];

let total = 0;

for (const { dir, from, to } of GLOBAL_REPLACEMENTS) {
  for (const file of walk(dir)) {
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes(from)) continue;
    fs.writeFileSync(file, content.split(from).join(to));
    total++;
  }
}

for (const dir of NESTED_AI_COACH_DIRS) {
  for (const file of walk(dir)) {
    if (applyReplacements(file, NESTED_REPLACEMENTS)) total++;
  }
}

for (const file of walk('src/messaging')) {
  if (applyReplacements(file, MESSAGING_REPLACEMENTS)) total++;
}

for (const dir of ['src/trainer-app', 'src/workouts', 'src/client-app']) {
  for (const file of walk(dir)) {
    if (applyReplacements(file, TOP_LEVEL_SRC_REPLACEMENTS)) total++;
  }
}

console.log(`Fixed ${total} files`);
