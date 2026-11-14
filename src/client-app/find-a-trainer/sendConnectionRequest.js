// Client “connect with this coach” flow — confirm sheet, optional intro note, then Firestore send.
// Flow: open confirm → optional intro draft → send request → success alert (or failure alert).
// Used by browse list, search results, and TrainerProfileSheet.
// Hook return keys stay frozen so parent sheets keep working.

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

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  maybeFunction(...args);
}

function trainerDocForRequest(uiTrainer) {
  if (!uiTrainer) {
    return null;
  }
  if (uiTrainer._firebase) {
    return uiTrainer._firebase;
  }
  return uiTrainer;
}

function fullNameFromTrainerDoc(trainer) {
  if (!trainer) {
    return FALLBACK_TRAINER_NAME;
  }
  if (trainer.displayName) {
    return trainer.displayName;
  }
  if (trainer.name) {
    return trainer.name;
  }
  return FALLBACK_TRAINER_NAME;
}

function coachFirstNameFromTrainer(trainer) {
  const fullName = fullNameFromTrainerDoc(trainer);
  const trimmedName = String(fullName).trim();
  const nameParts = trimmedName.split(/\s+/);
  const firstWord = nameParts[0];
  if (!firstWord) {
    return FALLBACK_TRAINER_NAME;
  }
  return firstWord;
}

function trimmedIntroOrUndefined(draftText) {
  const trimmed = String(draftText || '').trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed;
}

function messageFromRequestError(requestError) {
  if (requestError && requestError.message) {
    return requestError.message;
  }
  return REQUEST_FAILED_FALLBACK;
}

function alertRequestFailed(requestError) {
  const message = messageFromRequestError(requestError);
  Alert.alert(REQUEST_FAILED_TITLE, message);
}

function alertConnectUnavailable() {
  Alert.alert(UNABLE_TO_CONNECT_TITLE, UNABLE_TO_CONNECT_MESSAGE);
}

function clearAllRequestSheets(setRequestConfirmTrainer, setRequestIntroTrainer, setRequestIntroDraft) {
  setRequestConfirmTrainer(null);
  setRequestIntroTrainer(null);
  setRequestIntroDraft('');
}

function requestSentBody(firstName) {
  return (
    `${firstName} received your connection request. You'll be notified when they respond — usually within a day.`
  );
}

// ===== MAIN FUNCTION =====

/**
 * Native alert after a connection request is sent.
 * @param {object} trainer
 * @param {Function} [onDismiss]
 */
export function showTrainerRequestSentAlert(trainer, onDismiss) {
  const firstName = coachFirstNameFromTrainer(trainer);
  const body = requestSentBody(firstName);
  Alert.alert(REQUEST_SENT_TITLE, body, [
    {
      text: GOT_IT_LABEL,
      onPress: () => callIfFunction(onDismiss),
    },
  ]);
}

/**
 * Connection request hook — state order and return keys are frozen for parent sheets.
 * Flow: 1. open confirm  2. optional intro  3. send  4. success alert
 * @param {{ onRequestTrainer?: Function, onAfterSuccess?: Function }} [options]
 * @returns {object}
 */
export function sendConnectionRequest({ onRequestTrainer, onAfterSuccess } = {}) {
  const [requesting, setRequesting] = useState(false);
  const [requestConfirmTrainer, setRequestConfirmTrainer] = useState(null);
  const [requestIntroTrainer, setRequestIntroTrainer] = useState(null);
  const [requestIntroDraft, setRequestIntroDraft] = useState('');

  const openConnectFlow = useCallback((trainer) => {
    if (!trainer) {
      return;
    }
    setRequestConfirmTrainer(trainer);
    setRequestIntroDraft('');
  }, []);

  const closeRequestIntro = useCallback(() => {
    if (requesting) {
      return;
    }
    setRequestIntroTrainer(null);
    setRequestIntroDraft('');
  }, [requesting]);

  const closeRequestConfirm = useCallback(() => {
    if (requesting) {
      return;
    }
    setRequestConfirmTrainer(null);
  }, [requesting]);

  const proceedFromConfirmToMessage = useCallback(() => {
    if (!requestConfirmTrainer) {
      return;
    }
    setRequestIntroTrainer(requestConfirmTrainer);
    setRequestConfirmTrainer(null);
  }, [requestConfirmTrainer]);

  const runRequest = useCallback(
    async (trainer) => {
      // 1. Resolve the Firestore doc the parent’s onRequestTrainer expects.
      const rawTrainer = trainerDocForRequest(trainer);
      if (!rawTrainer) {
        return;
      }

      // 2. Bail with a friendly alert when the screen never wired the send handler.
      if (!onRequestTrainer) {
        alertConnectUnavailable();
        return;
      }

      // 3. Send with an optional trimmed intro; clear sheets on success.
      setRequesting(true);
      try {
        const customIntro = trimmedIntroOrUndefined(requestIntroDraft);
        await onRequestTrainer(rawTrainer, { clientIntro: customIntro });
        clearAllRequestSheets(
          setRequestConfirmTrainer,
          setRequestIntroTrainer,
          setRequestIntroDraft,
        );
        showTrainerRequestSentAlert(rawTrainer, () => {
          callIfFunction(onAfterSuccess, rawTrainer);
        });
      } catch (requestError) {
        console.error('Trainer request failed:', requestError);
        alertRequestFailed(requestError);
      } finally {
        setRequesting(false);
      }
    },
    [onRequestTrainer, requestIntroDraft, onAfterSuccess],
  );

  const completeFromIntro = useCallback(() => {
    let trainerToSend = requestIntroTrainer;
    if (!trainerToSend) {
      trainerToSend = requestConfirmTrainer;
    }
    if (!trainerToSend) {
      return;
    }
    runRequest(trainerToSend);
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
