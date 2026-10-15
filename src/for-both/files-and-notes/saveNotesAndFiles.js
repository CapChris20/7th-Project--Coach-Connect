// Notes and files for one client: photos, videos, PDFs, trainer documents, and spreadsheets.
// Flow: upload bytes → write users/{clientId}/notes_and_files → ping the other person.
// Used by client and trainer Notes & Files screens, document editor, and cert uploads.

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
  arrayUnion,
} from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import XLSX from '../../spreadsheet-support/spreadsheetReader';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { db, storage } from '../../app-start/cloudConnection';
import { postRemotePushNotify } from '../online-connection/sendPhoneAlert';
import { randomNotesSharedBody } from '../../notifications/writeAlertText';
import {
  deserializeSpreadsheetRows,
  serializeSpreadsheetRows,
  packSpreadsheetRowsHaveContent,
} from './packSpreadsheetRows';

export { serializeSpreadsheetRows, packSpreadsheetRowsHaveContent };

// ===== NAMED CONSTANTS =====

const COLLECTION = 'notes_and_files';
const DOCUMENTS_COLLECTION = 'documents';
const USERS_COLLECTION = 'users';
const TRAINERS_COLLECTION = 'trainers';
const IMPORTED_DATA_COLLECTION = 'importedData';
const ADDED_BY_TRAINER = 'trainer';
const ADDED_BY_CLIENT = 'client';
const TYPE_NOTE = 'note';
const TYPE_SPREADSHEET = 'spreadsheet';
const TYPE_DOCUMENT = 'document';
const TYPE_VIDEO = 'video';
const TYPE_PHOTO = 'photo';
const TYPE_DOC = 'doc';
const DEFAULT_FILE_NAME = 'File';
const DEFAULT_OCTET_STREAM = 'application/octet-stream';
const JPEG_CONTENT_TYPE = 'image/jpeg';
const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NOTES_SHARED_TYPE = 'notes_shared';
const SYSTEM_NOTES_SENDER = 'system_notes';
const DEFAULT_CLIENT_NAME = 'Client';
const DEFAULT_TRAINER_SENDER = 'Your coach';
const DEFAULT_SPREADSHEET_TITLE = 'Spreadsheet';
const DEFAULT_DOCUMENT_TITLE = 'Document';
const IMPORT_STATUS_UPLOADING = 'uploading';
const IMPORT_STATUS_PARSING = 'parsing';
const IMPORT_STATUS_ERROR = 'error';
const FACE_VERIFICATION_PENDING = 'pending';
const PERMISSION_DENIED_CODE = 'permission-denied';
const PERMISSION_DENIED_TEXT = 'missing or insufficient permissions';

// Manipulate here: photo thumbnail width in pixels. Wider = sharper, heavier upload.
const THUMBNAIL_PHOTO_WIDTH = 480;
// Manipulate here: JPEG quality 0–1 for the photo thumbnail.
const THUMBNAIL_JPEG_QUALITY = 0.82;
// Manipulate here: which video frame (ms) becomes the poster image.
const VIDEO_THUMBNAIL_TIME_MS = 800;
const THUMBNAIL_NAME_MAX_CHARS = 60;
const PREVIEW_SNIPPET_MAX_CHARS = 360;
const PREVIEW_SNIPPET_ROW_COUNT = 4;
const IMPORT_ID_NAME_MAX_CHARS = 40;
const DEFAULT_NOTES_LIST_CAP = 100;
const PERCENT_COMPLETE = 100;

const BYTES_PER_KILOBYTE = 1024;
const CERT_MAX_MEGABYTES = 10;
const CERT_MAX_BYTES = CERT_MAX_MEGABYTES * BYTES_PER_KILOBYTE * BYTES_PER_KILOBYTE;
const CERT_TOO_LARGE_MESSAGE = 'File is too large. Maximum size is 10MB.';

// Manipulate here: wait this long after the last keystroke before writing the xlsx.
const XLSX_EXPORT_DEBOUNCE_MS = 2500;
// Manipulate here: wait this long before refreshing client stubs.
const STUB_SYNC_DEBOUNCE_MS = 1500;

const xlsxExportTimers = new Map();
const stubSyncTimers = new Map();

// ===== HELPER FUNCTIONS =====

function addedByValue(addedBy) {
  return addedBy === ADDED_BY_TRAINER ? ADDED_BY_TRAINER : ADDED_BY_CLIENT;
}

function isReadForAddedBy(addedBy) {
  return addedBy === ADDED_BY_TRAINER ? false : true;
}

