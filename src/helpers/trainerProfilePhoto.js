// Finds a trainer's avatar URL no matter which field the record stored it in.
// Flow: check nested profile objects → check the flat aliases → if still nothing, ask Storage.
// Used by marketplace cards, chat headers, and the client dashboard.
// Read order: imports → constants → numbered mains → helper / PLUMBING at the bottom.

import { ref, getDownloadURL } from 'firebase/storage';

// ===== NAMED CONSTANTS =====

const EMPTY_WORD = 'null';
const UNDEFINED_WORD = 'undefined';
const STORAGE_PHOTO_FOLDER = 'profile_photos';

// ===== MAIN FUNCTION =====

/**
 * Reads every known spelling. Old onboarding, the users doc, and marketplace sync named this field differently.
 * @param {object} trainerRecord
 * @returns {string|null}
 */
export function trainerPhotoUri(trainerRecord) {
  // 1. Guard: a non-object record has no photo fields.
  if (!trainerRecord || typeof trainerRecord !== 'object') return null;

  // 2. Nested trainer copies beat flat fields when both exist (newer sync path).
  const nestedUrl = photoUrlFromNestedTrainerCopies(trainerRecord);
  let flatUrl = null;
  if (!nestedUrl) {
    flatUrl = photoUrlFromFlatTrainerFields(trainerRecord);
  }
  const photoUrl = nestedUrl || flatUrl;

  // 3. Trim and reject the literal strings "null" / "undefined" some old writes stored.
  let photoText = '';
  if (photoUrl != null) {
    photoText = String(photoUrl).trim();
  }
  if (!photoTextLooksUsable(photoText)) return null;
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
  // 1. If the record already has a usable URL, do not touch Storage.
  if (trainerPhotoUri(trainerLike)) return trainerLike;

  // 2. Without storage or an id we cannot build the folder path.
  const trainerId = trainerIdFromRecord(trainerLike);
  if (!storage || !trainerId) return trainerLike;

  try {
    const storagePath = pathInStorageForTrainerPhoto(trainerId);
    // vocab: ref(storage, path) = a Storage pointer; getDownloadURL turns it into https
    const downloadUrl = await getDownloadURL(ref(storage, storagePath));
    const trimmedUrl = downloadUrl ? String(downloadUrl).trim() : '';
    if (!trimmedUrl) return trainerLike;

    // 3. Spread keeps trainer-only fields; fill both spellings the UI might read.
    const existingAvatarUrl = trainerLike && trainerLike.avatarUrl;
    return {
      ...trainerLike,
      photoURL: trimmedUrl,
      avatarUrl: existingAvatarUrl || trimmedUrl,
    };
  } catch {
    // A missing file and a permission denial both mean there is no avatar to show.
    return trainerLike;
  }
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function trainerIdFromRecord(trainerLike) {
  if (!trainerLike) return null;
  if (trainerLike.id) return trainerLike.id;
  if (trainerLike.uid) return trainerLike.uid;
  return null;
}

function photoFromProfileObject(profileObject) {
  if (!profileObject) return null;
  if (profileObject.photoURL) return profileObject.photoURL;
  if (profileObject.photoUrl) return profileObject.photoUrl;
  if (profileObject.imageUrl) return profileObject.imageUrl;
  return null;
}

/**
 * Nested copies are checked first. When both exist, the nested profile is the newer sync.
 * @param {object} trainerRecord
 * @returns {string|null}
 */
function photoUrlFromNestedTrainerCopies(trainerRecord) {
  const profilePhoto = photoFromProfileObject(trainerRecord.profile);
  if (profilePhoto) return profilePhoto;

  const publicPhoto = photoFromProfileObject(trainerRecord.publicProfile);
  if (publicPhoto) return publicPhoto;

  const marketplacePhoto = photoFromProfileObject(trainerRecord.marketplace);
  if (marketplacePhoto) return marketplacePhoto;
  return null;
}

/**
 * Walk every flat alias older writes used. First hit wins.
 * @param {object} trainerRecord
 * @returns {string|null}
 */
function photoUrlFromFlatTrainerFields(trainerRecord) {
  if (trainerRecord.photoURL) return trainerRecord.photoURL;
  if (trainerRecord.photoUrl) return trainerRecord.photoUrl;
  if (trainerRecord.profilePhoto) return trainerRecord.profilePhoto;
  if (trainerRecord.profile_photo) return trainerRecord.profile_photo;
  if (trainerRecord.profile_picture) return trainerRecord.profile_picture;
  if (trainerRecord.profileImageUrl) return trainerRecord.profileImageUrl;
  if (trainerRecord.profileImage) return trainerRecord.profileImage;
  if (trainerRecord.avatarUrl) return trainerRecord.avatarUrl;
  if (trainerRecord.headshotUrl) return trainerRecord.headshotUrl;
  if (trainerRecord.headshot) return trainerRecord.headshot;
  if (trainerRecord.imageUrl) return trainerRecord.imageUrl;
  if (trainerRecord.image) return trainerRecord.image;
  if (trainerRecord.downloadURL) return trainerRecord.downloadURL;
  if (trainerRecord.picture) return trainerRecord.picture;
  return null;
}

function photoTextLooksUsable(photoText) {
  if (!photoText) return false;
  if (photoText === EMPTY_WORD) return false;
  if (photoText === UNDEFINED_WORD) return false;
  return true;
}

function pathInStorageForTrainerPhoto(trainerId) {
  // Manipulate here: this path has to match the upload path and the Storage rules.
  return `${STORAGE_PHOTO_FOLDER}/${trainerId}`;
}
