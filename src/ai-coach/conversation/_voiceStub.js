// Placeholder coach voice hook after real speech was removed from the app.
// Flow: export the same object shape as the old hook — every control is a no-op, mic stays hidden.
// Used by CoachConversationScreen / CoachHomeScreen that still destructure useCoachSpeech.
// Delete this file once call sites no longer import the mic / speech controls.

// ===== NAMED CONSTANTS =====

// Voice input does not exist in the app right now. Composers must hide their mic button while this
// is false — a visible mic that silently does nothing is worse than no mic (Oct 2026 trust-bug pass).
// Manipulate here: flip to true only when a real speech hook replaces this stub.
export const COACH_VOICE_INPUT_AVAILABLE = false;

// vocab: listening / speaking / partial = fields the old hook exposed so UI could show waveforms.
const IDLE_LISTENING = false;
const IDLE_SPEAKING = false;
const IDLE_PARTIAL_TRANSCRIPT = '';

// ===== HELPER FUNCTIONS =====

/**
 * Async no-op so callers can `await startListening()` without side effects or thrown errors.
 */
async function doNothingVoiceAction() {
  // Intentionally empty — screens still call these after the mic was removed.
}

/**
 * Frozen control bag matching the old useCoachSpeech return shape.
 * Screens still destructure toggleListen / speak / etc. even when the mic is hidden.
 */
function buildIdleSpeechControls() {
  return {
    listening: IDLE_LISTENING,
    speaking: IDLE_SPEAKING,
    partial: IDLE_PARTIAL_TRANSCRIPT,
    startListening: doNothingVoiceAction,
    stopListening: doNothingVoiceAction,
    // Screens still destructure toggleListen — must exist even when the mic button is hidden.
    toggleListen: doNothingVoiceAction,
    speak: doNothingVoiceAction,
    stopSpeaking: doNothingVoiceAction,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Stub hook — same keys as the real speech hook, all no-ops.
 * Callers may pass options; they are ignored so existing call sites keep compiling.
 * @returns {{ listening: boolean, speaking: boolean, partial: string, startListening: Function, stopListening: Function, toggleListen: Function, speak: Function, stopSpeaking: Function }}
 */
export function useCoachSpeech() {
  // 1. Build the frozen no-op control bag.
  const idleControls = buildIdleSpeechControls();

  // 2. Return it so existing screens keep destructuring the same keys.
  return idleControls;
}

export default useCoachSpeech;