function safeFileName(filename, fallbackName) {
  return (filename || fallbackName).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function notesStoragePath(clientId, filename) {
  const safeName = safeFileName(filename, 'file');
  return `users/${clientId}/${COLLECTION}/${Date.now()}_${safeName}`;
}

function notesFileTypeFromMime(type, mimeType) {
  if (type) return type;
  if (mimeType && mimeType.startsWith('video/')) return TYPE_VIDEO;
  if (mimeType && mimeType.startsWith('image/')) return TYPE_PHOTO;
  return TYPE_DOC;
}

function optionalSizeField(size) {
  if (typeof size === 'number' && Number.isFinite(size)) return { size };
  return {};
}

function optionalThumbnailField(thumbnailUrl) {
  if (thumbnailUrl) return { thumbnailUrl };
  return {};
}

function normalizeTrainerSpreadsheetDoc(documentRecord) {
  if (!documentRecord || documentRecord.type !== TYPE_SPREADSHEET) return documentRecord;
  return { ...documentRecord, rows: deserializeSpreadsheetRows(documentRecord.rows) };
}

function getTrainerDocStubType(docData) {
  return docData?.type === TYPE_SPREADSHEET ? TYPE_SPREADSHEET : TYPE_DOCUMENT;
}

function isPermissionDeniedError(error) {
  const errorCode = error?.code;
  const errorMessage = String(error?.message || error || '').toLowerCase();
  return errorCode === PERMISSION_DENIED_CODE || errorMessage.includes(PERMISSION_DENIED_TEXT);
}

function reportUploadPercent(snapshot, onProgress) {
  if (!onProgress || snapshot.totalBytes <= 0) return;
  const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * PERCENT_COMPLETE);
  onProgress(percent);
}

// vocab: XMLHttpRequest blob fetch — React Native Storage needs raw bytes, not a file:// uri.
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

function base64ToUploadBlob(base64, contentType) {
  const dataUri = `data:${contentType};base64,${base64}`;
  return fetch(dataUri).then((response) => response.blob());
}

function waitForResumableUpload(storageRef, blob, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob, { contentType });
    uploadTask.on(
      'state_changed',
      (snapshot) => reportUploadPercent(snapshot, onProgress),
      reject,
      resolve,
    );
  });
}

async function notifyClientOfTrainerNote(clientId) {
  await postRemotePushNotify({
    recipientId: clientId,
    senderName: DEFAULT_TRAINER_SENDER,
    messageText: randomNotesSharedBody(),
    senderId: SYSTEM_NOTES_SENDER,
    notificationType: NOTES_SHARED_TYPE,
  });
}

async function notifyTrainerOfClientNote(clientId) {
  const userSnapshot = await getDoc(doc(db, USERS_COLLECTION, clientId));
  if (!userSnapshot.exists()) return;
  const trainerId = userSnapshot.data()?.trainerId;
  if (!trainerId) return;
  const senderName = userSnapshot.data()?.firstName || userSnapshot.data()?.name || DEFAULT_CLIENT_NAME;
  await postRemotePushNotify({
    recipientId: trainerId,
    senderName,
    messageText: randomNotesSharedBody(),
    senderId: clientId,
    notificationType: NOTES_SHARED_TYPE,
  });
}

async function notifyNotesSharedPush(clientId, addedBy) {
  try {
    if (addedBy === ADDED_BY_TRAINER) {
      await notifyClientOfTrainerNote(clientId);
      return;
    }
    await notifyTrainerOfClientNote(clientId);
  } catch (_) {
    /* best-effort */
  }
}

async function thumbnailUrlForPhoto(clientId, localUri, filename) {
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: THUMBNAIL_PHOTO_WIDTH } }],
    { compress: THUMBNAIL_JPEG_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  );
  const safeName = safeFileName(filename || 'photo', 'photo').slice(0, THUMBNAIL_NAME_MAX_CHARS);
  const thumbName = `thumb_${Date.now()}_${safeName}.jpg`;
  return uploadNotesFile(clientId, manipulated.uri, thumbName, JPEG_CONTENT_TYPE);
}

async function thumbnailUrlForVideo(clientId, localUri) {
  const { uri: frameUri } = await VideoThumbnails.getThumbnailAsync(localUri, {
    time: VIDEO_THUMBNAIL_TIME_MS,
  });
  const thumbName = `thumb_${Date.now()}_video.jpg`;
  return uploadNotesFile(clientId, frameUri, thumbName, JPEG_CONTENT_TYPE);
}

async function thumbnailUrlForUploadedFile(clientId, localUri, filename, contentType, fileType) {
  try {
    if (contentType.startsWith('image/')) {
      return await thumbnailUrlForPhoto(clientId, localUri, filename);
    }
    if (fileType === TYPE_VIDEO || contentType.startsWith('video/')) {
      return await thumbnailUrlForVideo(clientId, localUri);
    }
    return null;
  } catch (error) {
    console.warn('notesAndFilesService addFile: thumbnail skipped', error?.message || error);
    return null;
  }
}

