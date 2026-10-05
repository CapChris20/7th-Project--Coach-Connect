/**
 * image Service
 *
 * Purpose: Data/service layer: image Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/ai
 * Key exports: requestImagePermissions, pickImage, prepareImageForOpenAI
 *
 * @file-header
 */
// Image service for handling image selection and conversion
import * as ImagePicker from 'expo-image-picker';
import { Alert, Linking } from 'react-native';

/**
 * Request camera/media library permissions
 */
export async function requestImagePermissions() {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    const buttons = canAskAgain
      ? [{ text: 'OK' }]
      : [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings().catch(() => {}) },
        ];

    Alert.alert('Photo Access Needed', 'To pick images, allow Photos access for CoachConnect.', buttons);
    return false;
  }
  return true;
}

/**
 * Pick an image from the device
 * @param {object} options - Image picker options
 * @returns {Promise<{uri: string, base64?: string}|null>}
 */
export async function pickImage(options = {}) {
  const hasPermission = await requestImagePermissions();
  if (!hasPermission) return null;

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: options.allowsEditing !== false,
      aspect: options.aspect || [4, 3],
      quality: options.quality || 0.8,
      base64: options.includeBase64 !== false, // Include base64 for OpenAI
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
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
 * Convert image to OpenAI-compatible format
 * @param {string} imageUri - Local image URI, base64 string, or base64 from pickImage
 * @returns {Promise<string>} Base64 data URL
 */
export async function prepareImageForOpenAI(imageUri) {
  // If already base64 data URL, return as is
  if (imageUri.startsWith('data:image')) {
    return imageUri;
  }
  
  // If it's a base64 string without prefix, add prefix
  if (!imageUri.startsWith('file://') && !imageUri.startsWith('http') && !imageUri.startsWith('/')) {
    return `data:image/jpeg;base64,${imageUri}`;
  }
  
  // For local file URIs, we need to read as base64
  // Since expo-image-picker already provides base64, we should use that
  // But if we only have URI, we'll need to fetch it
  try {
    // Try to fetch and convert to base64
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
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to process image. Please try selecting the image again.');
  }
}

