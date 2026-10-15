// Keeps trainers/{uid} (marketplace / Find Trainers) in sync with users/{uid} (profile + onboarding).
// Flow: read users/{uid} → merge a patch → skip non-trainers → shape the public doc → write trainers/{uid}.
// Used by: profile save and onboarding complete. Clients read trainers/*, not users/*.

import { doc, getDoc, setDoc } from 'firebase/firestore';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const TRAINERS_COLLECTION = 'trainers';
const ROLE_TRAINER = 'trainer';
const DEFAULT_TRAINER_NAME = 'Trainer';
const SESSION_TYPE_BOTH = 'Both';
const SESSION_TYPE_REMOTE = 'Remote';
const AVAILABILITY_WAITLIST = 'waitlist';
const AVAILABILITY_WAITLIST_LABEL = 'Waitlist';
const AVAILABILITY_AVAILABLE_LABEL = 'Available';

const EXPERIENCE_MAP = {
  less_than_1: 0,
  '1_2': 2,
  '3_5': 4,
  '6_10': 8,
  '10_plus': 10,
  '5_8': 6,
  '8_plus': 9,
};

// ===== HELPER FUNCTIONS =====

/**
 * First photo field that has a value. Older accounts used several names for the same picture.
 * @param {object} [userData]
 * @returns {string|null}
 */
function pickPhoto(userData = {}) {
  return (
    userData.photoURL ||
    userData.photoUrl ||
    userData.profilePhoto ||
    userData.avatarUrl ||
    userData.photo ||
    null
  );
}

/**
 * Display name: stored name, then first+last, then auth displayName, then "Trainer".
 * @param {object} [userData]
 * @returns {string}
 */
function pickName(userData = {}) {
  const firstName = String(userData.firstName || '').trim();
  const lastName = String(userData.lastName || '').trim();
  const fromParts = `${firstName} ${lastName}`.trim();
  return (
    String(userData.name || '').trim() ||
    fromParts ||
    String(userData.displayName || '').trim() ||
    DEFAULT_TRAINER_NAME
  );
}

/**
 * Deduped specialty list from specialties[], specializations[], and a single specialty string.
 * @param {object} [userData]
 * @returns {string[]}
 */
function collectSpecialties(userData = {}) {
  const list = [
    ...(Array.isArray(userData.specialties) ? userData.specialties : []),
    ...(Array.isArray(userData.specializations) ? userData.specializations : []),
    userData.specialty || '',
  ]
    .map((specialtyText) => String(specialtyText).trim())
    .filter(Boolean);
  const seen = new Set();
  return list.filter((specialtyText) => {
    const specialtyKey = specialtyText.toLowerCase();
    if (seen.has(specialtyKey)) return false;
    seen.add(specialtyKey);
    return true;
  });
}

/**
 * Certifications as an array. A comma-separated string from older onboarding is split.
 * @param {object} [userData]
 * @returns {Array}
 */