/** Upload xlsx via data-uri blob — avoids expo-file-system Base64 write (ERR_ARGUMENT_CAST on SDK 54). */
async function uploadSpreadsheetXlsx(trainerId, documentId, dataRows) {
  if (!storage) return null;
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(dataRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const base64 = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
  const path = `users/${trainerId}/notes_and_files/spreadsheets/${documentId}.xlsx`;
  const storageRef = ref(storage, path);
  const blob = await base64ToUploadBlob(base64, XLSX_CONTENT_TYPE);
  await uploadBytes(storageRef, blob, { contentType: XLSX_CONTENT_TYPE });
  return getDownloadURL(storageRef);
}

function scheduleSpreadsheetXlsxExport(trainerId, documentId, dataRows, documentRef) {
  const timerKey = String(documentId);
  if (xlsxExportTimers.has(timerKey)) clearTimeout(xlsxExportTimers.get(timerKey));
  const timer = setTimeout(() => {
    xlsxExportTimers.delete(timerKey);
    void uploadSpreadsheetXlsx(trainerId, documentId, dataRows)
      .then((storageUrl) => {
        if (storageUrl) return updateDoc(documentRef, { storageUrl });
        return null;
      })
      .catch((error) => {
        console.warn('saveTrainerSpreadsheet: xlsx export skipped', error?.code || error?.message || error);
      });
  }, XLSX_EXPORT_DEBOUNCE_MS);
  xlsxExportTimers.set(timerKey, timer);
}

/** Debounced client stub preview sync — avoids N Firestore reads/writes on every autosave keystroke. */
function scheduleSharedStubSync(trainerId, documentId, overrides = {}) {
  const timerKey = `${trainerId}:${documentId}`;
  if (stubSyncTimers.has(timerKey)) clearTimeout(stubSyncTimers.get(timerKey));
  const timer = setTimeout(() => {
    stubSyncTimers.delete(timerKey);
    void syncSharedTrainerDocStubs(trainerId, documentId, overrides).catch((error) => {
      console.warn('saveTrainerSpreadsheet: stub sync skipped', error?.code || error?.message || error);
    });
  }, STUB_SYNC_DEBOUNCE_MS);
  stubSyncTimers.set(timerKey, timer);
}

function notesItemsFromSnapshot(snapshot) {
  const list = snapshot.docs.map((snapshotDoc) => {
    const data = snapshotDoc.data();
    const createdAt = data.createdAt?.toDate?.() || new Date();
    return { id: snapshotDoc.id, ...data, createdAt };
  });
  list.sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0));
  return list;
}

function trainerDocumentsFromSnapshot(snapshot) {
  const list = snapshot.docs.map((snapshotDoc) => {
    const data = snapshotDoc.data();
    const createdAt = data.createdAt?.toDate?.() || new Date();
    const updatedAt = data.updatedAt?.toDate?.() || createdAt;
    return normalizeTrainerSpreadsheetDoc({ id: snapshotDoc.id, ...data, createdAt, updatedAt });
  });
  list.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
  return list;
}

function warnNotesReadError(error, uid) {
  if (isPermissionDeniedError(error)) {
    console.warn(
      'getNotesAndFiles: permission denied for',
      uid,
      '— deploy latest Firestore rules (trainer_clients link) or set client user trainerId.',
    );
    return;
  }
  console.warn('getNotesAndFiles error:', error?.message || error);
}

function warnTrainerDocumentsError(error) {
  if (isPermissionDeniedError(error)) return;
  console.warn('getTrainerDocuments error:', error?.message || error);
}

function documentIsSharedWithClient(documentRecord, clientId) {
  if (!Array.isArray(documentRecord?.sharedWith)) return false;
  return documentRecord.sharedWith.some((sharedId) => String(sharedId) === clientId);
}

function previewCellsFromRow(row) {
  const cells = Array.isArray(row) ? row : [];
  return cells.map((cell) => String(cell ?? '').trim()).filter(Boolean).join(' · ');
}

function buildSpreadsheetPreviewSnippet(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  return rows
    .slice(0, PREVIEW_SNIPPET_ROW_COUNT)
    .map(previewCellsFromRow)
    .filter(Boolean)
    .join(' | ')
    .slice(0, PREVIEW_SNIPPET_MAX_CHARS);
}

function buildTrainerDocPreviewSnippet(docData, overrides = {}) {
  const stubType = getTrainerDocStubType(docData);
  if (stubType === TYPE_SPREADSHEET) {
    const rows = overrides.rows ?? deserializeSpreadsheetRows(docData?.rows);
    return buildSpreadsheetPreviewSnippet(rows);
  }
  const rawBody = typeof overrides.body === 'string' ? overrides.body : docData?.body;
  return (typeof rawBody === 'string' ? rawBody : '').replace(/\s+/g, ' ').trim().slice(0, PREVIEW_SNIPPET_MAX_CHARS);
}

function trainerDocStubQuery(clientNotesRef, documentId, trainerId) {
  return query(
    clientNotesRef,
    where('documentId', '==', String(documentId)),
    where('trainerId', '==', String(trainerId)),
  );
}

function stubTitleForDoc(docData, stubType, overrides = {}) {
  if (overrides.title != null && overrides.title !== '') return overrides.title;
  if (docData.title) return docData.title;
  return stubType === TYPE_SPREADSHEET ? DEFAULT_SPREADSHEET_TITLE : DEFAULT_DOCUMENT_TITLE;
}

async function updateStubsOnNotesRef(clientNotesRef, documentId, trainerId, stubType, docTitle, previewSnippet) {
  const stubSnap = await getDocs(trainerDocStubQuery(clientNotesRef, documentId, trainerId));
  await Promise.all(
    stubSnap.docs.map((stubDoc) =>
      updateDoc(stubDoc.ref, {
        type: stubType,
        title: docTitle,
        previewSnippet: previewSnippet || '',
      }),
    ),
  );
}

async function updateStubsForOneClient(clientId, documentId, trainerId, stubType, docTitle, previewSnippet) {
  const clientUserRef = doc(db, USERS_COLLECTION, String(clientId));
  const clientNotesRef = collection(clientUserRef, COLLECTION);
  await updateStubsOnNotesRef(clientNotesRef, documentId, trainerId, stubType, docTitle, previewSnippet);
}

async function updateStubsForClientIds(clientIds, documentId, trainerId, stubType, docTitle, previewSnippet) {
  await Promise.all(
    clientIds.map((clientId) =>
      updateStubsForOneClient(clientId, documentId, trainerId, stubType, docTitle, previewSnippet),
    ),
  );
}

