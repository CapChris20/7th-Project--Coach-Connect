#!/usr/bin/env node
/**
 * Prints Google OAuth client IDs for Expo / Firebase Auth (Google) setup.
 *
 * Google Cloud does not offer a simple unauthenticated API to "list my OAuth clients".
 * The reliable source is what Firebase puts in the config files you download from the console.
 *
 * Usage:
 *   node scripts/printGoogleOAuthClientIds.js
 *   node scripts/printGoogleOAuthClientIds.js /path/to/google-services.json
 *   node scripts/printGoogleOAuthClientIds.js /path/to/google-services.json /path/to/GoogleService-Info.plist
 *
 * If you omit paths, common locations next to this repo are tried.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function tryLoadDotenv() {
  try {
    require('dotenv').config({ path: path.join(ROOT, '.env') });
  } catch (_) {
    /* optional */
  }
}

/** Firebase `oauth_client[].client_type`: 1=Android, 2=iOS, 3=Web */
const TYPE_LABEL = { 1: 'Android', 2: 'iOS', 3: 'Web' };

function parseGoogleServicesJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  const clients = data?.client?.[0]?.oauth_client;
  if (!Array.isArray(clients) || clients.length === 0) {
    console.warn(`No oauth_client[] found in ${filePath} (wrong file or old format).`);
    return;
  }

  console.log(`\n--- From ${path.relative(ROOT, filePath) || filePath} ---\n`);
  const byType = { 1: [], 2: [], 3: [] };
  for (const c of clients) {
    const id = c?.client_id;
    const t = c?.client_type;
    if (!id || typeof t !== 'number') continue;
    if (!byType[t]) byType[t] = [];
    byType[t].push(id);
    const label = TYPE_LABEL[t] || `type_${t}`;
    console.log(`${label.padEnd(10)} ${id}`);
  }

  const web = byType[3]?.[0];
  const android = byType[1]?.[0];
  const ios = byType[2]?.[0];

  console.log('\n# Paste into .env (Expo reads EXPO_PUBLIC_* at bundle time):\n');
  if (web) console.log(`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=${web}`);
  if (ios) console.log(`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=${ios}`);
  if (android) console.log(`EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=${android}`);
  if (!web) {
    console.log(
      '# No Web client (type 3) in this file. Create a "Web application" OAuth client in Google Cloud Console\n' +
        '# (same GCP project as Firebase) and set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to that client ID.'
    );
  }
}

function parsePlistStrings(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  /** <key>FOO</key>\s*<string>BAR</string> */
  const re = /<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g;
  const map = {};
  let m;
  while ((m = re.exec(xml)) !== null) {
    map[m[1]] = m[2];
  }

  console.log(`\n--- From ${path.relative(ROOT, filePath) || filePath} (plist) ---\n`);
  const interesting = ['CLIENT_ID', 'ANDROID_CLIENT_ID', 'REVERSED_CLIENT_ID'];
  for (const k of interesting) {
    if (map[k]) console.log(`${k.padEnd(22)} ${map[k]}`);
  }

  // iOS plist CLIENT_ID is usually the iOS OAuth client
  if (map.CLIENT_ID) {
    console.log('\n# Usually map plist CLIENT_ID → EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID\n');
    console.log(`EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=${map.CLIENT_ID}`);
  }

  const allIds = new Set();
  const idRe = /(\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com)/g;
  let im;
  while ((im = idRe.exec(xml)) !== null) allIds.add(im[1]);
  if (allIds.size > 1) {
    console.log('\n# All *.googleusercontent.com strings in plist (dedupe check):');
    for (const id of allIds) console.log(`  ${id}`);
  }
}

function printEnvStatus() {
  const keys = [
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
  ];
  console.log('\n--- Current .env (project root) ---\n');
  let any = false;
  for (const k of keys) {
    const v = process.env[k];
    if (!v) {
      console.log(`${k}: (not set)`);
      continue;
    }
    any = true;
    const tail = v.length > 12 ? v.slice(-12) : v;
    console.log(`${k}: set (…${tail})`);
  }
  if (!any) console.log('None of the Google EXPO_PUBLIC_* vars are set in the environment after loading .env.');
}

function defaultPaths() {
  return [
    path.join(ROOT, 'google-services.json'),
    path.join(ROOT, 'android', 'app', 'google-services.json'),
    path.join(ROOT, 'GoogleService-Info.plist'),
    path.join(ROOT, 'ios', 'GoogleService-Info.plist'),
  ];
}

function main() {
  tryLoadDotenv();

  console.log(
    'Coach Connect — Google OAuth client IDs\n' +
      '========================================\n' +
      '\n' +
      'Where to get files if you do not have them:\n' +
      '  1) https://console.firebase.google.com → your project (anatrox-auth)\n' +
      '  2) Project settings (gear) → Your apps\n' +
      '  3) Android app → Download google-services.json\n' +
      '  4) iOS app → Download GoogleService-Info.plist\n' +
      '\n' +
      'Then run:\n' +
      '  node scripts/printGoogleOAuthClientIds.js ~/Downloads/google-services.json ~/Downloads/GoogleService-Info.plist\n'
  );

  printEnvStatus();

  const args = process.argv.slice(2).filter(Boolean);
  const candidates = args.length ? args : defaultPaths();

  let usedJson = false;
  let usedPlist = false;

  for (const p of candidates) {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    if (!fs.existsSync(abs)) continue;
    if (abs.endsWith('.json')) {
      try {
        parseGoogleServicesJson(abs);
        usedJson = true;
      } catch (e) {
        console.error(`Failed to parse ${abs}:`, e?.message || e);
      }
    } else if (abs.endsWith('.plist')) {
      try {
        parsePlistStrings(abs);
        usedPlist = true;
      } catch (e) {
        console.error(`Failed to parse ${abs}:`, e?.message || e);
      }
    }
  }

  if (!usedJson && !usedPlist && args.length === 0) {
    console.log(
      '\n(No google-services.json / GoogleService-Info.plist found in default paths.)\n' +
        'Download them from Firebase and pass the paths as arguments (see above).\n'
    );
  }

  console.log(
    '\n--- Reminders ---\n' +
      '- EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID must be a Web OAuth client (type 3 in google-services.json).\n' +
      '- After editing .env, restart Expo.\n' +
      '- EAS builds need the same vars in EAS Secrets / env, not only your laptop .env.\n' +
      '- Android release: add SHA-1 in Google Cloud → Credentials → your Android OAuth client.\n'
  );
}

main();
