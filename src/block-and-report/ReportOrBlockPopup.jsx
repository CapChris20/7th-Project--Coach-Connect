// Safety menus: report, block, or pick a reason. iOS uses the action sheet. Android uses an alert.
// Flow: show the menu → wait until it finishes dismissing → run the report or block callback.
// Used by chat and the trainer profile popup.

import { ActionSheetIOS, Alert, Platform } from 'react-native';
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
 * The next alert has to wait until this sheet is gone, or the two native menus stack.
 * @param {Function} menuCallback
 * @returns {void}
 */
function runAfterMenuCloses(menuCallback) {
  if (typeof menuCallback !== 'function') return;
  const isIos = Platform.OS === IOS_PLATFORM;
  const delayMs = isIos ? IOS_MENU_DELAY_MS : OTHER_PLATFORM_MENU_DELAY_MS;
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

// ===== MAIN FUNCTION =====

/**
 * @param {{ peerName?: string, onReport: Function, onBlock: Function }} options
 * @returns {void}
 */
export function showSafetyPeerMenu({ peerName, onReport, onBlock }) {
  const title = peerName ? `Safety — ${peerName}` : SAFETY_TITLE;
  const options = [CANCEL_LABEL, REPORT_LABEL, BLOCK_LABEL];
  const isIos = Platform.OS === IOS_PLATFORM;

  if (isIos) {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options, cancelButtonIndex: CANCEL_INDEX, destructiveButtonIndex: BLOCK_INDEX },
      (selectedIndex) => {
        if (selectedIndex === REPORT_INDEX) runAfterMenuCloses(onReport);
        if (selectedIndex === BLOCK_INDEX) runAfterMenuCloses(onBlock);
      },
    );
    return;
  }

  Alert.alert(title, undefined, [
    { text: CANCEL_LABEL, style: 'cancel' },
    { text: REPORT_LABEL, onPress: () => runAfterMenuCloses(onReport) },
    { text: BLOCK_LABEL, style: 'destructive', onPress: () => runAfterMenuCloses(onBlock) },
  ]);
}

/**
 * @param {{ onPick: Function, title?: string }} options
 * @returns {void}
 */
export function showReportReasonPicker({ onPick, title = REASON_TITLE }) {
  const reasonLabels = REPORT_REASONS.map((reason) => reason.label);
  const isIos = Platform.OS === IOS_PLATFORM;

  if (isIos) {
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

  Alert.alert(title, REASON_PROMPT, [
    { text: CANCEL_LABEL, style: 'cancel' },
    ...REPORT_REASONS.map((reason) => ({
      text: reason.label,
      onPress: () => runAfterMenuCloses(() => onPick(reason.id)),
    })),
  ]);
}

/**
 * @param {{ peerName?: string, onConfirm: Function }} options
 * @returns {void}
 */
export function confirmBlockUser({ peerName, onConfirm }) {
  const personName = peerName || 'this user';
  Alert.alert(
    'Block user?',
    `You won’t see messages from ${personName} in your inbox. You can unblock anytime in Settings → Blocked users.`,
    [
      { text: CANCEL_LABEL, style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => runAfterMenuCloses(onConfirm) },
    ],
  );
}
