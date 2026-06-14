/**
 * Notes & Files — client and trainer can add notes, photos, videos, PDFs.
 * Single source: users/{clientId}/notes_and_files. Each doc has addedBy: 'client' | 'trainer'.
 * Client view: group by "From you" / "From trainer". Trainer view: group by "From client" / "From you".
 */

import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import XLSX from '../../utils/xlsx';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { db, storage } from '../../app/config';
import { postRemotePushNotify } from './pushNotifyApi';
import { randomNotesSharedBody } from '../notifications/pushCopy';

const COLLECTION = 'notes_and_files';
const DOCUMENTS_COLLECTION = 'documents';

async function notifyNotesSharedPush(clientId, addedBy) {
  try {
    if (addedBy === 'trainer') {
      await postRemotePushNotify({
        recipientId: clientId,
        senderName: 'Your coach',
        messageText: randomNotesSharedBody(),
        senderId: 'system_notes',
        notificationType: 'notes_shared',
      });
      return;
    }
    const u = await getDoc(doc(db, 'users', clientId));
    if (!u.exists()) return;
    const tid = u.data()?.trainerId;
    if (!tid) return;
    const name = u.data()?.firstName || u.data()?.name || 'Client';
    await postRemotePushNotify({
      recipientId: tid,
      senderName: name,
      messageText: randomNotesSharedBody(),
      senderId: clientId,
      notificationType: 'notes_shared',
    });
  } catch (_) {
    /* best-effort */
  }
}

function uriToBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Failed to fetch file'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * Upload a file to Storage. clientId = owner of the notes_and_files folder (client's uid).
 * Path: users/{clientId}/notes_and_files/{timestamp}_{safeName}
 */
export async function uploadNotesFile(clientId, localUri, filename, contentType = 'application/octet-stream') {
  if (!storage || !clientId) throw new Error('Storage or clientId not ready');
  const safeName = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `users/${clientId}/${COLLECTION}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  const blob = await uriToBlob(localUri);
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}

/**
 * Upload with progress callback. onProgress(percent 0-100). Returns download URL.
 */
export async function uploadNotesFileWithProgress(clientId, localUri, filename, contentType = 'application/octet-stream', onProgress) {
  if (!storage || !clientId) throw new Error('Storage or clientId not ready');
  const safeName = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `users/${clientId}/${COLLECTION}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  const blob = await uriToBlob(localUri);
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob, { contentType });
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(pct);
        }
      },
      reject,
      async () => {
        try {
          const url = await getDownloadURL(storageRef);
          resolve(url);
        } catch (e) {
          reject(e);
        }
      }
    );
  });
}

/**
 * Add a note. clientId = the user whose notes_and_files we're writing to.
 * addedBy: 'client' when client adds for themselves, 'trainer' when trainer adds for that client.
 */
export async function addNote(clientId, content, addedBy = 'client') {
  if (!db || !clientId) throw new Error('Firestore or clientId not ready');
  const data = {
    type: 'note',
    content: content || '',
    addedBy: addedBy === 'trainer' ? 'trainer' : 'client',
    isRead: addedBy === 'trainer' ? false : true,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'users', clientId, COLLECTION), data);
  void notifyNotesSharedPush(clientId, data.addedBy);
  return { id: docRef.id, ...data, createdAt: new Date() };
}

/**
 * Add a file (photo, video, pdf/doc, spreadsheet). clientId = user whose notes_and_files we're writing to.
 * addedBy: 'client' or 'trainer'.
 * For spreadsheets use type: 'spreadsheet' and optionally pass onProgress to addFileWithProgress instead.
 */
