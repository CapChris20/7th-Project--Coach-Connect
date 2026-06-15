/**
 * schedule Service
 *
 * Purpose: Data/service layer: schedule Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: getScheduleDocId, getScheduleBlocks, subscribeScheduleBlocks, addScheduleBlock, updateScheduleBlock, deleteScheduleBlock
 *
 * @file-header
 */
/**
 * Session schedule — trainer_clients/{trainerId}_{clientId}/schedule/{blockId}
 * Trainer: full CRUD. Client: read-only for their own schedule.
 */

import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../app/config';

const COLLECTION = 'trainer_clients';

export function getScheduleDocId(trainerId, clientId) {
  if (!trainerId || !clientId) return null;
  return `${trainerId}_${clientId}`;
}

/**
 * Get all schedule blocks for a client (optionally filtered by date).
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} [dateKey] - optional YYYY-MM-DD to filter
 * @returns {Promise<Array<{ id: string, ... }>>}
 */
export async function getScheduleBlocks(trainerId, clientId, dateKey = null) {
  if (!db || !trainerId || !clientId) return [];
  const docId = getScheduleDocId(trainerId, clientId);
  const scheduleRef = collection(db, COLLECTION, docId, 'schedule');
  const snap = await getDocs(scheduleRef);
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  if (dateKey) list = list.filter((b) => b.date === dateKey);
  list.sort((a, b) => {
    const d = (a.date || '').localeCompare(b.date || '');
    return d !== 0 ? d : (a.time || '').localeCompare(b.time || '');
  });
  return list;
}

/**
 * Subscribe to schedule blocks for a client (real-time).
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} [dateKey]
 * @param {(blocks: Array) => void} onBlocks
 * @returns {() => void} unsubscribe
 */
export function subscribeScheduleBlocks(trainerId, clientId, dateKey, onBlocks) {
  if (!db || !trainerId || !clientId) return () => {};
  const { onSnapshot } = require('firebase/firestore');
  const docId = getScheduleDocId(trainerId, clientId);
  const scheduleRef = collection(db, COLLECTION, docId, 'schedule');
  const unsub = onSnapshot(scheduleRef, (snap) => {
    let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (dateKey) list = list.filter((b) => b.date === dateKey);
    list.sort((a, b) => {
      const d = (a.date || '').localeCompare(b.date || '');
      return d !== 0 ? d : (a.time || '').localeCompare(b.time || '');
    });
    onBlocks(list);
  }, () => onBlocks([]));
  return unsub;
}

/**
 * Add a schedule block.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {Object} block - type, title, date, time, sessionLink?, notes?, repeat?
 * @returns {Promise<string>} blockId
 */
export async function addScheduleBlock(trainerId, clientId, block) {
  if (!db || !trainerId || !clientId) throw new Error('Missing trainerId or clientId');
  const docId = getScheduleDocId(trainerId, clientId);
  const scheduleRef = collection(db, COLLECTION, docId, 'schedule');
  const payload = {
    trainerId,
    clientId,
    type: block.type || 'Session',
    title: block.title || '',
    date: block.date || '',
    time: block.time || '',
    sessionLink: block.sessionLink || null,
    notes: block.notes || null,
    repeat: block.repeat || 'None',
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(scheduleRef, payload);
  return ref.id;
}

/**
 * Update a schedule block.
 */
export async function updateScheduleBlock(trainerId, clientId, blockId, updates) {
  if (!db || !trainerId || !clientId || !blockId) throw new Error('Missing params');
  const docId = getScheduleDocId(trainerId, clientId);
  const blockRef = doc(db, COLLECTION, docId, 'schedule', blockId);
  await setDoc(blockRef, { ...updates }, { merge: true });
}

/**
 * Delete a schedule block.
 */
export async function deleteScheduleBlock(trainerId, clientId, blockId) {
  if (!db || !trainerId || !clientId || !blockId) throw new Error('Missing params');
  const docId = getScheduleDocId(trainerId, clientId);
  const blockRef = doc(db, COLLECTION, docId, 'schedule', blockId);
  await deleteDoc(blockRef);
}
