// Safety peer menus — report, block, or pick a report reason (platform-specific UI).
// Flow: show menu → wait for native dismiss → parent runs report/block/reason callback.
// Used by: chat thread header and trainer profile overflow. Android uses host-screen sheets via injectors.
//
// vocab: ActionSheetIOS — iOS bottom sheet from React Native; index 0 is always Cancel here.
// Manipulate here: IOS_MENU_DELAY_MS / ANDROID_MENU_DELAY_MS if alerts still stack on top of each other.

import { ActionSheetIOS, Platform } from 'react-native';
import { REPORT_REASONS } from './reportReasons';

// ===== NAMED CONSTANTS =====

const IOS_PLATFORM = 'ios';
const CANCEL_MENU_INDEX = 0;
const REPORT_MENU_INDEX = 1;
const BLOCK_MENU_INDEX = 2;
const CONFIRM_BLOCK_MENU_INDEX = 1;
// iOS sheets dismiss faster — shorter delay before the next alert.
const IOS_MENU_DELAY_MS = 50;
const ANDROID_MENU_DELAY_MS = 100;

const CANCEL_LABEL = 'Cancel';
const REPORT_LABEL = 'Report…';
const BLOCK_LABEL = 'Block…';
const BLOCK_CONFIRM_LABEL = 'Block';
const SAFETY_TITLE = 'Safety';
const REASON_TITLE = 'Why are you reporting?';
const BLOCK_CONFIRM_TITLE = 'Block user?';
const DEFAULT_PEER_LABEL = 'this user';

// ===== HELPER FUNCTIONS =====

function appIsRunningOnIos() {
  return Platform.OS === IOS_PLATFORM;
}

function delayMillisecondsAfterMenuCloses() {
  if (appIsRunningOnIos()) {
    return IOS_MENU_DELAY_MS;
  }
  return ANDROID_MENU_DELAY_MS;
}

// Parent callbacks must run after the sheet is gone or two native menus overlap.
function runAfterMenuCloses(menuCallback) {
  if (typeof menuCallback !== 'function') {
    return;
  }
  const delayMilliseconds = delayMillisecondsAfterMenuCloses();
  setTimeout(() => menuCallback(), delayMilliseconds);
}

// Cancel is index 0, so the first REPORT_REASONS row is index 1.
function reportReasonIdForActionSheetIndex(selectedIndex) {
  if (selectedIndex <= CANCEL_MENU_INDEX) {
    return null;
  }
  const reasonRow = REPORT_REASONS[selectedIndex - 1];
  if (!reasonRow) {
    return null;
  }
  return reasonRow.id;
}

function buildSafetyMenuTitle(peerDisplayName) {
  if (peerDisplayName) {
    return `Safety — ${peerDisplayName}`;
  }
  return SAFETY_TITLE;
}

function buildBlockExplainerMessage(peerDisplayName) {
  let personLabel = DEFAULT_PEER_LABEL;
  if (peerDisplayName) {
    personLabel = peerDisplayName;
  }
  return (
    `You won’t see messages from ${personLabel} in your inbox. ` +
    'You can unblock anytime in Settings → Blocked users.'
  );
}

function collectReportReasonLabels() {
  const reasonLabels = [];
  for (let index = 0; index < REPORT_REASONS.length; index += 1) {
    reasonLabels.push(REPORT_REASONS[index].label);
  }
  return reasonLabels;
}

function buildIosReasonMenuOptions() {
  const menuOptions = [CANCEL_LABEL];
  const reasonLabels = collectReportReasonLabels();
  for (let index = 0; index < reasonLabels.length; index += 1) {
    menuOptions.push(reasonLabels[index]);
  }
  return menuOptions;
}

function openIosSafetyActionSheet(menuTitle, onReport, onBlock) {
  const menuOptions = [CANCEL_LABEL, REPORT_LABEL, BLOCK_LABEL];
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: menuTitle,
      options: menuOptions,
      cancelButtonIndex: CANCEL_MENU_INDEX,
      destructiveButtonIndex: BLOCK_MENU_INDEX,
    },
    (selectedIndex) => {
      if (selectedIndex === REPORT_MENU_INDEX) {
        runAfterMenuCloses(onReport);
        return;
      }
      if (selectedIndex === BLOCK_MENU_INDEX) {
        runAfterMenuCloses(onBlock);
      }
    },
  );
}

function openAndroidSafetySheet(menuTitle, onReport, onBlock, presentSafetyMenu) {
  presentSafetyMenu({
    title: menuTitle,
    onReport: () => runAfterMenuCloses(onReport),
    onBlock: () => runAfterMenuCloses(onBlock),
  });
}

