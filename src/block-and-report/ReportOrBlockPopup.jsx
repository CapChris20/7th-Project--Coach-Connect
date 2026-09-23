// Shared safety menus: pick Report reason, confirm Block — iOS ActionSheet / Android Alert.
// Flow: showSafetyPeerMenu or showReportReasonPicker → callbacks run services (block/report).
// Used by: ChatScreen, TrainerProfilePopup.
// Key exports: showSafetyPeerMenu, showReportReasonPicker, confirmBlockUser
// Why not a Modal component? Matches existing ChatThread attach pattern — less stacking bugs.

import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { REPORT_REASONS } from './reportReasons';

function runSoon(fn) {
  if (typeof fn !== 'function') return;
  // iOS: ActionSheet dismisses async — wait a tick before the next Alert
  setTimeout(() => fn(), Platform.OS === 'ios' ? 50 : 100);
}

/**
 * Report / Block / Cancel for the other person in a chat or marketplace profile.
 * @param {{
 *   peerName?: string,
 *   onReport: () => void,
 *   onBlock: () => void,
 * }} opts
 */
export function showSafetyPeerMenu({ peerName, onReport, onBlock }) {
  const title = peerName ? `Safety — ${peerName}` : 'Safety';
  const options = ['Cancel', 'Report…', 'Block…'];

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options, cancelButtonIndex: 0, destructiveButtonIndex: 2 },
      (idx) => {
        if (idx === 1) runSoon(onReport);
        else if (idx === 2) runSoon(onBlock);
      },
    );
    return;
  }

  Alert.alert(title, undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Report…', onPress: () => runSoon(onReport) },
    { text: 'Block…', style: 'destructive', onPress: () => runSoon(onBlock) },
  ]);
}

/**
 * Pick a REPORT_REASONS id, then call onPick(reasonId).
 * @param {{ onPick: (reasonId: string) => void, title?: string }} opts
 */
export function showReportReasonPicker({ onPick, title = 'Why are you reporting?' }) {
  const labels = REPORT_REASONS.map((r) => r.label);

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: ['Cancel', ...labels],
        cancelButtonIndex: 0,
      },
      (idx) => {
        if (idx <= 0) return;
        const reason = REPORT_REASONS[idx - 1];
        if (reason) runSoon(() => onPick(reason.id));
      },
    );
    return;
  }

  Alert.alert(title, 'Choose a reason', [
    { text: 'Cancel', style: 'cancel' },
    ...REPORT_REASONS.map((r) => ({
      text: r.label,
      onPress: () => runSoon(() => onPick(r.id)),
    })),
  ]);
}

/**
 * Confirm block, then onConfirm().
 * @param {{ peerName?: string, onConfirm: () => void }} opts
 */
export function confirmBlockUser({ peerName, onConfirm }) {
  const name = peerName || 'this user';
  Alert.alert(
    'Block user?',
    `You won’t see messages from ${name} in your inbox. You can unblock anytime in Settings → Blocked users.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Block', style: 'destructive', onPress: () => runSoon(onConfirm) },
    ],
  );
}
