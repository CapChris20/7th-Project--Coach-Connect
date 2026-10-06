// The attach menu on a coach chat: photo library, camera, or file.
// Flow: show the native menu → wait until it finishes dismissing → run the picker callback.
// Used by CoachConversationScreen and CoachHomeScreen.

import { ActionSheetIOS, Alert, Platform } from 'react-native';

// ===== NAMED CONSTANTS =====

// Cancel is first so iOS can draw it as the system cancel button. Indexes must match this order.
const CANCEL_OPTION_INDEX = 0;
const PHOTO_LIBRARY_OPTION_INDEX = 1;
const CAMERA_OPTION_INDEX = 2;
const FILE_OPTION_INDEX = 3;

const CANCEL_LABEL = 'Cancel';
const PHOTO_LIBRARY_LABEL = 'Photo Library';
const CAMERA_LABEL = 'Camera';
const FILE_LABEL = 'File';

// Manipulate here: the picker has to open after the menu is gone.
// iOS dismisses faster than Android's Alert. Too short and the picker stacks under the menu.
const IOS_PICKER_DELAY_MS = 50;
const OTHER_PLATFORM_PICKER_DELAY_MS = 150;

// ===== HELPER FUNCTIONS =====

// A screen that cannot attach files still shares this menu, so a missing callback is a no-op.
// The timeout is why this file exists: opening the picker in the same turn as the dismiss
// stacks two native modals, and the picker never shows.
function runAfterAttachMenuCloses(pickerCallback) {
  if (typeof pickerCallback !== 'function') return;
  const isIos = Platform.OS === 'ios';
  const delayMs = isIos ? IOS_PICKER_DELAY_MS : OTHER_PLATFORM_PICKER_DELAY_MS;
  setTimeout(() => pickerCallback(), delayMs);
}

function pickerForMenuIndex(selectedIndex, { onPhotoLibrary, onCamera, onFile }) {
  if (selectedIndex === PHOTO_LIBRARY_OPTION_INDEX) return onPhotoLibrary;
  if (selectedIndex === CAMERA_OPTION_INDEX) return onCamera;
  if (selectedIndex === FILE_OPTION_INDEX) return onFile;
  return null;
}

function showIosAttachMenu(callbacks) {
  // vocab: ActionSheetIOS = the native bottom menu. cancelButtonIndex is the row that only dismisses.
  ActionSheetIOS.showActionSheetWithOptions(
    {
      options: [CANCEL_LABEL, PHOTO_LIBRARY_LABEL, CAMERA_LABEL, FILE_LABEL],
      cancelButtonIndex: CANCEL_OPTION_INDEX,
    },
    (selectedIndex) => {
      runAfterAttachMenuCloses(pickerForMenuIndex(selectedIndex, callbacks));
    },
  );
}

function showOtherPlatformAttachMenu({ onPhotoLibrary, onCamera, onFile }) {
  Alert.alert('Attach', 'Choose an option', [
    { text: CANCEL_LABEL, style: 'cancel' },
    { text: PHOTO_LIBRARY_LABEL, onPress: () => runAfterAttachMenuCloses(onPhotoLibrary) },
    { text: CAMERA_LABEL, onPress: () => runAfterAttachMenuCloses(onCamera) },
    { text: FILE_LABEL, onPress: () => runAfterAttachMenuCloses(onFile) },
  ]);
}

// ===== MAIN FUNCTION =====

/**
 * Native attach menu. iOS uses the action sheet; other platforms use an alert.
 * @param {{ onPhotoLibrary?: function, onCamera?: function, onFile?: function }} callbacks
 * @returns {void}
 */
export function showCoachAttachMenu(callbacks) {
  const isIos = Platform.OS === 'ios';
  if (isIos) {
    showIosAttachMenu(callbacks);
    return;
  }
  showOtherPlatformAttachMenu(callbacks);
}
