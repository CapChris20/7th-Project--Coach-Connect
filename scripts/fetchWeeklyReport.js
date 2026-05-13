#!/usr/bin/env node
/**
 * Fetch weekly report for a specific user and week
 * Usage: node scripts/fetchWeeklyReport.js <userId> [weekStart]
 * Example: node scripts/fetchWeeklyReport.js SPHkiuTpEbX85ek8rgzLODpuF0r1
 *          node scripts/fetchWeeklyReport.js SPHkiuTpEbX85ek8rgzLODpuF0r1 2026-05-05
 *
 * Credentials (same order as server/index.js and scripts/inspectTrainerMarketplacePrices.js):
 * - FIREBASE_SERVICE_ACCOUNT (JSON string)
 * - FIREBASE_SERVICE_ACCOUNT_PATH (absolute or relative to cwd)
 * - GOOGLE_APPLICATION_CREDENTIALS (standard GCP env)
 * - server/serviceAccountKey.json
 * - serviceAccountKey.json (project root)
 *
 * Loads ../.env automatically so EXPO_PUBLIC_FIREBASE_PROJECT_ID is available if needed.
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const admin = require('firebase-admin');

function firebaseProjectIdHint() {
  const pid = (
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    ''
  ).trim();
  return pid || null;
}

function appOptions(credential, parsedServiceAccount) {
  const fromCert = parsedServiceAccount && parsedServiceAccount.project_id;
  const projectId = fromCert || firebaseProjectIdHint();
  if (projectId) return { credential, projectId };
  return { credential };
}

const PROJECT_ROOT = path.join(__dirname, '..');

/** Resolve a user-supplied path: try cwd first, then project root (works even if you run from another folder). */
function credentialPathCandidates(relOrAbs) {
  if (!relOrAbs || !String(relOrAbs).trim()) return [];
  const trimmed = String(relOrAbs).trim();
  if (path.isAbsolute(trimmed)) return [trimmed];
  return [path.join(process.cwd(), trimmed), path.join(PROJECT_ROOT, trimmed)];
}

function tryLoadParsedJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return null;
  }
}

function tryLoadFromPathEnv(envValue) {
  if (!envValue || !envValue.trim()) return null;
  const placeholder =
    envValue.includes('path/to') ||
    envValue.includes('/your/') ||
    envValue.endsWith('your/serviceAccountKey.json');
  if (placeholder) {
    console.error(
      'FIREBASE_SERVICE_ACCOUNT_PATH looks like a documentation placeholder, not a real file.'
    );
    console.error(`Current value: ${envValue}`);
    console.error(
      'Replace it with the real path to your downloaded JSON (Firebase Console → Project settings → Service accounts → Generate new private key).'
    );
    return null;
  }
  for (const candidate of credentialPathCandidates(envValue)) {
    const parsed = tryLoadParsedJson(candidate);
    if (parsed && parsed.type === 'service_account' && parsed.private_key) {
      return { parsed, resolvedPath: candidate };
    }
  }
  console.error(`Could not read a valid service account JSON from FIREBASE_SERVICE_ACCOUNT_PATH.`);
  console.error('Tried:', credentialPathCandidates(envValue).join(', ') || '(none)');
  return null;
}

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && typeof raw === 'string' && raw.trim().length > 0) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON. Fix the string or unset it and use a JSON file instead.'
      );
    }
    admin.initializeApp(appOptions(admin.credential.cert(parsed), parsed));
    return;
  }

  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (pathEnv && pathEnv.trim()) {
    const loaded = tryLoadFromPathEnv(pathEnv);
    if (loaded) {
      admin.initializeApp(appOptions(admin.credential.cert(loaded.parsed), loaded.parsed));
      return;
    }
  }

  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac && gac.trim()) {
    for (const candidate of credentialPathCandidates(gac)) {
      const parsed = tryLoadParsedJson(candidate);
      if (parsed && parsed.type === 'service_account') {
        admin.initializeApp(appOptions(admin.credential.cert(parsed), parsed));
        return;
      }
    }
  }

  const fallbacks = [
    path.join(PROJECT_ROOT, 'server', 'serviceAccountKey.json'),
    path.join(PROJECT_ROOT, 'serviceAccountKey.json'),
  ];
  for (const fp of fallbacks) {
    const parsed = tryLoadParsedJson(fp);
    if (parsed) {
      admin.initializeApp(appOptions(admin.credential.cert(parsed), parsed));
      return;
    }
  }

  // Default Firebase Console download name: *-firebase-adminsdk-*.json under server/
  const serverDir = path.join(PROJECT_ROOT, 'server');
  if (fs.existsSync(serverDir)) {
    const sdkNames = fs
      .readdirSync(serverDir)
      .filter((n) => n.endsWith('.json') && n.includes('firebase-adminsdk'))
      .sort();
    for (const name of sdkNames) {
      const fp = path.join(serverDir, name);
      const parsed = tryLoadParsedJson(fp);
      if (parsed && parsed.type === 'service_account') {
        admin.initializeApp(appOptions(admin.credential.cert(parsed), parsed));
        return;
      }
    }
  }

  console.error('No Firebase Admin credentials found. Checked (gitignored files must exist on disk):');
  fallbacks.forEach((fp) => console.error(`  - ${fp}`));
  console.error(`  - ${path.join(PROJECT_ROOT, 'server', '*firebase-adminsdk*.json')}`);
  console.error('');
  console.error('Fix one of these:');
  console.error(`  1) Save your key as: ${path.join(PROJECT_ROOT, 'server', 'serviceAccountKey.json')}`);
  console.error(`  2) Or project root: ${path.join(PROJECT_ROOT, 'serviceAccountKey.json')}`);
  console.error('  3) Or add to .env: FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/your-real-download.json');
  console.error('     (must be the actual path — not /path/to/your/...)');
  throw new Error('Firebase Admin init failed');
}

