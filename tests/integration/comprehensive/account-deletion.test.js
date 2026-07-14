/**
 * Account deletion — purgeUserFirestore pagination contract.
 */
const path = require('path');
const { pass, fail, skip, hasLiveFirebase, canWriteFirebase, getAdmin, createTestUser, deleteTestUser, ROOT } = require('./lib/harness');

function makeMockDb() {
  const { PAGE_SIZE } = require(path.join(ROOT, 'functions/lib/purgeUserFirestore.js'));
  const deleted = [];
  const stores = new Map();

  const makeRef = (p) => ({
    path: p,
    id: p.split('/').pop(),
    delete: async () => deleted.push(p),
    collection: (name) => makeCollectionRef(`${p}/${name}`),
    listCollections: async () => [],
  });

  const makeCollectionRef = (p) => ({
    path: p,
    doc: (id) => makeRef(`${p}/${id}`),
    where: () => makeQueryRef(p),
    limit: () => makeQueryRef(p),
    get: async () => {
      const docs = [...(stores.get(p) || [])];
      return {
        empty: docs.length === 0,
        size: docs.length,
        docs: docs.slice(0, PAGE_SIZE).map((d) => ({
          id: d.id,
          ref: makeRef(`${p}/${d.id}`),
          data: () => d.data,
        })),
      };
    },
  });

  const makeQueryRef = (p) => ({
    where: () => makeQueryRef(p),
    limit: () => ({
      get: async () => makeCollectionRef(p).get(),
    }),
    get: async () => makeCollectionRef(p).get(),
  });

  return {
    deleted,
    stores,
    collection: (name) => makeCollectionRef(name),
    collectionGroup: (name) => makeQueryRef(`group:${name}`),
    recursiveDelete: async (ref) => deleted.push(`recursive:${ref.path}`),
    batch: () => {
      const ops = [];
      return {
        delete: (ref) => ops.push(ref),
        commit: async () => deleted.push(...ops.map((r) => r.path)),
      };
    },
    seed(p, id, data = {}) {
      const list = stores.get(p) || [];
      list.push({ id, data });
      stores.set(p, list);
    },
  };
}

async function testAccountDeletion() {
  const results = [];
  const { purgeUserFirestore, PAGE_SIZE } = require(path.join(ROOT, 'functions/lib/purgeUserFirestore.js'));

  results.push(
    PAGE_SIZE === 100
      ? pass('Purge PAGE_SIZE is 100')
      : fail('Purge PAGE_SIZE is 100', `got ${PAGE_SIZE}`),
  );

  try {
    const db = makeMockDb();
    db.seed('conversations', 'conv1', { participants: ['u1'] });
    db.seed('messages', 'm1', { conversationId: 'conv1' });
    await purgeUserFirestore(db, 'u1');
    if (db.deleted.some((d) => d.includes('recursive:users/u1'))) {
      results.push(pass('purgeUserFirestore recursive-deletes user doc'));
    } else {
      results.push(fail('purgeUserFirestore recursive-deletes user doc', db.deleted.join(',')));
    }
  } catch (e) {
    results.push(fail('purgeUserFirestore recursive-deletes user doc', e.message));
  }

  if (!(await canWriteFirebase())) {
    results.push(skip('Live auth user delete', 'Firebase Admin credentials not writable'));
    return results;
  }

  let uid;
  try {
    const user = await createTestUser('client');
    uid = user.uid;
    await getAdmin().auth().deleteUser(uid);
    try {
      await getAdmin().auth().getUser(uid);
      results.push(fail('Live auth user delete', 'user still exists'));
    } catch {
      results.push(pass('Live auth user delete'));
    }
    await getAdmin().firestore().collection('users').doc(uid).delete().catch(() => {});
  } catch (e) {
    results.push(fail('Live auth user delete', e.message));
    if (uid) await deleteTestUser(uid);
  }

  return results;
}

module.exports = { testAccountDeletion };