/** Push latest title + preview excerpt to client notes_and_files stubs for shared trainer docs/spreadsheets. */
async function syncSharedTrainerDocStubs(trainerId, documentId, overrides = {}) {
  const documentRef = doc(db, USERS_COLLECTION, String(trainerId), DOCUMENTS_COLLECTION, String(documentId));
  const snap = await getDoc(documentRef);
  if (!snap.exists()) return;
  const docData = snap.data();
  const clientIds = docData.sharedWith || [];
  if (!clientIds.length) return;
  const stubType = getTrainerDocStubType(docData);
  const docTitle = stubTitleForDoc(docData, stubType, overrides);
  const previewSnippet = buildTrainerDocPreviewSnippet(docData, overrides);
  await updateStubsForClientIds(clientIds, documentId, trainerId, stubType, docTitle, previewSnippet);
}

async function deleteStorageUrlIfPresent(downloadUrl) {
  if (!downloadUrl || typeof downloadUrl !== 'string') return;
  try {
    await deleteObject(ref(storage, downloadUrl));
  } catch (error) {
    console.warn('deleteNotesAndFilesItem: storage delete skipped', error?.code || error?.message || error);
  }
}

async function deleteStorageUrlsForItem(downloadUrl, thumbnailUrl) {
  await Promise.all([deleteStorageUrlIfPresent(downloadUrl), deleteStorageUrlIfPresent(thumbnailUrl)]);
}

function clientIdsAddedAndRemoved(previousShared, clientIds) {
  const added = clientIds.filter((clientId) => !previousShared.includes(clientId));
  const removed = previousShared.filter((clientId) => !clientIds.includes(clientId));
  return { added, removed };
}

async function removeStubsForUnsharedClient(clientId, docId, trainerId) {
  const clientUserRef = doc(db, USERS_COLLECTION, String(clientId));
  const clientNotesRef = collection(clientUserRef, COLLECTION);
  const stubSnap = await getDocs(trainerDocStubQuery(clientNotesRef, docId, trainerId));
  stubSnap.docs.forEach((stubDoc) => deleteDoc(stubDoc.ref));
}

async function addStubForNewlySharedClient(clientId, docId, trainerId, stubType, title, previewSnippet) {
  const clientUserRef = doc(db, USERS_COLLECTION, String(clientId));
  const clientNotesRef = collection(clientUserRef, COLLECTION);
  await addDoc(clientNotesRef, {
    type: stubType,
    documentId: String(docId),
    trainerId: String(trainerId),
    title,
    ...(previewSnippet ? { previewSnippet } : {}),
    addedBy: ADDED_BY_TRAINER,
    isRead: false,
    createdAt: serverTimestamp(),
  });
  void notifyNotesSharedPush(clientId, ADDED_BY_TRAINER);
}

async function markImportUploadFailed(importRef, error) {
  await updateDoc(importRef, {
    status: IMPORT_STATUS_ERROR,
    error: error?.message || 'Upload failed',
    updatedAt: serverTimestamp(),
  }).catch(() => {});
}

function certificationSheetMeta(filename, safeName, storagePath, contentType, downloadUrl) {
  return {
    fileName: filename || safeName,
    uploadedAt: new Date().toISOString(),
    storagePath,
    fileType: contentType,
    url: downloadUrl,
  };
}

function sheetsWithoutStoragePath(list, storagePath) {
  return list.filter((sheet) => String(sheet?.storagePath || '') !== String(storagePath));
}

// ===== MAIN FUNCTION =====

/**
 * Upload a file to Storage. clientId = owner of the notes_and_files folder (client's uid).
 * Path: users/{clientId}/notes_and_files/{timestamp}_{safeName}
 * @param {string} clientId
 * @param {string} localUri
 * @param {string} filename
 * @param {string} [contentType]
 * @returns {Promise<string>}
 */
export async function uploadNotesFile(clientId, localUri, filename, contentType = DEFAULT_OCTET_STREAM) {
  if (!storage || !clientId) throw new Error('Storage or clientId not ready');
  const path = notesStoragePath(clientId, filename);
  const storageRef = ref(storage, path);
  const blob = await uriToBlob(localUri);
  await uploadBytes(storageRef, blob, { contentType });
  return getDownloadURL(storageRef);
}

/**
 * Upload with progress callback. onProgress(percent 0-100). Returns download URL.
 * @param {string} clientId
 * @param {string} localUri
 * @param {string} filename
 * @param {string} [contentType]
 * @param {Function} [onProgress]
 * @returns {Promise<string>}
 */
export async function uploadNotesFileWithProgress(
  clientId,
  localUri,
  filename,
  contentType = DEFAULT_OCTET_STREAM,
  onProgress,
) {
  if (!storage || !clientId) throw new Error('Storage or clientId not ready');
  const path = notesStoragePath(clientId, filename);
  const storageRef = ref(storage, path);
  const blob = await uriToBlob(localUri);
  await waitForResumableUpload(storageRef, blob, contentType, onProgress);
  return getDownloadURL(storageRef);
}

/**
 * Add a note. clientId = the user whose notes_and_files we're writing to.
 * addedBy: 'client' when client adds for themselves, 'trainer' when trainer adds for that client.
 * @param {string} clientId
 * @param {string} content
 * @param {string} [addedBy]
 * @returns {Promise<object>}
 */
