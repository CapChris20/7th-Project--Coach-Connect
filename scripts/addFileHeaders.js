#!/usr/bin/env node
/**
 * Adds a consistent file header to every .js / .jsx under src/ (except __tests__).
 * Safe to re-run — replaces headers marked with @file-header.
 *
 * Run: node scripts/addFileHeaders.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const HEADER_MARKER = '@file-header';

const AREA_BLURBS = {
  app: 'App entry shell — routes users to Client or Trainer experience after login.',
  auth: 'Authentication and onboarding — sign in, sign up, role selection, first-run setup.',
  client: 'Client-side features — home dashboard, stats, marketplace, files, settings screens.',
  trainer: 'Trainer-side CRM — client roster, sessions, messaging, workout plans, weekly reports.',
  ai: 'AI Coach backend on device — context, tool execution, guards, DeepSeek client.',
  aiChat: 'AI Coach UI — home screen, chat thread, tool modals, voice, persistence.',
  nutrition: 'Nutrition tracking — food logs, macros, search, barcode, meal planning.',
  workouts: 'Workout plans — generation, active session, plan viewer, exercise library.',
  shared: 'Cross-feature utilities — daily metrics, API helpers, UI kit, Firestore helpers.',
  navigation: 'Route names, bottom tabs, deep links, shell navigation helpers.',
  settings: 'App settings, support email, legal copy.',
  utils: 'App-wide helpers — error logging, cache cleanup on logout.',
  lib: 'Small shared libraries used by multiple features.',
  contexts: 'React context providers for global app state.',
  splash: 'Splash / loading screen assets and layout.',
  theme: 'Color tokens and theme constants.',
};

function humanizeBaseName(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return base
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferArea(relPath) {
  const parts = relPath.split(path.sep);
  return parts.slice(0, 2).join('/') || parts[0] || 'src';
}

function inferPurpose(relPath, areaKey) {
  const name = humanizeBaseName(relPath);
  const top = relPath.split(path.sep)[0];
  const blurb = AREA_BLURBS[top] || AREA_BLURBS[areaKey.split('/')[0]] || 'Feature module for Coach Connect.';
  if (/Screen|Modal|Sheet|Card|Banner|Section/i.test(relPath)) {
    return `UI screen or component: ${name}. ${blurb}`;
  }
  if (/Service|Provider|Firestore|Api/i.test(relPath)) {
    return `Data/service layer: ${name}. ${blurb}`;
  }
  if (/hook|use[A-Z]/i.test(path.basename(relPath))) {
    return `React hook: ${name}. ${blurb}`;
  }
  if (/test|spec/i.test(relPath)) {
    return `Tests for ${name}.`;
  }
  return `${name} — ${blurb}`;
}

function extractExports(content) {
  const names = new Set();
  const reExport = /export\s+(?:async\s+)?function\s+(\w+)/g;
  const reConst = /export\s+(?:const|let)\s+(\w+)/g;
  const reDefault = /export\s+default\s+function\s+(\w+)/g;
  const reModule = /module\.exports\s*=\s*\{([^}]+)\}/;
  let m;
  while ((m = reExport.exec(content))) names.add(m[1]);
  while ((m = reConst.exec(content))) names.add(m[1]);
  while ((m = reDefault.exec(content))) names.add(m[1]);
  const mod = content.match(reModule);
  if (mod) {
    mod[1].split(',').forEach((part) => {
      const key = part.trim().split(':')[0].trim();
      if (key && /^\w+$/.test(key)) names.add(key);
    });
  }
  const list = [...names].slice(0, 8);
  return list.length ? list.join(', ') : '(see file)';
}

function stripExistingHeader(content) {
  const trimmed = content.replace(/^\uFEFF/, '');
  const block = trimmed.match(/^\/\*\*[\s\S]*?\*\/\s*/);
  if (!block) return trimmed;
  if (!block[0].includes(HEADER_MARKER) && !block[0].includes('@coachconnect-file-guide')) {
    return trimmed;
  }
  return trimmed.slice(block[0].length);
}

function buildHeader(relPath, content) {
  const title = humanizeBaseName(relPath);
  const area = inferArea(relPath);
  const purpose = inferPurpose(relPath, area);
  const why =
    AREA_BLURBS[relPath.split(path.sep)[0]] ||
    'Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.';
  const exports = extractExports(content);
  return `/**
 * ${title}
 *
 * Purpose: ${purpose}
 * Why it matters: ${why}
 * Area: ${area}
 * Key exports: ${exports}
 *
 * ${HEADER_MARKER}
 */
`;
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(full);
  }
  return out;
}

function main() {
  const files = walk(SRC);
  let updated = 0;
  let skipped = 0;
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const raw = fs.readFileSync(file, 'utf8');
    const body = stripExistingHeader(raw);
    const header = buildHeader(rel, body);
    const next = header + body.replace(/^\n+/, '');
    if (next === raw) {
      skipped += 1;
      continue;
    }
    fs.writeFileSync(file, next);
    updated += 1;
  }
  console.log(`addFileHeaders: ${updated} updated, ${skipped} unchanged (${files.length} scanned).`);
}

main();
