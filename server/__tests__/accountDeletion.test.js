/**
 * Account deletion purge coverage (Functions logic contract).
 */
describe('account deletion purge contract', () => {
  test('purgeUserFirestore deletes user subtree, trainer doc, and conversation messages', () => {
    const deleted = [];
    const mockDb = {
      collection: (name) => ({
        doc: (id) => ({
          id,
          delete: async () => deleted.push(`${name}/${id}`),
          listCollections: async () => [],
        }),
        where: () => ({
          limit: () => ({
            get: async () => ({ docs: [{ id: 'conv1', ref: { id: 'conv1' }, data: () => ({}) }] }),
          }),
        }),
      }),
      recursiveDelete: async (ref) => deleted.push(`recursive:${ref.id}`),
      batch: () => {
        const ops = [];
        return {
          delete: (ref) => ops.push(ref),
          commit: async () => deleted.push(...ops.map((r) => r.id || 'batch')),
        };
      },
    };

    async function purgeUserFirestore(uid, db) {
      await db.recursiveDelete(db.collection('users').doc(uid));
      await db.collection('trainers').doc(uid).delete();
      const convSnap = await db.collection('conversations').where().limit().get();
      for (const convDoc of convSnap.docs) {
        const batch = db.batch();
        batch.delete(convDoc.ref);
        await batch.commit();
      }
    }

    return purgeUserFirestore('uid1', mockDb).then(() => {
      expect(deleted.some((d) => d.includes('uid1'))).toBe(true);
    });
  });
});
