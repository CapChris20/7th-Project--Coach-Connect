// Ask for Photos access, pick one image, and turn it into a data URL the coach API can send.
// Flow: request library permission → open the picker → if we only have a file path, read it as base64.
// Used by: login avatar picker, and coach chat when attaching a photo.

import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

// ===== NAMED CONSTANTS =====

const PERMISSION_STATUS_GRANTED = 'granted';
const DEFAULT_ASPECT_RATIO = [4, 3];
const DEFAULT_JPEG_QUALITY = 0.8;
const DATA_URL_IMAGE_PREFIX = 'data:image';
const FILE_URI_PREFIX = 'file://';
const HTTP_URI_PREFIX = 'http';
const ABSOLUTE_PATH_PREFIX = '/';
const JPEG_BASE64_DATA_URL_PREFIX = 'data:image/jpeg;base64,';
const PHOTO_ACCESS_TITLE = 'Photo Access Needed';
const PHOTO_ACCESS_MESSAGE = 'To pick images, allow Photos access for CoachConnect.';
const PROCESS_IMAGE_FAILED_MESSAGE = 'Failed to process image. Please try selecting the image again.';

// ===== MAIN FUNCTION =====

/**
 * Request camera/media library permissions.
 * @returns {Promise<boolean>}
 */
export async function requestImagePermissions() {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== PERMISSION_STATUS_GRANTED) {
    Alert.alert(PHOTO_ACCESS_TITLE, PHOTO_ACCESS_MESSAGE, photoAccessDeniedButtons(canAskAgain));
    return false;
  }
  return true;
}

/**
 * Pick an image from the device.
 * @param {object} [options] Image picker options
 * @returns {Promise<{uri: string, base64?: string, width?: number, height?: number}|null>}
 */
export async function pickImage(options = {}) {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) return null;

  try {
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: options.allowsEditing !== false,
      aspect: options.aspect || DEFAULT_ASPECT_RATIO,
      quality: options.quality || DEFAULT_JPEG_QUALITY,
      base64: options.includeBase64 !== false, // Include base64 for OpenAI
    });

    if (hasPickedAsset(pickerResult)) {
      const asset = pickerResult.assets[0];
      return {
        uri: asset.uri,
        base64: asset.base64,
        width: asset.width,
        height: asset.height,
      };
    }
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
}

/**
 * Convert image to OpenAI-compatible format.
 * @param {string} imageUri Local image URI, base64 string, or base64 from pickImage
 * @returns {Promise<string>} Base64 data URL
 */
export async function prepareImageForOpenAI(imageUri) {
  if (isImageDataUrl(imageUri)) {
    return imageUri;
  }

  if (isRawBase64Payload(imageUri)) {
    return `${JPEG_BASE64_DATA_URL_PREFIX}${imageUri}`;
  }

  try {
    return await readLocalImageAsDataUrl(imageUri);
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error(PROCESS_IMAGE_FAILED_MESSAGE);
  }
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

function photoAccessDeniedButtons(canAskAgain) {
  if (canAskAgain) return [{ text: 'OK' }];
  return [
    { text: 'Not now', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
  ];
}

function hasPickedAsset(pickerResult) {
  return !pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0;
}

function isImageDataUrl(imageUri) {
  return imageUri.startsWith(DATA_URL_IMAGE_PREFIX);
}

function isRawBase64Payload(imageUri) {
  return (
    !imageUri.startsWith(FILE_URI_PREFIX) &&
    !imageUri.startsWith(HTTP_URI_PREFIX) &&
    !imageUri.startsWith(ABSOLUTE_PATH_PREFIX)
  );
}

async function readLocalImageAsDataUrl(imageUri) {
  const response = await fetch(imageUri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
