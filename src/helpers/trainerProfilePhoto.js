// Finds a trainer's avatar URL no matter which field the record stored it in.
// Flow: check nested profile objects → check the flat aliases → if still nothing, ask Storage.
// Used by marketplace cards, chat headers, and the client dashboard.

import { ref, getDownloadURL } from 'firebase/storage';

// ===== NAMED CONSTANTS =====

const EMPTY_WORD = 'null';
const UNDEFINED_WORD = 'undefined';
const STORAGE_PHOTO_FOLDER = 'profile_photos';

// ===== HELPER FUNCTIONS =====

function photoFromProfileObject(profileObject) {
  if (!profileObject) return null;
  return (
    profileObject.photoURL
    || profileObject.photoUrl
    || profileObject.imageUrl
    || null
  );
}

/**
 * Nested copies are checked first. When both exist, the nested profile is the newer sync.
 * @param {object} trainerRecord
 * @returns {string|null}
 */
function nestedPhotoUrl(trainerRecord) {
  const profilePhoto = photoFromProfileObject(trainerRecord.profile);
  if (profilePhoto) return profilePhoto;

  const publicPhoto = photoFromProfileObject(trainerRecord.publicProfile);
  if (publicPhoto) return publicPhoto;

  const marketplacePhoto = photoFromProfileObject(trainerRecord.marketplace);
  if (marketplacePhoto) return marketplacePhoto;
  return null;
}

/**
 * @param {object} trainerRecord
 * @returns {string|null}
 */
function flatPhotoUrl(trainerRecord) {
  return (
    trainerRecord.photoURL
    || trainerRecord.photoUrl
    || trainerRecord.profilePhoto
    || trainerRecord.profile_photo
    || trainerRecord.profile_picture
    || trainerRecord.profileImageUrl
    || trainerRecord.profileImage
    || trainerRecord.avatarUrl
    || trainerRecord.headshotUrl
    || trainerRecord.headshot
    || trainerRecord.imageUrl
    || trainerRecord.image
    || trainerRecord.downloadURL
    || trainerRecord.picture
    || null
  );
}

function isUsablePhotoText(photoText) {
  if (!photoText) return false;
  if (photoText === EMPTY_WORD) return false;
  if (photoText === UNDEFINED_WORD) return false;
  return true;
}

function storagePathForTrainer(trainerId) {
  // Manipulate here: this path has to match the upload path and the Storage rules.
  return `${STORAGE_PHOTO_FOLDER}/${trainerId}`;
}

// ===== MAIN FUNCTION =====

/**
 * Reads every known spelling. Old onboarding, the users doc, and marketplace sync named this field differently.
 * @param {object} trainerRecord
 * @returns {string|null}
 */
export function trainerPhotoUri(trainerRecord) {
  if (!trainerRecord || typeof trainerRecord !== 'object') return null;
  const photoUrl = nestedPhotoUrl(trainerRecord) || flatPhotoUrl(trainerRecord);
  const photoText = photoUrl != null ? String(photoUrl).trim() : '';
  // Some writes stored the words "null" and "undefined". Those are not URLs.
  if (!isUsablePhotoText(photoText)) return null;
  return photoText;
}

/**
 * Returns a copy of the trainer with photoURL filled in. On a miss, the original object comes back unchanged.
 * vocab: getDownloadURL asks Cloud Storage for an https link. A missing file throws.
 * @param {object} trainerLike
 * @param {object} storage
 * @returns {Promise<object>}
 */
export async function resolveTrainerPhotoWithStorageFallback(trainerLike, storage) {
  if (trainerPhotoUri(trainerLike)) return trainerLike;
  const trainerId = trainerLike?.id || trainerLike?.uid;
  if (!storage || !trainerId) return trainerLike;

  try {
    const downloadUrl = await getDownloadURL(ref(storage, storagePathForTrainer(trainerId)));
    const trimmedUrl = downloadUrl ? String(downloadUrl).trim() : '';
    if (!trimmedUrl) return trainerLike;
    return {
      ...trainerLike,
      photoURL: trimmedUrl,
      avatarUrl: trainerLike?.avatarUrl || trimmedUrl,
    };
  } catch {
    // A missing file and a permission denial both mean there is no avatar to show.
    return trainerLike;
  }
}
