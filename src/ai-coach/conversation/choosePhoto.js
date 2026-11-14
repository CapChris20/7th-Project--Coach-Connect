// Photo, camera, and file pickers for a coach chat message.
// Flow: ask for permission → open the native picker → resize images to JPEG base64 → return attachments.
// Used by: CoachConversationScreen and CoachHomeScreen when the user taps attach.

import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';

// ===== NAMED CONSTANTS =====

const PERMISSION_GRANTED = 'granted';

// Manipulate here: 1024px and 0.72 keep vision-API uploads small enough to send.
// Raise the width for sharper food photos; lower the compress number for smaller files.
const PHOTO_RESIZE_WIDTH = 1024;
const JPEG_COMPRESS_QUALITY = 0.72;
const PICKER_IMAGE_QUALITY = 1;

const JPEG_MIME_TYPE = 'image/jpeg';
const DEFAULT_PHOTO_NAME = 'photo.jpg';
const IMAGE_ATTACHMENT_TYPE = 'image';
const FILE_ATTACHMENT_TYPE = 'file';

// Design Law attach sheet: “Pick up to 4 photos” — multi-select capped here.
const MAX_LIBRARY_PHOTOS = 4;
export const COACH_MAX_ATTACH_PHOTOS = MAX_LIBRARY_PHOTOS;

// vocab: toString(36) is base 36 (digits plus a-z). slice drops the "0." and keeps 6 characters.
const RANDOM_ID_RADIX = 36;
const RANDOM_ID_SLICE_START = 2;
const RANDOM_ID_SLICE_END = 8;

const MEDIA_IMAGES = ['images'];

const LIBRARY_DENIED_MESSAGE = 'Allow access to your photo library to attach images.';
const CAMERA_DENIED_MESSAGE = 'Allow camera access to take a progress photo.';
const UNREADABLE_PHOTO_MESSAGE = 'Try a different image or take a new photo with Camera.';
const UNREADABLE_CAMERA_PHOTO_MESSAGE = 'Try taking the photo again.';
const DEFAULT_PICKER_RETRY_MESSAGE = 'Try again.';

const ALERT_PERMISSION_TITLE = 'Permission needed';
const ALERT_COULD_NOT_READ_PHOTO = 'Could not read photo';
const ALERT_COULD_NOT_OPEN_PHOTOS = 'Could not open photos';
const ALERT_COULD_NOT_OPEN_CAMERA = 'Could not open camera';
const ALERT_COULD_NOT_OPEN_FILES = 'Could not open files';

// ===== HELPER FUNCTIONS =====

function makeAttachmentId() {
  const randomTail = Math.random()
    .toString(RANDOM_ID_RADIX)
    .slice(RANDOM_ID_SLICE_START, RANDOM_ID_SLICE_END);
  return `att_${Date.now()}_${randomTail}`;
}

function buildImageAttachment(previewUri, base64, mimeType, fileName) {
  return {
    id: makeAttachmentId(),
    preview: previewUri,
    base64,
    type: IMAGE_ATTACHMENT_TYPE,
    mimeType,
    name: fileName,
  };
}

function buildFileAttachment(documentAsset) {
  return {
    id: makeAttachmentId(),
    name: documentAsset.name,
    uri: documentAsset.uri,
    type: FILE_ATTACHMENT_TYPE,
  };
}

function fileAttachmentsFromDocumentAssets(documentAssets) {
  const attachments = [];
  for (let index = 0; index < documentAssets.length; index += 1) {
    const documentAsset = documentAssets[index];
    attachments.push(buildFileAttachment(documentAsset));
  }
  return attachments;
}

function assetsFromPickerResult(pickerResult) {
  if (!pickerResult) return [];
  if (!Array.isArray(pickerResult.assets)) return [];
  return pickerResult.assets;
}

function userCanceledPicker(pickerResult) {
  if (!pickerResult) return false;
  if (pickerResult.canceled) return true;
  return false;
}

/**
 * Shared by the library and the camera. Denied access alerts and returns false so the caller sends nothing.
 * @param {Function} requestPermission
 * @param {string} deniedMessage
 * @returns {Promise<boolean>}
 */
