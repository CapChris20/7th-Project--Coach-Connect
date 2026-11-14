// Keeps trainers/{uid} (marketplace / Find Trainers) in sync with users/{uid} (profile + onboarding).
// Flow: read users doc → merge patch → skip non-trainers → shape public listing → write trainers doc.
// Used after profile save and onboarding complete. Clients read trainers/*, not users/*.

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

// Onboarding stores experience as a range key — map to a number for sorting and cards.
const EXPERIENCE_RANGE_TO_YEARS = {
  less_than_1: 0,
  '1_2': 2,
  '3_5': 4,
  '6_10': 8,
  '10_plus': 10,
  '5_8': 6,
  '8_plus': 9,
};

// ===== MAIN FUNCTION =====

/**
 * Build the public trainers/{uid} document (matches server onboarding complete shape).
 * @param {string} uid
 * @param {object} [userData]
 * @returns {object}
 */
export function buildTrainerMarketplaceDoc(uid, userData = {}) {
  // 1. Stable trainer id from auth uid or stored fields.
  const trainerId = String(uid || userData.uid || userData.id || '').trim();

  // 2. Experience, specialties, and credentials from onboarding + profile.
  const experienceRangeKey = userData.yearsExperience || userData.experienceRange || null;
  const experienceYears = yearsFromExperienceFields(userData, experienceRangeKey);
  const specialtyList = mergeUniqueSpecialtyList(userData);
  const certificationList = normalizeCertificationList(userData);
  const firstSpecialty = specialtyList[0] || '';
  const credentialsLine = certificationList.length
    ? certificationList.join(', ')
    : userData.credentials || null;

  // 3. Session mode, bio, photo, pricing — everything Find Trainers renders.
  const sessionType = userData.sessionType || userData.coachingMode || SESSION_TYPE_BOTH;
  const trainerProfileBio = String(userData.trainerProfileBio || '').trim();
  const trainingPhilosophy = String(userData.trainingPhilosophy || '').trim();
  const marketplaceBio = pickMarketplaceBio(userData, trainerProfileBio, trainingPhilosophy);
  const photoUrl = pickFirstPhotoUrl(userData);
  const pricing =
    userData.pricing && typeof userData.pricing === 'object' ? userData.pricing : {};
  const availabilityStatus = userData.trainerAvailabilityStatus || userData.availability;
  const availabilityLabel = pickAvailabilityLabel(userData, availabilityStatus);
  const isOnWaitlist = availabilityStatus === AVAILABILITY_WAITLIST;
  const isAvailable = !isOnWaitlist && userData.available !== false;
  const publicName = pickPublicDisplayName(userData);
  const locationLabel = String(userData.location || userData.city || '').trim();
  const isRemoteSession = sessionType === SESSION_TYPE_REMOTE;

  // 4. Same key letters clients already read on trainers/{uid}.
  return {
    uid: trainerId,
    id: trainerId,
    role: ROLE_TRAINER,
    name: publicName,
    displayName: userData.displayName || publicName,
    firstName: userData.firstName || null,
    lastName: userData.lastName || null,
    photoURL: photoUrl,
    photoUrl: photoUrl,
    avatarUrl: photoUrl,
    location: locationLabel,
    specialties: specialtyList,
    specialty: firstSpecialty,
    bio: marketplaceBio,
    trainerProfileBio: trainerProfileBio || null,
    trainingPhilosophy: trainingPhilosophy || null,
    certifications: certificationList,
    credentials: credentialsLine,
    pricing,
    rate: pricing.perSession ?? userData.rate ?? null,
    price: pricing.perMonth ?? pricing.perSession ?? userData.price ?? null,
    yearsExperience: experienceRangeKey,
    experience: experienceYears,
    experienceRange: experienceRangeKey,
    sessionType,
    coachingMode: sessionType,
    mode: sessionType,
    isRemote: isRemoteSession,
    available: isAvailable,
    availability: availabilityLabel,
    offerFreeConsultation: userData.offerFreeConsultation === true,
    flexiblePricingAvailable: userData.flexiblePricingAvailable === true,
    inviteCode: userData.inviteCode || null,
    onboardingCompleted: userData.onboardingCompleted === true,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * After users/{uid} changes, merge marketplace fields into trainers/{uid}.
 * @param {import('firebase/firestore').Firestore} firestore
 * @param {string} uid
 * @param {{ patch?: object, forceTrainer?: boolean }} [options]
 * @returns {Promise<object|null>}
 */
export async function syncTrainerMarketplaceDoc(
  firestore,
  uid,
  { patch = {}, forceTrainer = false } = {},
) {
  // Failures first — no db or no uid means nothing to sync.
  if (!firestore || !uid) return null;

  // 1. Load the private user profile, then overlay any fields from this save.
  // vocab: getDoc = one-shot Firestore read; setDoc with merge keeps server-only fields
  const userRef = doc(firestore, USERS_COLLECTION, uid);
  const userSnap = await getDoc(userRef);
  const storedUserFields = userSnap.exists() ? userSnap.data() || {} : {};
  const mergedUserFields = { ...storedUserFields, ...patch, uid };

  // 2. Only trainers get a public trainers/{uid} row (unless forceTrainer for edge fixes).
  const role = String(mergedUserFields.role || '').toLowerCase();
  const roleIsTrainer = role === ROLE_TRAINER;
  const shouldSkipNonTrainer = !forceTrainer && role && !roleIsTrainer;
  if (shouldSkipNonTrainer) return null;

  // 3. Write the listing doc — merge:true keeps fields clients added server-side.
  const marketplaceDoc = buildTrainerMarketplaceDoc(uid, mergedUserFields);
  const trainerRef = doc(firestore, TRAINERS_COLLECTION, uid);
  await setDoc(trainerRef, marketplaceDoc, { merge: true });
  return marketplaceDoc;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging =====

function pickFirstPhotoUrl(userData = {}) {
  if (userData.photoURL) return userData.photoURL;
  if (userData.photoUrl) return userData.photoUrl;
  if (userData.profilePhoto) return userData.profilePhoto;
  if (userData.avatarUrl) return userData.avatarUrl;
  if (userData.photo) return userData.photo;
  return null;
}

function pickPublicDisplayName(userData = {}) {
  const firstName = String(userData.firstName || '').trim();
  const lastName = String(userData.lastName || '').trim();
  const nameFromFirstLast = `${firstName} ${lastName}`.trim();
  const nameField = String(userData.name || '').trim();
  if (nameField) return nameField;
  if (nameFromFirstLast) return nameFromFirstLast;
  const displayNameField = String(userData.displayName || '').trim();
  if (displayNameField) return displayNameField;
  return DEFAULT_TRAINER_NAME;
}

function mergeUniqueSpecialtyList(userData = {}) {
  const specialtyFromArray = Array.isArray(userData.specialties) ? userData.specialties : [];
  const specializationFromArray = Array.isArray(userData.specializations)
    ? userData.specializations
    : [];
  const singleSpecialty = userData.specialty || '';

  const rawSpecialtyTexts = [
    ...specialtyFromArray,
    ...specializationFromArray,
    singleSpecialty,
  ]
    .map((specialtyText) => String(specialtyText).trim())
    .filter(Boolean);

  return keepFirstOfEachLowercase(rawSpecialtyTexts);
}

function keepFirstOfEachLowercase(specialtyTexts) {
  const seenLowercase = new Set();
  const uniqueList = [];
  for (let i = 0; i < specialtyTexts.length; i += 1) {
    const specialtyText = specialtyTexts[i];
    const lookupKey = specialtyText.toLowerCase();
    if (seenLowercase.has(lookupKey)) continue;
    seenLowercase.add(lookupKey);
    uniqueList.push(specialtyText);
  }
  return uniqueList;
}

function normalizeCertificationList(userData = {}) {
  if (Array.isArray(userData.certifications)) {
    return userData.certifications;
  }
  const certificationsAreString =
    typeof userData.certifications === 'string' && userData.certifications.trim();
  if (certificationsAreString) {
    return userData.certifications
      .split(',')
      .map((certText) => certText.trim())
      .filter(Boolean);
  }
  return [];
}

function yearsFromExperienceFields(userData, experienceRangeKey) {
  const mappedYears = EXPERIENCE_RANGE_TO_YEARS[experienceRangeKey];
  if (mappedYears !== undefined) return mappedYears;
  if (typeof userData.experience === 'number') return userData.experience;
  return 0;
}

function pickMarketplaceBio(userData, trainerProfileBio, trainingPhilosophy) {
  if (trainerProfileBio) return trainerProfileBio;
  const profileBio = String(userData.bio || '').trim();
  if (profileBio) return profileBio;
  if (trainingPhilosophy) return trainingPhilosophy;
  return null;
}

function pickAvailabilityLabel(userData, availabilityStatus) {
  const statusIsWaitlist = availabilityStatus === AVAILABILITY_WAITLIST;
  const labelIsWaitlist = userData.availability === AVAILABILITY_WAITLIST_LABEL;
  if (statusIsWaitlist || labelIsWaitlist) {
    return AVAILABILITY_WAITLIST_LABEL;
  }
  return AVAILABILITY_AVAILABLE_LABEL;
}
