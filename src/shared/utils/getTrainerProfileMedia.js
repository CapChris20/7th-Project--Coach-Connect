/**
 * trainer Profile Media
 *
 * Purpose: trainer Profile Media — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: trainerPhotoUri, resolveTrainerPhotoWithStorageFallback
 *
 * @file-header
 */
import { ref, getDownloadURL } from 'firebase/storage';

/**
 * Resolve a usable profile image URL from trainer / user shapes used across the app.
 * Prefers explicit top-level fields, then common nested marketplace/profile objects.
 */
export function trainerPhotoUri(t) {
  if (!t || typeof t !== 'object') return null;
  const nested =
    (t.profile && (t.profile.photoURL || t.profile.photoUrl || t.profile.imageUrl)) ||
    (t.publicProfile && (t.publicProfile.photoURL || t.publicProfile.photoUrl)) ||
    (t.marketplace && (t.marketplace.photoURL || t.marketplace.photoUrl || t.marketplace.imageUrl)) ||
    null;
  const u =
    nested ||
    t.photoURL ||
    t.photoUrl ||
    t.profilePhoto ||
    t.profile_photo ||
    t.profile_picture ||
    t.profileImageUrl ||
    t.profileImage ||
    t.avatarUrl ||
    t.headshotUrl ||
    t.headshot ||
    t.imageUrl ||
    t.image ||
    t.downloadURL ||
    t.picture ||
    null;
  const s = u != null ? String(u).trim() : '';
  if (!s || s === 'null' || s === 'undefined') return null;
  return s.length > 0 ? s : null;
}

/**
 * Clients often cannot read users/{trainerId}; photos may only exist in Storage at
 * profile_photos/{uid} (public read). If the doc has no usable URL, try Storage once.
 */
export async function resolveTrainerPhotoWithStorageFallback(trainerLike, storage) {
  if (trainerPhotoUri(trainerLike)) return trainerLike;
  const id = trainerLike?.id || trainerLike?.uid;
  if (!storage || !id) return trainerLike;
  try {
    const url = await getDownloadURL(ref(storage, `profile_photos/${id}`));
    if (url && String(url).trim()) {
      return { ...trainerLike, photoURL: url, avatarUrl: trainerLike?.avatarUrl || url };
    }
  } catch (_) {
    /* no object at path */
  }
  return trainerLike;
}
