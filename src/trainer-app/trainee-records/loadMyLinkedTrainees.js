// Narrows the trainer's raw CRM rows down to clients who are ACTUALLY linked to them right now.
// Flow: drop archived/inactive rows → batch-read those users/{id} docs → keep only ones whose
// trainerId points back at this trainer → resolve a real display name → merge + sort alphabetically.
// Why the double check: a CRM row is the trainer's own copy and can go stale (client switched or
// left), so users/{id}.trainerId is treated as the source of truth for the link.

/**
 * resolve Linked Trainer Clients
 *
 * Purpose: Filter CRM rows to active clients linked on users/{id}.trainerId and resolve display names.
 */
import {
  collection,
  doc,
  documentId,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { resolveTrainerClientDisplayName, isGenericClientDisplayName } from '../trainee-records/getTraineeDisplayName';
import { combineTraineeProfile } from '../../helpers/combineTraineeProfile';

// A row counts as inactive if it's archived or its status says so. Defaulting a MISSING status to
// 'active' matters: early CRM rows were written without the field, and treating those as inactive
// would make long-standing clients vanish from the roster.
function isCrmRowInactive(c) {
  if (!c || c.archived === true) return true;
  const st = String(c.status || 'active').toLowerCase();
  return st === 'inactive' || st === 'removed' || st === 'deleted';
}

// The authoritative link test. Compared as Strings because trainerId has been written as both a
// string and (rarely) a number across app versions, and 'abc' !== new String('abc') style
// mismatches would silently hide clients.
function userLinkedToTrainer(userData, trainerUid) {
  if (!userData || !trainerUid) return false;
  const tid = userData.trainerId;
  // Explicitly reject unset/empty rather than letting it fall through — an empty trainerId means
  // "unassigned", which must never match.
  if (tid == null || tid === '') return false;
  return String(tid) === String(trainerUid);
}

// Firestore's 'in' operator accepts at most 10 values per query, so this is a hard API limit, not
// a tuning knob. Manipulate here only if Firestore raises that cap.
const BATCH_SIZE = 10;

// Bulk-fetch user docs by id, ten at a time. Batching is what keeps this to a handful of queries
// instead of one round trip per client.
async function fetchUsersByIds(ids) {
  const userMap = new Map();
  if (!db || !ids.length) return userMap;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    // Per-chunk try/catch so one failing batch (permissions, offline) still lets the other batches
    // populate the map — the caller then just treats those clients as unlinked for this load.
    try {
      const usersRef = collection(db, 'users');
      // vocab: documentId() = a sentinel that lets you filter on the doc's own ID rather than a
      // field inside it, which is how you fetch a specific set of docs in one query.
      const q = query(usersRef, where(documentId(), 'in', chunk));
      const snap = await getDocs(q);
      snap.forEach((userDoc) => {
        userMap.set(userDoc.id, userDoc.data() || {});
      });
    } catch (_) {
      /* skip chunk */
    }
  }
  return userMap;
}

/**
 * @param {string} trainerUid
 * @param {object[]} rawRows
 * @returns {Promise<object[]>}
 */
export async function loadMyLinkedTrainees(trainerUid, rawRows) {
  if (!trainerUid || !db || !Array.isArray(rawRows)) return [];

  // Filter BEFORE fetching: every row we drop here is a user doc we don't have to read, which is
  // the main cost saving in this function.
  const candidates = rawRows.filter((c) => c?.id && !isCrmRowInactive(c));
  const userMap = await fetchUsersByIds(candidates.map((c) => c.id));

  const linked = [];
  for (const c of candidates) {
    // Per-row try/catch: one malformed client record shouldn't empty the trainer's whole roster.
    try {
      const ud = userMap.get(c.id);
      // No user doc (deleted account, or its batch failed) or the link no longer points here →
      // this person isn't on the roster anymore.
      if (!ud || !userLinkedToTrainer(ud, trainerUid)) continue;

      const resolvedName = resolveTrainerClientDisplayName(c, ud);
      // Prefer the user's own photo over the trainer's cached copy — the user's is more current.
      const photoURL = ud.photoURL || c.photoURL || null;

      // Self-healing write: the CRM row was created before we knew the client's real name (so it
      // says something generic like "Client"), but the user doc now has a real one. Backfill it so
      // future reads — and any other surface reading the CRM row directly — show the right name.
      // All three conditions are required: we must have a real name, and only overwrite a
      // placeholder, never a name the trainer typed themselves.
      if (
        resolvedName &&
        !isGenericClientDisplayName(resolvedName) &&
        isGenericClientDisplayName(String(c.name || '').trim())
      ) {
        try {
          // vocab: { merge: true } = update only these fields, leave the rest of the doc alone
          // (without it, setDoc REPLACES the entire document).
          // vocab: serverTimestamp() = let Firestore stamp the time on write, so it can't be
          // skewed by a wrong clock on the device.
          await setDoc(
            doc(db, 'trainer_clients', trainerUid, 'clients', c.id),
            { name: resolvedName, updatedAt: serverTimestamp() },
            { merge: true },
          );
        } catch (_) {
          /* ignore heal failures */
        }
      }

      // Combine the trainer's CRM row (their notes, tags, status) with the client's live profile.
      // Spreading `c` first then overriding name/photoURL means our freshly resolved values win.
      linked.push(
        combineTraineeProfile(
          { ...c, name: resolvedName, photoURL },
          ud,
        ),
      );
    } catch (_) {
      /* skip row */
    }
  }

  // Alphabetical by name, case-insensitively. localeCompare (not <) so accented names sort where a
  // human would expect them rather than after Z.
  linked.sort((a, b) =>
    String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()),
  );
  return linked;
}
