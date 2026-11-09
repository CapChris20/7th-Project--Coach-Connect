#!/usr/bin/env node
// Imports empty or with-food seed scenarios into Auth + Firestore via Admin SDK.
// Credentials: FIREBASE_SERVICE_ACCOUNT, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS.
// Passwords: SCREENSHOT_CLIENT_PASSWORD / SCREENSHOT_TRAINER_PASSWORD (env only).

const fs = require('fs');
const path = require('path');
const { SEEDS_ROOT, CLIENT_EMAIL, TRAINER_EMAIL } = require('./lib/constants');
const { buildScenario } = require('./lib/build-seed-data');

function parseArgs(argv) {
  const args = { scenario: 'with-food', writeJsonOnly: false, apply: true };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--scenario') args.scenario = argv[++i];
    else if (a === '--write-json-only') {
      args.writeJsonOnly = true;
      args.apply = false;
    } else if (a === '--dry-run') args.apply = false;
    else if (a === '--apply') args.apply = true;
  }
  return args;
}

function writeSeedJson(scenario) {
  const payload = buildScenario(scenario);
  const dir = path.join(SEEDS_ROOT, scenario);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'seed.json'), JSON.stringify(payload, null, 2));
  // Emulator-style sidecar metadata (portable artifact; import uses seed.json).
  fs.writeFileSync(
    path.join(dir, 'firebase-export-metadata.json'),
    JSON.stringify(
      {
        version: '12.0.0',
        kind: 'coachconnect-screenshot-seed',
        scenario,
        projectId: 'anatrox-auth',
        notes:
          'Not a binary Firestore LevelDB export. import-seed.js applies seed.json via Admin SDK. Expo app has no emulator hook.',
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(dir, 'auth_export.json'),
    JSON.stringify({ users: payload.auth.users.map(({ passwordEnv, ...rest }) => rest) }, null, 2),
  );
  fs.writeFileSync(
    path.join(dir, 'firestore_export.json'),
    JSON.stringify({ documents: payload.firestore.documents }, null, 2),
  );
  return payload;
}

async function loadAdmin() {
  // Prefer repo helper when workspace deps are available.
  try {
    const helper = require(path.join(__dirname, '../../scripts/lib/ensureFirebaseAdmin'));
    const info = await helper.ensureFirebaseAdminInitialized();
    return { admin: helper.admin, info };
  } catch (err) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
          credential: admin.credential.cert(parsed),
          projectId: parsed.project_id || 'anatrox-auth',
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        const keyPath =
          process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const parsed = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(parsed),
          projectId: parsed.project_id || 'anatrox-auth',
        });
      } else {
        throw new Error(
          `Firebase Admin credentials missing (${err.message}). Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.`,
        );
      }
    }
    return { admin, info: { source: 'tools/screenshots-local', projectId: 'anatrox-auth' } };
  }
}

async function upsertAuthUser(admin, user) {
  const password = process.env[user.passwordEnv];
  if (!password) {
    throw new Error(`Missing env ${user.passwordEnv} for ${user.email}`);
  }
  try {
    await admin.auth().getUser(user.localId);
    await admin.auth().updateUser(user.localId, {
      email: user.email,
      password,
      displayName: user.displayName,
      emailVerified: true,
      disabled: false,
    });
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    try {
      await admin.auth().createUser({
        uid: user.localId,
        email: user.email,
        password,
        displayName: user.displayName,
        emailVerified: true,
      });
    } catch (createErr) {
      if (createErr.code === 'auth/email-already-exists') {
        const existing = await admin.auth().getUserByEmail(user.email);
        await admin.auth().updateUser(existing.uid, {
          password,
          displayName: user.displayName,
          emailVerified: true,
        });
        return existing.uid;
      }
      throw createErr;
    }
  }
  return user.localId;
}

function parsePath(docPath) {
  const parts = docPath.split('/').filter(Boolean);
  if (parts.length % 2 !== 0) {
    throw new Error(`Document path must have even segments: ${docPath}`);
  }
  return parts;
}

async function writeDocuments(db, documents) {
  const batchSize = 400;
  for (let i = 0; i < documents.length; i += batchSize) {
    const slice = documents.slice(i, i + batchSize);
    const batch = db.batch();
    for (const doc of slice) {
      const parts = parsePath(doc.path);
      let ref = db.collection(parts[0]).doc(parts[1]);
      for (let p = 2; p < parts.length; p += 2) {
        ref = ref.collection(parts[p]).doc(parts[p + 1]);
      }
      batch.set(ref, doc.data, { merge: true });
    }
    await batch.commit();
  }
}

async function clearNutritionLogs(db, clientUid) {
  const snap = await db.collection('nutrition_logs').where('user_id', '==', clientUid).get();
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function applySeed(scenario) {
  const payload = writeSeedJson(scenario);
  const { admin, info } = await loadAdmin();
  console.log(`Using Admin credentials from ${info.source} (project ${info.projectId})`);

  for (const user of payload.auth.users) {
    const uid = await upsertAuthUser(admin, user);
    console.log(`Auth upserted: ${user.email} -> ${uid}`);
  }

  const db = admin.firestore();
  // Empty scenario: wipe food logs for the screenshot client so nutrition reads empty.
  const clientUser = payload.auth.users.find((u) => u.email === CLIENT_EMAIL) || payload.auth.users[0];
  if (scenario === 'empty' && clientUser) {
    await clearNutritionLogs(db, clientUser.localId);
  }
  await writeDocuments(db, payload.firestore.documents);
  console.log(`Wrote ${payload.firestore.documents.length} Firestore docs for scenario=${scenario}`);
  console.log(`Trainer login: ${TRAINER_EMAIL} (password from SCREENSHOT_TRAINER_PASSWORD)`);
  console.log(`Client login: ${CLIENT_EMAIL} (password from SCREENSHOT_CLIENT_PASSWORD)`);
  return payload;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!['empty', 'with-food'].includes(args.scenario)) {
    console.error('Usage: node import-seed.js --scenario empty|with-food [--write-json-only]');
    process.exit(2);
  }
  writeSeedJson(args.scenario);
  console.log(`Wrote seed JSON under ${path.join(SEEDS_ROOT, args.scenario)}`);
  if (!args.apply || args.writeJsonOnly) {
    console.log('Skipping live Admin import (--write-json-only / --dry-run).');
    return;
  }
  await applySeed(args.scenario);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { writeSeedJson, applySeed };
