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

// ===== HELPER FUNCTIONS =====

function assertStorageReady() {
  if (!storage) {
    throw new Error('Firebase Storage not initialized');
  }
}

function failureResult(error) {
  return { success: false, error: error.message };
}

// A web <input> gives a File. React Native gives { uri }. Anything else cannot be uploaded.
async function fileToBlob(file) {
  if (file instanceof File) return file;
  if (file.uri) {
    // vocab: fetch(uri).blob() = download the local file bytes so Storage can accept them.
    const response = await fetch(file.uri);
    return response.blob();
  }
  throw new Error('Invalid file format');
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

// ===== MAIN FUNCTION =====

/**
 * Upload one file to Firebase Storage at `path`.
 * @param {File|{ uri: string }} file
 * @param {string} path
 * @param {object} [metadata]
 * @returns {Promise<{ success: boolean, downloadURL?: string, ref?: object, metadata?: object, error?: string }>}
 */
export const uploadFile = async (file, path, metadata = {}) => {
  try {
    assertStorageReady();
    console.log('Uploading file to path:', path);
    // vocab: ref() = a pointer to a Storage path. uploadBytes writes the blob there.
    const storageRef = ref(storage, path);
    const fileBlob = await fileToBlob(file);
    const uploadResult = await uploadBytes(storageRef, fileBlob, metadata);
    const downloadURL = await getDownloadURL(uploadResult.ref);
    console.log('File uploaded successfully:', downloadURL);
    return {
      success: true,
      downloadURL,
      ref: uploadResult.ref,
      metadata: uploadResult.metadata,
    };
  } catch (error) {
    console.error('Upload file error:', error);
    return failureResult(error);
  }
};

/**
 * Download url for a file that is already in Storage.
 * @param {string} path
 * @returns {Promise<{ success: boolean, downloadURL?: string, error?: string }>}
 */
export const getFileURL = async (path) => {
  try {
    assertStorageReady();
    const storageRef = ref(storage, path);
    const downloadURL = await getDownloadURL(storageRef);
    console.log('Download URL retrieved:', downloadURL);
    return { success: true, downloadURL };
  } catch (error) {
    console.error('Get file URL error:', error);
    return failureResult(error);
  }
};

/**
 * Delete one file from Storage. Missing files come back as success: false.
 * @param {string} path
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export const deleteFile = async (path) => {
  try {
    assertStorageReady();
    console.log('Deleting file from path:', path);
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    console.log('File deleted successfully');
    return { success: true };
  } catch (error) {
    console.error('Delete file error:', error);
    return failureResult(error);
  }
};

/**
 * List files directly inside a Storage folder (not nested folders).
 * @param {string} path
 * @returns {Promise<{ success: boolean, files?: object[], error?: string }>}
 */
export const listFiles = async (path) => {
  try {
    assertStorageReady();
    console.log('Listing files in path:', path);
    const storageRef = ref(storage, path);
    // vocab: listAll = every file and subfolder pointer under this path, one page.
    const result = await listAll(storageRef);
    const files = [];
    for (const itemRef of result.items) {
      const describedFile = await describeListedFile(itemRef);
      if (describedFile) files.push(describedFile);
    }
    console.log('Files listed successfully:', files.length, 'files found');
    return { success: true, files };
  } catch (error) {
    console.error('List files error:', error);
    return failureResult(error);
  }
};

/**
 * Upload a profile photo under users/{userId}/profile/.
 * @param {string} userId
 * @param {File|{ uri: string }} imageFile
 */
export const uploadProfileImage = async (userId, imageFile) => {
  const timestamp = Date.now();
  const path = profileImageStoragePath(userId, timestamp);
  const metadata = imageUploadMetadata(userId, PROFILE_IMAGE_KIND);
  return uploadFile(imageFile, path, metadata);
};

/**
 * Upload a workout progress photo. No workout id lands in the "general" folder.
 * @param {string} userId
 * @param {File|{ uri: string }} photoFile
 * @param {string|null} [workoutId]
 */
export const uploadProgressPhoto = async (userId, photoFile, workoutId = null) => {
  const timestamp = Date.now();
  const path = progressPhotoStoragePath(userId, workoutId, timestamp);
  const metadata = imageUploadMetadata(userId, PROGRESS_PHOTO_KIND, {
    workoutId: workoutId || GENERAL_FOLDER_NAME,
    timestamp: timestamp.toString(),
  });
  return uploadFile(photoFile, path, metadata);
};

/**
 * Upload a food photo. No food id lands in the "custom" folder.
 * @param {string} userId
 * @param {File|{ uri: string }} imageFile
 * @param {string|null} [foodId]
 */
export const uploadFoodImage = async (userId, imageFile, foodId = null) => {
  const timestamp = Date.now();
  const path = foodImageStoragePath(userId, foodId, timestamp);
  const metadata = imageUploadMetadata(userId, FOOD_IMAGE_KIND, {
    foodId: foodId || CUSTOM_FOOD_FOLDER_NAME,
    timestamp: timestamp.toString(),
  });
  return uploadFile(imageFile, path, metadata);
};

/**
 * Save a trainer note as a plain-text file under trainerNotes/{trainerId}/{clientId}/.
 * @param {string} trainerId
 * @param {string} clientId
 * @param {string} textContent
 */
export const uploadTrainerNote = async (trainerId, clientId, textContent) => {
  try {
    assertStorageReady();
    const timestamp = Date.now();
    const path = trainerNoteStoragePath(trainerId, clientId, timestamp);
    // vocab: Blob = a bag of bytes. Here it is the note text with a text/plain type.
    const blob = new Blob([textContent], { type: PLAIN_TEXT_CONTENT_TYPE });
    const metadata = {
      contentType: PLAIN_TEXT_CONTENT_TYPE,
      customMetadata: {
        uploadedBy: trainerId,
        clientId: clientId,
        type: TRAINER_NOTE_KIND,
        timestamp: timestamp.toString(),
      },
    };
    return uploadFile(blob, path, metadata);
  } catch (error) {
    console.error('Upload trainer note error:', error);
    return failureResult(error);
  }
};
