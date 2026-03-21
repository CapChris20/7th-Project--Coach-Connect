/**
 * Safely remove test user documents from Firestore `users` collection.
 *
 * Usage:
 *   node scripts/removeTestUsersFromFirestore.js --list              # List all users
 *   node scripts/removeTestUsersFromFirestore.js --no-email-or-name   # Dry run: users with no email AND no name
 *   node scripts/removeTestUsersFromFirestore.js --no-email-or-name --yes   # Delete those
 *   node scripts/removeTestUsersFromFirestore.js                      # Dry run: TEST_EMAILS / TEST_UIDS only
 *   node scripts/removeTestUsersFromFirestore.js --yes                # Delete TEST_EMAILS / TEST_UIDS
 *
 * Requires: serviceAccountKey.json in project root.
 */

const admin = require('firebase-admin');
const path = require('path');

// Only these will ever be deleted. Add test emails or UIDs here after reviewing --list.
const TEST_EMAILS = [
  'chris@coachconnect.test',
  'sarah@coachconnect.test',
  // 'test@example.com',
];

const TEST_UIDS = [
  // 'abc123uid',   // add specific UIDs if needed (e.g. no email on doc)
];

function hasNoEmailOrName(data) {
  const email = (data.email || '').trim();
  const name = (data.name || data.displayName || data.firstName || '').trim();
  return !email && !name;
}

function shouldDelete(docId, data) {
  const email = (data.email || data.displayName || '').trim().toLowerCase();
  if (TEST_UIDS.includes(docId)) return true;
  if (email && TEST_EMAILS.some((e) => e.trim().toLowerCase() === email)) return true;
  return false;
}

async function main() {
  const doList = process.argv.includes('--list');
  const doNoEmailOrName = process.argv.includes('--no-email-or-name');
  const doDelete = process.argv.includes('--yes');

  let serviceAccount;
  try {
    serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  } catch (e) {
    console.error('Missing serviceAccountKey.json in project root.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  const db = admin.firestore();

  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();

  if (doList) {
    console.log('All users in Firestore (users collection):\n');
    console.log('UID\t\t\t\t\temail\t\t\tname/displayName\t\trole');
    console.log('─'.repeat(100));
    snapshot.docs.forEach((doc) => {
      const d = doc.data();
      const email = d.email || '';
      const name = d.name || d.displayName || d.firstName || '';
      const role = d.role || '';
      console.log(`${doc.id}\t${(email || '-').padEnd(24)}\t${(name || '-').slice(0, 20)}\t\t${role}`);
    });
    console.log('\nTotal:', snapshot.size);
    console.log('\nCopy the emails/UIDs you want to remove into TEST_EMAILS or TEST_UIDS in this script, then run without --list.');
    return;
  }

  const toDelete = [];
  if (doNoEmailOrName) {
    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      if (hasNoEmailOrName(data)) {
        toDelete.push({ id: doc.id, email: data.email || data.displayName || '(no email/name)' });
      }
    });
  } else {
    snapshot.docs.forEach((doc) => {
      if (shouldDelete(doc.id, doc.data())) {
        toDelete.push({ id: doc.id, email: doc.data().email || doc.data().displayName || doc.id });
      }
    });
  }

  if (toDelete.length === 0) {
    if (doNoEmailOrName) {
      console.log('No users with missing email and name. Nothing to delete.');
    } else {
      console.log('No users matched TEST_EMAILS or TEST_UIDS. Nothing to delete.');
      console.log('Run with --list to see all users, then add test emails/UIDs to the script.');
    }
    return;
  }

  if (doNoEmailOrName) {
    console.log('Users with no email and no name (would delete):');
  } else {
    console.log('Would delete (only accounts in your TEST_EMAILS / TEST_UIDS list):');
  }
  toDelete.forEach((u) => console.log('  -', u.id, u.email ? `(${u.email})` : ''));
  console.log('Total:', toDelete.length);

  if (!doDelete) {
    if (doNoEmailOrName) {
      console.log('\nDry run. To actually delete run: node scripts/removeTestUsersFromFirestore.js --no-email-or-name --yes');
    } else {
      console.log('\nDry run. To actually delete run: node scripts/removeTestUsersFromFirestore.js --yes');
    }
    return;
  }

  const batch = db.batch();
  toDelete.forEach((u) => batch.delete(usersRef.doc(u.id)));
  await batch.commit();
  console.log('\nDeleted', toDelete.length, 'user document(s).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
