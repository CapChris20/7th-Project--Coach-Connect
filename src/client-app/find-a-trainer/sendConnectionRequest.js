// The two-step "connect with this trainer" flow: confirm, then an optional intro note.
// Flow: tap Connect → confirm sheet → optional message → send the request → success alert.
// Used by the browse list, search results, and the trainer profile sheet.

import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

// ===== NAMED CONSTANTS =====

const FALLBACK_TRAINER_NAME = 'your coach';
const REQUEST_SENT_TITLE = 'Request sent';
const GOT_IT_LABEL = 'Got it';
const UNABLE_TO_CONNECT_TITLE = 'Unable to connect';
const UNABLE_TO_CONNECT_MESSAGE = 'Connection requests are not available right now.';
const REQUEST_FAILED_TITLE = 'Request failed';
const REQUEST_FAILED_FALLBACK = 'Please try again.';

// ===== HELPER FUNCTIONS =====

/**
 * Marketplace cards tuck the Firestore doc under `_firebase`. The send API needs that raw doc.
 * @param {object} uiTrainer
 * @returns {object}
 */
function firebaseTrainer(uiTrainer) {
  return uiTrainer?._firebase || uiTrainer;
}

/**
 * First name only, for "Sarah received your request".
 * @param {object} trainer
 * @returns {string}
 */
function trainerFirstName(trainer) {
  const fullName = trainer?.displayName || trainer?.name || FALLBACK_TRAINER_NAME;
  return String(fullName).trim().split(/\s+/)[0] || FALLBACK_TRAINER_NAME;
}

// ===== MAIN FUNCTION =====

/**
 * Native alert after a connection request is sent. Some screens send outside this hook and still want this copy.
 * @param {object} trainer
 * @param {Function} [onDismiss]
 * @returns {void}
 */
export function showTrainerRequestSentAlert(trainer, onDismiss) {
  const firstName = trainerFirstName(trainer);
  Alert.alert(
    REQUEST_SENT_TITLE,
    `${firstName} received your connection request. You'll be notified when they respond — usually within a day.`,
    [{ text: GOT_IT_LABEL, onPress: onDismiss }],
  );
}

/**
 * Hooks stay in this order: requesting, confirm trainer, intro trainer, intro draft, then the callbacks.
 * The returned keys stay the same so the sheets still read them.
 * @param {{ onRequestTrainer?: Function, onAfterSuccess?: Function }} [options]
 * @returns {object}
 */
export function sendConnectionRequest({ onRequestTrainer, onAfterSuccess } = {}) {
  const [requesting, setRequesting] = useState(false);
  const [requestConfirmTrainer, setRequestConfirmTrainer] = useState(null);
  const [requestIntroTrainer, setRequestIntroTrainer] = useState(null);
  const [requestIntroDraft, setRequestIntroDraft] = useState('');

  const openConnectFlow = useCallback((trainer) => {
    if (!trainer) return;
    setRequestConfirmTrainer(trainer);
    setRequestIntroDraft('');
  }, []);

  const closeRequestIntro = useCallback(() => {
    if (!requesting) {
      setRequestIntroTrainer(null);
      setRequestIntroDraft('');
    }
  }, [requesting]);

  const closeRequestConfirm = useCallback(() => {
    if (!requesting) setRequestConfirmTrainer(null);
  }, [requesting]);

  const proceedFromConfirmToMessage = useCallback(() => {
    if (!requestConfirmTrainer) return;
    setRequestIntroTrainer(requestConfirmTrainer);
    setRequestConfirmTrainer(null);
  }, [requestConfirmTrainer]);

  const runRequest = useCallback(
    async (trainer) => {
      const rawTrainer = firebaseTrainer(trainer);
      if (!rawTrainer) return;
      if (!onRequestTrainer) {
        Alert.alert(UNABLE_TO_CONNECT_TITLE, UNABLE_TO_CONNECT_MESSAGE);
        return;
      }
      setRequesting(true);
      try {
        const customIntro = String(requestIntroDraft || '').trim();
        await onRequestTrainer(rawTrainer, { clientIntro: customIntro || undefined });
        setRequestConfirmTrainer(null);
        setRequestIntroTrainer(null);
        setRequestIntroDraft('');
        showTrainerRequestSentAlert(rawTrainer, () => onAfterSuccess?.(rawTrainer));
      } catch (requestError) {
        console.error('Trainer request failed:', requestError);
        Alert.alert(REQUEST_FAILED_TITLE, requestError?.message || REQUEST_FAILED_FALLBACK);
      } finally {
        setRequesting(false);
      }
    },
    [onRequestTrainer, requestIntroDraft, onAfterSuccess],
  );

  const completeFromIntro = useCallback(() => {
    const trainerToSend = requestIntroTrainer || requestConfirmTrainer;
    if (trainerToSend) runRequest(trainerToSend);
  }, [requestIntroTrainer, requestConfirmTrainer, runRequest]);

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
