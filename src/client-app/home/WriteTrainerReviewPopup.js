// Bottom sheet where a client rates a trainer, edits that review, or deletes it.
// Flow: open with any saved stars and text → write reviews/{trainerId}_{clientId} → refresh the trainer average.
// Used by the client home and the trainer profile. One review per client-trainer pair.

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
import { db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const REVIEWS_COLLECTION = 'reviews';
const USERS_COLLECTION = 'users';
const TRAINERS_COLLECTION = 'trainers';
const STAR_COUNT = 5;
const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];
const MAX_REVIEW_CHARS = 500;
const EMPTY_RATING_AVERAGE = null;
const EMPTY_REVIEW_COUNT = 0;
const RATING_DECIMAL_PLACES = 10;
const FILLED_STAR_COLOR = '#F97316';
const EMPTY_STAR_COLOR = 'rgba(255,255,255,0.2)';
const DIM_SUBMIT_OPACITY = 0.4;
const FULL_SUBMIT_OPACITY = 1;
const FALLBACK_TRAINER_NAME = 'this trainer';

// ===== HELPER FUNCTIONS =====

function reviewDocumentId(trainerId, clientId) {
  return `${trainerId}_${clientId}`;
}

function ratingSummaryFromReviews(snapshot) {
  if (snapshot.empty) {
    return { rating: EMPTY_RATING_AVERAGE, reviewCount: EMPTY_REVIEW_COUNT };
  }
  let totalStars = 0;
  for (const reviewDoc of snapshot.docs) {
    totalStars += reviewDoc.data().rating || 0;
  }
  const average = totalStars / snapshot.docs.length;
  return {
    rating: Math.round(average * RATING_DECIMAL_PLACES) / RATING_DECIMAL_PLACES,
    reviewCount: snapshot.docs.length,
  };
}

function updateTrainerRating(trainerId) {
  const reviewsQuery = query(
    collection(db, REVIEWS_COLLECTION),
    where('trainerId', '==', trainerId),
  );
  return getDocs(reviewsQuery).then(async (snapshot) => {
    const payload = ratingSummaryFromReviews(snapshot);
    await setDoc(doc(db, USERS_COLLECTION, trainerId), payload, { merge: true });
    try {
      await setDoc(doc(db, TRAINERS_COLLECTION, trainerId), payload, { merge: true });
    } catch (ignoredError) {
      /* listing copy is optional */
    }
  });
}

