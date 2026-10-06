// Photo, camera, and file pickers for a coach chat message.
// Flow: ask for permission → open the native picker → resize images to JPEG base64 → return attachments.
// Used by CoachConversationScreen and CoachHomeScreen when the user taps attach.

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

// ===== HELPER FUNCTIONS =====

// Two picks in the same millisecond still need different ids, so the tail is random.
function makeAttachmentId() {
  const randomTail = Math.random()
    .toString(RANDOM_ID_RADIX)
    .slice(RANDOM_ID_SLICE_START, RANDOM_ID_SLICE_END);
  return `att_${Date.now()}_${randomTail}`;
}

// One shape for every image we hand the chat, whether it came from the resizer or the raw picker.
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

// Files keep their own uri. Images go through buildImageAttachment because the API wants base64.
function buildFileAttachment(documentAsset) {
  return {
    id: makeAttachmentId(),
    name: documentAsset.name,
    uri: documentAsset.uri,
    type: FILE_ATTACHMENT_TYPE,
  };
}

function assetsFromPickerResult(result) {
  return Array.isArray(result.assets) ? result.assets : [];
}

// Shared by the library and the camera. Denied access alerts and returns false so the caller sends nothing.
async function requestAccessOrAlert(requestPermission, deniedMessage) {
  const { status } = await requestPermission();
  const isGranted = status === PERMISSION_GRANTED;
  if (!isGranted) {
    Alert.alert('Permission needed', deniedMessage);
  }
  return isGranted;
}

// Resize to a JPEG with base64. If that fails but the picker already decoded the file,
// send the picker's base64 anyway — dropping the photo the user just chose is worse.
async function normalizePickedImage(asset, fallbackName = DEFAULT_PHOTO_NAME) {
  const imageUri = asset?.uri;
  if (!imageUri) return null;

  try {
    // vocab: manipulateAsync re-encodes the file. base64: true puts the JPEG text on the result
    // so the coach vision API doesn't have to read the phone file itself.
    const manipulated = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: PHOTO_RESIZE_WIDTH } }],
      {
        compress: JPEG_COMPRESS_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!manipulated?.base64) {
      throw new Error('Could not encode image');
    }

    return buildImageAttachment({
      previewUri: manipulated.uri || imageUri,
      base64: manipulated.base64,
      mimeType: JPEG_MIME_TYPE,
      fileName: asset.fileName || fallbackName,
    });
  } catch (error) {
    console.warn('[normalizePickedImage]', error?.message || error);
    if (asset.base64) {
      return buildImageAttachment({
        previewUri: imageUri,
        base64: asset.base64,
        mimeType: asset.mimeType || JPEG_MIME_TYPE,
        fileName: asset.fileName || fallbackName,
      });
    }
    return null;
  }
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
      'Allow access to your photo library to attach images.'
    );
    if (!isGranted) return [];

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: PICKER_IMAGE_QUALITY,
    });

    if (result.canceled) return [];

    const chosenAssets = assetsFromPickerResult(result).slice(0, MAX_LIBRARY_PHOTOS);
    const attachments = [];
    for (const asset of chosenAssets) {
      const normalized = await normalizePickedImage(asset);
      if (normalized) attachments.push(normalized);
    }

    // The picker returned files, but none of them survived encoding. Say so — an empty
    // return with no alert looks like the tap did nothing.
    if (chosenAssets.length > 0 && attachments.length === 0) {
      Alert.alert('Could not read photo', 'Try a different image or take a new photo with Camera.');
    }
    return attachments;
  } catch (error) {
    console.warn('[pickCoachPhotosFromLibrary]', error?.message || error);
    Alert.alert('Could not open photos', error?.message || 'Try again.');
    return [];
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
      'Allow camera access to take a progress photo.'
    );
    if (!isGranted) return [];

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: PICKER_IMAGE_QUALITY,
    });

    if (result.canceled) return [];
    const asset = result.assets?.[0];
    if (!asset?.uri) return [];

    const normalized = await normalizePickedImage(asset, DEFAULT_PHOTO_NAME);
    if (!normalized) {
      Alert.alert('Could not read photo', 'Try taking the photo again.');
      return [];
    }
    return [normalized];
  } catch (error) {
    console.warn('[pickCoachPhotoFromCamera]', error?.message || error);
    Alert.alert('Could not open camera', error?.message || 'Try again.');
    return [];
  }
}

/**
 * Open the document picker. Files are not re-encoded — the chat keeps the local uri.
 * @returns {Promise<Array<{id: string, name: string, uri: string, type: string}>>}
 */
export async function pickCoachDocuments() {
  try {
    // vocab: getDocumentAsync is Expo's file picker. multiple lets the user select more than one.
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (result.canceled) return [];
    return assetsFromPickerResult(result).map((documentAsset) => buildFileAttachment(documentAsset));
  } catch (error) {
    console.warn('[pickCoachDocuments]', error?.message || error);
    Alert.alert('Could not open files', error?.message || 'Try again.');
    return [];
  }
}
