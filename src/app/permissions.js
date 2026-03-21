import { Camera } from 'expo-camera';
import { Audio } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

// Request camera permission
export const requestCameraPermission = async () => {
  try {
    console.log('Requesting camera permission');
    
    const { status } = await Camera.requestCameraPermissionsAsync();
    
    if (status === 'granted') {
      console.log('Camera permission granted');
      return { success: true, granted: true };
    } else {
      console.log('Camera permission denied');
      return { success: true, granted: false };
    }
  } catch (error) {
    console.error('Camera permission error:', error);
    return { success: false, error: error.message };
  }
};

// Request microphone permission
export const requestMicrophonePermission = async () => {
  try {
    console.log('Requesting microphone permission');
    
    const { status } = await Audio.requestPermissionsAsync();
    
    if (status === 'granted') {
      console.log('Microphone permission granted');
      return { success: true, granted: true };
    } else {
      console.log('Microphone permission denied');
      return { success: true, granted: false };
    }
  } catch (error) {
    console.error('Microphone permission error:', error);
    return { success: false, error: error.message };
  }
};

// Request photo library permission
export const requestPhotoLibraryPermission = async () => {
  try {
    console.log('Requesting photo library permission');
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status === 'granted') {
      console.log('Photo library permission granted');
      return { success: true, granted: true };
    } else {
      console.log('Photo library permission denied');
      return { success: true, granted: false };
    }
  } catch (error) {
    console.error('Photo library permission error:', error);
    return { success: false, error: error.message };
  }
};

// Check all permissions at once
export const checkAllPermissions = async () => {
  try {
    console.log('Checking all permissions');
    
    const [cameraResult, microphoneResult, photoLibraryResult] = await Promise.all([
      requestCameraPermission(),
      requestMicrophonePermission(),
      requestPhotoLibraryPermission()
    ]);
    
    const allGranted = cameraResult.granted && microphoneResult.granted && photoLibraryResult.granted;
    
    console.log('All permissions checked:', allGranted);
    return {
      success: true,
      allGranted,
      permissions: {
        camera: cameraResult.granted,
        microphone: microphoneResult.granted,
        photoLibrary: photoLibraryResult.granted
      }
    };
  } catch (error) {
    console.error('Check all permissions error:', error);
    return { success: false, error: error.message };
  }
};

// Request all permissions at once
export const requestAllPermissions = async () => {
  try {
    console.log('Requesting all permissions');
    
    const [cameraResult, microphoneResult, photoLibraryResult] = await Promise.all([
      requestCameraPermission(),
      requestMicrophonePermission(),
      requestPhotoLibraryPermission()
    ]);
    
    const allGranted = cameraResult.granted && microphoneResult.granted && photoLibraryResult.granted;
    
    console.log('All permissions requested:', allGranted);
    return {
      success: true,
      allGranted,
      permissions: {
        camera: cameraResult.granted,
        microphone: microphoneResult.granted,
        photoLibrary: photoLibraryResult.granted
      }
    };
  } catch (error) {
    console.error('Request all permissions error:', error);
    return { success: false, error: error.message };
  }
};

// Check if permissions are granted
export const arePermissionsGranted = async () => {
  try {
    console.log('Checking if permissions are granted');
    
    const cameraStatus = await Camera.getCameraPermissionsAsync();
    const audioStatus = await Audio.getPermissionsAsync();
    const photoStatus = await ImagePicker.getMediaLibraryPermissionsAsync();
    
    const allGranted = cameraStatus.granted && audioStatus.granted && photoStatus.granted;
    
    console.log('Permissions status:', allGranted);
    return {
      success: true,
      allGranted,
      permissions: {
        camera: cameraStatus.granted,
        microphone: audioStatus.granted,
        photoLibrary: photoStatus.granted
      }
    };
  } catch (error) {
    console.error('Check permissions granted error:', error);
    return { success: false, error: error.message };
  }
};


