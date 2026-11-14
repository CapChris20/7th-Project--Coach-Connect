// Uploads, downloads, lists, and deletes files in Firebase Storage.
// Flow: turn the picked file into a blob → write it under a fixed path → return the download url (or a failure object).
// Used by profile photos, progress photos, food photos, and trainer notes.

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  getMetadata,
} from 'firebase/storage';
import { storage } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

// vocab: contentType = the MIME type stored with the file so downloads open as an image or text.
const JPEG_CONTENT_TYPE = 'image/jpeg';
const PLAIN_TEXT_CONTENT_TYPE = 'text/plain';
const PROFILE_IMAGE_KIND = 'profile-image';
const PROGRESS_PHOTO_KIND = 'progress-photo';
const FOOD_IMAGE_KIND = 'food-image';
const TRAINER_NOTE_KIND = 'trainer-note';
const GENERAL_FOLDER_NAME = 'general';
const CUSTOM_FOOD_FOLDER_NAME = 'custom';

// ===== MAIN FUNCTION =====

/**
 * Upload one file to Firebase Storage at `path`.
 * @param {File|{ uri: string }} file
 * @param {string} path
 * @param {object} [metadata]
 * @returns {Promise<{ success: boolean, downloadURL?: string, ref?: object, metadata?: object, error?: string }>}
 */
export async function uploadFile(file, path, metadata = {}) {
  try {
    // 1. Storage must be initialized before any ref() call.
    assertStorageReady();
    console.log('Uploading file to path:', path);

    // 2. Normalize web File vs React Native { uri } into bytes Storage accepts.
    const fileBlob = await fileToBlob(file);

    // 3. Write and return the public download url on success.
    const result = await writeBlobToStoragePath(fileBlob, path, metadata);
    console.log('File uploaded successfully:', result.downloadURL);
    return result;
  } catch (error) {
    console.error('Upload file error:', error);
    return failureResult(error);
  }
}

/**
 * Download url for a file that is already in Storage.
 * @param {string} path
 * @returns {Promise<{ success: boolean, downloadURL?: string, error?: string }>}
 */
export async function getFileURL(path) {
  try {
    // 1. Need Storage and a path.
    assertStorageReady();

    // 2. Ask Storage for the HTTPS download link.
    // vocab: ref() = a pointer to a Storage path. getDownloadURL turns it into a public URL.
    const storageRef = ref(storage, path);
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Download URL retrieved:', downloadURL);
    return { success: true, downloadURL };
  } catch (error) {
    console.error('Get file URL error:', error);
    return failureResult(error);
  }
}

/**
 * Delete one file from Storage. Missing files come back as success: false.
 * @param {string} path
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteFile(path) {
  try {
    // 1. Need Storage.
    assertStorageReady();
    console.log('Deleting file from path:', path);

    // 2. Delete the object at that path.
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    console.log('File deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Delete file error:', error);
    return failureResult(error);
  }
}

/**
 * List files directly inside a Storage folder (not nested folders).
 * @param {string} path
 * @returns {Promise<{ success: boolean, files?: object[], error?: string }>}
 */
export async function listFiles(path) {
  try {
    // 1. Need Storage and a folder path.
    assertStorageReady();
    console.log('Listing files in path:', path);
    const storageRef = ref(storage, path);

    // 2. listAll returns file pointers in this folder only (not nested folders).
    // vocab: listAll = one-page listing of immediate children under a Storage path.
    const listResult = await listAll(storageRef);

    // 3. Attach download urls and metadata; skip individual items that fail.
    const files = await describeAllListedFiles(listResult.items);
    console.log('Files listed successfully:', files.length, 'files found');
    return { success: true, files };
  } catch (error) {
    console.error('List files error:', error);
    return failureResult(error);
  }
}

/**
 * Upload a profile photo under users/{userId}/profile/.
 * @param {string} userId
 * @param {File|{ uri: string }} imageFile
 * @returns {Promise<{ success: boolean, downloadURL?: string, ref?: object, metadata?: object, error?: string }>}
 */
export async function uploadProfileImage(userId, imageFile) {
  // 1. Build the fixed path + jpeg metadata, then reuse uploadFile.
  const timestamp = Date.now();
  const path = profileImageStoragePath(userId, timestamp);
  const metadata = imageUploadMetadata(userId, PROFILE_IMAGE_KIND);
  return uploadFile(imageFile, path, metadata);
}

/**
 * Upload a workout progress photo. No workout id lands in the "general" folder.
 * @param {string} userId
 * @param {File|{ uri: string }} photoFile
 * @param {string|null} [workoutId]
 * @returns {Promise<{ success: boolean, downloadURL?: string, ref?: object, metadata?: object, error?: string }>}
 */
export async function uploadProgressPhoto(userId, photoFile, workoutId = null) {
  // 1. Path + metadata, then upload.
  const timestamp = Date.now();
  const path = progressPhotoStoragePath(userId, workoutId, timestamp);
  const workoutLabel = workoutId || GENERAL_FOLDER_NAME;
  const metadata = imageUploadMetadata(userId, PROGRESS_PHOTO_KIND, {
    workoutId: workoutLabel,
    timestamp: timestamp.toString(),
  });
  return uploadFile(photoFile, path, metadata);
}

