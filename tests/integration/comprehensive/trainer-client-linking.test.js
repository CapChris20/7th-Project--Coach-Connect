/**
 * Trainer-client linking — 3 surfaces stay in sync (users, trainer_clients, trainer_client_links).
 */
const {
  pass,
  fail,
  skip,
  getAdmin,
  canWriteFirebase,
  createTestUser,
  deleteTestUser,
} = require('./lib/harness');

async function linkClientBatch(db, trainerId, clientId, crmPayload, ts) {
  const linkId = `${trainerId}_${clientId}`;
  const batch = db.batch();
  batch.set(
    db.collection('trainer_client_links').doc(linkId),
    { trainerId, clientId, name: crmPayload.name, joinedAt: ts, status: 'active' },
    { merge: true },
  );
  batch.set(
    db.collection('trainer_clients').doc(trainerId).collection('clients').doc(clientId),
    crmPayload,
    { merge: true },
  );
  batch.set(db.collection('users').doc(clientId), { trainerId }, { merge: true });
  await batch.commit();
}

async function unlinkClientBatch(db, admin, trainerId, clientId) {
  const linkId = `${trainerId}_${clientId}`;
  const batch = db.batch();
  batch.delete(db.collection('trainer_client_links').doc(linkId));
  batch.delete(db.collection('trainer_clients').doc(trainerId).collection('clients').doc(clientId));
  batch.update(db.collection('users').doc(clientId), { trainerId: admin.firestore.FieldValue.delete() });
  await batch.commit();
}

async function verifyLinked(db, trainerId, clientId) {
  const userDoc = await db.collection('users').doc(clientId).get();
  const trainerClientDoc = await db
    .collection('trainer_clients')
    .doc(trainerId)
    .collection('clients')
    .doc(clientId)
    .get();
  const linkDoc = await db.collection('trainer_client_links').doc(`${trainerId}_${clientId}`).get();
  return Boolean(userDoc.data()?.trainerId && trainerClientDoc.exists && linkDoc.exists);
}

async function testTrainerClientLinking() {
  const results = [];
  const cleanup = [];

  if (!(await canWriteFirebase())) {
    results.push(skip('Client connection request message created', 'Firebase Admin credentials not writable'));
    results.push(skip('All 3 collections written on accept', 'Firebase Admin credentials not writable'));
    results.push(skip('All 3 collections cleared on remove', 'Firebase Admin credentials not writable'));
    return results;
  }

  const admin = getAdmin();
  const db = admin.firestore();
  const ts = new Date().toISOString();
  let trainer;
  let client;

  try {
    trainer = await createTestUser('trainer');
    client = await createTestUser('client');
    cleanup.push(trainer.uid, client.uid);

    const msgRef = await db.collection('messages').add({
      senderId: client.uid,
      recipientId: trainer.uid,
      status: 'pending',
      requestType: 'connection',
      clientName: 'Test Client',
      conversationId: '',
      createdAt: ts,
    });

    const snap = await msgRef.get();
    if (snap.exists && snap.data().requestType === 'connection') {
      results.push(pass('Client connection request message created', {
        type: 'live_firestore',
        verified: `messages/${msgRef.id} requestType=connection, status=pending`,
        evidence: `sender=${client.uid.slice(0, 8)}… → trainer=${trainer.uid.slice(0, 8)}…`,
      }));
    } else {
      results.push(fail('Client connection request message created', 'invalid message'));
    }
  } catch (e) {
    results.push(fail('Client connection request message created', e.message));
  }

  try {
    await linkClientBatch(db, trainer.uid, client.uid, {
      clientId: client.uid,
      trainerId: trainer.uid,
      name: 'Test Client',
      status: 'active',
      joinedAt: ts,
    }, ts);

    const ok = await verifyLinked(db, trainer.uid, client.uid);
    results.push(
      ok
        ? pass('All 3 collections written on accept', {
            type: 'live_firestore',
            verified: 'users.trainerId + trainer_clients + trainer_client_links all exist',
            evidence: `linkId=${trainer.uid}_${client.uid}`,
          })
        : fail('All 3 collections written on accept', 'missing collection'),
    );
  } catch (e) {
    results.push(fail('All 3 collections written on accept', e.message));
  }

  try {
    await unlinkClientBatch(db, admin, trainer.uid, client.uid);
    const userDoc = await db.collection('users').doc(client.uid).get();
    const trainerClientDoc = await db
      .collection('trainer_clients')
      .doc(trainer.uid)
      .collection('clients')
      .doc(client.uid)
      .get();
    const linkDoc = await db.collection('trainer_client_links').doc(`${trainer.uid}_${client.uid}`).get();

    if (!userDoc.data()?.trainerId && !trainerClientDoc.exists && !linkDoc.exists) {
      results.push(pass('All 3 collections cleared on remove', {
        type: 'live_firestore',
        verified: 'trainerId deleted; CRM + link docs removed',
      }));
    } else {
      results.push(fail('All 3 collections cleared on remove', 'data still exists'));
    }
  } catch (e) {
    results.push(fail('All 3 collections cleared on remove', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testTrainerClientLinking };
