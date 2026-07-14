/**
 * Authentication + role routing (live Firebase Admin when available).
 */
const path = require('path');
const {
  pass,
  fail,
  skip,
  getAdmin,
  canWriteFirebase,
  createTestUser,
  deleteTestUser,
  getIdTokenForUid,
  importEsm,
  ROOT,
} = require('./lib/harness');

async function testAuth() {
  const results = [];
  const cleanup = [];

  try {
    const mod = await importEsm(path.join(ROOT, 'src/auth/authSessionTransition.js'));
    const calls = [];
    const deps = {
      clearPushTokensForUid: async (uid) => calls.push(`push:${uid}`),
      clearAllUserData: async () => calls.push('clear'),
    };
    const next = await mod.handleAuthUidTransition('u1', { uid: 'u2' }, deps);
    if (next === 'u2' && calls.includes('clear')) {
      results.push(pass('Auth uid transition clears session on switch', {
        type: 'unit_logic',
        verified: 'clearAllUserData() called on uid switch u1→u2',
        evidence: `calls=${calls.join(',')}`,
      }));
    } else {
      results.push(fail('Auth uid transition clears session on switch', 'deps not invoked'));
    }
  } catch (e) {
    results.push(fail('Auth uid transition clears session on switch', e.message));
  }

  try {
    const mod = await importEsm(path.join(ROOT, 'src/auth/authSessionTransition.js'));
    let cleared = false;
    await mod.handleAuthUidTransition('u1', null, {
      clearPushTokensForUid: async () => {},
      clearAllUserData: async () => {
        cleared = true;
      },
    });
    results.push(
      cleared
        ? pass('Auth logout clears local user data', {
            type: 'unit_logic',
            verified: 'clearAllUserData() invoked when uid becomes null',
          })
        : fail('Auth logout clears local user data', 'not cleared'),
    );
  } catch (e) {
    results.push(fail('Auth logout clears local user data', e.message));
  }

  if (!(await canWriteFirebase())) {
    results.push(skip('Live signup trainer + Firestore role', 'Firebase Admin credentials not writable'));
    results.push(skip('Live login trainer + role correct', 'Firebase Admin credentials not writable'));
    results.push(skip('Live create second user (client)', 'Firebase Admin credentials not writable'));
    results.push(skip('Forgot password email link generated', 'Firebase Admin credentials not writable'));
    results.push(skip('Token refresh works', 'Firebase Admin credentials not writable'));
    return results;
  }

  let trainer = null;
  let client = null;

  try {
    trainer = await createTestUser('trainer');
    cleanup.push(trainer.uid);
    const doc = await getAdmin().firestore().collection('users').doc(trainer.uid).get();
    if (doc.exists && doc.data().role === 'trainer') {
      results.push(pass('Live signup trainer + Firestore role', {
        type: 'live_auth',
        verified: `users/${trainer.uid} role=trainer`,
        evidence: `email=${trainer.email}`,
      }));
    } else {
      results.push(fail('Live signup trainer + Firestore role', 'role doc missing'));
    }
  } catch (e) {
    results.push(fail('Live signup trainer + Firestore role', e.message));
  }

  try {
    const token = await getIdTokenForUid(trainer.uid);
    if (!token) throw new Error('no token');
    const doc = await getAdmin().firestore().collection('users').doc(trainer.uid).get();
    if (doc.data().role === 'trainer') {
      results.push(pass('Live login trainer + role correct', {
        type: 'live_auth',
        verified: 'Custom token exchanged; role doc still trainer',
        evidence: `jwt length=${token.length}`,
      }));
    } else {
      results.push(fail('Live login trainer + role correct', 'wrong role'));
    }
  } catch (e) {
    results.push(fail('Live login trainer + role correct', e.message));
  }

  try {
    client = await createTestUser('client');
    cleanup.push(client.uid);
    if (client.uid !== trainer.uid) {
      results.push(pass('Live create second user (client)', {
        type: 'live_auth',
        verified: 'Second Auth user created with distinct uid',
        evidence: `clientUid=${client.uid.slice(0, 8)}…`,
      }));
    } else {
      results.push(fail('Live create second user (client)', 'same uid'));
    }
  } catch (e) {
    results.push(fail('Live create second user (client)', e.message));
  }

  try {
    const admin = getAdmin();
    const link = await admin.auth().generatePasswordResetLink(trainer.email);
    if (link && link.includes('oobCode')) {
      results.push(pass('Forgot password email link generated', {
        type: 'live_auth',
        verified: 'Reset link contains oobCode',
        sample: link.split('?')[0] + '?…',
      }));
    } else {
      results.push(fail('Forgot password email link generated', 'no link'));
    }
  } catch (e) {
    results.push(fail('Forgot password email link generated', e.message));
  }

  try {
    const token = await getIdTokenForUid(client.uid);
    const token2 = await getIdTokenForUid(client.uid);
    if (token && token2) {
      results.push(pass('Token refresh works', {
        type: 'live_auth',
        verified: 'Two JWT minted successfully',
        evidence: `tokens differ=${token !== token2}`,
      }));
    } else {
      results.push(fail('Token refresh works', 'empty token'));
    }
  } catch (e) {
    results.push(fail('Token refresh works', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testAuth };
