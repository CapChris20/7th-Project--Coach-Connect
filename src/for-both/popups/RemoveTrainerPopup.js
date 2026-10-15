// Bottom sheet to end a trainer–client link, with reasons and a hold-to-confirm.
// Flow: pick why → hold the button → call removeTrainerClientLink → close.
// Used from client Settings (Remove Trainer) and trainer client detail (Remove Client).

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

// Manipulate here: how long they must hold before the link is removed.
const HOLD_TO_REMOVE_MS = 3000;

const REASONS = [
  'Not seeing results',
  'Poor communication',
  'Too expensive',
  'Scheduling issues',
  'Found a different trainer',
  'Other',
];

// ===== HELPER FUNCTIONS =====

function nextSelectedReasons(currentReasons, reasonLabel) {
  if (currentReasons.includes(reasonLabel)) {
    return currentReasons.filter((label) => label !== reasonLabel);
  }
  return [...currentReasons, reasonLabel];
}

/**
 * Cloud Function that ends the trainer–client link. Same argument keys as before.
 * @param {{ trainerId: string, clientId: string, reasons: string[], otherText: string|null, removedBy: string }} args
 * @returns {Promise<unknown>}
 */
async function callRemoveTrainerClientLink({ trainerId, clientId, reasons, otherText, removedBy }) {
  if (!functions) {
    throw new Error('Cloud Functions not initialized');
  }
  // vocab: httpsCallable = Firebase callable. The server name stays removeTrainerClientLink.
  const removeLinkCall = httpsCallable(functions, 'removeTrainerClientLink');
  return removeLinkCall({
    trainerId,
    clientId,
    reasons,
    otherText,
    removedBy,
  });
}

// ===== MAIN FUNCTION =====

/**
 * Remove trainer or client after they pick reasons and hold to confirm.
 * @param {object} props
 */
