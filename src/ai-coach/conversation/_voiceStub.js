// Stand-in after the voice feature was removed. Call sites still expect this hook.
// Flow: return the same shape as the old speech hook, with every action doing nothing.
// Used by: coach screens that used to start listening or speaking. Safe to delete once those calls are gone.

// ===== NAMED CONSTANTS =====

// Voice input does not exist in the app right now. Composers must hide their
// mic button while this is false — a visible mic that silently does nothing
// is worse than no mic (found in the Oct 2026 trust-bug pass).
// Manipulate here: flip to true only when a real speech hook replaces this stub.
export const COACH_VOICE_INPUT_AVAILABLE = false;

const SILENT_SPEECH_STATE = {
  listening: false,
  speaking: false,
  partial: '',
};

// ===== HELPER FUNCTIONS =====

async function ignoreRemovedVoiceAction() {}

/**
 * Build the object screens destructure from useCoachSpeech.
 * Keeping keys identical avoids touching every caller when voice was removed.
 * @returns {object}
 */
function buildSilentCoachSpeechControls() {
  return {
    listening: SILENT_SPEECH_STATE.listening,
    speaking: SILENT_SPEECH_STATE.speaking,
    partial: SILENT_SPEECH_STATE.partial,
    startListening: ignoreRemovedVoiceAction,
    stopListening: ignoreRemovedVoiceAction,
    // Screens destructure toggleListen — it must exist (as a no-op) even
    // though the mic button itself is hidden while voice is unavailable.
    toggleListen: ignoreRemovedVoiceAction,
    speak: ignoreRemovedVoiceAction,
    stopSpeaking: ignoreRemovedVoiceAction,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Voice hook that no longer records or speaks.
 * The keys match the old hook so existing screens keep working.
 * @returns {object}
 */
export function useCoachSpeech() {
  return buildSilentCoachSpeechControls();
}

export default useCoachSpeech;
