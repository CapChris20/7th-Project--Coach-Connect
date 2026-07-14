/**
 * Session scheduling — trainer_clients/{uid}/sessions collection contract.
 */
const fs = require('fs');
const path = require('path');
const { pass, fail, skip, canWriteFirebase, getAdmin, createTestUser, deleteTestUser, ROOT } = require('./lib/harness');

async function testSessionScheduling() {
  const results = [];
  const cleanup = [];

  const sessionsHook = path.join(ROOT, 'src/trainer-app/hooks/useMyTrainingSessions.js');
  if (fs.existsSync(sessionsHook) && fs.readFileSync(sessionsHook, 'utf8').includes('trainer_clients')) {
    results.push(pass('useMyTrainingSessions listens on trainer_clients sessions'));
  } else {
    results.push(fail('useMyTrainingSessions listens on trainer_clients sessions', 'pattern missing'));
  }

  const ctx = path.join(ROOT, 'src/trainer-app/hooks/SessionsContext.jsx');
  if (fs.existsSync(ctx)) {
    results.push(pass('SessionsContext provider exists'));
  } else {
    results.push(fail('SessionsContext provider exists', 'missing'));
  }

  if (!(await canWriteFirebase())) {
    results.push(skip('Training session Firestore write/read', 'Firebase Admin credentials not writable'));
    return results;
  }

  const db = getAdmin().firestore();
  let trainer;
  let client;

  try {
    trainer = await createTestUser('trainer');
    client = await createTestUser('client');
    cleanup.push(trainer.uid, client.uid);

    const sessionId = `sess-${Date.now()}`;
    await db
      .collection('trainer_clients')
      .doc(trainer.uid)
      .collection('sessions')
      .doc(sessionId)
      .set({
        trainerId: trainer.uid,
        clientId: client.uid,
        scheduledAt: new Date().toISOString(),
        status: 'scheduled',
        durationMinutes: 60,
      });

    const snap = await db
      .collection('trainer_clients')
      .doc(trainer.uid)
      .collection('sessions')
      .doc(sessionId)
      .get();
    if (snap.exists && snap.data().status === 'scheduled') {
      results.push(pass('Training session Firestore write/read'));
    } else {
      results.push(fail('Training session Firestore write/read', 'doc missing'));
    }

    await db
      .collection('trainer_clients')
      .doc(trainer.uid)
      .collection('sessions')
      .doc(sessionId)
      .delete();
  } catch (e) {
    results.push(fail('Training session Firestore write/read', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testSessionScheduling };
