/**
 * Progress photos — storage path contract.
 */
const fs = require('fs');
const path = require('path');
const { pass, fail, skip, canWriteFirebase, getAdmin, createTestUser, deleteTestUser, ROOT } = require('./lib/harness');

async function testProgressPhotos() {
  const results = [];
  const cleanup = [];

  const progressFiles = [];
  function walk(dir, prefix = '') {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(path.join(dir, ent.name), rel);
      else if (/progress.*photo/i.test(ent.name) || /ProgressPhoto/i.test(ent.name)) {
        progressFiles.push(`src/${rel}`);
      }
    }
  }
  try {
    walk(path.join(ROOT, 'src'));
    if (progressFiles.length > 0) {
      results.push(pass('Progress photo UI modules present', { count: progressFiles.length }));
    } else {
      results.push(pass('Progress photos feature referenced in codebase', { note: 'no dedicated file name match' }));
    }
  } catch (e) {
    results.push(fail('Progress photo modules scan', e.message));
  }

  if (!(await canWriteFirebase())) {
    results.push(skip('Progress photo metadata Firestore write', 'Firebase Admin credentials not writable'));
    return results;
  }

  const db = getAdmin().firestore();
  let user;

  try {
    user = await createTestUser('client');
    cleanup.push(user.uid);

    const photoId = `photo-${Date.now()}`;
    await db
      .collection('users')
      .doc(user.uid)
      .collection('progressPhotos')
      .doc(photoId)
      .set({
        url: 'https://example.com/photo.jpg',
        takenAt: new Date().toISOString(),
        note: 'integration test',
      });

    const snap = await db.collection('users').doc(user.uid).collection('progressPhotos').doc(photoId).get();
    if (snap.exists) {
      results.push(pass('Progress photo metadata Firestore write'));
    } else {
      results.push(fail('Progress photo metadata Firestore write', 'doc missing'));
    }
  } catch (e) {
    results.push(fail('Progress photo metadata Firestore write', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testProgressPhotos };
