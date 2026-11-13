// Design Law “Review {name}” sheet (client-home PNG 13/14) — stars, tags, note, Post / Not now.
// Flow: open with any saved stars/text → write reviews/{trainerId}_{clientId} → refresh trainer average.
// Used by client home + review prompt. One review per client-trainer pair. Keep Firestore keys.
//
// vocab: NbSheet = Design Law bottom sheet; tags are UI-only chips (not a new Firestore field yet)
// Manipulate here: REVIEW_TAGS match PNG chips; star fill uses nbFill (never green / soft orange)

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
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
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import HardShadow from '../../look-and-feel/HardShadow';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const REVIEWS_COLLECTION = 'reviews';
const USERS_COLLECTION = 'users';
const TRAINERS_COLLECTION = 'trainers';
const STAR_COUNT = 5;
const MAX_REVIEW_CHARS = 500;
const EMPTY_RATING_AVERAGE = null;
const EMPTY_REVIEW_COUNT = 0;
const RATING_DECIMAL_PLACES = 10;
const FALLBACK_TRAINER_NAME = 'trainer';
// Manipulate here: PNG 13 chips — selected = fill; unselected = surface
const REVIEW_TAGS = ['Clear plans', 'Responsive', 'Pushes me', 'Great with injuries', 'On time'];

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
  tags,
  existingReview,
}) {
  const savedCreatedAt = existingReview ? existingReview.createdAt : undefined;
  return {
    trainerId,
    clientId,
    clientFirstName: clientFirstName || null,
    rating,
    text: reviewText.trim() || null,
    // tags stay optional — older reviews without tags still load fine
    tags: Array.isArray(tags) && tags.length ? tags : null,
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

function finishReviewAndClose(onSubmitComplete, onClose) {
  if (onSubmitComplete) onSubmitComplete();
  if (onClose) onClose();
}

function initialsFromName(name) {
  return String(name || '')
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'TR';
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
  const { colors } = useTheme();
  const [rating, setRating] = useState(4);
  const [reviewText, setReviewText] = useState('');
  const [tags, setTags] = useState(['Clear plans', 'Responsive']);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const savedRating = existingReview ? existingReview.rating : undefined;
    const savedText = existingReview ? existingReview.text : undefined;
    const savedTags = existingReview?.tags;
    setRating(savedRating ?? 4);
    setReviewText(savedText ?? '');
    setTags(Array.isArray(savedTags) && savedTags.length ? savedTags : ['Clear plans', 'Responsive']);
  }, [visible, existingReview]);

  const firstName = String(trainerName || '').split(/\s+/)[0] || FALLBACK_TRAINER_NAME;
  const initials = initialsFromName(trainerName);

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
          tags,
          existingReview,
        }),
        { merge: true },
      );
      await updateTrainerRating(trainerId);
      finishReviewAndClose(onSubmitComplete, onClose);
    } catch (error) {
      console.error('WriteTrainerReviewPopup submit error:', error);
      setNotice({ title: 'Could not save', message: 'Could not save review. Please try again.' });
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
      setConfirmRemove(false);
      finishReviewAndClose(onSubmitComplete, onClose);
    } catch (error) {
      console.error('WriteTrainerReviewPopup remove error:', error);
      setConfirmRemove(false);
      setNotice({ title: 'Could not remove', message: 'Could not remove review. Please try again.' });
    } finally {
      setRemoving(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <NbSheet visible={visible} onClose={onClose}>
        <View style={styles.body}>
          <View style={styles.headRow}>
            <View
              style={[
                styles.av,
                { backgroundColor: accentGradients[1][0], borderColor: colors.nbBorder },
              ]}
            >
              <Text style={{ fontWeight: '900', color: colors.nbInk }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.title, { color: colors.nbInk }]}>{`Review ${firstName}`}</Text>
              <Text style={[styles.sub, { color: colors.nbMuted }]}>Visible on their profile.</Text>
            </View>
          </View>

          <View style={styles.starRow}>
            {starIndexes().map((starIndex) => (
              <TouchableOpacity
                key={starIndex}
                onPress={() => setRating(starIndex)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${starIndex} star`}
              >
                <Ionicons
                  name={starIndex <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={starIndex <= rating ? colors.nbFill : colors.nbMuted}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.tagRow}>
            {REVIEW_TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() =>
                    setTags((prev) => (on ? prev.filter((t) => t !== tag) : [...prev, tag]))
                  }
                  style={[
                    styles.tagChip,
                    {
                      borderColor: colors.nbBorder,
                      backgroundColor: on ? colors.nbFill : colors.nbSurface,
                    },
                  ]}
                >
                  <Text style={{ fontWeight: '800', color: on ? colors.nbOnFill : colors.nbInk }}>
                    {tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
            <TextInput
              placeholder="Built around my knee from week one, and checks in without nagging."
              placeholderTextColor={colors.nbMuted}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              maxLength={MAX_REVIEW_CHARS}
              style={[
                styles.note,
                {
                  color: colors.nbInk,
                  backgroundColor: colors.nbSurface,
                  borderColor: colors.nbBorder,
                },
              ]}
            />
          </HardShadow>
          <Text style={[styles.counter, { color: colors.nbMuted }]}>
            {reviewText.length}/{MAX_REVIEW_CHARS}
          </Text>

          <View style={styles.actions}>
            <NbButton variant="ghost" onPress={onClose} style={{ flex: 1 }} disabled={submitting}>
              Not now
            </NbButton>
            <NbButton
              variant="fill"
              onPress={saveReview}
              style={{ flex: 1 }}
              disabled={rating <= 0 || submitting}
            >
              {submitting ? 'Posting…' : existingReview ? 'Update review' : 'Post review'}
            </NbButton>
          </View>

          {existingReview ? (
            <TouchableOpacity
              onPress={() => setConfirmRemove(true)}
              disabled={removing}
              style={{ alignItems: 'center', marginTop: 12 }}
            >
              {removing ? (
                <ActivityIndicator size="small" color={colors.nbMuted} />
              ) : (
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.nbMuted }}>
                  Remove review
                </Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </NbSheet>

      <NbNoticeSheet
        visible={!!notice}
        onClose={() => setNotice(null)}
        title={notice?.title || 'Error'}
        message={notice?.message}
        confirmLabel="OK"
      />
      <NbNoticeSheet
        visible={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remove your review?"
        message="This cannot be undone."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        onConfirm={confirmRemoveReview}
        destructive
      />
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 14,
    paddingBottom: spacing.lg,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  av: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '900' },
  sub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    minHeight: 100,
    fontSize: 14,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: -6,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
});
