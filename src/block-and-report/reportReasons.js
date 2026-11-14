// Reason codes a person can pick when they report a chat or a trainer profile.
// Flow: picker shows each label → saved report stores the matching id → type string says what was reported.
// Used by: reportContent.js, ReportOrBlockPopup.jsx, ReportOrBlockSheet.jsx.

// ===== NAMED CONSTANTS =====

// Manipulate here: add a row to REPORT_REASONS. The id is what Firestore stores —
// do not rename an id that is already live in reports.
const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or scam' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Something else' },
];

// Report "what was reported" strings — letters stay frozen for Firestore / API.
const REPORT_TYPES = {
  USER: 'user',
  MESSAGE: 'message',
  TRAINER_PROFILE: 'trainer_profile',
};

// ===== MAIN EXPORTS =====

export { REPORT_REASONS, REPORT_TYPES };
