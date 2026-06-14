import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImageManipulator from 'expo-image-manipulator';

function attId() {
  return `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Resize + JPEG compress so we always have base64 for the vision API. */
async function normalizePickedImage(asset, fallbackName = 'photo.jpg') {
  const uri = asset?.uri;
  if (!uri) return null;

  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      {
        compress: 0.72,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    if (!manipulated?.base64) {
      throw new Error('Could not encode image');
    }

    return {
      id: attId(),
      preview: manipulated.uri || uri,
      base64: manipulated.base64,
      type: 'image',
      mimeType: 'image/jpeg',
      name: asset.fileName || fallbackName,
    };
  } catch (e) {
    console.warn('[normalizePickedImage]', e?.message || e);
    if (asset.base64) {
      return {
        id: attId(),
        preview: uri,
        base64: asset.base64,
        type: 'image',
        mimeType: asset.mimeType || 'image/jpeg',
        name: asset.fileName || fallbackName,
      };
    }
    return null;
  }
}

async function ensureMediaLibraryPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status === 'granted') return true;
  Alert.alert('Permission needed', 'Allow access to your photo library to attach images.');
  return false;
}

export async function pickCoachPhotosFromLibrary() {
  try {
    const ok = await ensureMediaLibraryPermission();
    if (!ok) return [];

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (result.canceled) return [];
    const assets = Array.isArray(result.assets) ? result.assets : [];
    const out = [];
    for (const asset of assets.slice(0, 3)) {
      const normalized = await normalizePickedImage(asset);
      if (normalized) out.push(normalized);
    }
    if (assets.length > 0 && out.length === 0) {
      Alert.alert('Could not read photo', 'Try a different image or take a new photo with Camera.');
    }
    return out;
  } catch (e) {
    console.warn('[pickCoachPhotosFromLibrary]', e?.message || e);
    Alert.alert('Could not open photos', e?.message || 'Try again.');
    return [];
  }
}

export async function pickCoachPhotoFromCamera() {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take a progress photo.');
      return [];
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled) return [];
    const asset = result.assets?.[0];
    if (!asset?.uri) return [];

    const normalized = await normalizePickedImage(asset, 'photo.jpg');
    if (!normalized) {
      Alert.alert('Could not read photo', 'Try taking the photo again.');
      return [];
    }
    return [normalized];
  } catch (e) {
    console.warn('[pickCoachPhotoFromCamera]', e?.message || e);
    Alert.alert('Could not open camera', e?.message || 'Try again.');
    return [];
  }
}

export async function pickCoachDocuments() {
  try {
    const result = await DocumentPicker.getDocumentAsync({ multiple: true });
    if (result.canceled) return [];
    const assets = Array.isArray(result.assets) ? result.assets : [];
    return assets.map((a) => ({
      id: attId(),
      name: a.name,
      uri: a.uri,
      type: 'file',
    }));
  } catch (e) {
    console.warn('[pickCoachDocuments]', e?.message || e);
    Alert.alert('Could not open files', e?.message || 'Try again.');
    return [];
  }
}
