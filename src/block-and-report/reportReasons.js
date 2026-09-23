// Report reason codes for contentReports — keep labels user-facing and short.
// Flow: ReportOrBlockPopup / report pickers import REPORT_REASONS → store `id` on the Firestore doc.
// Used by: reportContent.js, ReportOrBlockPopup.jsx
// Manipulate here: add/remove reasons; ids are what get stored (don’t rename shipped ids casually).

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or scam' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'other', label: 'Something else' },
];

export const REPORT_TYPES = {
  USER: 'user',
  MESSAGE: 'message',
  TRAINER_PROFILE: 'trainer_profile',
};
