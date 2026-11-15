// Reason codes a person can pick when they report a chat or a trainer profile.
// Flow: picker shows each label → saved report stores the matching id → type string says what was reported.
// Used by: reportContent.js, ReportOrBlockPopup.jsx, ReportOrBlockSheet.jsx.

// ===== NAMED CONSTANTS =====

// Manipulate here: add a row. The id is what Firestore stores —
// do not rename an id that is already live in reports.
const REPORT_REASON_SPAM = { id: 'spam', label: 'Spam or scam' };
const REPORT_REASON_HARASSMENT = { id: 'harassment', label: 'Harassment or bullying' };
const REPORT_REASON_INAPPROPRIATE = { id: 'inappropriate', label: 'Inappropriate content' };
const REPORT_REASON_OTHER = { id: 'other', label: 'Something else' };

// Report "what was reported" strings — letters stay frozen for Firestore / API.
const REPORT_TYPE_USER = 'user';
const REPORT_TYPE_MESSAGE = 'message';
const REPORT_TYPE_TRAINER_PROFILE = 'trainer_profile';

// ===== HELPER FUNCTIONS =====

function buildReportReasonsList() {
  const reasons = [];
  reasons.push(REPORT_REASON_SPAM);
  reasons.push(REPORT_REASON_HARASSMENT);
  reasons.push(REPORT_REASON_INAPPROPRIATE);
  reasons.push(REPORT_REASON_OTHER);
  return reasons;
}

function buildReportTypesTable() {
  return {
    USER: REPORT_TYPE_USER,
    MESSAGE: REPORT_TYPE_MESSAGE,
    TRAINER_PROFILE: REPORT_TYPE_TRAINER_PROFILE,
  };
}

// ===== MAIN FUNCTION =====
// Export the tables so pickers and submitters share the same ids.

const REPORT_REASONS = buildReportReasonsList();
const REPORT_TYPES = buildReportTypesTable();

export { REPORT_REASONS, REPORT_TYPES };
