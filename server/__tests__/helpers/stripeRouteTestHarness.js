/**
 * In-memory Firestore + Express harness for Stripe route tests.
 */
const express = require('express');

const firestoreStore = {
  users: {},
  payments: {},
  trainer_clients: {},
};

function resetFirestoreStore() {
  firestoreStore.users = {};
  firestoreStore.payments = {};
  firestoreStore.trainer_clients = {};
}

function applyWrite(prev, data, merge) {
  const base = merge ? { ...(prev || {}) } : {};
  for (const [key, value] of Object.entries(data || {})) {
    if (value && typeof value === 'object' && value.__increment != null) {
      base[key] = (Number(base[key]) || 0) + Number(value.__increment);
    } else {
      base[key] = value;
    }
  }
  return base;
}

function createMockFirestore() {
  const FieldValue = {
    serverTimestamp: () => 'SERVER_TS',
    increment: (n) => ({ __increment: n }),
  };

  function docRef(collectionPath, id) {
    return {
      get: async () => {
        const parts = collectionPath.split('/');
        let cursor = firestoreStore;
        for (let i = 0; i < parts.length; i += 1) {
          cursor = cursor?.[parts[i]];
          if (cursor == null) break;
        }
        const data = cursor?.[id];
        return {
          exists: data != null,
          data: () => (data ? { ...data } : undefined),
          id,
        };
      },
      set: async (data, options = {}) => {
        const parts = collectionPath.split('/');
        let cursor = firestoreStore;
        for (let i = 0; i < parts.length; i += 1) {
          const p = parts[i];
          if (!cursor[p] || typeof cursor[p] !== 'object') cursor[p] = {};
          cursor = cursor[p];
        }
        const prev = cursor[id] || {};
        cursor[id] = applyWrite(prev, data, !!options.merge);
      },
      collection: (sub) => ({
        doc: (subId) => docRef(`${collectionPath}/${id}/${sub}`, subId),
      }),
    };
  }

  function collection(name) {
    return {
      doc: (id) => docRef(name, id),
    };
  }

  function batch() {
    const ops = [];
    return {
      set: (ref, data, options) => {
        ops.push(() => ref.set(data, options));
      },
      commit: async () => {
        for (const op of ops) await op();
      },
    };
  }

  const firestoreFn = () => ({ collection, batch });
  firestoreFn.FieldValue = FieldValue;
  return firestoreFn;
}

function createFirebaseAdminMock() {
  return {
    apps: [{ name: 'test-app' }],
    firestore: createMockFirestore(),
  };
}

function createAuthMiddleware(defaultUid = 'user-test', defaultEmail = 'user@test.com') {
  return (req, res, next) => {
    const header = String(req.headers.authorization || '');
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
    }
    req.firebaseAuth = { uid: defaultUid, email: defaultEmail };
    return next();
  };
}

function buildStripeTestApp({ uid = 'user-test', email = 'user@test.com', authMiddleware } = {}) {
  const { registerStripeConnectRoutes } = require('../../routes/stripeConnectRoutes');
  const { registerStripePaymentRoutes } = require('../../routes/stripePaymentRoutes');

  const app = express();
  app.use(express.json());

  const verifyFirebaseBearerToken = authMiddleware || createAuthMiddleware(uid, email);

  const deps = { verifyFirebaseBearerToken };
  registerStripeConnectRoutes(app, deps);
  registerStripePaymentRoutes(app, deps);

  return app;
}

async function postJson(app, path, body = {}, headers = {}) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (_) {
      json = { raw: text };
    }
    return { status: res.status, body: json };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function seedUser(uid, data) {
  firestoreStore.users[uid] = { ...data };
}

function getUser(uid) {
  return firestoreStore.users[uid] ? { ...firestoreStore.users[uid] } : null;
}

function getPayment(id) {
  return firestoreStore.payments[id] ? { ...firestoreStore.payments[id] } : null;
}

function countPayments() {
  return Object.keys(firestoreStore.payments).length;
}

module.exports = {
  firestoreStore,
  resetFirestoreStore,
  createFirebaseAdminMock,
  buildStripeTestApp,
  postJson,
  seedUser,
  getUser,
  getPayment,
  countPayments,
};
