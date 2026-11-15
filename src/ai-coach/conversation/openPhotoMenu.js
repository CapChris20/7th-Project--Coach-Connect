// Legacy native “attach” menu — do not wire this into new coach screens.
// Flow: warn in dev → iOS ActionSheet or Android Alert → user picks source → short delay → callback.
// Replaced by: CoachAttachSheet (Design Law NbSheet). File stays so stale imports do not crash.

import { ActionSheetIOS, Alert, Platform } from 'react-native';

// ===== NAMED CONSTANTS =====

const MENU_LABEL_CANCEL = 'Cancel';
const MENU_LABEL_LIBRARY = 'Photo Library';
const MENU_LABEL_CAMERA = 'Camera';
const MENU_LABEL_FILE = 'File';

// Order matches MENU_INDEX_* below — ActionSheetIOS uses these indices.
const ATTACH_MENU_OPTIONS = [
  MENU_LABEL_CANCEL,
  MENU_LABEL_LIBRARY,
  MENU_LABEL_CAMERA,
  MENU_LABEL_FILE,
];

const MENU_INDEX_CANCEL = 0;
const MENU_INDEX_PHOTO_LIBRARY = 1;
const MENU_INDEX_CAMERA = 2;
const MENU_INDEX_FILE = 3;

// Manipulate here: wait for the native sheet to dismiss before opening the picker (avoids iOS glitches).
const IOS_POST_MENU_WAIT_MS = 50;
const ANDROID_POST_MENU_WAIT_MS = 150;

const ATTACH_SHEET_TITLE = 'Attach';
const ATTACH_SHEET_MESSAGE = 'Choose an option';

const DEPRECATION_WARNING =
  '[AI Coach] showCoachAttachMenu is deprecated — open CoachAttachSheet (Design Law) instead.';

// ===== HELPER FUNCTIONS =====

function callbackOrNull(maybeCallback) {
  if (maybeCallback === null || maybeCallback === undefined) {
    return null;
  }
  return maybeCallback;
}

function pickCallbackForMenuIndex(selectedIndex, callbacks) {
  if (selectedIndex === MENU_INDEX_PHOTO_LIBRARY) {
    return callbackOrNull(callbacks.onPhotoLibrary);
  }
  if (selectedIndex === MENU_INDEX_CAMERA) {
    return callbackOrNull(callbacks.onCamera);
  }
  if (selectedIndex === MENU_INDEX_FILE) {
    return callbackOrNull(callbacks.onFile);
  }
  return null;
}

function runPickerAfterNativeMenuCloses(pickerCallback) {
  if (typeof pickerCallback !== 'function') {
    return;
  }

  const runningOnIos = Platform.OS === 'ios';
  let waitMilliseconds = ANDROID_POST_MENU_WAIT_MS;
  if (runningOnIos) {
    waitMilliseconds = IOS_POST_MENU_WAIT_MS;
  }

  setTimeout(() => {
    pickerCallback();
  }, waitMilliseconds);
}

function showIosActionSheetAttachMenu(callbacks) {
  // vocab: ActionSheetIOS.showActionSheetWithOptions = iOS system bottom sheet with labeled rows.
  ActionSheetIOS.showActionSheetWithOptions(
    {
      options: ATTACH_MENU_OPTIONS,
      cancelButtonIndex: MENU_INDEX_CANCEL,
    },
    (selectedIndex) => {
      const pickerCallback = pickCallbackForMenuIndex(selectedIndex, callbacks);
      runPickerAfterNativeMenuCloses(pickerCallback);
    },
  );
}

function delayedPickerPressHandler(pickerCallback) {
  return () => {
    runPickerAfterNativeMenuCloses(pickerCallback);
  };
}

function buildAndroidAttachAlertButtons(callbacks) {
  return [
    { text: MENU_LABEL_CANCEL, style: 'cancel' },
    {
      text: MENU_LABEL_LIBRARY,
      onPress: delayedPickerPressHandler(callbacks.onPhotoLibrary),
    },
    {
      text: MENU_LABEL_CAMERA,
      onPress: delayedPickerPressHandler(callbacks.onCamera),
    },
    {
      text: MENU_LABEL_FILE,
      onPress: delayedPickerPressHandler(callbacks.onFile),
    },
  ];
}

function showAndroidAlertAttachMenu(callbacks) {
  // vocab: Alert.alert = Android/iOS system dialog; on Android this is our attach menu stand-in.
  const alertButtons = buildAndroidAttachAlertButtons(callbacks);
  Alert.alert(ATTACH_SHEET_TITLE, ATTACH_SHEET_MESSAGE, alertButtons);
}

// ===== MAIN FUNCTION =====

/**
 * @deprecated Open CoachAttachSheet on conversation screens — this ActionSheet/Alert path is old chrome.
 * @param {{ onPhotoLibrary?: Function, onCamera?: Function, onFile?: Function }} callbacks
 */
export function showCoachAttachMenu(callbacks) {
  if (__DEV__) {
    console.warn(DEPRECATION_WARNING);
  }

  // 1. Pick the native chrome for this OS, then return — only one branch runs.
  const runningOnIos = Platform.OS === 'ios';
  if (runningOnIos) {
    showIosActionSheetAttachMenu(callbacks);
    return;
  }

  showAndroidAlertAttachMenu(callbacks);
}
