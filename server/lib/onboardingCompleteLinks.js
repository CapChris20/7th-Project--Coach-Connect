/**
 * Server-side trainer–client link writes (extracted from onboardingRoutes).
 */
const { sanitizeOnboardingData } = require('./onboardingSanitize');
async function writeTrainerClientLinks(db, trainerId, clientId, { serverTimestamp, merge = true } = {}) {
  const ts = serverTimestamp();
  await db
    .collection('trainer_clients')
    .doc(trainerId)
    .collection('clients')
    .doc(clientId)
    .set(
      {
        id: clientId,
        joinedAt: ts,
        status: 'active',
      },
      { merge },
    );

  await db
    .collection('trainer_client_links')
    .doc(`${trainerId}_${clientId}`)
    .set(
      {
        trainerId,
        clientId,
        joinedAt: ts,
      },
      { merge },
    );
}

/**
 * Mirrors POST /api/onboarding/complete link + user writes for client with trainerId.
 */
async function applyOnboardingCompleteServer({
  db,
  uid,
  finalRole,
  onboardingData,
  displayName,
  serverTimestamp,
  existingUser = {},
}) {
  const usersRef = db.collection('users');
  const { sanitized: safeOnboardingData } = sanitizeOnboardingData(onboardingData, { uid });
  const updateData = {
    ...safeOnboardingData,
    role: finalRole,
    onboardingCompleted: true,
    onboardingCompletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (
    (existingUser?.startingWeight == null || existingUser?.startingWeight === '') &&
    safeOnboardingData?.weight != null &&
    safeOnboardingData.weight !== ''
  ) {
    updateData.startingWeight = safeOnboardingData.weight;
  }

  await usersRef.doc(uid).set(updateData, { merge: true });

  let linked = false;
  if (finalRole === 'client' && safeOnboardingData?.trainerId) {
    const trainerId = String(safeOnboardingData.trainerId);
    const trainerDoc = await usersRef.doc(trainerId).get();
    if (!trainerDoc.exists || trainerDoc.data()?.role !== 'trainer') {
      return { success: true, linked: false, reason: 'Invalid trainerId', role: finalRole };
    }

    await writeTrainerClientLinks(db, trainerId, uid, { serverTimestamp, merge: true });
    linked = true;
  }

  return { success: true, linked, role: finalRole, displayName };
}

module.exports = {
  applyOnboardingCompleteServer,
  writeTrainerClientLinks,
};