/**
 * Upload a food photo. No food id lands in the "custom" folder.
 * @param {string} userId
 * @param {File|{ uri: string }} imageFile
 * @param {string|null} [foodId]
 * @returns {Promise<{ success: boolean, downloadURL?: string, ref?: object, metadata?: object, error?: string }>}
 */
export async function uploadFoodImage(userId, imageFile, foodId = null) {
  // 1. Path + metadata, then upload.
  const timestamp = Date.now();
  const path = foodImageStoragePath(userId, foodId, timestamp);
  const foodLabel = foodId || CUSTOM_FOOD_FOLDER_NAME;
  const metadata = imageUploadMetadata(userId, FOOD_IMAGE_KIND, {
    foodId: foodLabel,
    timestamp: timestamp.toString(),
  });
  return uploadFile(imageFile, path, metadata);
}

/**
 * Save a trainer note as a plain-text file under trainerNotes/{trainerId}/{clientId}/.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} textContent
 * @returns {Promise<{ success: boolean, downloadURL?: string, ref?: object, metadata?: object, error?: string }>}
 */
export async function uploadTrainerNote(trainerId, clientId, textContent) {
  try {
    // 1. Need Storage.
    assertStorageReady();
    const timestamp = Date.now();
    const path = trainerNoteStoragePath(trainerId, clientId, timestamp);

    // 2. Wrap the note text as a blob, then upload like any other file.
    // vocab: Blob = a bag of bytes. Here it is the note text with a text/plain type.
    const noteBlob = new Blob([textContent], { type: PLAIN_TEXT_CONTENT_TYPE });
    const metadata = trainerNoteMetadata(trainerId, clientId, timestamp);
    return uploadFile(noteBlob, path, metadata);
  } catch (error) {
    console.error('Upload trainer note error:', error);
    return failureResult(error);
  }
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging Storage paths, blobs, or folder listing.

function assertStorageReady() {
  if (!storage) {
    throw new Error('Firebase Storage not initialized');
  }
}

function failureResult(error) {
  return { success: false, error: error.message };
}

function successUploadResult(uploadResult, downloadURL) {
  return {
    success: true,
    downloadURL,
    ref: uploadResult.ref,
    metadata: uploadResult.metadata,
  };
}

// A web <input> gives a File. React Native gives { uri }. Anything else cannot be uploaded.
async function fileToBlob(file) {
  if (file instanceof File) {
    return file;
  }
  if (!file.uri) {
    throw new Error('Invalid file format');
  }
  // vocab: fetch(uri).blob() = download the local file bytes so Storage can accept them.
  const response = await fetch(file.uri);
  return response.blob();
}

function imageUploadMetadata(userId, imageKind, extraFields) {
  return {
    contentType: JPEG_CONTENT_TYPE,
    customMetadata: {
      uploadedBy: userId,
      type: imageKind,
      ...extraFields,
    },
  };
}

function profileImageStoragePath(userId, timestamp) {
  return `users/${userId}/profile/profile-image-${timestamp}`;
}

function progressPhotoStoragePath(userId, workoutId, timestamp) {
  const folderName = workoutId ? `workout-${workoutId}` : GENERAL_FOLDER_NAME;
  return `users/${userId}/progress/${folderName}-${timestamp}`;
}

function foodImageStoragePath(userId, foodId, timestamp) {
  const folderName = foodId ? `food-${foodId}` : CUSTOM_FOOD_FOLDER_NAME;
  return `users/${userId}/food/${folderName}-${timestamp}`;
}

function trainerNoteStoragePath(trainerId, clientId, timestamp) {
  return `trainerNotes/${trainerId}/${clientId}/${timestamp}.txt`;
}

function trainerNoteMetadata(trainerId, clientId, timestamp) {
  return {
    contentType: PLAIN_TEXT_CONTENT_TYPE,
    customMetadata: {
      uploadedBy: trainerId,
      clientId: clientId,
      type: TRAINER_NOTE_KIND,
      timestamp: timestamp.toString(),
    },
  };
}

// One listed file. A bad metadata read is skipped so the rest of the folder still returns.
async function describeListedFile(itemRef) {
  try {
    const downloadURL = await getDownloadURL(itemRef);
    const metadata = await getMetadata(itemRef);
    return {
      name: itemRef.name,
      fullPath: itemRef.fullPath,
      downloadURL,
      metadata,
    };
  } catch (error) {
    console.warn('Error getting metadata for file:', itemRef.name, error);
    return null;
  }
}

async function describeAllListedFiles(itemRefs) {
  const files = [];
  for (const itemRef of itemRefs) {
    const describedFile = await describeListedFile(itemRef);
    if (!describedFile) {
      continue;
    }
    files.push(describedFile);
  }
  return files;
}

async function writeBlobToStoragePath(fileBlob, path, metadata) {
  // vocab: uploadBytes writes the blob at the Storage ref, then we ask for the download URL.
  const storageRef = ref(storage, path);
  const uploadResult = await uploadBytes(storageRef, fileBlob, metadata);
  const downloadURL = await getDownloadURL(uploadResult.ref);
  return successUploadResult(uploadResult, downloadURL);
}
