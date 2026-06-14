/**
 * Keeps trainers/{uid} (marketplace / Find Trainers) in sync with users/{uid} (profile + onboarding).
 * Clients read trainers/* — not users/* — so profile edits must mirror here.
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';

const EXPERIENCE_MAP = {
  less_than_1: 0,
  '1_2': 2,
  '3_5': 4,
  '6_10': 8,
  '10_plus': 10,
  '5_8': 6,
  '8_plus': 9,
};

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

function pickName(userData = {}) {
  const first = String(userData.firstName || '').trim();
  const last = String(userData.lastName || '').trim();
  const fromParts = `${first} ${last}`.trim();
  return (
    String(userData.name || '').trim() ||
    fromParts ||
    String(userData.displayName || '').trim() ||
    'Trainer'
  );
}

function collectSpecialties(userData = {}) {
  const list = [
    ...(Array.isArray(userData.specialties) ? userData.specialties : []),
    ...(Array.isArray(userData.specializations) ? userData.specializations : []),
    userData.specialty || '',
  ]
    .map((s) => String(s).trim())
    .filter(Boolean);
  const seen = new Set();
  return list.filter((s) => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function collectCertifications(userData = {}) {
  if (Array.isArray(userData.certifications)) return userData.certifications;
  if (typeof userData.certifications === 'string' && userData.certifications.trim()) {
    return userData.certifications.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

/**
 * Build the public marketplace document shape (matches server /api/onboarding/complete).
 * @param {string} uid
 * @param {Record<string, unknown>} userData — merged users/{uid} fields
 */
export function buildTrainerMarketplaceDoc(uid, userData = {}) {
  const id = String(uid || userData.uid || userData.id || '').trim();
  const yearsExperience = userData.yearsExperience || userData.experienceRange || null;
  const experience = EXPERIENCE_MAP[yearsExperience] ?? (typeof userData.experience === 'number' ? userData.experience : 0);
  const specialties = collectSpecialties(userData);
  const certifications = collectCertifications(userData);
  const sessionType = userData.sessionType || userData.coachingMode || 'Both';
  const trainerProfileBio = String(userData.trainerProfileBio || '').trim();
  const trainingPhilosophy = String(userData.trainingPhilosophy || '').trim();
  const bio =
    trainerProfileBio ||
    String(userData.bio || '').trim() ||
    trainingPhilosophy ||
    null;
  const photo = pickPhoto(userData);
  const pricing = userData.pricing && typeof userData.pricing === 'object' ? userData.pricing : {};
  const availabilityStatus = userData.trainerAvailabilityStatus || userData.availability;

  return {
    uid: id,
    id,
    role: 'trainer',
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
    isRemote: sessionType === 'Remote',
    available: availabilityStatus !== 'waitlist' && userData.available !== false,
    availability:
      availabilityStatus === 'waitlist' || userData.availability === 'Waitlist' ? 'Waitlist' : 'Available',
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
 */
export async function syncTrainerMarketplaceDoc(firestore, uid, { patch = {}, forceTrainer = false } = {}) {
  if (!firestore || !uid) return null;

  const userRef = doc(firestore, 'users', uid);
  const userSnap = await getDoc(userRef);
  const base = userSnap.exists() ? userSnap.data() || {} : {};
  const merged = { ...base, ...patch, uid };

  const role = String(merged.role || '').toLowerCase();
  if (!forceTrainer && role && role !== 'trainer') return null;

  const marketplace = buildTrainerMarketplaceDoc(uid, merged);
  await setDoc(doc(firestore, 'trainers', uid), marketplace, { merge: true });
  return marketplace;
}