function reviewDocumentPayload({
  trainerId,
  clientId,
  clientFirstName,
  rating,
  reviewText,
  existingReview,
}) {
  const savedCreatedAt = existingReview ? existingReview.createdAt : undefined;
  return {
    trainerId,
    clientId,
    clientFirstName: clientFirstName || null,
    rating,
    text: reviewText.trim() || null,
    createdAt: savedCreatedAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function starIndexes() {
  const indexes = [];
  for (let starIndex = 1; starIndex <= STAR_COUNT; starIndex += 1) {
    indexes.push(starIndex);
  }
  return indexes;
}

function starColor(starIndex, rating) {
  if (starIndex <= rating) return FILLED_STAR_COLOR;
  return EMPTY_STAR_COLOR;
}

function ratingWord(rating) {
  return RATING_LABELS[rating] || '';
}

function submitButtonOpacity(rating) {
  if (rating <= 0) return DIM_SUBMIT_OPACITY;
  return FULL_SUBMIT_OPACITY;
}

function reviewSheetTitle(trainerName) {
  if (trainerName) return `Rate your experience with ${trainerName}`;
  return `Rate your experience with ${FALLBACK_TRAINER_NAME}`;
}

function submitButtonLabel(existingReview) {
  if (existingReview) return 'Update Review';
  return 'Submit Review';
}

function finishReviewAndClose(onSubmitComplete, onClose) {
  if (onSubmitComplete) onSubmitComplete();
  if (onClose) onClose();
}

function StarRow({ rating, onChangeRating }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {starIndexes().map((starIndex) => (
        <TouchableOpacity
          key={starIndex}
          onPress={() => onChangeRating(starIndex)}
          style={{ padding: 4 }}
        >
          <Ionicons name="star" size={36} color={starColor(starIndex, rating)} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RatingWordLine({ rating }) {
  const word = ratingWord(rating);
  if (!word) return null;
  return (
    <Text
      style={{
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        marginTop: 8,
      }}
    >
      {word}
    </Text>
  );
}

function SubmitReviewButton({ submitting, submitLabel, rating, onPress }) {
  const isSubmitDisabled = rating <= 0 || submitting;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isSubmitDisabled}
      style={{
        width: '100%',
        height: 50,
        borderRadius: 12,
        backgroundColor: '#FF6B9D',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        opacity: submitButtonOpacity(rating),
      }}
    >
      <SubmitReviewButtonFace submitting={submitting} submitLabel={submitLabel} />
    </TouchableOpacity>
  );
}

function SubmitReviewButtonFace({ submitting, submitLabel }) {
  if (submitting) return <ActivityIndicator size="small" color="#fff" />;
  return <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>{submitLabel}</Text>;
}

function RemoveReviewButton({ existingReview, removing, onPress }) {
  if (!existingReview) return null;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={removing}
      style={{ alignItems: 'center', marginTop: 12 }}
    >
      <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Remove review</Text>
    </TouchableOpacity>
  );
}

function WriteTrainerReviewSheet({
  visible,
  onClose,
  trainerName,
  rating,
  onChangeRating,
  reviewText,
  onChangeReviewText,
  submitting,
  removing,
  existingReview,
  onSubmit,
  onRemove,
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
            {reviewSheetTitle(trainerName)}
          </Text>

          <StarRow rating={rating} onChangeRating={onChangeRating} />
          <RatingWordLine rating={rating} />

          <TextInput
            placeholder="Share your experience (optional)"
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={reviewText}
            onChangeText={onChangeReviewText}
            multiline
            numberOfLines={5}
            maxLength={MAX_REVIEW_CHARS}
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
            {reviewText.length}/{MAX_REVIEW_CHARS}
          </Text>

          <SubmitReviewButton
            submitting={submitting}
            submitLabel={submitButtonLabel(existingReview)}
            rating={rating}
            onPress={onSubmit}
          />
          <RemoveReviewButton existingReview={existingReview} removing={removing} onPress={onRemove} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ===== MAIN FUNCTION =====

export default function WriteTrainerReviewPopup({
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
    if (!visible) return;
    const savedRating = existingReview ? existingReview.rating : undefined;
    const savedText = existingReview ? existingReview.text : undefined;
    setRating(savedRating ?? 0);
    setReviewText(savedText ?? '');
  }, [visible, existingReview]);

  const saveReview = async () => {
    if (!trainerId || !clientId || rating <= 0) return;
    setSubmitting(true);
    try {
      const reviewId = reviewDocumentId(trainerId, clientId);
      await setDoc(
        doc(db, REVIEWS_COLLECTION, reviewId),
        reviewDocumentPayload({
          trainerId,
          clientId,
          clientFirstName,
          rating,
          reviewText,
          existingReview,
        }),
        { merge: true },
      );
      await updateTrainerRating(trainerId);
      finishReviewAndClose(onSubmitComplete, onClose);
    } catch (error) {
      console.error('WriteTrainerReviewPopup submit error:', error);
      Alert.alert('Error', 'Could not save review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRemoveReview = async () => {
    if (!trainerId || !clientId) return;
    setRemoving(true);
    try {
      await deleteDoc(doc(db, REVIEWS_COLLECTION, reviewDocumentId(trainerId, clientId)));
      await updateTrainerRating(trainerId);
      finishReviewAndClose(onSubmitComplete, onClose);
    } catch (error) {
      console.error('WriteTrainerReviewPopup remove error:', error);
      Alert.alert('Error', 'Could not remove review. Please try again.');
    } finally {
      setRemoving(false);
    }
  };

  const askToRemoveReview = () => {
    Alert.alert('Remove your review?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: confirmRemoveReview },
    ]);
  };

  if (!visible) return null;

  return (
    <WriteTrainerReviewSheet
      visible={visible}
      onClose={onClose}
      trainerName={trainerName}
      rating={rating}
      onChangeRating={setRating}
      reviewText={reviewText}
      onChangeReviewText={setReviewText}
      submitting={submitting}
      removing={removing}
      existingReview={existingReview}
      onSubmit={saveReview}
      onRemove={askToRemoveReview}
    />
  );
}
