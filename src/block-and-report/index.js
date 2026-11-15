// One import point for block and report helpers — chat and trainer profile menus use this barrel.
// Flow: import from here → get sheet, block list, report reasons, and submit helpers.
// Used by messaging menus and trainer profile safety actions.

import ReportOrBlockSheet from './ReportOrBlockSheet';
import { blockedList } from './blockedList';
import BlockedUsersScreen from './BlockedUsersScreen';
import { blockUser, listMyBlocks, unblockUser, subscribeMyBlocks } from './blockUser';
import {
  showSafetyPeerMenu,
  showReportReasonPicker,
  confirmBlockUser,
} from './ReportOrBlockPopup';
import { submitContentReport } from './reportContent';
import { REPORT_TYPES, REPORT_REASONS } from './reportReasons';

// ===== NAMED CONSTANTS =====
// No local constants — this barrel only re-exports sibling modules.

// ===== HELPER FUNCTIONS =====
// Real block / report logic lives in the files imported above.

// ===== MAIN FUNCTION =====
// Re-export the frozen public names other screens already import.

export {
  blockedList,
  BlockedUsersScreen,
  blockUser,
  listMyBlocks,
  unblockUser,
  subscribeMyBlocks,
  showSafetyPeerMenu,
  showReportReasonPicker,
  confirmBlockUser,
  ReportOrBlockSheet,
  submitContentReport,
  REPORT_TYPES,
  REPORT_REASONS,
};
