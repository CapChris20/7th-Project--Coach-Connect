#!/usr/bin/env node
/**
 * Firestore + Storage security rules tests (firebase emulators:exec).
 */
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'security-rules-test';
const firestoreRules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const storageRules = fs.readFileSync(path.join(__dirname, '..', 'storage.rules'), 'utf8');

let testEnv;

async function setup() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: firestoreRules },
    storage: { rules: storageRules },
  });
}

async function seed() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.collection('conversations').doc('conv_alice_bob').set({
      participants: ['alice', 'bob'],
      createdAt: new Date(),
    });
    await db.collection('messages').doc('m1').set({
      conversationId: 'conv_alice_bob',
      senderId: 'alice',
      text: 'hello',
      read: false,
    });
    await db.collection('trainer_clients').doc('trainer_alice').collection('clients').doc('client123').set({
      clientId: 'client123',
      trainerId: 'trainer_alice',
    });
    await db.collection('users').doc('client123').set({
      trainerId: 'trainer_alice',
      role: 'client',
    });

    await ctx.storage().ref('progressPhotos/client123/photo1.jpg').putString('fake-image-bytes', {
      contentType: 'image/jpeg',
    });
  });
}

async function testMessages() {
  const aliceDb = testEnv.authenticatedContext('alice').firestore();
  const charlieDb = testEnv.authenticatedContext('charlie').firestore();
  const unauthDb = testEnv.unauthenticatedContext().firestore();

  await assertSucceeds(
    aliceDb.collection('messages').where('conversationId', '==', 'conv_alice_bob').get()
  );
  console.log('✅ messages: alice can read conv_alice_bob');

  await assertFails(
    charlieDb.collection('messages').where('conversationId', '==', 'conv_alice_bob').get()
  );
  console.log('✅ messages: charlie denied conv_alice_bob');

  await assertFails(unauthDb.collection('messages').get());
  console.log('✅ messages: unauthenticated denied');
}

async function testStorageProgressPhotos() {
  const clientRef = testEnv.authenticatedContext('client123').storage().ref('progressPhotos/client123/photo1.jpg');
  const trainerRef = testEnv.authenticatedContext('trainer_alice').storage().ref('progressPhotos/client123/photo1.jpg');
  const charlieRef = testEnv.authenticatedContext('charlie').storage().ref('progressPhotos/client123/photo1.jpg');

  await assertSucceeds(clientRef.getMetadata());
  console.log('✅ storage: client123 can read own progress photo');

  await assertSucceeds(trainerRef.getMetadata());
  console.log('✅ storage: trainer_alice can read client progress photo');

  await assertFails(charlieRef.getMetadata());
  console.log('✅ storage: charlie denied client progress photo');
}

async function run() {
  await setup();
  await seed();
  await testMessages();
  await testStorageProgressPhotos();
  await testEnv.cleanup();
  console.log('\nAll Firestore/Storage rules tests passed.\n');
}

run().catch((e) => {
  console.error('Rules test failed:', e);
  process.exit(1);
});