export async function addFile(clientId, { localUri, filename, mimeType, type, size }, addedBy = 'client') {
  if (!db || !storage || !clientId) throw new Error('Firestore/Storage or clientId not ready');
  const contentType = mimeType || 'application/octet-stream';
  const downloadUrl = await uploadNotesFile(clientId, localUri, filename, contentType);
  const fileType =
    type ||
    (mimeType && mimeType.startsWith('video/')
      ? 'video'
      : mimeType && mimeType.startsWith('image/')
        ? 'photo'
        : 'doc');

  let thumbnailUrl = null;
  try {
    if (contentType.startsWith('image/')) {
      const manipulated = await ImageManipulator.manipulateAsync(
        localUri,
        [{ resize: { width: 480 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
      );
      const thumbName = `thumb_${Date.now()}_${(filename || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60)}.jpg`;
      thumbnailUrl = await uploadNotesFile(clientId, manipulated.uri, thumbName, 'image/jpeg');
    } else if (fileType === 'video' || contentType.startsWith('video/')) {
      const { uri: frameUri } = await VideoThumbnails.getThumbnailAsync(localUri, {
        time: 800,
      });
      const thumbName = `thumb_${Date.now()}_video.jpg`;
      thumbnailUrl = await uploadNotesFile(clientId, frameUri, thumbName, 'image/jpeg');
    }
  } catch (e) {
    console.warn('notesAndFilesService addFile: thumbnail skipped', e?.message || e);
  }

  const data = {
    type: fileType,
    url: downloadUrl,
    name: filename || 'File',
    mimeType: contentType,
    addedBy: addedBy === 'trainer' ? 'trainer' : 'client',
    ...(typeof size === 'number' && Number.isFinite(size) ? { size } : {}),
    isRead: addedBy === 'trainer' ? false : true,
    createdAt: serverTimestamp(),
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
  };
  const docRef = await addDoc(collection(db, 'users', clientId, COLLECTION), data);
  void notifyNotesSharedPush(clientId, data.addedBy);
  return { id: docRef.id, ...data, createdAt: new Date() };
}

/**
 * Add a spreadsheet file with upload progress. onProgress(0-100).
 */
export async function addSpreadsheetFile(clientId, { localUri, filename, mimeType, size }, addedBy = 'client', onProgress) {
  if (!db || !storage || !clientId) throw new Error('Firestore/Storage or clientId not ready');
  const contentType = mimeType || 'application/octet-stream';
  const downloadUrl = onProgress
    ? await uploadNotesFileWithProgress(clientId, localUri, filename, contentType, onProgress)
    : await uploadNotesFile(clientId, localUri, filename, contentType);
  const data = {
    type: 'spreadsheet',
    url: downloadUrl,
    name: filename || 'File',
    mimeType: contentType,
    addedBy: addedBy === 'trainer' ? 'trainer' : 'client',
    ...(typeof size === 'number' && Number.isFinite(size) ? { size } : {}),
    isRead: addedBy === 'trainer' ? false : true,
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'users', clientId, COLLECTION), data);
  void notifyNotesSharedPush(clientId, data.addedBy);
  return { id: docRef.id, ...data, createdAt: new Date() };
}

export async function markNotesAndFilesItemRead(clientId, itemId) {
  if (!db || !clientId || !itemId) throw new Error('Missing clientId or itemId');
  const refDoc = doc(db, 'users', String(clientId), COLLECTION, String(itemId));
  await updateDoc(refDoc, { isRead: true });
  return { id: String(itemId), isRead: true };
}

/**
 * Delete a notes_and_files item. Removes Firestore doc and best-effort deletes Storage objects
 * referenced by `url` and `thumbnailUrl` (if present).
 *
 * This is used by BOTH client + trainer UIs.
 */
export async function deleteNotesAndFilesItem(clientId, item) {
  if (!db || !storage || !clientId) throw new Error('Firestore/Storage or clientId not ready');
  const id = typeof item === 'string' ? item : item?.id;
  if (!id) throw new Error('Missing notes_and_files id');

  const url = typeof item === 'object' ? item?.url : null;
  const thumbnailUrl = typeof item === 'object' ? item?.thumbnailUrl : null;

  // Delete Storage refs if present. Use best-effort; missing permissions shouldn’t block doc deletion.
  const maybeDeleteUrl = async (u) => {
    if (!u || typeof u !== 'string') return;
    try {
      await deleteObject(ref(storage, u));
    } catch (e) {
      // Ignore not-found / permission errors; Firestore doc deletion is still useful.
      console.warn('deleteNotesAndFilesItem: storage delete skipped', e?.code || e?.message || e);
    }
  };

  await Promise.all([maybeDeleteUrl(url), maybeDeleteUrl(thumbnailUrl)]);

  const docRef = doc(db, 'users', String(clientId), COLLECTION, String(id));
  await deleteDoc(docRef);
  return { id };
}

/**
 * Fetch all notes and files for a user (client view). Includes shared trainer documents (type: 'document').
 * Uses subcollection path users/{uid}/notes_and_files.
 */
export async function getNotesAndFiles(uid, max = 100) {
  if (!db || !uid) return [];
  try {
    const userDocRef = doc(db, 'users', String(uid));
    const notesRef = collection(userDocRef, COLLECTION);
    const snap = await getDocs(notesRef);
    const list = snap.docs.map((d) => {
      const x = d.data();
      const createdAt = x.createdAt?.toDate?.() || new Date();
      return { id: d.id, ...x, createdAt };
    });
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return list.slice(0, max);
  } catch (e) {
    const code = e?.code;
    const msg = String(e?.message || e || '').toLowerCase();
    const permissionDenied = code === 'permission-denied' || msg.includes('missing or insufficient permissions');
    if (permissionDenied) {
      console.warn(
        'getNotesAndFiles: permission denied for',
        uid,
        '— deploy latest Firestore rules (trainer_clients link) or set client user trainerId.',
      );
    } else {
      console.warn('getNotesAndFiles error:', e?.message || e);
    }
    return [];
  }
}

// ─────────────────────────────────────────────
// Trainer documents (users/{trainerUid}/documents)
// ─────────────────────────────────────────────

export async function getTrainerDocuments(trainerId) {
  if (!db || !trainerId) return [];
  try {
    const userDocRef = doc(db, 'users', String(trainerId));
    const documentsRef = collection(userDocRef, DOCUMENTS_COLLECTION);
    const snap = await getDocs(documentsRef);
    const list = snap.docs.map((d) => {
      const x = d.data();
      const createdAt = x.createdAt?.toDate?.() || new Date();
      const updatedAt = x.updatedAt?.toDate?.() || createdAt;
      return { id: d.id, ...x, createdAt, updatedAt };
    });
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return list;
  } catch (e) {
    const code = e?.code;
    const msg = String(e?.message || e || '').toLowerCase();
    const permissionDenied = code === 'permission-denied' || msg.includes('missing or insufficient permissions');
    if (!permissionDenied) console.warn('getTrainerDocuments error:', e?.message || e);
    return [];
  }
}

/** Coach documents are stored under the trainer uid; only show a doc in a *client* workspace if sharedWith includes that client. */
export function filterTrainerDocumentsForClient(documents, clientId) {
  if (!clientId || !Array.isArray(documents)) return [];
  const cid = String(clientId);
  return documents.filter((d) => Array.isArray(d?.sharedWith) && d.sharedWith.some((id) => String(id) === cid));
}

export async function getTrainerDocument(trainerId, docId) {
  if (!db || !trainerId || !docId) return null;
  try {
    const docRef = doc(db, 'users', String(trainerId), DOCUMENTS_COLLECTION, String(docId));
    const d = await getDoc(docRef);
    if (!d.exists()) return null;
    const x = d.data();
    return { id: d.id, ...x, createdAt: x.createdAt?.toDate?.(), updatedAt: x.updatedAt?.toDate?.() };
  } catch (e) {
    console.warn('getTrainerDocument error:', e?.message || e);
    return null;
  }
}

/** Push latest title + body excerpt to client notes_and_files stubs for shared trainer documents. */
async function syncSharedDocumentPreviewStubs(trainerId, documentId, title, rawBody) {
  const previewSnippet = (typeof rawBody === 'string' ? rawBody : '').replace(/\s+/g, ' ').trim().slice(0, 360);
  const docRef = doc(db, 'users', String(trainerId), DOCUMENTS_COLLECTION, String(documentId));
  const snap = await getDoc(docRef);
  if (!snap.exists()) return;
  const clientIds = snap.data().sharedWith || [];
  const docTitle = (title != null && title !== '' ? title : snap.data().title) || 'Document';
  await Promise.all(
    clientIds.map(async (clientId) => {
      const clientUserRef = doc(db, 'users', String(clientId));
      const clientNotesRef = collection(clientUserRef, COLLECTION);
      const q = query(
        clientNotesRef,
        where('type', '==', 'document'),
        where('documentId', '==', String(documentId)),
        where('trainerId', '==', String(trainerId)),
      );
      const stubSnap = await getDocs(q);
      await Promise.all(
        stubSnap.docs.map((d) =>
          updateDoc(d.ref, {
            title: docTitle,
            previewSnippet: previewSnippet || '',
          }),
        ),
      );
    }),
  );
}

export async function saveTrainerDocument(trainerId, { id, title, body, bodyHtml }) {
  if (!db || !trainerId) throw new Error('Firestore or trainerId not ready');
  const payload = {
    title: title || '',
    body: body || '',
    ...(typeof bodyHtml === 'string' ? { bodyHtml } : {}),
    updatedAt: serverTimestamp(),
  };
  if (id) {
    const docRef = doc(db, 'users', String(trainerId), DOCUMENTS_COLLECTION, String(id));
    await updateDoc(docRef, payload);
    await syncSharedDocumentPreviewStubs(trainerId, id, payload.title, payload.body);
    return { id, ...payload };
  }
  payload.createdAt = serverTimestamp();
  payload.sharedWith = [];
  const userDocRef = doc(db, 'users', String(trainerId));
  const documentsRef = collection(userDocRef, DOCUMENTS_COLLECTION);
  const docRef = await addDoc(documentsRef, payload);
  return { id: docRef.id, ...payload, createdAt: new Date() };
}

// Save spreadsheet-style trainer document with rows/columns and xlsx export.
export async function saveTrainerSpreadsheet(trainerId, { id, title, rows, columnCount, rowCount, formats, colWidths, isFavorite, lastSavedAt }) {
  if (!db || !storage || !trainerId) throw new Error('Firestore/Storage or trainerId not ready');

  const safeTitle = (title || 'Spreadsheet').trim() || 'Spreadsheet';
  const dataRows = Array.isArray(rows) ? rows : [];
  const cols = columnCount || (dataRows[0] ? dataRows[0].length : 0);
  const rCount = rowCount || dataRows.length;

  // Build workbook in memory
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const ab = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

  // Upload xlsx to Storage: uploads/{trainerUid}/spreadsheets/{timestamp}_{title}.xlsx
  const safeName = safeTitle.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `uploads/${trainerId}/spreadsheets/${Date.now()}_${safeName}.xlsx`;
  const storageRef = ref(storage, path);
  const fileUint8 = new Uint8Array(ab);
  await uploadBytes(storageRef, fileUint8, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const downloadUrl = await getDownloadURL(storageRef);

  const payload = {
    title: safeTitle,
    type: 'spreadsheet',
    rows: dataRows,
    columnCount: cols,
    rowCount: rCount,
    ...(formats && typeof formats === 'object' ? { formats } : {}),
    ...(colWidths && typeof colWidths === 'object' ? { colWidths } : {}),
    ...(typeof isFavorite === 'boolean' ? { isFavorite } : {}),
    ...(lastSavedAt ? { lastSavedAt } : {}),
    storageUrl: downloadUrl,
    updatedAt: serverTimestamp(),
  };

  const userDocRef = doc(db, 'users', String(trainerId));
  const documentsRef = collection(userDocRef, DOCUMENTS_COLLECTION);

  if (id) {
    const docRef = doc(documentsRef, String(id));
    await setDoc(docRef, payload, { merge: true });
    return { id, ...payload };
  }

  const newRef = doc(documentsRef);
  await setDoc(newRef, { ...payload, createdAt: serverTimestamp(), sharedWith: [] }, { merge: true });
  return { id: newRef.id, ...payload, createdAt: new Date(), sharedWith: [] };
}

/** Set sharedWith array and sync stubs in users/{clientId}/notes_and_files for each client. */
export async function setDocumentSharedWith(trainerId, docId, clientIds) {
  if (!db || !trainerId || !docId) throw new Error('Missing trainerId or docId');
  const docRef = doc(db, 'users', String(trainerId), DOCUMENTS_COLLECTION, String(docId));
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error('Document not found');
  const docData = docSnap.data();
  const rawBody = typeof docData.body === 'string' ? docData.body : '';
  const previewSnippet = rawBody.replace(/\s+/g, ' ').trim().slice(0, 360);
  const previousShared = docData.sharedWith || [];
  const added = clientIds.filter((c) => !previousShared.includes(c));
  const removed = previousShared.filter((c) => !clientIds.includes(c));

  // Remove stubs for unshared clients
  for (const clientId of removed) {
    const clientUserRef = doc(db, 'users', String(clientId));
    const clientNotesRef = collection(clientUserRef, COLLECTION);
    const q = query(
      clientNotesRef,
      where('type', '==', 'document'),
      where('documentId', '==', String(docId)),
      where('trainerId', '==', String(trainerId))
    );
    const stubSnap = await getDocs(q);
    stubSnap.docs.forEach((d) => deleteDoc(d.ref));
  }

  // Add stubs for newly shared clients — include text snapshot for gallery thumbnails (no file URL on stubs).
  const title = docData.title || 'Document';
  for (const clientId of added) {
    const clientUserRef = doc(db, 'users', String(clientId));
    const clientNotesRef = collection(clientUserRef, COLLECTION);
    await addDoc(clientNotesRef, {
      type: 'document',
      documentId: String(docId),
      trainerId: String(trainerId),
      title,
      ...(previewSnippet ? { previewSnippet } : {}),
      addedBy: 'trainer',
      isRead: false,
      createdAt: serverTimestamp(),
    });
    void notifyNotesSharedPush(clientId, 'trainer');
  }

  await updateDoc(docRef, { sharedWith: clientIds });

  // Sync title + text snapshot onto every client stub still shared (updates previews when coach edits the doc).
  await Promise.all(
    clientIds.map(async (clientId) => {
      const clientUserRef = doc(db, 'users', String(clientId));
      const clientNotesRef = collection(clientUserRef, COLLECTION);
      const q = query(
        clientNotesRef,
        where('type', '==', 'document'),
        where('documentId', '==', String(docId)),
        where('trainerId', '==', String(trainerId)),
      );
      const stubSnap = await getDocs(q);
      await Promise.all(
        stubSnap.docs.map((d) =>
          updateDoc(d.ref, {
            title,
            previewSnippet: previewSnippet || '',
          }),
        ),
      );
    }),
  );

  return { sharedWith: clientIds };
}
