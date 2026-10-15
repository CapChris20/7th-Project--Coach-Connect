// Narrows the trainer's raw CRM rows down to clients who are actually linked to them right now.
// Flow: drop archived/inactive rows → batch-read those users/{id} docs → keep only ones whose
// trainerId points back at this trainer → resolve a real display name → merge + sort alphabetically.
// Used by: the paged trainee list. users/{id}.trainerId is the source of truth for the link.

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
// Firestore's `in` operator accepts at most 10 values per query — an API limit, not a tuning knob.
const FIRESTORE_IN_QUERY_MAX = 10;

// ===== HELPER FUNCTIONS =====

/**
 * A row counts as inactive if it's archived or its status says so.
 * Missing status defaults to active: early CRM rows were written without the field.
 * @param {object} crmRow
 * @returns {boolean}
 */
function isCrmRowInactive(crmRow) {
  if (!crmRow || crmRow.archived === true) return true;
  const statusText = String(crmRow.status || STATUS_ACTIVE_DEFAULT).toLowerCase();
  return statusText === STATUS_INACTIVE || statusText === STATUS_REMOVED || statusText === STATUS_DELETED;
}

/**
 * The authoritative link test. Compared as Strings because trainerId has been written as both
 * a string and (rarely) a number across app versions.
 * @param {object} userData
 * @param {string} trainerUid
 * @returns {boolean}
 */
function isUserLinkedToTrainer(userData, trainerUid) {
  if (!userData || !trainerUid) return false;
  const linkedTrainerId = userData.trainerId;
  if (linkedTrainerId == null || linkedTrainerId === '') return false;
  return String(linkedTrainerId) === String(trainerUid);
}

/**
 * Bulk-fetch user docs by id, ten at a time, so this stays a handful of queries.
 * @param {string[]} userIds
 * @returns {Promise<Map<string, object>>}
 */
async function fetchUsersByIds(userIds) {
  const userMap = new Map();
  if (!db || !userIds.length) return userMap;

  for (let startIndex = 0; startIndex < userIds.length; startIndex += FIRESTORE_IN_QUERY_MAX) {
    const idChunk = userIds.slice(startIndex, startIndex + FIRESTORE_IN_QUERY_MAX);
    try {
      const usersRef = collection(db, USERS_COLLECTION);
      // vocab: documentId() = filter on the doc's own ID rather than a field inside it.
      const userIdQuery = query(usersRef, where(documentId(), 'in', idChunk));
      const userSnapshot = await getDocs(userIdQuery);
      userSnapshot.forEach((userDoc) => {
        userMap.set(userDoc.id, userDoc.data() || {});
      });
    } catch (error) {
      /* skip chunk — one failing batch still lets the other batches populate the map */
    }
  }
  return userMap;
}

/**
 * If the CRM row still says a placeholder like "Client" but the user doc has a real name, backfill it.
 * @param {object} crmRow
 * @param {string} trainerUid
 * @param {string} resolvedName
 */
async function healGenericCrmName(crmRow, trainerUid, resolvedName) {
  const crmName = String(crmRow.name || '').trim();
  const hasRealName = Boolean(resolvedName) && !isGenericClientDisplayName(resolvedName);
  const crmNameIsPlaceholder = isGenericClientDisplayName(crmName);
  if (!hasRealName || !crmNameIsPlaceholder) return;

  try {
    // vocab: { merge: true } = update only these fields, leave the rest of the doc alone.
    // vocab: serverTimestamp() = Firestore stamps the time on write, so a wrong phone clock cannot skew it.
    await setDoc(
      doc(db, TRAINER_CLIENTS_COLLECTION, trainerUid, CLIENTS_SUBCOLLECTION, crmRow.id),
      { name: resolvedName, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (error) {
    /* ignore heal failures — the roster still shows the resolved name this load */
  }
}

/**
 * Skip one malformed client so it cannot empty the whole roster.
 * @param {object} crmRow
 * @param {object} userData
 * @param {string} trainerUid
 * @returns {Promise<object|null>}
 */
async function tryLinkedProfileFromRow(crmRow, userData, trainerUid) {
  try {
    return await linkedProfileFromRow(crmRow, userData, trainerUid);
  } catch (error) {
    return null;
  }
}

/**
 * One candidate row: skip if unlinked, heal a placeholder name, then merge CRM + live profile.
 * @param {object} crmRow
 * @param {object} userData
 * @param {string} trainerUid
 * @returns {Promise<object|null>}
 */
async function linkedProfileFromRow(crmRow, userData, trainerUid) {
  if (!userData || !isUserLinkedToTrainer(userData, trainerUid)) return null;

  const resolvedName = resolveTrainerClientDisplayName(crmRow, userData);
  const photoURL = userData.photoURL || crmRow.photoURL || null;
  await healGenericCrmName(crmRow, trainerUid, resolvedName);
  return combineTraineeProfile(
    { ...crmRow, name: resolvedName, photoURL },
    userData,
  );
}

/**
 * Alphabetical by name, case-insensitively. localeCompare so accented names sort where a human expects.
 * @param {object} leftClient
 * @param {object} rightClient
 * @returns {number}
 */
function compareClientNames(leftClient, rightClient) {
  const leftName = String(leftClient.name || '').toLowerCase();
  const rightName = String(rightClient.name || '').toLowerCase();
  return leftName.localeCompare(rightName);
}

// ===== MAIN FUNCTION =====

/**
 * Filter CRM rows to active clients linked on users/{id}.trainerId and resolve display names.
 * @param {string} trainerUid
 * @param {object[]} rawRows
 * @returns {Promise<object[]>}
 */
export async function loadMyLinkedTrainees(trainerUid, rawRows) {
  if (!trainerUid || !db || !Array.isArray(rawRows)) return [];

  const candidates = rawRows.filter((crmRow) => crmRow?.id && !isCrmRowInactive(crmRow));
  const userMap = await fetchUsersByIds(candidates.map((crmRow) => crmRow.id));

  const linked = [];
  for (const crmRow of candidates) {
    const linkedProfile = await tryLinkedProfileFromRow(crmRow, userMap.get(crmRow.id), trainerUid);
    if (linkedProfile) linked.push(linkedProfile);
  }

  linked.sort(compareClientNames);
  return linked;
}
