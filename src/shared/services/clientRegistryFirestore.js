/**
 * Client registry: canonical clients/{uid}, profile truth in users/{uid}.
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/config';
import { buildClientRegistryDoc } from './clientProfileFirestore';

/** Read clients/{uid} merged with users/{uid} (registry first, user fills gaps). */
export async function fetchClientRegistryProfile(uid) {
  if (!uid || !db) return null;

  let registry = null;
  let user = null;

  try {
    const registrySnap = await getDoc(doc(db, 'clients', String(uid)));
    if (registrySnap.exists()) registry = registrySnap.data();
  } catch (_) {
    /* ignore */
  }

  try {
    const userSnap = await getDoc(doc(db, 'users', String(uid)));
    if (userSnap.exists()) user = userSnap.data();
  } catch (_) {
    /* ignore */
  }

  if (!registry && !user) return null;

  const merged = {
    ...(user || {}),
    ...(registry || {}),
    uid: String(uid),
    id: String(uid),
  };

  const normalized = buildClientRegistryDoc(uid, merged);
  return normalized ? { ...merged, ...normalized } : merged;
}
