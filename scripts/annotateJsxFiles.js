#!/usr/bin/env node
/**
 * Adds readable block comments to every .jsx file under src/
 * Safe to re-run. Does NOT change runtime behavior.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const MARKER = '@coachconnect-file-guide';

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (ent.name.endsWith('.jsx')) acc.push(p);
  }
  return acc;
}

function humanizeFilename(name) {
  return name
    .replace(/\.jsx$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim();
}

function describeFolder(relDir) {
  const map = {
    app: 'App shell (ClientApp, TrainerApp, auth routing)',
    auth: 'Login, onboarding, password reset',
    trainer: 'Trainer CRM — clients, dashboard, sessions, documents',
    client: 'Client home, marketplace, daily metrics',
    nutrition: 'Food logging, macros, barcode, meal plans',
    aiChat: 'AI coach chat UI, tool modals, voice',
    workouts: 'Workout plans, active workout, exercise library',
    profile: 'User profile screens',
    settings: 'Settings, legal, support screens',
    shared: 'Shared UI, messaging, notes/files, components',
    navigation: 'Tab bar, navigators, routing helpers',
  };
  const top = relDir.split('/')[0];
  return map[top] || relDir.replace(/\//g, ' → ');
}

function buildFileHeader(relPath) {
  const rel = relPath.replace(/^src\//, '');
  const dir = path.dirname(rel);
  const base = path.basename(rel, '.jsx');
  const title = humanizeFilename(base);
  const folderHint = describeFolder(dir);
  return `/**
 * ${title}
 * Location: src/${rel}
 * Area: ${folderHint}
 *
 * How to read this file:
 * 1. Imports — dependencies and child components
 * 2. Constants / helpers — theme tokens, small pure functions
 * 3. Sub-components — UI pieces used only in this file
 * 4. Main export — state → effects → handlers → JSX return
 *
 * ${MARKER}
 */\n\n`;
}

function isPascalCase(name) {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function lineHasCommentAbove(out, idx) {
  if (idx <= 0) return false;
  const prev = out[idx - 1].trim();
  const prev2 = idx >= 2 ? out[idx - 2].trim() : '';
  return (
    prev.startsWith('//') ||
    prev.startsWith('*') ||
    prev.endsWith('*/') ||
    prev2.startsWith('/**')
  );
}

function isTopLevelDecl(line) {
  if (/^export default function \w+/.test(line)) return true;
  if (/^export function \w+/.test(line)) return true;
  if (/^function \w+\(/.test(line)) return true;
  if (/^const \w+ = (\(|function)/.test(line)) return true;
  if (/^export const \w+ = (\(|function)/.test(line)) return true;
  return false;
}

function extractDeclName(line) {
  const m =
    line.match(/^export default function (\w+)/) ||
    line.match(/^export function (\w+)/) ||
    line.match(/^function (\w+)/) ||
    line.match(/^export const (\w+) =/) ||
    line.match(/^const (\w+) =/);
  return m ? m[1] : 'Component';
}

function componentBlurb(name) {
  const n = name.toLowerCase();
  if (n.includes('screen')) return 'Full screen UI — what the user sees on this route.';
  if (n.includes('modal')) return 'Modal overlay for a focused task.';
  if (n.includes('container')) return 'Data + flow wrapper; loads state and swaps child screens.';
  if (n.includes('tab')) return 'One tab panel inside a tabbed screen.';
  if (n.includes('section')) return 'One section block inside a larger screen.';
  if (n.includes('card')) return 'Card widget — summary or list grouping.';
  if (n.includes('banner') || n.includes('hero')) return 'Hero / banner at the top of a screen.';
  if (n.includes('sheet')) return 'Bottom sheet or slide-over panel.';
  return 'React component — props in, JSX out.';
}

function helperBlurb(name) {
  const n = name.toLowerCase();
  if (n.startsWith('get') || n.startsWith('fetch') || n.startsWith('load')) return 'Fetches or derives data.';
  if (n.startsWith('is') || n.startsWith('has') || n.startsWith('can')) return 'Boolean check / guard.';
  if (n.startsWith('format') || n.startsWith('normalize') || n.startsWith('parse')) return 'Formats or normalizes values.';
  if (n.startsWith('handle') || n.startsWith('on')) return 'Event handler callback.';
  if (n.includes('style')) return 'StyleSheet factory for this file.';
  return 'Small helper used in this file only.';
}

function stripBadAutoComments(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].trim() === '/**' &&
      i + 2 < lines.length &&
      lines[i + 2].trim() === '*/'
    ) {
      const body = lines[i + 1];
      if (body.includes('React component — see props') || body.includes('React component — props in')) {
        const nameMatch = body.match(/^\s*\*\s*(\w+)\s*—/);
        const name = nameMatch ? nameMatch[1] : '';
        if (name && !isPascalCase(name)) {
          i += 2;
          continue;
        }
      }
    }
    out.push(lines[i]);
  }
  return out;
}

function findMainExportRange(lines) {
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^export default function [A-Z]/.test(line)) {
      start = i;
      break;
    }
    if (/^export const [A-Z]\w* = /.test(line) && (line.includes('=>') || lines.slice(i, i + 5).some((l) => l.includes('=>')))) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;

  let bodyOpen = -1;
  for (let i = start; i < Math.min(start + 8, lines.length); i++) {
    if (lines[i].includes('{')) {
      bodyOpen = i;
      break;
    }
  }
  if (bodyOpen < 0) return null;

  let depth = 0;
  let started = false;
  for (let i = bodyOpen; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth++;
        started = true;
      } else if (ch === '}') {
        depth--;
        if (started && depth === 0) return { start: bodyOpen, end: i };
      }
    }
  }
  return null;
}

function insertSectionMarkers(lines, range) {
  if (!range) return lines;
  const out = [...lines];
  let addedState = false;
  let addedEffects = false;
  let addedHandlers = false;
  let addedRender = false;

  for (let i = range.start + 1; i <= range.end; i++) {
    const line = out[i];

    if (!addedState && /^\s{2}const \[/.test(line) && line.includes('useState')) {
      if (!lineHasCommentAbove(out, i) && !String(out[i - 1]).includes('--- State ---')) {
        out.splice(i, 0, '  // --- State (local UI flags, form values, lists) ---');
        addedState = true;
        range.end++;
        i++;
      }
    }

    if (!addedEffects && /^\s{2}useEffect\s*\(/.test(line)) {
      if (!lineHasCommentAbove(out, i) && !String(out[i - 1]).includes('--- Effects ---')) {
        out.splice(i, 0, '  // --- Effects (fetch data, Firestore listeners, sync on prop changes) ---');
        addedEffects = true;
        range.end++;
        i++;
      }
    }

    if (!addedHandlers && /^\s{2}const (handle|on[A-Z])\w* =/.test(line)) {
      if (!lineHasCommentAbove(out, i) && !String(out[i - 1]).includes('--- Handlers ---')) {
        out.splice(i, 0, '  // --- Handlers (button taps, form submit, navigation callbacks) ---');
        addedHandlers = true;
        range.end++;
        i++;
      }
    }

    if (!addedRender && /^\s{2}return\s*\(/.test(line)) {
      if (!lineHasCommentAbove(out, i) && !String(out[i - 1]).includes('--- Render ---')) {
        out.splice(i, 0, '  // --- Render (JSX returned to React Native) ---');
        addedRender = true;
        range.end++;
        i++;
      }
    }
  }
  return out;
}

function annotateFile(absPath) {
  const relFromRoot = path.relative(ROOT, absPath).replace(/\\/g, '/');
  let content = fs.readFileSync(absPath, 'utf8');
  let lines = content.split('\n');

  if (!content.includes(MARKER)) {
    lines = (buildFileHeader(relFromRoot) + content).split('\n');
  }

  lines = stripBadAutoComments(lines);

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isTopLevelDecl(line) && !lineHasCommentAbove(out, out.length)) {
      const name = extractDeclName(line);
      if (isPascalCase(name)) {
        out.push('/**');
        out.push(` * ${name} — ${componentBlurb(name)}`);
        out.push(' */');
      } else {
        out.push(`// Helper: ${name} — ${helperBlurb(name)}`);
      }
    }
    out.push(line);
  }

  let finalLines = out;
  const mainRange = findMainExportRange(finalLines);
  finalLines = insertSectionMarkers(finalLines, mainRange);

  const next = finalLines.join('\n');
  if (next !== content) {
    fs.writeFileSync(absPath, next, 'utf8');
    return true;
  }
  return false;
}

const files = walk(SRC);
let updated = 0;
for (const f of files) {
  if (annotateFile(f)) updated++;
}
console.log(`Updated ${updated}/${files.length} JSX files under src/`);
