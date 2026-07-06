/**
 * Firestore security rules — payments + locked user fields.
 * Uses @firebase/rules-unit-testing (in-process rules evaluator).
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  ensureFirestoreEmulatorRunning,
  stopManagedFirestoreEmulator,
} = require('./helpers/firestoreEmulator');

const PROJECT_ID = 'coachconnect-rules-test';
const firestoreRules = fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8');

const CLIENT_ID = 'client123';
const OTHER_CLIENT_ID = 'client456';
const TRAINER_ID = 'trainer456';
const PAYMENT_ID = 'charge123';

let testEnv;

beforeAll(async () => {
  const { host, port } = await ensureFirestoreEmulatorRunning();
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: firestoreRules,
      host,
      port,
    },
  });
}, 120000);

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
  await stopManagedFirestoreEmulator();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('users').doc(CLIENT_ID).set({
      role: 'client',
      firstName: 'Client',
      bio: 'Old bio',
    });
    await db.collection('users').doc(OTHER_CLIENT_ID).set({
      role: 'client',
      firstName: 'Other',
    });
    await db.collection('users').doc(TRAINER_ID).set({
      role: 'trainer',
      firstName: 'Coach',
      bio: 'Trainer bio',
    });
    await db.collection('payments').doc(PAYMENT_ID).set({
      client_id: CLIENT_ID,
      trainer_id: TRAINER_ID,
      amount: 100,
      status: 'succeeded',
    });
  });
});

describe('Firestore security rules — payments', () => {
  test('Test 1: Client CANNOT Write to payments/{id}', async () => {
    const db = testEnv.authenticatedContext(CLIENT_ID).firestore();
    await assertFails(
      db.collection('payments').doc('test').set({ amount: 100, client_id: CLIENT_ID }),
    );
  });

  test('Test 2: Trainer CANNOT Write to payments/{id}', async () => {
    const db = testEnv.authenticatedContext(TRAINER_ID).firestore();
    await assertFails(
      db.collection('payments').doc('test').set({ amount: 100, trainer_id: TRAINER_ID }),
    );
  });

  test('Test 3: Server CAN Write to payments/{id}', async () => {
    await assertSucceeds(
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('payments').doc('admin_charge').set({
          client_id: CLIENT_ID,
          trainer_id: TRAINER_ID,
          amount: 100,
        });
      }),
    );
  });

  test('Test 4: Client CAN Read Own payments', async () => {
    const db = testEnv.authenticatedContext(CLIENT_ID).firestore();
    await assertSucceeds(db.collection('payments').doc(PAYMENT_ID).get());
  });

  test('Test 5: Client CANNOT Read Other Client payments', async () => {
    const db = testEnv.authenticatedContext(OTHER_CLIENT_ID).firestore();
    await assertFails(db.collection('payments').doc(PAYMENT_ID).get());
  });

  test('Test 6: Trainer CAN Read Own payments', async () => {
    const db = testEnv.authenticatedContext(TRAINER_ID).firestore();
    await assertSucceeds(db.collection('payments').doc(PAYMENT_ID).get());
  });
});

describe('Firestore security rules — users locked fields', () => {
  test('Test 7: Client CANNOT Write subscription Field', async () => {
    const db = testEnv.authenticatedContext(CLIENT_ID).firestore();
    await assertFails(
      db.collection('users').doc(CLIENT_ID).update({ subscription: 'active' }),
    );
  });

  test('Test 8: Trainer CANNOT Write stripeAccountId', async () => {
    const db = testEnv.authenticatedContext(TRAINER_ID).firestore();
    await assertFails(
      db.collection('users').doc(TRAINER_ID).update({ stripeAccountId: 'fake' }),
    );
  });

  test('Test 9: Server CAN Write subscription', async () => {
    await assertSucceeds(
      testEnv.withSecurityRulesDisabled(async (ctx) => {
        await ctx.firestore().collection('users').doc(CLIENT_ID).update({
          subscription: 'active',
        });
      }),
    );
  });

  test('Test 10: Trainer CAN Write bio (non-locked field)', async () => {
    const db = testEnv.authenticatedContext(TRAINER_ID).firestore();
    await assertSucceeds(
      db.collection('users').doc(TRAINER_ID).update({ bio: 'New bio' }),
    );
  });

  test('Trainer CANNOT set trainerId on another user', async () => {
    const db = testEnv.authenticatedContext(TRAINER_ID).firestore();
    await assertFails(
      db.collection('users').doc(OTHER_CLIENT_ID).update({ trainerId: TRAINER_ID }),
    );
  });
});

describe('Firestore security rules — AI coach chat', () => {
  const SESSION_ID = 'aiChat_test_session';

  test('owner can write aiChats session + messages subcollection', async () => {
    const db = testEnv.authenticatedContext(CLIENT_ID).firestore();
    const sessionRef = db
      .collection('users')
      .doc(CLIENT_ID)
      .collection('aiChats')
      .doc(SESSION_ID);

    await assertSucceeds(
      sessionRef.set({
        sessionId: SESSION_ID,
        title: 'New Chat',
        updatedAt: new Date(),
      }),
    );

    await assertSucceeds(
      sessionRef.collection('messages').doc('msg_1').set({
        id: 'msg_1',
        role: 'user',
        text: 'Hello coach',
        createdAt: Date.now(),
      }),
    );
  });

  test('other user cannot write aiChats messages subcollection', async () => {
    const db = testEnv.authenticatedContext(OTHER_CLIENT_ID).firestore();
    await assertFails(
      db
        .collection('users')
        .doc(CLIENT_ID)
        .collection('aiChats')
        .doc(SESSION_ID)
        .collection('messages')
        .doc('msg_1')
        .set({
          id: 'msg_1',
          role: 'user',
          text: 'nope',
          createdAt: Date.now(),
        }),
    );
  });
});