export async function addNote(clientId, content, addedBy = ADDED_BY_CLIENT) {
  if (!db || !clientId) throw new Error('Firestore or clientId not ready');
  const data = {
    type: TYPE_NOTE,
    content: content || '',
    addedBy: addedByValue(addedBy),
    isRead: isReadForAddedBy(addedBy),
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, USERS_COLLECTION, clientId, COLLECTION), data);
  void notifyNotesSharedPush(clientId, data.addedBy);
  return { id: docRef.id, ...data, createdAt: new Date() };
}

/**
 * Add a file (photo, video, pdf/doc, spreadsheet). clientId = user whose notes_and_files we're writing to.
 * addedBy: 'client' or 'trainer'.
 * For spreadsheets use type: 'spreadsheet' and optionally pass onProgress to addFileWithProgress instead.
 * @param {string} clientId
 * @param {{ localUri: string, filename?: string, mimeType?: string, type?: string, size?: number }} file
 * @param {string} [addedBy]
 * @returns {Promise<object>}
 */
export async function addFile(clientId, { localUri, filename, mimeType, type, size }, addedBy = ADDED_BY_CLIENT) {
  // 1. Need Firestore, Storage, and a client id.
  if (!db || !storage || !clientId) throw new Error('Firestore/Storage or clientId not ready');

  // 2. Upload the original file.
  const contentType = mimeType || DEFAULT_OCTET_STREAM;
  const downloadUrl = await uploadNotesFile(clientId, localUri, filename, contentType);
  const fileType = notesFileTypeFromMime(type, mimeType);

  // 3. Best-effort thumbnail for photos and videos.
  const thumbnailUrl = await thumbnailUrlForUploadedFile(clientId, localUri, filename, contentType, fileType);

  // 4. Write the notes_and_files row and ping the other person.
  const data = {
    type: fileType,
    url: downloadUrl,
    name: filename || DEFAULT_FILE_NAME,
    mimeType: contentType,
    addedBy: addedByValue(addedBy),
    ...optionalSizeField(size),
    isRead: isReadForAddedBy(addedBy),
    createdAt: serverTimestamp(),
    ...optionalThumbnailField(thumbnailUrl),
  };
  const docRef = await addDoc(collection(db, USERS_COLLECTION, clientId, COLLECTION), data);
  void notifyNotesSharedPush(clientId, data.addedBy);
  return { id: docRef.id, ...data, createdAt: new Date() };
}

/**
 * Add a spreadsheet file with upload progress. onProgress(0-100).
 * @param {string} clientId
 * @param {{ localUri: string, filename?: string, mimeType?: string, size?: number }} file
 * @param {string} [addedBy]
 * @param {Function} [onProgress]
 * @returns {Promise<object>}
 */
export async function addSpreadsheetFile(clientId, { localUri, filename, mimeType, size }, addedBy = ADDED_BY_CLIENT, onProgress) {
  if (!db || !storage || !clientId) throw new Error('Firestore/Storage or clientId not ready');
  const contentType = mimeType || DEFAULT_OCTET_STREAM;
  const downloadUrl = onProgress
    ? await uploadNotesFileWithProgress(clientId, localUri, filename, contentType, onProgress)
    : await uploadNotesFile(clientId, localUri, filename, contentType);
  const data = {
    type: TYPE_SPREADSHEET,
    url: downloadUrl,
    name: filename || DEFAULT_FILE_NAME,
    mimeType: contentType,
    addedBy: addedByValue(addedBy),
    ...optionalSizeField(size),
    isRead: isReadForAddedBy(addedBy),
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, USERS_COLLECTION, clientId, COLLECTION), data);
  void notifyNotesSharedPush(clientId, data.addedBy);
  return { id: docRef.id, ...data, createdAt: new Date() };
}

/**
 * Mark one notes_and_files item as read.
 * @param {string} clientId
 * @param {string} itemId
 * @returns {Promise<{ id: string, isRead: boolean }>}
 */
export async function markNotesAndFilesItemRead(clientId, itemId) {
  if (!db || !clientId || !itemId) throw new Error('Missing clientId or itemId');
  const refDoc = doc(db, USERS_COLLECTION, String(clientId), COLLECTION, String(itemId));
  await updateDoc(refDoc, { isRead: true });
  return { id: String(itemId), isRead: true };
}

/**
 * Delete a notes_and_files item. Removes Firestore doc and best-effort deletes Storage objects
 * referenced by `url` and `thumbnailUrl` (if present).
 * This is used by BOTH client + trainer UIs.
 * @param {string} clientId
 * @param {string|object} item
 * @returns {Promise<{ id: string }>}
 */
export async function deleteNotesAndFilesItem(clientId, item) {
  // 1. Need Storage, Firestore, and an item id.
  if (!db || !storage || !clientId) throw new Error('Firestore/Storage or clientId not ready');
  const id = typeof item === 'string' ? item : item?.id;
  if (!id) throw new Error('Missing notes_and_files id');

  // 2. Best-effort delete of the file and thumbnail. A missing object must not block the doc delete.
  const downloadUrl = typeof item === 'object' ? item?.url : null;
  const thumbnailUrl = typeof item === 'object' ? item?.thumbnailUrl : null;
  await deleteStorageUrlsForItem(downloadUrl, thumbnailUrl);

  // 3. Remove the Firestore row.
  const documentRef = doc(db, USERS_COLLECTION, String(clientId), COLLECTION, String(id));
  await deleteDoc(documentRef);
  return { id };
}

