// Reason codes a person can pick when they report a chat or a trainer profile.
// Flow: the picker shows the label. The saved report stores the id.
// Used by: reportContent.js and ReportOrBlockPopup.jsx.

// ===== NAMED CONSTANTS =====

// Manipulate here: add or remove a reason. The id is what gets stored. Do not rename an id that is already in Firestore.
const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or scam' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Something else' },
];

const REPORT_TYPES = {
  USER: 'user',
  MESSAGE: 'message',
  TRAINER_PROFILE: 'trainer_profile',
};

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

export { REPORT_REASONS, REPORT_TYPES };
