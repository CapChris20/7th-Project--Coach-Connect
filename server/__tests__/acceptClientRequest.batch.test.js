describe('accept-client batch linking', () => {
  it('commits all three surfaces in a single batch', async () => {
    const batchOps = [];
    const batch = {
      set: jest.fn((ref, data, opts) => batchOps.push({ type: 'set', path: ref.path, data, opts })),
      update: jest.fn(),
      commit: jest.fn(async () => {
        if (batchOps.some((op) => op.path.includes('FAIL'))) {
          throw new Error('batch failed');
        }
      }),
    };

    const db = {
      batch: () => batch,
      collection: (name) => ({
        doc: (id) => ({ path: `${name}/${id}` }),
      }),
    };

    async function linkClientBatch(trainerId, clientId, crmPayload, ts) {
      const linkId = `${trainerId}_${clientId}`;
      const b = db.batch();
      b.set(
        db.collection('trainer_client_links').doc(linkId),
        { trainerId, clientId, name: crmPayload.name, joinedAt: ts, status: 'active' },
        { merge: true },
      );
      b.set(
        { path: `trainer_clients/${trainerId}/clients/${clientId}` },
        crmPayload,
        { merge: true },
      );
      b.set(db.collection('users').doc(clientId), { trainerId }, { merge: true });
      await b.commit();
    }

    await linkClientBatch('t1', 'c1', { name: 'Client' }, 'ts');

    expect(batch.set).toHaveBeenCalledTimes(3);
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(batchOps.map((o) => o.path)).toEqual(
      expect.arrayContaining([
        'trainer_client_links/t1_c1',
        'trainer_clients/t1/clients/c1',
        'users/c1',
      ]),
    );
  });

  it('rolls back when batch commit fails', async () => {
    const batch = {
      set: jest.fn(),
      commit: jest.fn(async () => {
        throw new Error('commit failed');
      }),
    };
    const db = { batch: () => batch, collection: () => ({ doc: () => ({ path: 'x' }) }) };

    await expect(async () => {
      const b = db.batch();
      b.set({ path: 'a' }, {});
      b.set({ path: 'FAIL/b' }, {});
      await b.commit();
    }).rejects.toThrow('commit failed');
  });
});
