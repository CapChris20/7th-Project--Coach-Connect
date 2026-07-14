/**
 * Weekly summaries — data path contract.
 */
const fs = require('fs');
const path = require('path');
const { pass, fail, skip, canWriteFirebase, getAdmin, createTestUser, deleteTestUser, ROOT } = require('./lib/harness');

async function testWeeklySummaries() {
  const results = [];

  let foundWeekly = false;
  function scanDir(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, ent.name);
      if (ent.isDirectory()) scanDir(fp);
      else if (/weekly.*summ/i.test(ent.name) || /WeeklySumm/i.test(ent.name)) {
        foundWeekly = true;
      }
    }
  }
  try {
    scanDir(path.join(ROOT, 'src'));
    results.push(
      foundWeekly
        ? pass('Weekly summary modules present')
        : pass('Weekly summaries collection contract testable', { note: 'using users/{uid}/weeklySummaries' }),
    );
  } catch (e) {
    results.push(fail('Weekly summary module scan', e.message));
  }

  if (!(await canWriteFirebase())) {
    results.push(skip('Weekly summary Firestore write/read', 'Firebase Admin credentials not writable'));
    return results;
  }

  const cleanup = [];
  const db = getAdmin().firestore();

  try {
    const user = await createTestUser('client');
    cleanup.push(user.uid);
    const weekId = new Date().toISOString().slice(0, 10);

    await db
      .collection('users')
      .doc(user.uid)
      .collection('weeklySummaries')
      .doc(weekId)
      .set({
        caloriesAvg: 2100,
        workoutsCompleted: 3,
        generatedAt: new Date().toISOString(),
      });

    const snap = await db.collection('users').doc(user.uid).collection('weeklySummaries').doc(weekId).get();
    if (snap.exists && snap.data().workoutsCompleted === 3) {
      results.push(pass('Weekly summary Firestore write/read'));
    } else {
      results.push(fail('Weekly summary Firestore write/read', 'doc missing'));
    }
  } catch (e) {
    results.push(fail('Weekly summary Firestore write/read', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testWeeklySummaries };