/**
 * Fetch all notes and files for a user (client view). Includes shared trainer documents (type: 'document').
 * Uses subcollection path users/{uid}/notes_and_files.
 * @param {string} uid
 * @param {number} [max]
 * @returns {Promise<object[]>}
 */
export async function getNotesAndFiles(uid, max = DEFAULT_NOTES_LIST_CAP) {
  // 1. Need a signed-in user and Firestore.
  if (!db || !uid) return [];
  try {
    // 2. Read users/{uid}/notes_and_files, newest first, then cap.
    const userDocRef = doc(db, USERS_COLLECTION, String(uid));
    const notesRef = collection(userDocRef, COLLECTION);
    const snap = await getDocs(notesRef);
    return notesItemsFromSnapshot(snap).slice(0, max);
  } catch (error) {
    warnNotesReadError(error, uid);
    return [];
  }
}

/**
 * Load every document under users/{trainerId}/documents, newest update first.
 * @param {string} trainerId
 * @returns {Promise<object[]>}
 */
export async function getTrainerDocuments(trainerId) {
  if (!db || !trainerId) return [];
  try {
    const userDocRef = doc(db, USERS_COLLECTION, String(trainerId));
    const documentsRef = collection(userDocRef, DOCUMENTS_COLLECTION);
    const snap = await getDocs(documentsRef);
    return trainerDocumentsFromSnapshot(snap);
  } catch (error) {
    warnTrainerDocumentsError(error);
    return [];
  }
}

/**
 * Coach documents are stored under the trainer uid; only show a doc in a *client* workspace if sharedWith includes that client.
 * @param {object[]} documents
 * @param {string} clientId
 * @returns {object[]}
 */
export function filterTrainerDocumentsForClient(documents, clientId) {
  if (!clientId || !Array.isArray(documents)) return [];
  const matchingClientId = String(clientId);
  return documents.filter((documentRecord) => documentIsSharedWithClient(documentRecord, matchingClientId));
}

/**
 * Load one trainer document by id.
 * @param {string} trainerId
 * @param {string} docId
 * @returns {Promise<object|null>}
 */
export async function getTrainerDocument(trainerId, docId) {
  if (!db || !trainerId || !docId) return null;
  try {
    const documentRef = doc(db, USERS_COLLECTION, String(trainerId), DOCUMENTS_COLLECTION, String(docId));
    const documentSnapshot = await getDoc(documentRef);
    if (!documentSnapshot.exists()) return null;
    const data = documentSnapshot.data();
    return normalizeTrainerSpreadsheetDoc({
      id: documentSnapshot.id,
      ...data,
      createdAt: data.createdAt?.toDate?.(),
      updatedAt: data.updatedAt?.toDate?.(),
    });
  } catch (error) {
    console.warn('getTrainerDocument error:', error?.message || error);
    return null;
  }
}

/**
 * Load coach-built spreadsheet for viewing — prefers Firestore row grid over Storage URL.
 * @param {string} trainerId
 * @param {string} documentId
 * @returns {Promise<object|null>}
 */
export async function resolveTrainerSpreadsheetView(trainerId, documentId) {
  const documentRecord = await getTrainerDocument(trainerId, documentId);
  if (!documentRecord || documentRecord.type !== TYPE_SPREADSHEET) return null;
  return documentRecord;
}

/**
 * Resolve a trainer spreadsheet stub to its latest Storage URL for read-only viewing.
 * @param {string} trainerId
 * @param {string} documentId
 * @returns {Promise<string|null>}
 */
export async function resolveTrainerSpreadsheetUrl(trainerId, documentId) {
  const docData = await getTrainerDocument(trainerId, documentId);
  if (!docData || docData.type !== TYPE_SPREADSHEET) return null;
  return docData.storageUrl || null;
}

/**
 * Create or update a trainer text document.
 * @param {string} trainerId
 * @param {{ id?: string, title?: string, body?: string, bodyHtml?: string }} fields
 * @returns {Promise<object>}
 */
export async function saveTrainerDocument(trainerId, { id, title, body, bodyHtml }) {
  if (!db || !trainerId) throw new Error('Firestore or trainerId not ready');
  const payload = {
    title: title || '',
    body: body || '',
    ...(typeof bodyHtml === 'string' ? { bodyHtml } : {}),
    updatedAt: serverTimestamp(),
  };
  if (id) {
    const documentRef = doc(db, USERS_COLLECTION, String(trainerId), DOCUMENTS_COLLECTION, String(id));
    await updateDoc(documentRef, payload);
    await syncSharedTrainerDocStubs(trainerId, id, { title: payload.title, body: payload.body });
    return { id, ...payload };
  }
  payload.createdAt = serverTimestamp();
  payload.sharedWith = [];
  const userDocRef = doc(db, USERS_COLLECTION, String(trainerId));
  const documentsRef = collection(userDocRef, DOCUMENTS_COLLECTION);
  const documentRef = await addDoc(documentsRef, payload);
  return { id: documentRef.id, ...payload, createdAt: new Date() };
}

/**
 * Save spreadsheet-style trainer document with rows/columns and xlsx export.
 * @param {string} trainerId
 * @param {object} fields
 * @returns {Promise<object>}
 */
