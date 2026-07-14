const { purgeUserFirestore, PAGE_SIZE } = require('../../functions/lib/purgeUserFirestore');

function makeMockDb() {
  const deleted = [];
  const stores = new Map();

  const makeRef = (path) => ({
    path,
    id: path.split('/').pop(),
    delete: async () => deleted.push(path),
    collection: (name) => makeCollectionRef(`${path}/${name}`),
    listCollections: async () => [],
  });

  const makeCollectionRef = (path) => ({
    path,
    doc: (id) => makeRef(`${path}/${id}`),
    where: () => makeQueryRef(path),
    limit: () => makeQueryRef(path),
    orderBy: () => makeQueryRef(path),
    startAfter: () => makeQueryRef(path),
    get: async () => {
      const docs = [...(stores.get(path) || [])];
      return {
        empty: docs.length === 0,
        size: docs.length,
        docs: docs.slice(0, PAGE_SIZE).map((d) => ({
          id: d.id,
          ref: makeRef(`${path}/${d.id}`),
          data: () => d.data,
        })),
      };
    },
  });

  const makeQueryRef = (path) => ({
    where: () => makeQueryRef(path),
    limit: (n) => ({
      get: async () => {
        const docs = [...(stores.get(path) || [])];
        const slice = docs.splice(0, n || PAGE_SIZE);
        stores.set(path, docs);
        return {
          empty: slice.length === 0,
          size: slice.length,
          docs: slice.map((d) => ({
            id: d.id,
            ref: makeRef(`${path}/${d.id}`),
            data: () => d.data,
          })),
        };
      },
    }),
    get: async () => makeCollectionRef(path).get(),
  });

  const db = {
    deleted,
    stores,
    collection: (name) => makeCollectionRef(name),
    collectionGroup: (name) => makeQueryRef(`group:${name}`),
    recursiveDelete: async (ref) => deleted.push(`recursive:${ref.path}`),
    batch: () => {
      const ops = [];
      return {
        delete: (ref) => ops.push(ref),
        set: (ref) => ops.push(ref),
        commit: async () => deleted.push(...ops.map((r) => r.path)),
      };
    },
    seed(path, id, data = {}) {
      const list = stores.get(path) || [];
      list.push({ id, data });
      stores.set(path, list);
    },
  };

  return db;
}

describe('purgeUserFirestore', () => {
  it('deletes more than PAGE_SIZE trainer_client_links for a client', async () => {
    const db = makeMockDb();
    const uid = 'client-1';

    for (let i = 0; i < 60; i += 1) {
      db.seed('trainer_client_links', `t${i}_${uid}`, { clientId: uid, trainerId: `t${i}` });
    }

    await purgeUserFirestore(db, uid);

    const linkDeletes = db.deleted.filter((p) => p.includes('trainer_client_links'));
    expect(linkDeletes.length).toBeGreaterThanOrEqual(60);
    expect(db.deleted.some((p) => p.includes(`recursive:users/${uid}`))).toBe(true);
  });

  it('clears trainerId on clients when trainer account is deleted', async () => {
    const db = makeMockDb();
    const trainerUid = 'trainer-1';

    for (let i = 0; i < 3; i += 1) {
      db.seed('trainer_client_links', `${trainerUid}_c${i}`, {
        trainerId: trainerUid,
        clientId: `c${i}`,
      });
    }

    await purgeUserFirestore(db, trainerUid);

    expect(db.deleted.length).toBeGreaterThan(0);
  });
});
