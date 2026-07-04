/**
 * In-memory Firestore + Express harness for Stripe route tests.
 */
const express = require('express');

const firestoreStore = {
  users: {},
  payments: {},
};

function resetFirestoreStore() {
  firestoreStore.users = {};
  firestoreStore.payments = {};
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    out[key] = value;
  }
  return out;
}

function createMockFirestore() {
  const FieldValue = {
    serverTimestamp: () => 'SERVER_TS',
  };

  function docRef(collection, id) {
    return {
      get: async () => {
        const data = firestoreStore[collection]?.[id];
        return {
          exists: data != null,
          data: () => (data ? { ...data } : undefined),
          id,
        };
      },
      set: async (data, options = {}) => {
        if (!firestoreStore[collection]) firestoreStore[collection] = {};
        const prev = firestoreStore[collection][id] || {};
        firestoreStore[collection][id] = options.merge ? deepMerge(prev, data) : { ...data };
      },
    };
  }

  function collection(name) {
    return { doc: (id) => docRef(name, id) };
  }

  const firestoreFn = () => ({ collection });
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

  const verifyFirebaseBearerToken =
    authMiddleware || createAuthMiddleware(uid, email);

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