export async function saveTrainerSpreadsheet(
  trainerId,
  { id, title, rows, columnCount, rowCount, formats, colWidths, rowHeights, sheets, isFavorite, syncClientStubs = false },
) {
  // 1. Need Firestore and a trainer id.
  if (!db || !trainerId) throw new Error('Firestore or trainerId not ready');

  const safeTitle = (title || DEFAULT_SPREADSHEET_TITLE).trim() || DEFAULT_SPREADSHEET_TITLE;
  const dataRows = Array.isArray(rows) ? rows : [];
  const cols = columnCount || (dataRows[0] ? dataRows[0].length : 0);
  const rCount = rowCount || dataRows.length;

  const userDocRef = doc(db, USERS_COLLECTION, String(trainerId));
  const documentsRef = collection(userDocRef, DOCUMENTS_COLLECTION);
  const docId = id ? String(id) : doc(documentsRef).id;
  const isNew = !id;

  // 2. Pack rows as { cells } so Firestore will store them.
  const payload = {
    title: safeTitle,
    type: TYPE_SPREADSHEET,
    rows: serializeSpreadsheetRows(dataRows),
    columnCount: cols,
    rowCount: rCount,
    ...(formats && typeof formats === 'object' ? { formats } : {}),
    ...(colWidths && typeof colWidths === 'object' ? { colWidths } : {}),
    ...(rowHeights && typeof rowHeights === 'object' ? { rowHeights } : {}),
    ...(Array.isArray(sheets) && sheets.length ? { sheets } : {}),
    ...(typeof isFavorite === 'boolean' ? { isFavorite } : {}),
    updatedAt: serverTimestamp(),
  };

  // 3. New doc gets createdAt + empty sharedWith. Edits may refresh client stubs.
  const documentRef = doc(documentsRef, docId);
  if (isNew) {
    await setDoc(documentRef, { ...payload, createdAt: serverTimestamp(), sharedWith: [] }, { merge: true });
  } else {
    await setDoc(documentRef, payload, { merge: true });
    if (syncClientStubs) {
      scheduleSharedStubSync(trainerId, docId, { title: safeTitle, rows: dataRows });
    }
  }

  // 4. Debounced xlsx export for the download URL.
  scheduleSpreadsheetXlsxExport(trainerId, docId, dataRows, documentRef);

  return {
    id: docId,
    ...payload,
    ...(isNew ? { createdAt: new Date(), sharedWith: [] } : {}),
  };
}

/**
 * Set sharedWith array and sync stubs in users/{clientId}/notes_and_files for each client.
 * @param {string} trainerId
 * @param {string} docId
 * @param {string[]} clientIds
 * @returns {Promise<{ sharedWith: string[] }>}
 */
export async function setDocumentSharedWith(trainerId, docId, clientIds) {
  // 1. Need the trainer document.
  if (!db || !trainerId || !docId) throw new Error('Missing trainerId or docId');
  const documentRef = doc(db, USERS_COLLECTION, String(trainerId), DOCUMENTS_COLLECTION, String(docId));
  const docSnap = await getDoc(documentRef);
  if (!docSnap.exists()) throw new Error('Document not found');

  const docData = docSnap.data();
  const stubType = getTrainerDocStubType(docData);
  const previewSnippet = buildTrainerDocPreviewSnippet(docData);
  const previousShared = docData.sharedWith || [];
  const { added, removed } = clientIdsAddedAndRemoved(previousShared, clientIds);

  // 2. Drop stubs for people who lost access.
  for (const clientId of removed) {
    await removeStubsForUnsharedClient(clientId, docId, trainerId);
  }

  // 3. Add stubs for newly shared clients — include text snapshot for gallery thumbnails (no file URL on stubs).
  const title = docData.title || (stubType === TYPE_SPREADSHEET ? DEFAULT_SPREADSHEET_TITLE : DEFAULT_DOCUMENT_TITLE);
  for (const clientId of added) {
    await addStubForNewlySharedClient(clientId, docId, trainerId, stubType, title, previewSnippet);
  }

  // 4. Save sharedWith and refresh every remaining stub.
  await updateDoc(documentRef, { sharedWith: clientIds });
  await updateStubsForClientIds(clientIds, docId, trainerId, stubType, title, previewSnippet || '');

  return { sharedWith: clientIds };
}

/**
 * Upload a trainer import (PDF/DOC) to trainers/{trainerId}/imports/...
 * Also writes trainers/{trainerId}/importedData/{id} with status.
 * @param {string} trainerId
 * @param {{ localUri: string, filename?: string, mimeType?: string }} file
 * @param {Function} [onProgress]
 * @returns {Promise<object>}
 */
