/**
 * Notifications — unread count + push token paths.
 */
const fs = require('fs');
const path = require('path');
const { pass, fail, skip, canWriteFirebase, getAdmin, createTestUser, deleteTestUser, ROOT } = require('./lib/harness');

async function testNotifications() {
  const results = [];
  const cleanup = [];

  const hookPath = path.join(ROOT, 'src/notifications/useUnreadNotificationCount.js');
  if (fs.existsSync(hookPath)) {
    const text = fs.readFileSync(hookPath, 'utf8');
    if (text.includes('subscribeToUnreadCount')) {
      results.push(pass('useUnreadNotificationCount uses unread index listener'));
    } else {
      results.push(fail('useUnreadNotificationCount uses unread index listener', 'pattern missing'));
    }
  } else {
    results.push(fail('useUnreadNotificationCount hook exists', 'file missing'));
  }

  const sendPath = path.join(ROOT, 'src/ai-coach/server-logic/trainer-messaging/sendTrainerNotification.js');
  if (fs.existsSync(sendPath)) {
    results.push(pass('sendTrainerNotification module exists'));
  } else {
    results.push(fail('sendTrainerNotification module exists', 'missing'));
  }

  if (!(await canWriteFirebase())) {
    results.push(skip('Push token doc write/read', 'Firebase Admin credentials not writable'));
    return results;
  }

  const db = getAdmin().firestore();
  let user;

  try {
    user = await createTestUser('client');
    cleanup.push(user.uid);

    await db
      .collection('users')
      .doc(user.uid)
      .collection('pushTokens')
      .doc('device-1')
      .set({ token: 'test-token', platform: 'ios', updatedAt: new Date().toISOString() });

    const snap = await db.collection('users').doc(user.uid).collection('pushTokens').doc('device-1').get();
    if (snap.exists && snap.data().token === 'test-token') {
      results.push(pass('Push token doc write/read'));
    } else {
      results.push(fail('Push token doc write/read', 'doc missing'));
    }
  } catch (e) {
    results.push(fail('Push token doc write/read', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testNotifications };
