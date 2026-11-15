// Folder-local door for clipboard helpers — reply views import here, not from conversation/.
// Flow: import the three helpers from copyReplyText → bind the same frozen export names.
// Used by CoachReplyText, InternetAnswerReply, and CoachConversationScreen when copying.

import {
  stripInlineWebCitations as stripCitationsHelper,
  coachPlainText as plainTextHelper,
  copyCoachText as copyTextHelper,
} from '../conversation/copyReplyText';

// ===== NAMED CONSTANTS =====
// No local constants — this file only re-exports frozen names from conversation/.

// ===== HELPER FUNCTIONS =====

// Bind conversation clipboard helpers under the frozen reply-display export names.
function bindReplyClipboardHelpers() {
  return {
    stripInlineWebCitations: stripCitationsHelper,
    coachPlainText: plainTextHelper,
    copyCoachText: copyTextHelper,
  };
}

// ===== MAIN FUNCTION =====

const replyClipboardHelpers = bindReplyClipboardHelpers();

export const stripInlineWebCitations = replyClipboardHelpers.stripInlineWebCitations;
export const coachPlainText = replyClipboardHelpers.coachPlainText;
export const copyCoachText = replyClipboardHelpers.copyCoachText;

// ===== PLUMBING — skip unless debugging =====
// Edit ../conversation/copyReplyText.js to change clipboard behavior.
