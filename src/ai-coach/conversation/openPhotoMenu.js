// Native attach sheet for coach chat: library, camera, or file.
// Flow: show menu → wait for dismiss animation → invoke the matching picker callback.
// Used by CoachConversationScreen and CoachHomeScreen.

import { ActionSheetIOS, Alert, Platform } from 'react-native';

// ===== NAMED CONSTANTS =====

// Cancel row first — iOS uses cancelButtonIndex for the system cancel styling.
const ATTACH_MENU_LABELS = ['Cancel', 'Photo Library', 'Camera', 'File'];
const CANCEL_MENU_INDEX = 0;
const LIBRARY_MENU_INDEX = 1;
const CAMERA_MENU_INDEX = 2;
const FILE_MENU_INDEX = 3;

// Manipulate here: delay before opening ImagePicker so it does not stack under the menu modal.
const IOS_DISMISS_WAIT_MS = 50;
const ANDROID_DISMISS_WAIT_MS = 150;

// ===== MAIN FUNCTION =====

/**
 * Show the attach menu and route the user's choice to the right picker.
 * @param {{ onPhotoLibrary?: function, onCamera?: function, onFile?: function }} callbacks
 * @returns {void}
 */
export function showCoachAttachMenu(callbacks) {
  // 1. iOS native sheet; everything else uses Alert.
  const isIosDevice = Platform.OS === 'ios';
  if (isIosDevice) {
    openIosAttachSheet(callbacks);
    return;
  }
  openAlertAttachMenu(callbacks);
}

// ===== HELPER FUNCTIONS =====

function attachPickerCallbackForIndex(selectedIndex, callbacks) {
  if (selectedIndex === LIBRARY_MENU_INDEX) return callbacks.onPhotoLibrary ?? null;
  if (selectedIndex === CAMERA_MENU_INDEX) return callbacks.onCamera ?? null;
  if (selectedIndex === FILE_MENU_INDEX) return callbacks.onFile ?? null;
  return null;
}

function schedulePickerAfterMenuDismiss(pickerCallback) {
  if (typeof pickerCallback !== 'function') return;
  const isIosDevice = Platform.OS === 'ios';
  const waitMs = isIosDevice ? IOS_DISMISS_WAIT_MS : ANDROID_DISMISS_WAIT_MS;
  setTimeout(() => {
    pickerCallback();
  }, waitMs);
}

function openIosAttachSheet(callbacks) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      options: ATTACH_MENU_LABELS,
      cancelButtonIndex: CANCEL_MENU_INDEX,
    },
    (selectedIndex) => {
      const pickerCallback = attachPickerCallbackForIndex(selectedIndex, callbacks);
      schedulePickerAfterMenuDismiss(pickerCallback);
    },
  );
}

function openAlertAttachMenu(callbacks) {
  const wrap = (pickerCallback) => () => schedulePickerAfterMenuDismiss(pickerCallback);
  Alert.alert('Attach', 'Choose an option', [
    { text: ATTACH_MENU_LABELS[CANCEL_MENU_INDEX], style: 'cancel' },
    { text: ATTACH_MENU_LABELS[LIBRARY_MENU_INDEX], onPress: wrap(callbacks.onPhotoLibrary) },
    { text: ATTACH_MENU_LABELS[CAMERA_MENU_INDEX], onPress: wrap(callbacks.onCamera) },
    { text: ATTACH_MENU_LABELS[FILE_MENU_INDEX], onPress: wrap(callbacks.onFile) },
  ]);
}