async function requestAccessOrAlert(requestPermission, deniedMessage) {
  const permissionResult = await requestPermission();
  const isGranted = permissionResult.status === PERMISSION_GRANTED;
  if (!isGranted) {
    Alert.alert(ALERT_PERMISSION_TITLE, deniedMessage);
  }
  return isGranted;
}

function messageFromCaughtError(error) {
  if (!error) return error;
  if (error.message) return error.message;
  return error;
}

function firstPickerAsset(pickerResult) {
  if (!pickerResult) return undefined;
  if (!pickerResult.assets) return undefined;
  return pickerResult.assets[0];
}

function mimeTypeOrJpeg(asset) {
  if (asset.mimeType) return asset.mimeType;
  return JPEG_MIME_TYPE;
}

function fileNameOrFallback(asset, fallbackName) {
  if (asset.fileName) return asset.fileName;
  return fallbackName;
}

function previewUriAfterResize(manipulated, imageUri) {
  if (manipulated.uri) return manipulated.uri;
  return imageUri;
}

/**
 * Design Law notice when the host passed presentNotice; OS Alert otherwise.
 * Permission denials stay on Alert (system Settings path) — see requestAccessOrAlert.
 * @param {((title: string, message: string) => void)|undefined} presentNotice
 * @param {string} title
 * @param {string} message
 */
function presentPhotoNotice(presentNotice, title, message) {
  if (typeof presentNotice === 'function') {
    presentNotice(title, message);
    return;
  }
  Alert.alert(title, message);
}

/**
 * @param {Error|*} error
 * @returns {string}
 */
function alertTextFromPickerError(error) {
  if (error && error.message) return error.message;
  return DEFAULT_PICKER_RETRY_MESSAGE;
}

function handlePickerFailure(error, logTag, alertTitle, presentNotice) {
  console.warn(logTag, messageFromCaughtError(error));
  presentPhotoNotice(presentNotice, alertTitle, alertTextFromPickerError(error));
  return [];
}

function alertIfNoneEncoded(chosenAssets, attachments, presentNotice) {
  if (chosenAssets.length === 0) return;
  if (attachments.length > 0) return;
  presentPhotoNotice(presentNotice, ALERT_COULD_NOT_READ_PHOTO, UNREADABLE_PHOTO_MESSAGE);
}

// ===== MAIN FUNCTION =====

/**
 * Open the photo library and return up to four JPEG attachments.
 * Returns [] when permission is denied, the user cancels, or every file fails to encode.
 * @param {{ presentNotice?: (title: string, message: string) => void }} [options]
 * @returns {Promise<Array<{id: string, preview: string, base64: string, type: string, mimeType: string, name: string}>>}
 */
export async function pickCoachPhotosFromLibrary(options = {}) {
  const presentNotice = options.presentNotice;

  try {
    // 1. Ask for library access.
    const isGranted = await requestAccessOrAlert(
      () => ImagePicker.requestMediaLibraryPermissionsAsync(),
      LIBRARY_DENIED_MESSAGE,
    );
    if (!isGranted) return [];

    // 2. Open the multi-select picker (capped at MAX_LIBRARY_PHOTOS).
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: MEDIA_IMAGES,
      allowsMultipleSelection: true,
      selectionLimit: MAX_LIBRARY_PHOTOS,
      quality: PICKER_IMAGE_QUALITY,
    });
    if (userCanceledPicker(pickerResult)) return [];

    // 3. Resize each chosen photo and return JPEG attachments.
    const allAssets = assetsFromPickerResult(pickerResult);
    const chosenAssets = allAssets.slice(0, MAX_LIBRARY_PHOTOS);
    const attachments = await attachmentsFromChosenAssets(chosenAssets);
    alertIfNoneEncoded(chosenAssets, attachments, presentNotice);
    return attachments;
  } catch (error) {
    return handlePickerFailure(
      error,
      '[pickCoachPhotosFromLibrary]',
      ALERT_COULD_NOT_OPEN_PHOTOS,
      presentNotice,
    );
  }
}

/**
 * Open the camera and return a one-item list, or [] if the shot can't be read.
 * @param {{ presentNotice?: (title: string, message: string) => void }} [options]
 * @returns {Promise<Array<{id: string, preview: string, base64: string, type: string, mimeType: string, name: string}>>}
 */
