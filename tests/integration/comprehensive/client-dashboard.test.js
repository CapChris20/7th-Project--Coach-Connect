/**
 * Client dashboard — bootstrap paths and daily metrics.
 */
const fs = require('fs');
const path = require('path');
const { pass, fail, skip, canWriteFirebase, getAdmin, createTestUser, deleteTestUser, ROOT } = require('./lib/harness');

async function testClientDashboard() {
  const results = [];
  const cleanup = [];

  const clientApp = path.join(ROOT, 'src/app-start/ClientApp.js');
  if (fs.existsSync(clientApp) && fs.readFileSync(clientApp, 'utf8').includes('ErrorBoundary')) {
    results.push(pass('ClientApp wrapped in ErrorBoundary'));
  } else {
    results.push(fail('ClientApp wrapped in ErrorBoundary', 'not found'));
  }

  const authGate = path.join(ROOT, 'src/app-start/AuthGate.js');
  const authText = fs.readFileSync(authGate, 'utf8');
  if (authText.includes('role') && authText.includes('trainer')) {
    results.push(pass('AuthGate routes by user role'));
  } else {
    results.push(fail('AuthGate routes by user role', 'role routing not found'));
  }

  if (!(await canWriteFirebase())) {
    results.push(skip('Client daily log write/read', 'Firebase Admin credentials not writable'));
    return results;
  }

  const db = getAdmin().firestore();
  let client;

  try {
    client = await createTestUser('client');
    cleanup.push(client.uid);

    const today = new Date().toISOString().slice(0, 10);
    await db
      .collection('users')
      .doc(client.uid)
      .collection('dailyLogs')
      .doc(today)
      .set({ calories: 500, protein: 40, updatedAt: new Date().toISOString() }, { merge: true });

    const snap = await db.collection('users').doc(client.uid).collection('dailyLogs').doc(today).get();
    if (snap.exists && snap.data().calories === 500) {
      results.push(pass('Client daily log write/read'));
    } else {
      results.push(fail('Client daily log write/read', 'doc missing'));
    }
  } catch (e) {
    results.push(fail('Client daily log write/read', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testClientDashboard };
