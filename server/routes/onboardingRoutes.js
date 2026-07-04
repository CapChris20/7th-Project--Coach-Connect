/** Onboarding API (invite codes, complete) */
const admin = require('firebase-admin');
const { writeTrainerClientLinks } = require('../lib/onboardingCompleteLinks');
const { sanitizeOnboardingData } = require('../lib/onboardingSanitize');

function registerOnboardingRoutes(app, deps) {
  const { verifyFirebaseBearerToken } = deps;

// ─────────────────────────────────────────────
// ONBOARDING (server-backed to avoid Expo Go Firestore transport)
// ─────────────────────────────────────────────
function normalizeInviteCodeForServer(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  // Strip TRAINER prefix (case-insensitive), if user pasted it.
  if (/^trainer/i.test(s)) s = s.replace(/^trainer[\-\s]*/i, '').trim();
  // Remove ALL non-alphanumeric characters, uppercase.
  const cleaned = s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  // Must be exactly 6 alphanumeric chars for XXX-XXX format.
  if (cleaned.length !== 6) return null;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
}

app.post('/api/onboarding/check-invite-code', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const code = req.body?.code;
    const normalized = normalizeInviteCodeForServer(code);
    if (!normalized) return res.status(400).json({ error: 'Invalid code format.' });

    const qSnap = await admin
      .firestore()
      .collection('users')
      .where('inviteCode', '==', normalized)
      .limit(1)
      .get();

    return res.json({ exists: !qSnap.empty });
  } catch (e) {
    console.error('POST /api/onboarding/check-invite-code failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to check invite code.' });
  }
});

app.post('/api/onboarding/validate-trainer-code', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const code = req.body?.code;
    const normalized = normalizeInviteCodeForServer(code);
    if (!normalized) return res.status(400).json({ error: 'Invalid code format.' });

    const qSnap = await admin
      .firestore()
      .collection('users')
      .where('inviteCode', '==', normalized)
      .limit(5)
      .get();

    let trainerId = null;
    for (const docSnap of qSnap.docs) {
      const data = docSnap.data() || {};
      if (data?.role === 'trainer') {
        trainerId = docSnap.id;
        break;
      }
    }

    return res.json({ valid: !!trainerId, trainerId });
  } catch (e) {
    console.error('POST /api/onboarding/validate-trainer-code failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to validate trainer code.' });
  }
});

app.post('/api/onboarding/complete', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const uid = req.firebaseAuth?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { finalRole, onboardingData, displayName } = req.body || {};
    const allowedRoles = new Set(['client', 'trainer']);
    const resolvedRole = String(finalRole || onboardingData?.role || 'client');
    if (!allowedRoles.has(resolvedRole)) {
      return res.status(400).json({ error: 'Invalid finalRole.' });
    }

    if (!onboardingData || typeof onboardingData !== 'object') {
      return res.status(400).json({ error: 'Missing onboardingData.' });
    }

    const { sanitized: safeOnboardingData } = sanitizeOnboardingData(onboardingData, { uid });

    const db = admin.firestore();
    const usersRef = db.collection('users');
    const trainersRef = db.collection('trainers');

    // Check existing user doc to decide whether startingWeight should be set.
    const existingSnap = await usersRef.doc(uid).get();
    const existing = existingSnap.exists ? existingSnap.data() : {};

    const updateData = {
      ...safeOnboardingData,
      role: resolvedRole,
      onboardingCompleted: true,
      onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const weight = safeOnboardingData?.weight;
    if (
      (existing?.startingWeight == null || existing?.startingWeight === '') &&
      weight != null &&
      weight !== ''
    ) {
      updateData.startingWeight = weight;
    }

    await usersRef.doc(uid).set(updateData, { merge: true });

    // Write trainer discovery profile.
    if (resolvedRole === 'trainer') {
      const userForMarketplace = await usersRef.doc(uid).get();
      const uPub = userForMarketplace.exists ? userForMarketplace.data() : {};

      const yearsExperience = safeOnboardingData?.yearsExperience || null;
      const experienceMap = {
        less_than_1: 0,
        '1_2': 2,
        '3_5': 4,
        '6_10': 8,
        '10_plus': 10,
      };
      const experience = experienceMap[yearsExperience] ?? 0;

      const certifications = Array.isArray(safeOnboardingData?.certifications)
        ? safeOnboardingData.certifications
        : safeOnboardingData?.certifications || [];

      const specialties = Array.isArray(safeOnboardingData?.specialties)
        ? safeOnboardingData.specialties
        : safeOnboardingData?.specialties || [];

      const specialty =
        specialties?.[0] ||
        (Array.isArray(safeOnboardingData?.specializations)
          ? safeOnboardingData.specializations?.[0]
          : '') ||
        '';

      const sessionType = safeOnboardingData?.sessionType || 'Both';

      const trainerDocData = {
        uid,
        name:
          safeOnboardingData?.name ||
          safeOnboardingData?.firstName ||
          displayName ||
          'Trainer',
        // Marketplace is read by clients; they cannot read users/{trainerId} — mirror public photo on trainers/*.
        photoURL:
          uPub.photoURL ||
          uPub.photoUrl ||
          safeOnboardingData?.photoURL ||
          safeOnboardingData?.photoUrl ||
          null,
        avatarUrl: uPub.avatarUrl || safeOnboardingData?.avatarUrl || null,
        displayName: uPub.displayName || displayName || null,
        location: safeOnboardingData?.location || '',
        specialties,
        bio:
          safeOnboardingData?.trainerProfileBio ||
          safeOnboardingData?.bio ||
          safeOnboardingData?.trainingPhilosophy ||
          null,
        certifications,
        rate: safeOnboardingData?.pricing?.perSession || null,
        pricing: safeOnboardingData?.pricing || {},
        yearsExperience,
        experience,
        available: true,
        // Normalize for marketplace cards + profile UI
        specialty,
        price: safeOnboardingData?.pricing?.perMonth ?? safeOnboardingData?.pricing?.perSession ?? null,
        reviewCount: 0,
        rating: 0,
        availability:
          safeOnboardingData?.trainerAvailabilityStatus === 'waitlist' ? 'Waitlist' : 'Available',
        sessionType,
        isRemote: sessionType === 'Remote',
        experienceRange: yearsExperience,
        tags: [],
        credentials: Array.isArray(certifications) ? certifications.join(', ') : certifications || null,
        clients: 0,
        sessions: 0,
        availableDays: [true, true, true, true, true, false, false],
        offerFreeConsultation: safeOnboardingData?.offerFreeConsultation || false,
        flexiblePricingAvailable: safeOnboardingData?.flexiblePricingAvailable || false,
        inviteCode: safeOnboardingData?.inviteCode || null,
        onboardingCompleted: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await trainersRef.doc(uid).set(trainerDocData, { merge: true });
    }

    // Link client to trainer via trainerId (we do it directly with Admin SDK).
    if (resolvedRole === 'client' && safeOnboardingData?.trainerId) {
      const trainerId = String(safeOnboardingData.trainerId);
      const trainerDoc = await usersRef.doc(trainerId).get();
      if (!trainerDoc.exists || trainerDoc.data()?.role !== 'trainer') {
        return res.json({ success: true, linked: false, reason: 'Invalid trainerId' });
      }

      await writeTrainerClientLinks(db, trainerId, uid, {
        serverTimestamp: () => admin.firestore.FieldValue.serverTimestamp(),
        merge: true,
      });
    }

    return res.json({ success: true, role: resolvedRole });
  } catch (e) {
    console.error('POST /api/onboarding/complete failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to complete onboarding.' });
  }
});

}

module.exports = { registerOnboardingRoutes };
