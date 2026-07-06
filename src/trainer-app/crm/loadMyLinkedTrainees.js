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
import { db } from '../../app-start/config';
import { resolveTrainerClientDisplayName, isGenericClientDisplayName } from '../crm/getTraineeDisplayName';
import { mergeTrainerClientProfile } from '../../shared-utils/mergeTrainerClientProfile';

function isCrmRowInactive(c) {
  if (!c || c.archived === true) return true;
  const st = String(c.status || 'active').toLowerCase();
  return st === 'inactive' || st === 'removed' || st === 'deleted';
}

function userLinkedToTrainer(userData, trainerUid) {
  if (!userData || !trainerUid) return false;
  const tid = userData.trainerId;
  if (tid == null || tid === '') return false;
  return String(tid) === String(trainerUid);
}

const BATCH_SIZE = 10;

async function fetchUsersByIds(ids) {
  const userMap = new Map();
  if (!db || !ids.length) return userMap;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    try {
      const usersRef = collection(db, 'users');
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

  const candidates = rawRows.filter((c) => c?.id && !isCrmRowInactive(c));
  const userMap = await fetchUsersByIds(candidates.map((c) => c.id));

  const linked = [];
  for (const c of candidates) {
    try {
      const ud = userMap.get(c.id);
      if (!ud || !userLinkedToTrainer(ud, trainerUid)) continue;

      const resolvedName = resolveTrainerClientDisplayName(c, ud);
      const photoURL = ud.photoURL || c.photoURL || null;

      if (
        resolvedName &&
        !isGenericClientDisplayName(resolvedName) &&
        isGenericClientDisplayName(String(c.name || '').trim())
      ) {
        try {
          await setDoc(
            doc(db, 'trainer_clients', trainerUid, 'clients', c.id),
            { name: resolvedName, updatedAt: serverTimestamp() },
            { merge: true },
          );
        } catch (_) {
          /* ignore heal failures */
        }
      }

      linked.push(
        mergeTrainerClientProfile(
          { ...c, name: resolvedName, photoURL },
          ud,
        ),
      );
    } catch (_) {
      /* skip row */
    }
  }

  linked.sort((a, b) =>
    String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()),
  );
  return linked;
}
