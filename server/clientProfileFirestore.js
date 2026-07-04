'use strict';

const {
  buildClientRegistryDoc,
} = require('../src/shared/services/clientProfileFirestore');

/**
 * Merge users + onboarding into clients/{uid} (Admin SDK).
 */
function buildClientRegistryDocForServer(uid, usersData = {}, onboardingData = {}) {
  const merged = { ...usersData, ...onboardingData, uid };
  const base = buildClientRegistryDoc(uid, merged);
  if (!base) return null;
  return {
    ...base,
    updatedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
    ...(base.onboardingCompleted && !usersData.onboardingCompletedAt
      ? { onboardingCompletedAt: require('firebase-admin').firestore.FieldValue.serverTimestamp() }
      : {}),
  };
}

async function upsertClientRegistry(db, uid, usersData = {}, onboardingData = {}) {
  const payload = buildClientRegistryDocForServer(uid, usersData, onboardingData);
  if (!payload) return;
  await db.collection('clients').doc(String(uid)).set(payload, { merge: true });
}

module.exports = {
  buildClientRegistryDocForServer,
  upsertClientRegistry,
};