try {
  initFirebaseAdmin();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const db = admin.firestore();

async function fetchWeeklyReport() {
  const userId = process.argv[2];
  const weekStart = process.argv[3];

  if (!userId) {
    console.error('Usage: node scripts/fetchWeeklyReport.js <userId> [weekStart]');
    console.error('Example: node scripts/fetchWeeklyReport.js SPHkiuTpEbX85ek8rgzLODpuF0r1');
    process.exit(1);
  }

  try {
    console.log(`📋 Fetching weekly reports for user: ${userId}`);

    const weeklySummariesRef = db.collection('users').doc(userId).collection('weeklySummaries');
    const snapshot = await weeklySummariesRef.get();
    const docsSorted = (snapshot.docs || []).slice().sort((a, b) => a.id.localeCompare(b.id));

    if (!docsSorted.length) {
      console.log('No weekly reports found for this user');
      process.exit(0);
    }

    console.log(`\nFound ${docsSorted.length} weekly report(s)\n`);

    let targetDoc;

    if (weekStart) {
      targetDoc = docsSorted.find((doc) => doc.id === weekStart);
      if (!targetDoc) {
        console.log(`No report found for week starting ${weekStart}`);
        console.log('\nAvailable week doc ids:');
        docsSorted.forEach((doc) => {
          console.log(`  ${doc.id}`);
        });
        process.exit(1);
      }
    } else {
      targetDoc = docsSorted[0];
      console.log('Week 1 = earliest report by document id (YYYY-MM-DD):\n');
    }

    const data = targetDoc.data();

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📊 WEEKLY REPORT: ${data.weekStart} → ${data.weekEnd}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    console.log('📈 QUICK STATS');
    console.log('─────────────────────────────────────────────────────');
    console.log(`Avg Sleep:   ${data.avgSleep} hrs`);
    console.log(`Avg Water:   ${data.avgWater} oz`);
    console.log(`Avg Steps:   ${data.avgSteps}`);
    console.log(`Avg Energy:  ${data.avgEnergy}/5`);
    console.log(`Avg Weight:  ${data.avgWeight} lbs\n`);

    console.log('📝 SUMMARY');
    console.log('─────────────────────────────────────────────────────');
    console.log(data.summary);
    console.log();

    if (Array.isArray(data.dayBreakdown) && data.dayBreakdown.length > 0) {
      console.log('📅 DAY-BY-DAY');
      console.log('─────────────────────────────────────────────────────');
      const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      data.dayBreakdown.forEach((day, idx) => {
        console.log(`\n${dayLabels[idx]} (${day.split(':')[0].split(' ').slice(1).join(' ')})`);
        const details = day.split(':').slice(1).join(':').trim();
        console.log(`  ${details}`);
      });
      console.log();
    }

    if (Array.isArray(data.trends) && data.trends.length > 0) {
      console.log('\n🔄 TRENDS & PATTERNS');
      console.log('─────────────────────────────────────────────────────');
      data.trends.forEach((trend) => {
        console.log(`• ${trend}`);
      });
      console.log();
    }

    if (Array.isArray(data.wins) && data.wins.length > 0) {
      console.log('\n✨ WINS');
      console.log('─────────────────────────────────────────────────────');
      data.wins.forEach((win) => {
        console.log(`✓ ${win}`);
      });
      console.log();
    }

    if (Array.isArray(data.pros) && data.pros.length > 0) {
      console.log('\n👍 WHAT WENT WELL');
      console.log('─────────────────────────────────────────────────────');
      data.pros.forEach((pro) => {
        console.log(`• ${pro}`);
      });
      console.log();
    }

    if (Array.isArray(data.cons) && data.cons.length > 0) {
      console.log('\n⚠️  TO IMPROVE');
      console.log('─────────────────────────────────────────────────────');
      data.cons.forEach((con) => {
        console.log(`• ${con}`);
      });
      console.log();
    }

    if (Array.isArray(data.focus) && data.focus.length > 0) {
      console.log('\n🎯 FOCUS FOR NEXT WEEK');
      console.log('─────────────────────────────────────────────────────');
      data.focus.forEach((goal, idx) => {
        console.log(`${idx + 1}. ${goal}`);
      });
      console.log();
    }

    if (data.signOff) {
      console.log('\n💬 SIGN OFF');
      console.log('─────────────────────────────────────────────────────');
      console.log(`"${data.signOff}"`);
      console.log();
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Show raw JSON for reference
    console.log('📦 RAW JSON DATA');
    console.log('─────────────────────────────────────────────────────');
    console.log(JSON.stringify(data, null, 2));
    console.log();
  } catch (error) {
    console.error('❌ Error fetching report:', error.message);
    process.exit(1);
  } finally {
    await admin.app().delete();
  }
}

fetchWeeklyReport();
