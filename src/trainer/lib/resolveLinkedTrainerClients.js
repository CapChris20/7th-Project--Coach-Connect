/**
 * resolve Linked Trainer Clients
 *
 * Purpose: resolve Linked Trainer Clients — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: resolveLinkedTrainerClients
 *
 * @file-header
 */
/**
 * Filter CRM rows to active clients linked on users/{id}.trainerId and resolve display names.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app/config';
import { resolveTrainerClientDisplayName, isGenericClientDisplayName } from '../crm/formatClientName';

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

/**
 * @param {string} trainerUid
 * @param {object[]} rawRows
 * @returns {Promise<object[]>}
 */
export async function resolveLinkedTrainerClients(trainerUid, rawRows) {
  if (!trainerUid || !db || !Array.isArray(rawRows)) return [];

  const linked = [];
  for (const c of rawRows) {
    if (!c?.id || isCrmRowInactive(c)) continue;
    try {
      const userSnap = await getDoc(doc(db, 'users', c.id));
      if (!userSnap.exists()) continue;
      const ud = userSnap.data() || {};
      if (!userLinkedToTrainer(ud, trainerUid)) continue;

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

      linked.push({ ...c, name: resolvedName, photoURL });
    } catch (_) {
      /* skip row */
    }
  }

  linked.sort((a, b) =>
    String(a.name || '').toLowerCase().localeCompare(String(b.name || '').toLowerCase()),
  );
  return linked;
}
