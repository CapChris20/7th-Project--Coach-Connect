/**
 * Bottom sheet for submitting or editing a trainer review.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../app/config';

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

function updateTrainerRating(trainerId) {
  return getDocs(
    query(collection(db, 'reviews'), where('trainerId', '==', trainerId))
  ).then(async (snap) => {
    const payload = snap.empty
      ? { rating: null, reviewCount: 0 }
      : {
          rating: Math.round((snap.docs.reduce((sum, d) => sum + (d.data().rating || 0), 0) / snap.docs.length) * 10) / 10,
          reviewCount: snap.docs.length,
        };
    await setDoc(doc(db, 'users', trainerId), payload, { merge: true });
    try {
      await setDoc(doc(db, 'trainers', trainerId), payload, { merge: true });
    } catch (_) {}
  });
}



export default function ReviewSubmitSheet({
  visible,
  onClose,
  onSubmitComplete,
  trainerName,
  trainerId,
  clientId,
  clientFirstName,
  existingReview,
}) {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (visible) {
      setRating(existingReview?.rating ?? 0);
      setReviewText(existingReview?.text ?? '');
    }
  }, [visible, existingReview]);

  const handleSubmit = async () => {
    if (!trainerId || !clientId || rating <= 0) return;
    setSubmitting(true);
    try {
      const reviewId = `${trainerId}_${clientId}`;
      await setDoc(
        doc(db, 'reviews', reviewId),
        {
          trainerId,
          clientId,
          clientFirstName: clientFirstName || null,
          rating,
          text: reviewText.trim() || null,
          createdAt: existingReview?.createdAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await updateTrainerRating(trainerId);
      onSubmitComplete?.();
      onClose?.();
    } catch (e) {
      console.error('ReviewSubmitSheet submit error:', e);
      Alert.alert('Error', 'Could not save review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = () => {
    Alert.alert(
      'Remove your review?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!trainerId || !clientId) return;
            setRemoving(true);
            try {
              await deleteDoc(doc(db, 'reviews', `${trainerId}_${clientId}`));
              await updateTrainerRating(trainerId);
              onSubmitComplete?.();
              onClose?.();
            } catch (e) {
              console.error('ReviewSubmitSheet remove error:', e);
              Alert.alert('Error', 'Could not remove review. Please try again.');
            } finally {
              setRemoving(false);
            }
          },
        },
      ]
    );
  };

  if (!visible) return null;

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
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: '#fff',
              marginBottom: 24,
            }}
          >
            Rate your experience with {trainerName || 'this trainer'}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {[1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity
                key={i}
                onPress={() => setRating(i)}
                style={{ padding: 4 }}
              >
                <Ionicons
                  name="star"
                  size={36}
                  color={i <= rating ? '#F97316' : 'rgba(255,255,255,0.2)'}
                />
              </TouchableOpacity>
            ))}
          </View>
          {RATING_LABELS[rating] ? (
            <Text
              style={{
                fontSize: 14,
                color: 'rgba(255,255,255,0.6)',
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              {RATING_LABELS[rating]}
            </Text>
          ) : null}

          <TextInput
            placeholder="Share your experience (optional)"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            numberOfLines={5}
            maxLength={500}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: 14,
              fontSize: 14,
              color: '#fff',
              marginTop: 20,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
          <Text
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              textAlign: 'right',
              marginTop: 4,
            }}
          >
            {reviewText.length}/500
          </Text>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={rating <= 0 || submitting}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 12,
              backgroundColor: '#FF6B9D',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 20,
              opacity: rating <= 0 ? 0.4 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}
              >
                {existingReview ? 'Update Review' : 'Submit Review'}
              </Text>
            )}
          </TouchableOpacity>

          {existingReview ? (
            <TouchableOpacity
              onPress={handleRemove}
              disabled={removing}
              style={{ alignItems: 'center', marginTop: 12 }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.4)',
                }}
              >
                Remove review
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
