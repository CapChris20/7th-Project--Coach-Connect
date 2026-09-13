/**
 * Marketplace trainer profile write authorization + public field filtering.
 */

/** Fields safe to return on public marketplace GETs (no email/phone/stripe/private docs). */
const PUBLIC_TRAINER_FIELDS = [
  'uid',
  'id',
  'role',
  'name',
  'displayName',
  'firstName',
  'lastName',
  'photoURL',
  'photoUrl',
  'avatarUrl',
  'location',
  'specialties',
  'specialty',
  'bio',
  'trainerProfileBio',
  'trainingPhilosophy',
  'certifications',
  'credentials',
  'pricing',
  'rate',
  'price',
  'yearsExperience',
  'experience',
  'experienceRange',
  'sessionType',
  'coachingMode',
  'mode',
  'isRemote',
  'available',
  'availability',
  'offerFreeConsultation',
  'flexiblePricingAvailable',
  'onboardingCompleted',
  'rating',
  'reviews',
  'clients',
  'sessions',
  'createdAt',
  'updatedAt',
];

/** Fields trainers may set via POST/PUT (server sets uid/timestamps/stats separately). */
const WRITABLE_TRAINER_FIELDS = [
  'name',
  'displayName',
  'firstName',
  'lastName',
  'photoURL',
  'photoUrl',
  'avatarUrl',
  'location',
  'specialties',
  'specialty',
  'bio',
  'trainerProfileBio',
  'trainingPhilosophy',
  'certifications',
  'credentials',
  'pricing',
  'rate',
  'price',
  'yearsExperience',
  'experience',
  'experienceRange',
  'sessionType',
  'coachingMode',
  'mode',
  'isRemote',
  'available',
  'availability',
  'offerFreeConsultation',
  'flexiblePricingAvailable',
  'inviteCode',
  'onboardingCompleted',
];

function getRequesterUid(req) {
  return String(req.firebaseAuth?.uid || '').trim();
}

function assertTrainerSelf(req, trainerId) {
  const requesterUid = getRequesterUid(req);
  const targetId = String(trainerId || '').trim();
  if (!requesterUid) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }
  if (!targetId) {
    return { ok: false, status: 400, error: 'Trainer id is required' };
  }
  if (requesterUid !== targetId) {
    return { ok: false, status: 403, error: 'Cannot modify other trainer profiles' };
  }
  return { ok: true, requesterUid, targetId };
}

function pickFields(source, allowed) {
  const out = {};
  if (!source || typeof source !== 'object') return out;
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      out[key] = source[key];
    }
  }
  return out;
}

/** Strip private fields from Admin SDK trainer docs before API responses. */
function toPublicTrainerProfile(docId, data = {}) {
  const publicData = pickFields(data, PUBLIC_TRAINER_FIELDS);
  return {
    ...publicData,
    id: docId || publicData.id || publicData.uid || null,
  };
}

function pickWritableTrainerFields(body = {}) {
  return pickFields(body, WRITABLE_TRAINER_FIELDS);
}

module.exports = {
  getRequesterUid,
  assertTrainerSelf,
  toPublicTrainerProfile,
  pickWritableTrainerFields,
  PUBLIC_TRAINER_FIELDS,
  WRITABLE_TRAINER_FIELDS,
};
