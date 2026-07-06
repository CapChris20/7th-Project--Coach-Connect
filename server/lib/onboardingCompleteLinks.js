/**
 * Server-side trainer–client link writes (extracted from onboardingRoutes).
 */
const { sanitizeOnboardingData } = require('./onboardingSanitize');
async function writeTrainerClientLinks(db, trainerId, clientId, { serverTimestamp, merge = true, profileSnapshot = {} } = {}) {
  const ts = serverTimestamp();
  const snapshot =
    profileSnapshot && typeof profileSnapshot === 'object' && !Array.isArray(profileSnapshot)
      ? profileSnapshot
      : {};
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
        ...snapshot,
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

    await writeTrainerClientLinks(db, trainerId, uid, {
      serverTimestamp,
      merge: true,
      profileSnapshot: {
        name: displayName || safeOnboardingData.name || null,
        email: safeOnboardingData.email || null,
        weight: safeOnboardingData.weight ?? null,
        startingWeight: updateData.startingWeight ?? safeOnboardingData.weight ?? null,
        height: safeOnboardingData.height ?? null,
        age: safeOnboardingData.age ?? null,
        gender: safeOnboardingData.gender || null,
        goals: safeOnboardingData.primaryGoal || safeOnboardingData.goals || null,
        fitnessLevel: safeOnboardingData.fitnessLevel || null,
        equipmentAccess: Array.isArray(safeOnboardingData.equipmentAccess)
          ? safeOnboardingData.equipmentAccess
          : [],
        daysPerWeek: safeOnboardingData.daysPerWeek ?? null,
        injuries: safeOnboardingData.injuries ?? null,
        exercisesDislike: safeOnboardingData.exercisesDislike || null,
        preferredWorkoutTime: safeOnboardingData.preferredWorkoutTime || null,
        trainingEnvironment: safeOnboardingData.trainingEnvironment || null,
      },
    });
    linked = true;
  }

  return { success: true, linked, role: finalRole, displayName };
}

module.exports = {
  applyOnboardingCompleteServer,
  writeTrainerClientLinks,
};
