// Narrows the trainer's raw CRM rows down to clients who are actually linked right now.
// Flow: drop archived/inactive → batch-read users/{id} → keep rows whose trainerId matches
// → heal placeholder CRM names → merge profile fields → sort A–Z by display name.
// Used by the paged trainee list. users/{id}.trainerId is the source of truth for the link.
// Read order: constants → small helpers → main recipe → PLUMBING (Firestore batches / heal write).

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

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const TRAINER_CLIENTS_COLLECTION = 'trainer_clients';
const CLIENTS_SUBCOLLECTION = 'clients';
const STATUS_ACTIVE_DEFAULT = 'active';
const STATUS_INACTIVE = 'inactive';
const STATUS_REMOVED = 'removed';
const STATUS_DELETED = 'deleted';
// Manipulate here: Firestore `in` queries accept at most ten ids — API cap, not app tuning.
const FIRESTORE_IN_QUERY_MAX = 10;

// ===== HELPER FUNCTIONS =====

function crmRowIsInactive(crmRow) {
  if (!crmRow) {
    return true;
  }
  if (crmRow.archived === true) {
    return true;
  }

  const statusText = String(crmRow.status || STATUS_ACTIVE_DEFAULT).toLowerCase();
  if (statusText === STATUS_INACTIVE) {
    return true;
  }
  if (statusText === STATUS_REMOVED) {
    return true;
  }
  if (statusText === STATUS_DELETED) {
    return true;
  }
  return false;
}

function pickActiveCrmRowsWithIds(rawRows) {
  const activeRows = [];
  for (const crmRow of rawRows) {
    if (!crmRow?.id) {
      continue;
    }
    if (crmRowIsInactive(crmRow)) {
      continue;
    }
    activeRows.push(crmRow);
  }
  return activeRows;
}

function userProfileLinksToTrainer(userData, trainerUid) {
  if (!userData || !trainerUid) {
    return false;
  }

  const linkedTrainerId = userData.trainerId;
  if (linkedTrainerId == null || linkedTrainerId === '') {
    return false;
  }

  // Compared as strings — trainerId has been written as string or number across app versions.
  const linkedTrainerIdText = String(linkedTrainerId);
  const trainerUidText = String(trainerUid);
  return linkedTrainerIdText === trainerUidText;
}

function compareTraineeNamesForSort(leftClient, rightClient) {
  const leftName = String(leftClient.name || '').toLowerCase();
  const rightName = String(rightClient.name || '').toLowerCase();
  return leftName.localeCompare(rightName);
}

async function collectLinkedProfilesFromCrmRows(activeCrmRows, userDataById, trainerUid) {
  const linkedProfiles = [];
  for (const crmRow of activeCrmRows) {
    const userData = userDataById.get(crmRow.id);
    const profile = await buildLinkedProfileFromCrmRow(crmRow, userData, trainerUid);
    if (profile) {
      linkedProfiles.push(profile);
    }
  }
  return linkedProfiles;
}

// ===== MAIN FUNCTION =====

/**
 * Filter CRM rows to active clients linked on users/{id}.trainerId and resolve display names.
 * @param {string} trainerUid
 * @param {object[]} rawRows
 * @returns {Promise<object[]>}
 */
export async function loadMyLinkedTrainees(trainerUid, rawRows) {
  // 1. Bail when we cannot talk to Firestore or the trainer id is missing.
  if (!trainerUid || !db || !Array.isArray(rawRows)) {
    return [];
  }

  // 2. Drop archived / inactive CRM rows but keep rows that still have a client id.
  const activeCrmRows = pickActiveCrmRowsWithIds(rawRows);

  // 3. Bulk-read users/{id} for every candidate (ten ids per query).
  const userIdList = activeCrmRows.map((crmRow) => crmRow.id);
  const userDataById = await fetchUserDocumentsByIdList(userIdList);

  // 4. Merge each linked row into a roster profile; skip rows that fail or are unlinked.
  const linkedProfiles = await collectLinkedProfilesFromCrmRows(
    activeCrmRows,
    userDataById,
    trainerUid,
  );

  // 5. Sort alphabetically so the trainer list matches human expectations.
  linkedProfiles.sort(compareTraineeNamesForSort);
  return linkedProfiles;
}

// ===== PLUMBING — skip unless debugging =====
// Firestore batch reads and the CRM name-heal write. Main recipe stays above.

async function fetchUserDocumentsByIdList(userIds) {
  const userDataById = new Map();
  if (!db || userIds.length === 0) {
    return userDataById;
  }

  for (let batchStart = 0; batchStart < userIds.length; batchStart += FIRESTORE_IN_QUERY_MAX) {
    const idBatch = userIds.slice(batchStart, batchStart + FIRESTORE_IN_QUERY_MAX);
    await mergeUserBatchIntoMap(idBatch, userDataById);
  }
  return userDataById;
}

async function mergeUserBatchIntoMap(idBatch, userDataById) {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    // vocab: documentId() = filter on doc id, not a field inside the document.
    // vocab: `in` = Firestore "id is one of these" — max 10 values per query.
    const userIdQuery = query(usersRef, where(documentId(), 'in', idBatch));
    const userSnapshot = await getDocs(userIdQuery);
    userSnapshot.forEach((userDoc) => {
      userDataById.set(userDoc.id, userDoc.data() || {});
    });
  } catch (batchError) {
    // Skip this batch — other batches can still populate the map.
  }
}

async function buildLinkedProfileFromCrmRow(crmRow, userData, trainerUid) {
  try {
    return await mergeLinkedTraineeProfile(crmRow, userData, trainerUid);
  } catch (rowError) {
    return null;
  }
}

async function mergeLinkedTraineeProfile(crmRow, userData, trainerUid) {
  if (!userData) {
    return null;
  }
  if (!userProfileLinksToTrainer(userData, trainerUid)) {
    return null;
  }

  const displayName = resolveTrainerClientDisplayName(crmRow, userData);
  // vocab/symbol: ?? not used here — || is intentional for empty-string photo URLs.
  const photoURL = userData.photoURL || crmRow.photoURL || null;

  await backfillGenericCrmNameWhenNeeded(crmRow, trainerUid, displayName);

  const crmRowWithResolvedName = { ...crmRow, name: displayName, photoURL };
  return combineTraineeProfile(crmRowWithResolvedName, userData);
}

async function backfillGenericCrmNameWhenNeeded(crmRow, trainerUid, resolvedName) {
  const crmName = String(crmRow.name || '').trim();
  const resolvedNameIsReal = Boolean(resolvedName) && !isGenericClientDisplayName(resolvedName);
  const crmNameIsPlaceholder = isGenericClientDisplayName(crmName);
  if (!resolvedNameIsReal || !crmNameIsPlaceholder) {
    return;
  }

  try {
    const crmDocPath = doc(
      db,
      TRAINER_CLIENTS_COLLECTION,
      trainerUid,
      CLIENTS_SUBCOLLECTION,
      crmRow.id,
    );
    // vocab: merge true = patch only these fields; serverTimestamp = server-owned clock.
    await setDoc(
      crmDocPath,
      { name: resolvedName, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (healError) {
    // Roster still shows resolvedName for this load even when the write fails.
  }
}
