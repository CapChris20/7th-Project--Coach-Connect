import { ActionSheetIOS, Alert, Platform } from 'react-native';

/**
 * Native attach menu — avoids Modal + ImagePicker stacking bugs on iOS.
 */
export function showCoachAttachMenu({ onPhotoLibrary, onCamera, onFile }) {
  const run = (fn) => {
    if (typeof fn !== 'function') return;
    // iOS: run immediately after native sheet dismisses.
    setTimeout(() => fn(), Platform.OS === 'ios' ? 50 : 150);
  };

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Photo Library', 'Camera', 'File'],
        cancelButtonIndex: 0,
      },
      (idx) => {
        if (idx === 1) run(onPhotoLibrary);
        else if (idx === 2) run(onCamera);
        else if (idx === 3) run(onFile);
      }
    );
    return;
  }

  Alert.alert('Attach', 'Choose an option', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Photo Library', onPress: () => run(onPhotoLibrary) },
    { text: 'Camera', onPress: () => run(onCamera) },
    { text: 'File', onPress: () => run(onFile) },
  ]);
}
