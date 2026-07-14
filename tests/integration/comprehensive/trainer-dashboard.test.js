/**
 * Trainer dashboard — CRM data paths and pending requests loader.
 */
const fs = require('fs');
const path = require('path');
const { pass, fail, skip, canWriteFirebase, getAdmin, createTestUser, deleteTestUser, ROOT } = require('./lib/harness');

async function testTrainerDashboard() {
  const results = [];
  const cleanup = [];

  const trainerApp = path.join(ROOT, 'src/app-start/TrainerApp.js');
  if (fs.existsSync(trainerApp) && fs.readFileSync(trainerApp, 'utf8').includes('ErrorBoundary')) {
    results.push(pass('TrainerApp wrapped in ErrorBoundary'));
  } else {
    results.push(fail('TrainerApp wrapped in ErrorBoundary', 'not found'));
  }

  const pendingLoader = path.join(ROOT, 'src/trainer-app/client-requests/loadPendingTraineeRequests.js');
  if (fs.existsSync(pendingLoader)) {
    results.push(pass('loadPendingTraineeRequests module exists'));
  } else {
    results.push(fail('loadPendingTraineeRequests module exists', 'missing'));
  }

  if (!(await canWriteFirebase())) {
    results.push(skip('Trainer CRM client roster write/read', 'Firebase Admin credentials not writable'));
    return results;
  }

  const admin = getAdmin();
  const db = admin.firestore();
  let trainer;
  let client;

  try {
    trainer = await createTestUser('trainer');
    client = await createTestUser('client');
    cleanup.push(trainer.uid, client.uid);

    await db
      .collection('trainer_clients')
      .doc(trainer.uid)
      .collection('clients')
      .doc(client.uid)
      .set({
        clientId: client.uid,
        trainerId: trainer.uid,
        name: 'Dashboard Client',
        status: 'active',
        active: true,
      });

    const snap = await db
      .collection('trainer_clients')
      .doc(trainer.uid)
      .collection('clients')
      .doc(client.uid)
      .get();

    if (snap.exists && snap.data().status === 'active') {
      results.push(pass('Trainer CRM client roster write/read'));
    } else {
      results.push(fail('Trainer CRM client roster write/read', 'doc missing'));
    }
  } catch (e) {
    results.push(fail('Trainer CRM client roster write/read', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testTrainerDashboard };