export async function uploadTrainerDocumentImport(trainerId, { localUri, filename, mimeType }, onProgress) {
  // 1. Need Storage, Firestore, and a trainer id.
  if (!storage || !db || !trainerId) throw new Error('Storage/Firestore or trainerId not ready');
  const safeName = safeFileName(filename, 'document');
  const stamp = Date.now();
  const importId = `${stamp}_${safeName.replace(/\.[^.]+$/, '').slice(0, IMPORT_ID_NAME_MAX_CHARS)}`;
  const storagePath = `trainers/${trainerId}/imports/${stamp}_${safeName}`;
  const contentType = mimeType || DEFAULT_OCTET_STREAM;

  const importRef = doc(db, TRAINERS_COLLECTION, trainerId, IMPORTED_DATA_COLLECTION, importId);
  await setDoc(importRef, {
    id: importId,
    filename: filename || safeName,
    mimeType: contentType,
    storagePath,
    status: IMPORT_STATUS_UPLOADING,
    extractedText: '',
    error: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    // 2. Upload the bytes, then mark the import as parsing.
    const storageRef = ref(storage, storagePath);
    const blob = await uriToBlob(localUri);
    await waitForResumableUpload(storageRef, blob, contentType, onProgress);
    const storageUrl = await getDownloadURL(ref(storage, storagePath));
    await updateDoc(importRef, {
      status: IMPORT_STATUS_PARSING,
      storageUrl,
      updatedAt: serverTimestamp(),
    });
    return { importId, storagePath, storageUrl, importRef };
  } catch (error) {
    await markImportUploadFailed(importRef, error);
    throw error;
  }
}

/**
 * Upload certification sheet to trainers/{trainerId}/certifications/{filename}
 * Writes metadata to trainers/{trainerId}.certificationSheets[] (file metadata;
 * trainer cert *names* stay on trainers.certifications string list).
 * @param {string} trainerId
 * @param {{ localUri: string, filename?: string, mimeType?: string, fileSize?: number }} file
 * @param {Function} [onProgress]
 * @returns {Promise<object>}
 */
export async function uploadTrainerCertificationSheet(
  trainerId,
  { localUri, filename, mimeType, fileSize },
  onProgress,
) {
  // 1. Need Storage and a file under the 10MB cap.
  if (!storage || !db || !trainerId) throw new Error('Storage/Firestore or trainerId not ready');
  if (fileSize != null && Number(fileSize) > CERT_MAX_BYTES) {
    throw new Error(CERT_TOO_LARGE_MESSAGE);
  }

  const safeName = safeFileName(filename, 'cert');
  const storagePath = `trainers/${trainerId}/certifications/${Date.now()}_${safeName}`;
  const contentType = mimeType || DEFAULT_OCTET_STREAM;
  const storageRef = ref(storage, storagePath);
  const blob = await uriToBlob(localUri);
  if (blob?.size > CERT_MAX_BYTES) {
    throw new Error(CERT_TOO_LARGE_MESSAGE);
  }

  // 2. Upload, then append the sheet onto trainers/{id}.certificationSheets.
  await waitForResumableUpload(storageRef, blob, contentType, onProgress);
  const downloadUrl = await getDownloadURL(storageRef);
  const meta = certificationSheetMeta(filename, safeName, storagePath, contentType, downloadUrl);
  await setDoc(
    doc(db, TRAINERS_COLLECTION, trainerId),
    {
      certificationSheets: arrayUnion(meta),
      // Also mirror onto certificationsDocuments for clients reading marketplace-safe fields
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return { path: storagePath, url: downloadUrl, meta };
}

/**
 * Remove a certification sheet from Storage + trainers.certificationSheets
 * @param {string} trainerId
 * @param {{ storagePath: string }} meta
 * @returns {Promise<void>}
 */
export async function deleteTrainerCertificationSheet(trainerId, meta) {
  if (!db || !trainerId || !meta?.storagePath) throw new Error('Missing trainerId or storagePath');
  try {
    await deleteObject(ref(storage, meta.storagePath));
  } catch (error) {
    if (__DEV__) console.warn('cert delete storage:', error?.message || error);
  }
  const refDoc = doc(db, TRAINERS_COLLECTION, trainerId);
  const snap = await getDoc(refDoc);
  const list = Array.isArray(snap.data()?.certificationSheets) ? snap.data().certificationSheets : [];
  const next = sheetsWithoutStoragePath(list, meta.storagePath);
  await setDoc(refDoc, { certificationSheets: next, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Face verification selfie → trainers/{trainerId}/verification/
 * @param {string} trainerId
 * @param {{ localUri: string }} file
 * @returns {Promise<{ path: string, url: string }>}
 */
export async function uploadTrainerFaceVerification(trainerId, { localUri }) {
  if (!storage || !db || !trainerId) throw new Error('Storage/Firestore or trainerId not ready');
  const path = `trainers/${trainerId}/verification/${Date.now()}_face.jpg`;
  const storageRef = ref(storage, path);
  const blob = await uriToBlob(localUri);
  await uploadBytes(storageRef, blob, { contentType: JPEG_CONTENT_TYPE });
  const downloadUrl = await getDownloadURL(storageRef);
  await setDoc(
    doc(db, TRAINERS_COLLECTION, trainerId),
    {
      faceVerificationPhotoURL: downloadUrl,
      faceVerificationStoragePath: path,
      faceVerificationStatus: FACE_VERIFICATION_PENDING,
      isVerified: false,
      faceVerificationSubmittedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return { path, url: downloadUrl };
}

/**
 * Load one trainers/{trainerId}/importedData/{importId} row.
 * @param {string} trainerId
 * @param {string} importId
 * @returns {Promise<object|null>}
 */
export async function getTrainerImportedData(trainerId, importId) {
  if (!db || !trainerId || !importId) return null;
  const snap = await getDoc(doc(db, TRAINERS_COLLECTION, trainerId, IMPORTED_DATA_COLLECTION, importId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
