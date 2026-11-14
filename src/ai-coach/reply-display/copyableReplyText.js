// Folder-local door for clipboard helpers — reply views import here, not from conversation/.
// Flow: import the three helpers from copyReplyText → bind the same frozen export names.
// Used by CoachReplyText, InternetAnswerReply, and CoachConversationScreen when copying.

import {
  stripInlineWebCitations as stripCitationsHelper,
  coachPlainText as plainTextHelper,
  copyCoachText as copyTextHelper,
} from '../conversation/copyReplyText';

// ===== MAIN FUNCTION =====
// No recipe body — this file only binds the three frozen names to the conversation helpers.
// Strip / plain / copy work lives in ../conversation/copyReplyText.js.

export const stripInlineWebCitations = stripCitationsHelper;
export const coachPlainText = plainTextHelper;
export const copyCoachText = copyTextHelper;

// ===== PLUMBING — skip unless debugging =====
// Edit ../conversation/copyReplyText.js to change clipboard behavior.