function openIosReasonActionSheet(title, onPick) {
  const menuOptions = buildIosReasonMenuOptions();
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title,
      options: menuOptions,
      cancelButtonIndex: CANCEL_MENU_INDEX,
    },
    (selectedIndex) => {
      const reasonId = reportReasonIdForActionSheetIndex(selectedIndex);
      if (!reasonId) {
        return;
      }
      runAfterMenuCloses(() => onPick(reasonId));
    },
  );
}

function openAndroidReasonPicker(title, onPick, presentReasonPicker) {
  presentReasonPicker({
    title,
    reasons: REPORT_REASONS,
    onPick: (reasonId) => runAfterMenuCloses(() => onPick(reasonId)),
  });
}

function openIosBlockConfirmSheet(onConfirm) {
  ActionSheetIOS.showActionSheetWithOptions(
    {
      title: BLOCK_CONFIRM_TITLE,
      options: [CANCEL_LABEL, BLOCK_CONFIRM_LABEL],
      cancelButtonIndex: CANCEL_MENU_INDEX,
      destructiveButtonIndex: CONFIRM_BLOCK_MENU_INDEX,
    },
    (selectedIndex) => {
      if (selectedIndex === CONFIRM_BLOCK_MENU_INDEX) {
        runAfterMenuCloses(onConfirm);
      }
    },
  );
}

function openAndroidBlockConfirmNotice(blockExplainerMessage, onConfirm, presentNotice) {
  presentNotice(BLOCK_CONFIRM_TITLE, blockExplainerMessage, {
    cancelLabel: CANCEL_LABEL,
    confirmLabel: BLOCK_CONFIRM_LABEL,
    destructive: true,
    onConfirm: () => runAfterMenuCloses(onConfirm),
  });
}

// ===== MAIN FUNCTION =====

/**
 * Opens Report / Block for a chat or profile peer.
 * presentSafetyMenu (Android): host passes a Design Law sheet opener.
 * @param {{ peerName?: string, onReport: Function, onBlock: Function, presentSafetyMenu?: Function }} args
 */
export function showSafetyPeerMenu({ peerName, onReport, onBlock, presentSafetyMenu }) {
  const menuTitle = buildSafetyMenuTitle(peerName);

  // 1. iOS — native action sheet; destructive index points at Block.
  if (appIsRunningOnIos()) {
    openIosSafetyActionSheet(menuTitle, onReport, onBlock);
    return;
  }

  // 2. Android — host-owned sheet; still delay callbacks until dismiss finishes.
  if (typeof presentSafetyMenu === 'function') {
    openAndroidSafetySheet(menuTitle, onReport, onBlock, presentSafetyMenu);
    return;
  }

  console.warn('[showSafetyPeerMenu] presentSafetyMenu required on Android');
}

/**
 * Reason picker after user chose Report — returns a reason id to Firestore keys.
 * @param {{ onPick: Function, title?: string, presentReasonPicker?: Function }} args
 */
export function showReportReasonPicker({ onPick, title = REASON_TITLE, presentReasonPicker }) {
  // 1. iOS — native sheet with Cancel + each REPORT_REASONS label.
  if (appIsRunningOnIos()) {
    openIosReasonActionSheet(title, onPick);
    return;
  }

  // 2. Android — host sheet; delay the pick until dismiss finishes.
  if (typeof presentReasonPicker === 'function') {
    openAndroidReasonPicker(title, onPick, presentReasonPicker);
    return;
  }

  console.warn('[showReportReasonPicker] presentReasonPicker required on Android');
}

/**
 * Final block confirmation — inbox copy matches Settings → Blocked users unblock path.
 * presentNotice (Android): host NbNoticeSheet with destructive Block button.
 * @param {{ peerName?: string, onConfirm: Function, presentNotice?: Function }} args
 */
export function confirmBlockUser({ peerName, onConfirm, presentNotice }) {
  const blockExplainerMessage = buildBlockExplainerMessage(peerName);

  // 1. iOS — Cancel / Block destructive sheet.
  if (appIsRunningOnIos()) {
    openIosBlockConfirmSheet(onConfirm);
    return;
  }

  // 2. Android — host notice sheet with the same copy.
  if (typeof presentNotice === 'function') {
    openAndroidBlockConfirmNotice(blockExplainerMessage, onConfirm, presentNotice);
    return;
  }

  console.warn('[confirmBlockUser] presentNotice required on Android');
}
