// Photo library permission, single-image pick, and base64 data URL for the coach vision API.
// Flow: request Photos access → launch library picker → normalize uri/base64 for OpenAI payloads.
// Used by: login avatar pick and coach chat attach. Failures surface Alerts; no UI in this file.

import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

// ===== NAMED CONSTANTS =====

const PERMISSION_GRANTED = 'granted';

// Manipulate here: default crop aspect and JPEG quality when the caller does not override.
const DEFAULT_CROP_ASPECT = [4, 3];
const DEFAULT_JPEG_QUALITY = 0.8;

const PREFIX_DATA_IMAGE = 'data:image';
const PREFIX_FILE_URI = 'file://';
const PREFIX_HTTP = 'http';
const PREFIX_ABSOLUTE_UNIX_PATH = '/';
const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,';

const ALERT_TITLE_PHOTO_ACCESS = 'Photo Access Needed';
const ALERT_BODY_PHOTO_ACCESS = 'To pick images, allow Photos access for CoachConnect.';
const ERROR_MESSAGE_PROCESS_FAILED =
  'Failed to process image. Please try selecting the image again.';

// ===== MAIN FUNCTIONS =====

/**
 * Ask the OS for Photos library access. Shows an Alert when denied.
 * @returns {Promise<boolean>} true when status is granted
 */
export async function requestImagePermissions() {
  // 1. Ask Expo ImagePicker for media-library permission (system dialog or cached status).
  // vocab: requestMediaLibraryPermissionsAsync = Expo helper for iOS Photos / Android storage.
  const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
  const permissionStatus = permissionResult.status;
  const userCanBeAskedAgain = permissionResult.canAskAgain;

  // 2. Denied → alert (OK, or Open Settings when the OS will not ask again).
  if (permissionStatus !== PERMISSION_GRANTED) {
    const alertButtons = buildPhotoDeniedAlertButtons(userCanBeAskedAgain);
    Alert.alert(ALERT_TITLE_PHOTO_ACCESS, ALERT_BODY_PHOTO_ACCESS, alertButtons);
    return false;
  }

  return true;
}

/**
 * Open the system photo library and return one chosen asset, or null.
 * @param {object} [options]
 * @param {boolean} [options.allowsEditing]
 * @param {number[]} [options.aspect]
 * @param {number} [options.quality]
 * @param {boolean} [options.includeBase64]
 * @returns {Promise<{ uri: string, base64?: string, width?: number, height?: number }|null>}
 */
export async function pickImage(options = {}) {
  // 1. Bail early if Photos is not granted.
  const permissionGranted = await requestImagePermissions();
  if (!permissionGranted) {
    return null;
  }

  const wantEditing = options.allowsEditing !== false;
  const cropAspect = options.aspect || DEFAULT_CROP_ASPECT;
  const jpegQuality = options.quality || DEFAULT_JPEG_QUALITY;
  const includeBase64InResult = options.includeBase64 !== false;

  try {
    // 2. Open the system photo library once.
    // vocab: launchImageLibraryAsync = Expo picker that returns { canceled, assets }.
    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: wantEditing,
      aspect: cropAspect,
      quality: jpegQuality,
      base64: includeBase64InResult,
    });

    // 3. User canceled or picked nothing → null.
    if (!userSelectedAnImageAsset(pickerResult)) {
      return null;
    }

    const chosenAsset = pickerResult.assets[0];
    return {
      uri: chosenAsset.uri,
      base64: chosenAsset.base64,
      width: chosenAsset.width,
      height: chosenAsset.height,
    };
  } catch (pickError) {
    console.error('Error picking image:', pickError);
    return null;
  }
}

/**
 * Turn a local uri, raw base64, or data URL into a data URL the vision API accepts.
 * @param {string} imageUri
 * @returns {Promise<string>}
 */
export async function prepareImageForOpenAI(imageUri) {
  // 1. Already a data:image… URL → return as-is.
  if (stringAlreadyLooksLikeImageDataUrl(imageUri)) {
    return imageUri;
  }

  // 2. Looks like raw base64 (no file:// / http / absolute path) → wrap as JPEG data URL.
  if (stringLooksLikeRawBase64WithoutPrefix(imageUri)) {
    return `${JPEG_DATA_URL_PREFIX}${imageUri}`;
  }

  // 3. Local file uri → fetch blob → FileReader data URL.
  try {
    return await readLocalFileUriAsDataUrl(imageUri);
  } catch (conversionError) {
    console.error('Error converting image to base64:', conversionError);
    throw new Error(ERROR_MESSAGE_PROCESS_FAILED);
  }
}

// ===== PLUMBING — skip unless debugging =====

function buildPhotoDeniedAlertButtons(userCanBeAskedAgain) {
  if (userCanBeAskedAgain) {
    return [{ text: 'OK' }];
  }
  return [
    { text: 'Not now', style: 'cancel' },
    {
      text: 'Open Settings',
      onPress: () => {
        // vocab: Linking.openSettings = jump to this app's page in OS Settings.
        Linking.openSettings().catch(() => {});
      },
    },
  ];
}

function userSelectedAnImageAsset(pickerResult) {
  if (pickerResult.canceled) {
    return false;
  }
  const assets = pickerResult.assets;
  if (!assets) {
    return false;
  }
  if (assets.length === 0) {
    return false;
  }
  return true;
}

function stringAlreadyLooksLikeImageDataUrl(imageUri) {
  return imageUri.startsWith(PREFIX_DATA_IMAGE);
}

function stringLooksLikeRawBase64WithoutPrefix(imageUri) {
  if (imageUri.startsWith(PREFIX_FILE_URI)) {
    return false;
  }
  if (imageUri.startsWith(PREFIX_HTTP)) {
    return false;
  }
  if (imageUri.startsWith(PREFIX_ABSOLUTE_UNIX_PATH)) {
    return false;
  }
  return true;
}

async function readLocalFileUriAsDataUrl(fileUri) {
  const fileResponse = await fetch(fileUri);
  const imageBlob = await fileResponse.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // vocab: FileReader.readAsDataURL = yields data:image/…;base64,…
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(imageBlob);
  });
}
