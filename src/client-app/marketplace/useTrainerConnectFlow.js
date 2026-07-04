/**
 * Shared connect / request flow for marketplace trainer profiles.
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

function firebaseTrainer(uiTrainer) {
  return uiTrainer?._firebase || uiTrainer;
}

function trainerFirstName(trainer) {
  const full = trainer?.displayName || trainer?.name || 'your coach';
  return String(full).trim().split(/\s+/)[0] || 'your coach';
}

/** Native alert after a connection request is sent successfully. */
export function showTrainerRequestSentAlert(trainer, onDismiss) {
  const firstName = trainerFirstName(trainer);
  Alert.alert(
    'Request sent',
    `${firstName} received your connection request. You'll be notified when they respond — usually within a day.`,
    [{ text: 'Got it', onPress: onDismiss }],
  );
}

export function useTrainerConnectFlow({ onRequestTrainer, onAfterSuccess } = {}) {
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
      const raw = firebaseTrainer(trainer);
      if (!raw) return;
      if (!onRequestTrainer) {
        Alert.alert('Unable to connect', 'Connection requests are not available right now.');
        return;
      }
      setRequesting(true);
      try {
        const customIntro = String(requestIntroDraft || '').trim();
        await onRequestTrainer(raw, { clientIntro: customIntro || undefined });
        setRequestConfirmTrainer(null);
        setRequestIntroTrainer(null);
        setRequestIntroDraft('');
        showTrainerRequestSentAlert(raw, () => onAfterSuccess?.(raw));
      } catch (e) {
        console.error('Trainer request failed:', e);
        Alert.alert('Request failed', e?.message || 'Please try again.');
      } finally {
        setRequesting(false);
      }
    },
    [onRequestTrainer, requestIntroDraft, onAfterSuccess],
  );

  const completeFromIntro = useCallback(() => {
    const t = requestIntroTrainer || requestConfirmTrainer;
    if (t) runRequest(t);
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