function collectCertifications(userData = {}) {
  if (Array.isArray(userData.certifications)) return userData.certifications;
  if (typeof userData.certifications === 'string' && userData.certifications.trim()) {
    return userData.certifications.split(',').map((certText) => certText.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Years of experience: mapped onboarding range, or a raw number, or 0.
 * @param {object} userData
 * @param {*} yearsExperience
 * @returns {number}
 */
function resolveExperienceYears(userData, yearsExperience) {
  return EXPERIENCE_MAP[yearsExperience] ?? (typeof userData.experience === 'number' ? userData.experience : 0);
}

/**
 * Bio prefers the dedicated trainer profile field, then a generic bio, then philosophy.
 * @param {object} userData
 * @param {string} trainerProfileBio
 * @param {string} trainingPhilosophy
 * @returns {string|null}
 */
function resolveBio(userData, trainerProfileBio, trainingPhilosophy) {
  return (
    trainerProfileBio ||
    String(userData.bio || '').trim() ||
    trainingPhilosophy ||
    null
  );
}

// ===== MAIN FUNCTION =====

/**
 * Build the public marketplace document shape (matches server /api/onboarding/complete).
 * @param {string} uid
 * @param {Record<string, unknown>} userData — merged users/{uid} fields
 * @returns {object}
 */
export function buildTrainerMarketplaceDoc(uid, userData = {}) {
  const id = String(uid || userData.uid || userData.id || '').trim();
  const yearsExperience = userData.yearsExperience || userData.experienceRange || null;
  const experience = resolveExperienceYears(userData, yearsExperience);
  const specialties = collectSpecialties(userData);
  const certifications = collectCertifications(userData);
  const sessionType = userData.sessionType || userData.coachingMode || SESSION_TYPE_BOTH;
  const trainerProfileBio = String(userData.trainerProfileBio || '').trim();
  const trainingPhilosophy = String(userData.trainingPhilosophy || '').trim();
  const bio = resolveBio(userData, trainerProfileBio, trainingPhilosophy);
  const photo = pickPhoto(userData);
  const pricing = userData.pricing && typeof userData.pricing === 'object' ? userData.pricing : {};
  const availabilityStatus = userData.trainerAvailabilityStatus || userData.availability;

  return {
    uid: id,
    id,
    role: ROLE_TRAINER,
    name: pickName(userData),
    displayName: userData.displayName || pickName(userData),
    firstName: userData.firstName || null,
    lastName: userData.lastName || null,
    photoURL: photo,
    photoUrl: photo,
    avatarUrl: photo,
    location: String(userData.location || userData.city || '').trim(),
    specialties,
    specialty: specialties[0] || '',
    bio,
    trainerProfileBio: trainerProfileBio || null,
    trainingPhilosophy: trainingPhilosophy || null,
    certifications,
    credentials: certifications.length ? certifications.join(', ') : userData.credentials || null,
    pricing,
    rate: pricing.perSession ?? userData.rate ?? null,
    price: pricing.perMonth ?? pricing.perSession ?? userData.price ?? null,
    yearsExperience,
    experience,
    experienceRange: yearsExperience,
    sessionType,
    coachingMode: sessionType,
    mode: sessionType,
    isRemote: sessionType === SESSION_TYPE_REMOTE,
    available: availabilityStatus !== AVAILABILITY_WAITLIST && userData.available !== false,
    availability:
      availabilityStatus === AVAILABILITY_WAITLIST || userData.availability === AVAILABILITY_WAITLIST_LABEL
        ? AVAILABILITY_WAITLIST_LABEL
        : AVAILABILITY_AVAILABLE_LABEL,
    offerFreeConsultation: userData.offerFreeConsultation === true,
    flexiblePricingAvailable: userData.flexiblePricingAvailable === true,
    inviteCode: userData.inviteCode || null,
    onboardingCompleted: userData.onboardingCompleted === true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * After profile (or onboarding) writes users/{uid}, mirror marketplace fields to trainers/{uid}.
 * @param {import('firebase/firestore').Firestore} firestore
 * @param {string} uid
 * @param {{ patch?: Record<string, unknown>, forceTrainer?: boolean }} [options]
 * @returns {Promise<object|null>}
 */
export async function syncTrainerMarketplaceDoc(firestore, uid, { patch = {}, forceTrainer = false } = {}) {
  if (!firestore || !uid) return null;

  const userRef = doc(firestore, USERS_COLLECTION, uid);
  const userSnap = await getDoc(userRef);
  const userDocData = userSnap.exists() ? userSnap.data() || {} : {};
  const mergedUserData = { ...userDocData, ...patch, uid };

  const role = String(mergedUserData.role || '').toLowerCase();
  if (!forceTrainer && role && role !== ROLE_TRAINER) return null;

  const marketplaceDoc = buildTrainerMarketplaceDoc(uid, mergedUserData);
  await setDoc(doc(firestore, TRAINERS_COLLECTION, uid), marketplaceDoc, { merge: true });
  return marketplaceDoc;
}