export default function RemoveTrainerPopup({
  visible,
  onClose,
  onRemovalComplete,
  trainerName,
  clientName,
  removedBy,
  trainerId,
  clientId,
}) {
  const [step, setStep] = useState(1);
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [otherText, setOtherText] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [removalError, setRemovalError] = useState(null);
  const holdAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setStep(1);
      setSelectedReasons([]);
      setOtherText('');
      setIsRemoving(false);
      setRemovalError(null);
      holdAnim.setValue(0);
    }
  }, [visible, holdAnim]);

  const toggleReason = (reasonLabel) => {
    // 1. Tap again to uncheck. First tap adds the reason chip.
    setSelectedReasons((currentReasons) => nextSelectedReasons(currentReasons, reasonLabel));
  };

  const handleRemoval = async () => {
    // 1. Need both ids. Missing either one is a no-op, not a half-delete.
    if (!trainerId || !clientId) return;
    setRemovalError(null);
    try {
      // 2. Call the server. Reasons and "Other" text stay on the request.
      await callRemoveTrainerClientLink({
        trainerId,
        clientId,
        reasons: selectedReasons,
        otherText: otherText || null,
        removedBy,
      });

      // 3. Parent refreshes, then we close.
      onRemovalComplete?.();
      onClose?.();
    } catch (caughtError) {
      console.error('RemoveTrainerPopup removal error:', caughtError);
      setRemovalError('Something went wrong. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  };

  const displayName = removedBy === 'client' ? trainerName : clientName;

  const startHold = () => {
    // 1. Already removing → ignore a second press.
    if (isRemoving) return;

    // 2. When the bar fills (3 seconds), lock and call the server.
    const listenerId = holdAnim.addListener(({ value }) => {
      if (value >= 1) {
        holdAnim.removeListener(listenerId);
        setIsRemoving(true);
        handleRemoval();
      }
    });
    Animated.timing(holdAnim, {
      toValue: 1,
      duration: HOLD_TO_REMOVE_MS,
      useNativeDriver: false,
    }).start();
  };

  const cancelHold = () => {
    // 1. Release early → bar springs back. A finished hold is not cancelled.
    if (isRemoving) return;
    Animated.spring(holdAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' }}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={{
            marginTop: 'auto',
            backgroundColor: '#0C0C14',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
          }}
          onStartShouldSetResponder={() => true}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              marginBottom: 24,
            }}
          >
            {[1, 2, 3].map((stepNumber) => (
              <View
                key={stepNumber}
                style={{
                  width: step === stepNumber ? 8 : 6,
                  height: step === stepNumber ? 8 : 6,
                  borderRadius: 4,
                  backgroundColor:
                    step === stepNumber ? '#FF6B9D' : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </View>

          {step === 1 && (
            <>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#fff',
                  marginBottom: 8,
                }}
              >
                Before you go...
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 24,
                }}
              >
                Help us understand why.
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 20,
                }}
              >
                {REASONS.map((reasonLabel) => {
                  const selected = selectedReasons.includes(reasonLabel);
                  return (
                    <TouchableOpacity
                      key={reasonLabel}
                      onPress={() => toggleReason(reasonLabel)}
                      style={{
                        height: 36,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        backgroundColor: selected
                          ? 'rgba(255,107,157,0.15)'
                          : 'rgba(255,255,255,0.05)',
                        borderWidth: 1,
                        borderColor: selected ? '#FF6B9D' : 'rgba(255,255,255,0.12)',
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color: selected ? '#FF6B9D' : 'rgba(255,255,255,0.5)',
                        }}
                      >
                        {reasonLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {selectedReasons.includes('Other') && (
                <TextInput
                  placeholder="Tell us more (optional)"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={otherText}
                  onChangeText={setOtherText}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    height: 44,
                    paddingHorizontal: 12,
                    fontSize: 14,
                    color: '#fff',
                    marginBottom: 24,
                  }}
                />
              )}
              <TouchableOpacity
                onPress={() => setStep(2)}
                disabled={selectedReasons.length === 0}
                style={{
                  width: '100%',
                  height: 50,
                  borderRadius: 12,
                  backgroundColor: '#FF6B9D',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: selectedReasons.length === 0 ? 0.4 : 1,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                  Next
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 2 && (
            <>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#fff',
                  marginBottom: 16,
                }}
              >
                Are you sure?
              </Text>
              <View
                style={{
                  backgroundColor: 'rgba(255,59,48,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,59,48,0.2)',
                  borderRadius: 12,
                  padding: 16,
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Ionicons
                    name="chatbubbles-outline"
                    size={18}
                    color="rgba(255,255,255,0.5)"
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.6)',
                      flex: 1,
                    }}
                  >
                    Your message history will be archived and read-only
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Ionicons
                    name="barbell-outline"
                    size={18}
                    color="rgba(255,255,255,0.5)"
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.6)',
                      flex: 1,
                    }}
                  >
                    All assigned workouts will be removed from your plan
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="rgba(255,255,255,0.5)"
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.6)',
                      flex: 1,
                    }}
                  >
                    Any upcoming scheduled sessions will be cancelled
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Ionicons
                    name="star-outline"
                    size={18}
                    color="rgba(255,255,255,0.5)"
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.6)',
                      flex: 1,
                    }}
                  >
                    You can leave a review after removing
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 12,
                  color: '#10B981',
                  marginTop: 12,
                }}
              >
                Your workout history and progress data stays on your account —
                you won't lose your personal records.
              </Text>
              <TouchableOpacity
                onPress={() => setStep(1)}
                style={{
                  width: '100%',
                  height: 50,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 24,
                }}
              >
                <Text
                  style={{ fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}
                >
                  Go Back
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(3)}
                style={{
                  width: '100%',
                  height: 50,
                  borderRadius: 12,
                  backgroundColor: '#FF6B9D',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 10,
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
                  Continue
                </Text>
              </TouchableOpacity>
            </>
          )}

          {step === 3 && (
            <>
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#fff',
                  marginBottom: 8,
                }}
              >
                Last step
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.5)',
                  marginBottom: 32,
                }}
              >
                Hold the button below for 3 seconds to confirm. This cannot be
                undone.
              </Text>
              <View
                style={{
                  width: '100%',
                  height: 56,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,107,157,0.15)',
                  borderWidth: 1,
                  borderColor: '#FF6B9D',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: holdAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: 'rgba(255,107,157,0.3)',
                    borderRadius: 14,
                  }}
                />
                <TouchableOpacity
                  onPressIn={startHold}
                  onPressOut={cancelHold}
                  disabled={isRemoving}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: '#fff',
                    }}
                  >
                    {isRemoving
                      ? 'Removing...'
                      : `Hold to Remove ${displayName || (removedBy === 'client' ? 'Trainer' : 'Client')}`}
                  </Text>
                </TouchableOpacity>
              </View>
              {removalError ? (
                <Text
                  style={{
                    fontSize: 13,
                    color: '#FF6B9D',
                    marginTop: 12,
                  }}
                >
                  {removalError}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={onClose}
                style={{ alignItems: 'center', marginTop: 20 }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.4)',
                  }}
                >
                  Changed your mind?
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
