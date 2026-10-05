// Two-step "connect with this trainer" flow, shared by every marketplace surface.
// Flow: tap Connect → confirm sheet → optional intro-message sheet → send request → success alert.
// Why a hook: the browse list, search results, and profile sheet all need identical modal state
// and the same send/error handling, so the whole flow lives here instead of in each screen.
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

// Marketplace cards carry a display-shaped object with the original Firestore doc tucked under
// `_firebase`. The send API needs the RAW doc, so unwrap it — falling back to the object itself
// for callers that already passed the raw version.
function firebaseTrainer(uiTrainer) {
  return uiTrainer?._firebase || uiTrainer;
}

// First name only, for friendly copy ("Sarah received your request").
// Two fallback layers: the field may be missing entirely, and split() on an all-whitespace name
// can yield an empty string — both land on the neutral 'your coach'.
function trainerFirstName(trainer) {
  const full = trainer?.displayName || trainer?.name || 'your coach';
  return String(full).trim().split(/\s+/)[0] || 'your coach';
}

/** Native alert after a connection request is sent successfully. */
// Exported on its own because some screens send a request outside this hook but still want the
// identical confirmation copy.
// Manipulate here: this is the exact success wording, including the "usually within a day"
// expectation, and 'Got it' is the single dismiss button's label.
export function showTrainerRequestSentAlert(trainer, onDismiss) {
  const firstName = trainerFirstName(trainer);
  Alert.alert(
    'Request sent',
    `${firstName} received your connection request. You'll be notified when they respond — usually within a day.`,
    // onPress fires after the user dismisses, which is how callers navigate away only once the
    // alert is gone (navigating underneath a visible alert looks broken).
    [{ text: 'Got it', onPress: onDismiss }],
  );
}

export function sendConnectionRequest({ onRequestTrainer, onAfterSuccess } = {}) {
  // `requesting` is the in-flight lock, and it does double duty: it disables the send button AND
  // blocks the close handlers below, so the user can't dismiss a sheet mid-network-call.
  const [requesting, setRequesting] = useState(false);
  // The two sheets are tracked by holding the TRAINER (not a boolean), so each sheet knows who
  // it's about. null = closed. Only one is ever non-null at a time.
  const [requestConfirmTrainer, setRequestConfirmTrainer] = useState(null);
  const [requestIntroTrainer, setRequestIntroTrainer] = useState(null);
  // The optional personal note the client types in step 2.
  const [requestIntroDraft, setRequestIntroDraft] = useState('');

  // Step 1: open the confirm sheet. The draft is reset here so a message typed for a PREVIOUS
  // trainer can never leak into this new request.
  const openConnectFlow = useCallback((trainer) => {
    if (!trainer) return;
    setRequestConfirmTrainer(trainer);
    setRequestIntroDraft('');
  }, []);

  // Both close handlers are no-ops while a send is in flight — dismissing mid-request would leave
  // the user with no feedback about whether it succeeded.
  const closeRequestIntro = useCallback(() => {
    if (!requesting) {
      setRequestIntroTrainer(null);
      setRequestIntroDraft('');
    }
  }, [requesting]);

  const closeRequestConfirm = useCallback(() => {
    if (!requesting) setRequestConfirmTrainer(null);
  }, [requesting]);

  // Step 1 → step 2: hand the trainer over to the intro sheet and close the confirm sheet.
  // Setting the new one before clearing the old is deliberate — it makes the sheets cross-fade
  // rather than flashing an empty backdrop between them.
  const proceedFromConfirmToMessage = useCallback(() => {
    if (!requestConfirmTrainer) return;
    setRequestIntroTrainer(requestConfirmTrainer);
    setRequestConfirmTrainer(null);
  }, [requestConfirmTrainer]);

  // The actual send. Everything above this is just modal choreography.
  const runRequest = useCallback(
    async (trainer) => {
      const raw = firebaseTrainer(trainer);
      if (!raw) return;
      // The screen owns the send function. If it wasn't wired up, say so plainly instead of
      // silently doing nothing and leaving the user waiting.
      if (!onRequestTrainer) {
        Alert.alert('Unable to connect', 'Connection requests are not available right now.');
        return;
      }
      setRequesting(true);
      try {
        const customIntro = String(requestIntroDraft || '').trim();
        // `|| undefined` rather than `|| ''`: passing undefined omits the field entirely so the
        // backend applies its own default intro, whereas an empty string would send a blank note.
        await onRequestTrainer(raw, { clientIntro: customIntro || undefined });
        // Tear the whole flow down only AFTER a confirmed success, so a failure keeps the sheet
        // open with the user's typed message intact for a retry.
        setRequestConfirmTrainer(null);
        setRequestIntroTrainer(null);
        setRequestIntroDraft('');
        // vocab/symbol: onAfterSuccess?.(raw) = call it only if the caller provided it. Passed as
        // the alert's dismiss handler so any navigation happens after the user taps "Got it".
        showTrainerRequestSentAlert(raw, () => onAfterSuccess?.(raw));
      } catch (e) {
        console.error('Trainer request failed:', e);
        // Manipulate here: 'Please try again.' is the generic fallback when the thrown error has
        // no message worth showing.
        Alert.alert('Request failed', e?.message || 'Please try again.');
      } finally {
        // Always release the lock, or the send button stays disabled forever after one failure.
        setRequesting(false);
      }
    },
    [onRequestTrainer, requestIntroDraft, onAfterSuccess],
  );

  // The send button in the intro sheet. Falls back to requestConfirmTrainer so the flow still
  // works if a screen skips step 2 and sends straight from the confirm sheet.
  const completeFromIntro = useCallback(() => {
    const t = requestIntroTrainer || requestConfirmTrainer;
    if (t) runRequest(t);
  }, [requestIntroTrainer, requestConfirmTrainer, runRequest]);

  // Note the rename on the way out: `confirmSendRequest` is really "advance to the message step",
  // named from the CALLER's point of view (it's what the confirm sheet's primary button does).
  return {
    requesting,
    requestConfirmTrainer,
    requestIntroTrainer,
    requestIntroDraft,
    setRequestIntroDraft,
    openConnectFlow,
    closeRequestIntro,
    closeRequestConfirm,
    confirmSendRequest: proceedFromConfirmToMessage,
    completeFromIntro,
  };
}
