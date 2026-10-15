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

// The library picker is single-select today. The cap stays so a future multi-select
// still can't attach a whole camera roll in one message.
const MAX_LIBRARY_PHOTOS = 3;

// vocab: toString(36) is base 36 (digits plus a-z). slice drops the "0." and keeps 6 characters.
const RANDOM_ID_RADIX = 36;
const RANDOM_ID_SLICE_START = 2;
const RANDOM_ID_SLICE_END = 8;

const MEDIA_IMAGES = ['images'];

const LIBRARY_DENIED_MESSAGE = 'Allow access to your photo library to attach images.';
const CAMERA_DENIED_MESSAGE = 'Allow camera access to take a progress photo.';
const UNREADABLE_PHOTO_MESSAGE = 'Try a different image or take a new photo with Camera.';
const UNREADABLE_CAMERA_PHOTO_MESSAGE = 'Try taking the photo again.';

// ===== HELPER FUNCTIONS =====

function makeAttachmentId() {
  const randomTail = Math.random()
    .toString(RANDOM_ID_RADIX)
    .slice(RANDOM_ID_SLICE_START, RANDOM_ID_SLICE_END);
  return `att_${Date.now()}_${randomTail}`;
}

function buildImageAttachment({ previewUri, base64, mimeType, fileName }) {
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

function assetsFromPickerResult(result) {
  if (Array.isArray(result.assets)) return result.assets;
  return [];
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
    Alert.alert('Permission needed', deniedMessage);
  }
  return isGranted;
}

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

function messageFromCaughtError(error) {
  if (!error) return error;
  if (error.message) return error.message;
  return error;
}

function firstPickerAsset(result) {
  if (!result.assets) return undefined;
  return result.assets[0];
}

function fallbackImageAttachment(asset, imageUri, fallbackName) {
  if (!asset.base64) return null;
  return buildImageAttachment({
    previewUri: imageUri,
    base64: asset.base64,
    mimeType: mimeTypeOrJpeg(asset),
    fileName: fileNameOrFallback(asset, fallbackName),
  });
}

/**
 * Resize to a JPEG with base64. If that fails but the picker already decoded the file,
 * send the picker's base64 anyway — dropping the photo the user just chose is worse.
 * @param {object} asset
 * @param {string} [fallbackName]
 * @returns {Promise<object|null>}
 */
async function normalizePickedImage(asset, fallbackName = DEFAULT_PHOTO_NAME) {
  if (!asset || !asset.uri) return null;
  const imageUri = asset.uri;

  try {
    const manipulated = await resizedJpegFromUri(imageUri);
    if (!manipulated || !manipulated.base64) {
      throw new Error('Could not encode image');
    }
    return buildImageAttachment({
      previewUri: previewUriAfterResize(manipulated, imageUri),
      base64: manipulated.base64,
      mimeType: JPEG_MIME_TYPE,
      fileName: fileNameOrFallback(asset, fallbackName),
    });
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

function alertIfNoneEncoded(chosenAssets, attachments) {
  if (chosenAssets.length === 0) return;
  if (attachments.length > 0) return;
  Alert.alert('Could not read photo', UNREADABLE_PHOTO_MESSAGE);
}

/**
 * @param {Error|*} error
 * @param {string} logTag
 * @param {string} alertTitle
 * @returns {[]}
 */
function alertTextFromPickerError(error) {
  if (error && error.message) return error.message;
  return 'Try again.';
}

function handlePickerFailure(error, logTag, alertTitle) {
  console.warn(logTag, messageFromCaughtError(error));
  Alert.alert(alertTitle, alertTextFromPickerError(error));
  return [];
}

// ===== MAIN FUNCTION =====

/**
 * Open the photo library and return up to three JPEG attachments.
 * Returns [] when permission is denied, the user cancels, or every file fails to encode.
 * @returns {Promise<Array<{id: string, preview: string, base64: string, type: string, mimeType: string, name: string}>>}
 */
export async function pickCoachPhotosFromLibrary() {
  try {
    const isGranted = await requestAccessOrAlert(
      () => ImagePicker.requestMediaLibraryPermissionsAsync(),
      LIBRARY_DENIED_MESSAGE,
    );
    if (!isGranted) return [];

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: MEDIA_IMAGES,
      allowsMultipleSelection: false,
      quality: PICKER_IMAGE_QUALITY,
    });
    if (result.canceled) return [];

    const chosenAssets = assetsFromPickerResult(result).slice(0, MAX_LIBRARY_PHOTOS);
    const attachments = await attachmentsFromChosenAssets(chosenAssets);
    alertIfNoneEncoded(chosenAssets, attachments);
    return attachments;
  } catch (error) {
    return handlePickerFailure(error, '[pickCoachPhotosFromLibrary]', 'Could not open photos');
  }
}

/**
 * Open the camera and return a one-item list, or [] if the shot can't be read.
 * @returns {Promise<Array<{id: string, preview: string, base64: string, type: string, mimeType: string, name: string}>>}
 */
export async function pickCoachPhotoFromCamera() {
  try {
    const isGranted = await requestAccessOrAlert(
      () => ImagePicker.requestCameraPermissionsAsync(),
      CAMERA_DENIED_MESSAGE,
    );
    if (!isGranted) return [];

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: MEDIA_IMAGES,
      quality: PICKER_IMAGE_QUALITY,
    });
    if (result.canceled) return [];

    const asset = firstPickerAsset(result);
    if (!asset) return [];
    if (!asset.uri) return [];

    const normalized = await normalizePickedImage(asset, DEFAULT_PHOTO_NAME);
    if (!normalized) {
      Alert.alert('Could not read photo', UNREADABLE_CAMERA_PHOTO_MESSAGE);
      return [];
    }
    return [normalized];
  } catch (error) {
    return handlePickerFailure(error, '[pickCoachPhotoFromCamera]', 'Could not open camera');
  }
}

/**
 * Open the document picker. Files are not re-encoded — the chat keeps the local uri.
 * vocab: getDocumentAsync is Expo's file picker. multiple lets the user select more than one.
 * @returns {Promise<Array<{id: string, name: string, uri: string, type: string}>>}
 */
export async function pickCoachDocuments() {
  try {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (result.canceled) return [];
    const documentAssets = assetsFromPickerResult(result);
    const attachments = [];
    for (let index = 0; index < documentAssets.length; index += 1) {
      attachments.push(buildFileAttachment(documentAssets[index]));
    }
    return attachments;
  } catch (error) {
    return handlePickerFailure(error, '[pickCoachDocuments]', 'Could not open files');
  }
}