export async function pickCoachPhotoFromCamera(options = {}) {
  const presentNotice = options.presentNotice;

  try {
    // 1. Ask for camera access.
    const isGranted = await requestAccessOrAlert(
      () => ImagePicker.requestCameraPermissionsAsync(),
      CAMERA_DENIED_MESSAGE,
    );
    if (!isGranted) return [];

    // 2. Take one photo.
    const pickerResult = await ImagePicker.launchCameraAsync({
      mediaTypes: MEDIA_IMAGES,
      quality: PICKER_IMAGE_QUALITY,
    });
    if (userCanceledPicker(pickerResult)) return [];

    // 3. Encode it as a JPEG attachment.
    const asset = firstPickerAsset(pickerResult);
    if (!asset) return [];
    if (!asset.uri) return [];

    const normalized = await normalizePickedImage(asset, DEFAULT_PHOTO_NAME);
    if (!normalized) {
      presentPhotoNotice(presentNotice, ALERT_COULD_NOT_READ_PHOTO, UNREADABLE_CAMERA_PHOTO_MESSAGE);
      return [];
    }
    return [normalized];
  } catch (error) {
    return handlePickerFailure(
      error,
      '[pickCoachPhotoFromCamera]',
      ALERT_COULD_NOT_OPEN_CAMERA,
      presentNotice,
    );
  }
}

/**
 * Open the document picker. Files are not re-encoded — the chat keeps the local uri.
 * vocab: getDocumentAsync is Expo's file picker. multiple lets the user select more than one.
 * @returns {Promise<Array<{id: string, name: string, uri: string, type: string}>>}
 */
export async function pickCoachDocuments() {
  try {
    // 1. Open the system file picker (multi-select).
    const pickerResult = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (userCanceledPicker(pickerResult)) return [];

    // 2. Wrap each asset as a file attachment (uri only — no base64).
    const documentAssets = assetsFromPickerResult(pickerResult);
    return fileAttachmentsFromDocumentAssets(documentAssets);
  } catch (error) {
    return handlePickerFailure(error, '[pickCoachDocuments]', ALERT_COULD_NOT_OPEN_FILES);
  }
}

// ===== PLUMBING — skip unless debugging =====

function resizedJpegFromUri(imageUri) {
  // vocab: manipulateAsync re-encodes the file. base64: true puts the JPEG text on the result
  // so the coach vision API doesn't have to read the phone file itself.
  return ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: PHOTO_RESIZE_WIDTH } }],
    {
      compress: JPEG_COMPRESS_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
}

function fallbackImageAttachment(asset, imageUri, fallbackName) {
  if (!asset.base64) return null;
  return buildImageAttachment(
    imageUri,
    asset.base64,
    mimeTypeOrJpeg(asset),
    fileNameOrFallback(asset, fallbackName),
  );
}

/**
 * Resize to a JPEG with base64. If that fails but the picker already decoded the file,
 * send the picker's base64 anyway — dropping the photo the user just chose is worse.
 * @param {object} asset
 * @param {string} [fallbackName]
 * @returns {Promise<object|null>}
 */
async function normalizePickedImage(asset, fallbackName = DEFAULT_PHOTO_NAME) {
  if (!asset) return null;
  if (!asset.uri) return null;
  const imageUri = asset.uri;

  try {
    const manipulated = await resizedJpegFromUri(imageUri);
    if (!manipulated) {
      throw new Error('Could not encode image');
    }
    if (!manipulated.base64) {
      throw new Error('Could not encode image');
    }
    return buildImageAttachment(
      previewUriAfterResize(manipulated, imageUri),
      manipulated.base64,
      JPEG_MIME_TYPE,
      fileNameOrFallback(asset, fallbackName),
    );
  } catch (error) {
    console.warn('[normalizePickedImage]', messageFromCaughtError(error));
    return fallbackImageAttachment(asset, imageUri, fallbackName);
  }
}

/**
 * @param {object[]} chosenAssets
 * @returns {Promise<object[]>}
 */
async function attachmentsFromChosenAssets(chosenAssets) {
  const attachments = [];
  for (let assetIndex = 0; assetIndex < chosenAssets.length; assetIndex += 1) {
    const asset = chosenAssets[assetIndex];
    const normalized = await normalizePickedImage(asset);
    if (normalized) attachments.push(normalized);
  }
  return attachments;
}
