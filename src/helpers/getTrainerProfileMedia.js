// Finds a trainer's avatar URL no matter which field/shape the record stores it in.
// Flow: check nested profile objects → check ~12 top-level aliases → if still nothing,
//       fall back to a direct Firebase Storage lookup at profile_photos/{uid}.
// Used anywhere a coach avatar renders (marketplace cards, chat headers, client dashboard).

// vocab: firebase/storage ref + getDownloadURL = point at a file path in Cloud Storage
//        and ask for a public https URL for it
import { ref, getDownloadURL } from 'firebase/storage';

/**
 * Resolve a usable profile image URL from trainer / user shapes used across the app.
 * Prefers explicit top-level fields, then common nested marketplace/profile objects.
 */
// Why so many aliases: trainer records are assembled from the users doc, the marketplace
// sync, and older onboarding writes, each of which named the photo field differently.
// Rather than migrate the data, this reads every known spelling.
export function trainerPhotoUri(t) {
  if (!t || typeof t !== 'object') return null;
  // Nested containers are checked FIRST because when a record has both, the nested
  // profile/marketplace copy is the more recently synced one.
  const nested =
    (t.profile && (t.profile.photoURL || t.profile.photoUrl || t.profile.imageUrl)) ||
    (t.publicProfile && (t.publicProfile.photoURL || t.publicProfile.photoUrl)) ||
    (t.marketplace && (t.marketplace.photoURL || t.marketplace.photoUrl || t.marketplace.imageUrl)) ||
    null;
  // Then the flat aliases, in rough priority order — the `||` chain stops at the first
  // non-empty one. Manipulate here: add a new field name to this chain if a data source
  // starts writing the avatar under a different key.
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
  // The 'null'/'undefined' STRING checks are not paranoia: some writes stringified a
  // missing value, so those exact words are stored in Firestore and would otherwise be
  // handed to <Image source={{ uri: 'null' }} /> as a real URL.
  if (!s || s === 'null' || s === 'undefined') return null;
  return s.length > 0 ? s : null;
}

/**
 * Clients often cannot read users/{trainerId}; photos may only exist in Storage at
 * profile_photos/{uid} (public read). If the doc has no usable URL, try Storage once.
 */
// Returns an ENRICHED COPY of the trainer object (not just a URL) so callers can keep
// passing one object around. On failure it returns the input unchanged, so this is always
// safe to await and the caller never has to null-check the result.
export async function resolveTrainerPhotoWithStorageFallback(trainerLike, storage) {
  // Fast path — the doc already had a usable URL, so skip the network entirely.
  if (trainerPhotoUri(trainerLike)) return trainerLike;
  const id = trainerLike?.id || trainerLike?.uid;
  if (!storage || !id) return trainerLike;
  try {
    // Convention: every trainer's avatar is stored at this exact path with public read,
    // which is why a client can fetch it even when Firestore rules block the users doc.
    // Manipulate here: 'profile_photos/{uid}' must match the upload path and the Storage rules
    const url = await getDownloadURL(ref(storage, `profile_photos/${id}`));
    if (url && String(url).trim()) {
      // Write the URL into both field names so downstream code reading either one works.
      // `trainerLike?.avatarUrl ||` preserves an existing avatarUrl rather than clobbering it.
      return { ...trainerLike, photoURL: url, avatarUrl: trainerLike?.avatarUrl || url };
    }
  } catch (_) {
    // getDownloadURL throws for "file doesn't exist" as well as for permission denials.
    // Both mean "no avatar", which is a normal state — hence swallow, don't log.
    /* no object at path */
  }
  return trainerLike;
}
