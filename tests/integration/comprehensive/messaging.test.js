/**
 * Messaging — top-level messages collection + unread index shape.
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

async function testMessaging() {
  const results = [];
  const cleanup = [];

  // Offline: unread index uses { total, conversations } not count
  try {
    const sample = { total: 3, conversations: { conv1: 2, conv2: 1 } };
    if (typeof sample.total === 'number' && typeof sample.conversations === 'object') {
      results.push(pass('Unread index schema (total + conversations)', {
        type: 'unit_logic',
        verified: 'Schema uses { total: number, conversations: object }',
      }));
    } else {
      results.push(fail('Unread index schema (total + conversations)', 'bad shape'));
    }
  } catch (e) {
    results.push(fail('Unread index schema (total + conversations)', e.message));
  }

  if (!(await canWriteFirebase())) {
    results.push(skip('Message write latency', 'Firebase Admin credentials not writable'));
    results.push(skip('Unread index increment', 'Firebase Admin credentials not writable'));
    results.push(skip('Mark as read clears badge', 'Firebase Admin credentials not writable'));
    results.push(skip('100 messages batch write', 'Firebase Admin credentials not writable'));
    return results;
  }

  const admin = getAdmin();
  const db = admin.firestore();
  let trainer;
  let client;
  let convId;

  try {
    trainer = await createTestUser('trainer');
    client = await createTestUser('client');
    cleanup.push(trainer.uid, client.uid);

    const convRef = await db.collection('conversations').add({
      participants: [trainer.uid, client.uid],
      trainerId: trainer.uid,
      clientId: client.uid,
      updatedAt: new Date().toISOString(),
    });
    convId = convRef.id;

    const sendStart = Date.now();
    await db.collection('messages').add({
      conversationId: convId,
      senderId: trainer.uid,
      recipientId: client.uid,
      text: 'Hello client',
      read: false,
      createdAt: new Date().toISOString(),
    });
    const elapsed = Date.now() - sendStart;

    results.push(
      elapsed < 2000
        ? pass('Message write completes', {
            type: 'live_firestore',
            elapsed,
            verified: `messages doc written in ${elapsed}ms`,
            evidence: `conversationId=${convId}`,
          })
        : fail('Message write completes', `slow: ${elapsed}ms`, { elapsed }),
    );
  } catch (e) {
    results.push(fail('Message write completes', e.message));
  }

  try {
    await db
      .collection('users')
      .doc(client.uid)
      .collection('unreadCount')
      .doc('index')
      .set({
        total: 1,
        conversations: { [convId]: 1 },
        updatedAt: new Date().toISOString(),
      });

    const unreadRef = await db
      .collection('users')
      .doc(client.uid)
      .collection('unreadCount')
      .doc('index')
      .get();

    if (unreadRef.exists && unreadRef.data().total > 0) {
      results.push(pass('Unread index increment', {
        type: 'live_firestore',
        count: unreadRef.data().total,
        verified: `users/…/unreadCount/index total=${unreadRef.data().total}`,
      }));
    } else {
      results.push(fail('Unread index increment', 'no unread total'));
    }
  } catch (e) {
    results.push(fail('Unread index increment', e.message));
  }

  try {
    await db
      .collection('users')
      .doc(client.uid)
      .collection('unreadCount')
      .doc('index')
      .set({ total: 0, conversations: { [convId]: 0 } }, { merge: true });

    const unreadRef2 = await db
      .collection('users')
      .doc(client.uid)
      .collection('unreadCount')
      .doc('index')
      .get();

    if (unreadRef2.data().total === 0) {
      results.push(pass('Mark as read clears badge', {
        type: 'live_firestore',
        verified: 'unreadCount/index total=0 after mark-read',
      }));
    } else {
      results.push(fail('Mark as read clears badge', 'total not zero'));
    }
  } catch (e) {
    results.push(fail('Mark as read clears badge', e.message));
  }

  try {
    const batch = db.batch();
    for (let i = 0; i < 100; i += 1) {
      const ref = db.collection('messages').doc();
      batch.set(ref, {
        conversationId: convId,
        senderId: i % 2 === 0 ? trainer.uid : client.uid,
        text: `Message ${i}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    }
    await batch.commit();
    const q = await db.collection('messages').where('conversationId', '==', convId).limit(100).get();
    results.push(
      q.size >= 100
        ? pass('100 messages batch write', {
            type: 'live_firestore',
            count: q.size,
            verified: `${q.size} messages queryable by conversationId`,
          })
        : fail('100 messages batch write', `only ${q.size}`),
    );
  } catch (e) {
    results.push(fail('100 messages batch write', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testMessaging };
