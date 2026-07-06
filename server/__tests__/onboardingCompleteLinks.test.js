const { applyOnboardingCompleteServer } = require('../lib/onboardingCompleteLinks');

function makeFirestoreMock() {
  const writes = [];

  function docRef(pathParts) {
    return {
      get: async () => {
        const path = pathParts.join('/');
        if (path === 'users/trainer_1') {
          return { exists: true, data: () => ({ role: 'trainer' }) };
        }
        return { exists: false, data: () => null };
      },
      set: async (data, opts) => {
        writes.push({ path: pathParts.join('/'), data, opts });
      },
      collection(name) {
        return {
          doc(id) {
            return docRef([...pathParts, name, id]);
          },
        };
      },
    };
  }

  const db = {
    collection(name) {
      return {
        doc(id) {
          return docRef([name, id]);
        },
      };
    },
    writes,
  };

  return db;
}

describe('onboardingCompleteLinks trainer CRM snapshot', () => {
  it('writes client profile fields into trainer_clients on link', async () => {
    const db = makeFirestoreMock();

    await applyOnboardingCompleteServer({
      db,
      uid: 'client_1',
      finalRole: 'client',
      onboardingData: {
        trainerId: 'trainer_1',
        weight: 152,
        daysPerWeek: 4,
        primaryGoal: 'build_muscle',
        email: 'client@example.com',
      },
      displayName: 'Alex Client',
      serverTimestamp: () => ({ _seconds: 1 }),
      existingUser: {},
    });

    const crmWrite = db.writes.find((w) => w.path === 'trainer_clients/trainer_1/clients/client_1');
    expect(crmWrite).toBeTruthy();
    expect(crmWrite.data.weight).toBe(152);
    expect(crmWrite.data.daysPerWeek).toBe(4);
    expect(crmWrite.data.goals).toBe('build_muscle');
    expect(crmWrite.data.name).toBe('Alex Client');
  });
});
