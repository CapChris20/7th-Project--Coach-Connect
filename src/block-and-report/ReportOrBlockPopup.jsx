// Safety menus: report, block, or pick a reason. iOS uses the action sheet. Android uses in-app sheets via callbacks.
// Flow: show the menu → wait until it finishes dismissing → run the report or block callback.
// Used by chat and the trainer profile popup.

import { ActionSheetIOS, Platform } from 'react-native';
import { REPORT_REASONS } from './reportReasons';

// ===== NAMED CONSTANTS =====

const IOS_PLATFORM = 'ios';
const CANCEL_INDEX = 0;
const REPORT_INDEX = 1;
const BLOCK_INDEX = 2;
const IOS_MENU_DELAY_MS = 50;
const OTHER_PLATFORM_MENU_DELAY_MS = 100;

const CANCEL_LABEL = 'Cancel';
const REPORT_LABEL = 'Report…';
const BLOCK_LABEL = 'Block…';
const SAFETY_TITLE = 'Safety';
const REASON_TITLE = 'Why are you reporting?';
const REASON_PROMPT = 'Choose a reason';

// ===== HELPER FUNCTIONS =====

/**
 * @returns {boolean}
 */
function runningOnIos() {
  return Platform.OS === IOS_PLATFORM;
}

/**
 * The next alert has to wait until this sheet is gone, or the two native menus stack.
 * @param {Function} menuCallback
 * @returns {void}
 */
function runAfterMenuCloses(menuCallback) {
  if (typeof menuCallback !== 'function') return;
  const delayMs = runningOnIos() ? IOS_MENU_DELAY_MS : OTHER_PLATFORM_MENU_DELAY_MS;
  setTimeout(() => menuCallback(), delayMs);
}

/**
 * Cancel is index 0, so the first reason is index 1.
 * @param {number} selectedIndex
 * @returns {string|null}
 */
function reasonIdForMenuIndex(selectedIndex) {
  if (selectedIndex <= CANCEL_INDEX) return null;
  const reason = REPORT_REASONS[selectedIndex - 1];
  return reason ? reason.id : null;
}

/**
 * @param {string|undefined} peerName
 * @returns {string}
 */
function safetyMenuTitle(peerName) {
  if (peerName) return `Safety — ${peerName}`;
  return SAFETY_TITLE;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ peerName?: string, onReport: Function, onBlock: Function, presentSafetyMenu?: Function }} options
 * presentSafetyMenu (Android): ({ title, onReport, onBlock }) => void — Design Law sheet in the host screen
 * @returns {void}
 */
export function showSafetyPeerMenu({ peerName, onReport, onBlock, presentSafetyMenu }) {
  const title = safetyMenuTitle(peerName);
  const options = [CANCEL_LABEL, REPORT_LABEL, BLOCK_LABEL];

  if (runningOnIos()) {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options, cancelButtonIndex: CANCEL_INDEX, destructiveButtonIndex: BLOCK_INDEX },
      (selectedIndex) => {
        if (selectedIndex === REPORT_INDEX) runAfterMenuCloses(onReport);
        if (selectedIndex === BLOCK_INDEX) runAfterMenuCloses(onBlock);
      },
    );
    return;
  }

  if (typeof presentSafetyMenu === 'function') {
    presentSafetyMenu({
      title,
      onReport: () => runAfterMenuCloses(onReport),
      onBlock: () => runAfterMenuCloses(onBlock),
    });
    return;
  }

  console.warn('[showSafetyPeerMenu] presentSafetyMenu required on Android');
}

/**
 * @param {{ onPick: Function, title?: string, presentReasonPicker?: Function }} options
 * @returns {void}
 */
export function showReportReasonPicker({ onPick, title = REASON_TITLE, presentReasonPicker }) {
  const reasonLabels = REPORT_REASONS.map((reason) => reason.label);

  if (runningOnIos()) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [CANCEL_LABEL, ...reasonLabels],
        cancelButtonIndex: CANCEL_INDEX,
      },
      (selectedIndex) => {
        const reasonId = reasonIdForMenuIndex(selectedIndex);
        if (!reasonId) return;
        runAfterMenuCloses(() => onPick(reasonId));
      },
    );
    return;
  }

  if (typeof presentReasonPicker === 'function') {
    presentReasonPicker({
      title,
      reasons: REPORT_REASONS,
      onPick: (reasonId) => runAfterMenuCloses(() => onPick(reasonId)),
    });
    return;
  }

  console.warn('[showReportReasonPicker] presentReasonPicker required on Android');
}

/**
 * @param {{ peerName?: string, onConfirm: Function, presentNotice?: Function }} options
 * presentNotice: (title, message, extras) => void — host screen NbNoticeSheet
 * @returns {void}
 */
export function confirmBlockUser({ peerName, onConfirm, presentNotice }) {
  const personName = peerName || 'this user';
  const message = `You won’t see messages from ${personName} in your inbox. You can unblock anytime in Settings → Blocked users.`;

  if (runningOnIos()) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Block user?',
        options: [CANCEL_LABEL, 'Block'],
        cancelButtonIndex: CANCEL_INDEX,
        destructiveButtonIndex: 1,
      },
      (selectedIndex) => {
        if (selectedIndex === 1) runAfterMenuCloses(onConfirm);
      },
    );
    return;
  }

  if (typeof presentNotice === 'function') {
    presentNotice('Block user?', message, {
      cancelLabel: CANCEL_LABEL,
      confirmLabel: 'Block',
      destructive: true,
      onConfirm: () => runAfterMenuCloses(onConfirm),
    });
    return;
  }

  console.warn('[confirmBlockUser] presentNotice required on Android');
}
