// Design Law “Review {name}” sheet (client-home PNG 13/14) — stars, tags, note, Post / Not now.
// Flow: open with saved stars/text → write reviews/{trainerId}_{clientId} → refresh trainer average.
// Used by client home + review prompt. One review per client-trainer pair. Keep Firestore keys.

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
const FALLBACK_INITIALS = 'TR';
const DEFAULT_STAR_RATING = 4;
const DEFAULT_SELECTED_TAGS = ['Clear plans', 'Responsive'];
const REVIEW_TAGS = ['Clear plans', 'Responsive', 'Pushes me', 'Great with injuries', 'On time'];
const MAX_INITIAL_LETTERS = 2;

// ===== HELPER FUNCTIONS =====

function reviewDocumentId(trainerId, clientId) {
  return `${trainerId}_${clientId}`;
}

function trainerFirstName(fullName) {
  const words = String(fullName || '').split(/\s+/);
  const firstWord = words[0];
  if (firstWord) return firstWord;
  return FALLBACK_TRAINER_NAME;
}

function initialsFromName(name) {
  const words = String(name || '').split(/\s+/);
  const letters = [];
  for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
    const word = words[wordIndex];
    if (!word) continue;
    letters.push(word[0]);
    if (letters.length >= MAX_INITIAL_LETTERS) break;
  }
  if (letters.length === 0) return FALLBACK_INITIALS;
  return letters.join('').toUpperCase();
}

function listOfStarNumbers() {
  const starNumbers = [];
  for (let starNumber = 1; starNumber <= STAR_COUNT; starNumber += 1) {
    starNumbers.push(starNumber);
  }
  return starNumbers;
}

function tagsWithoutThisLabel(previousTags, tagToDrop) {
  const keptTags = [];
  for (let tagIndex = 0; tagIndex < previousTags.length; tagIndex += 1) {
    const label = previousTags[tagIndex];
    if (label === tagToDrop) continue;
    keptTags.push(label);
  }
  return keptTags;
}

function tagsAfterTogglingChip(previousTags, tagLabel, tagWasSelected) {
  if (tagWasSelected) {
    return tagsWithoutThisLabel(previousTags, tagLabel);
  }
  return [...previousTags, tagLabel];
}

function selectedTagsFromExisting(existingReview) {
  if (!existingReview) return DEFAULT_SELECTED_TAGS;
  const savedTags = existingReview.tags;
  if (!Array.isArray(savedTags)) return DEFAULT_SELECTED_TAGS;
  if (savedTags.length === 0) return DEFAULT_SELECTED_TAGS;
  return savedTags;
}

function postButtonLabelForState(isSubmitting, hasExistingReview) {
  if (isSubmitting) return 'Posting…';
  if (hasExistingReview) return 'Update review';
  return 'Post review';
}

function finishReviewAndClose(onSubmitComplete, onClose) {
  if (onSubmitComplete) onSubmitComplete();
  if (onClose) onClose();
}

function tagIsInList(tags, tagLabel) {
  for (let tagIndex = 0; tagIndex < tags.length; tagIndex += 1) {
    if (tags[tagIndex] === tagLabel) return true;
  }
  return false;
}

function ReviewStarButton({ starNumber, rating, colors, onPickStar }) {
  const starIsFilled = starNumber <= rating;
  const starIconName = starIsFilled ? 'star' : 'star-outline';
  const starIconColor = starIsFilled ? colors.nbFill : colors.nbMuted;

  return (
    <TouchableOpacity
      onPress={() => onPickStar(starNumber)}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${starNumber} star`}
    >
      <Ionicons name={starIconName} size={36} color={starIconColor} />
    </TouchableOpacity>
  );
}

function ReviewTagChip({ tagLabel, tagIsSelected, colors, onToggleTag }) {
  const tagBackground = tagIsSelected ? colors.nbFill : colors.nbSurface;
  const tagTextColor = tagIsSelected ? colors.nbOnFill : colors.nbInk;

  return (
    <TouchableOpacity
      onPress={() => onToggleTag(tagLabel, tagIsSelected)}
      style={[
        styles.tagChip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: tagBackground,
        },
      ]}
    >
      <Text style={{ fontWeight: '800', color: tagTextColor }}>{tagLabel}</Text>
    </TouchableOpacity>
  );
}

function buildStarButtonViews(rating, colors, onPickStar) {
  const starNumbers = listOfStarNumbers();
  const starViews = [];
  for (let starIndex = 0; starIndex < starNumbers.length; starIndex += 1) {
    const starNumber = starNumbers[starIndex];
    starViews.push(
      <ReviewStarButton
        key={starNumber}
        starNumber={starNumber}
        rating={rating}
        colors={colors}
        onPickStar={onPickStar}
      />,
    );
  }
  return starViews;
}

function buildTagChipViews(tags, colors, onToggleTag) {
  const tagViews = [];
  for (let tagIndex = 0; tagIndex < REVIEW_TAGS.length; tagIndex += 1) {
    const tagLabel = REVIEW_TAGS[tagIndex];
    tagViews.push(
      <ReviewTagChip
        key={tagLabel}
        tagLabel={tagLabel}
        tagIsSelected={tagIsInList(tags, tagLabel)}
        colors={colors}
        onToggleTag={onToggleTag}
      />,
    );
  }
  return tagViews;
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet to post or update one client→trainer review, then refresh the public average.
 * Hook order is frozen: theme → seven useState → hydrate useEffect.
 */
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
  const [rating, setRating] = useState(DEFAULT_STAR_RATING);
  const [reviewText, setReviewText] = useState('');
  const [tags, setTags] = useState(DEFAULT_SELECTED_TAGS);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let savedRating = DEFAULT_STAR_RATING;
    let savedText = '';
    if (existingReview) {
      if (existingReview.rating != null) savedRating = existingReview.rating;
      if (existingReview.text != null) savedText = existingReview.text;
    }

    setRating(savedRating ?? DEFAULT_STAR_RATING);
    setReviewText(savedText ?? '');
    setTags(selectedTagsFromExisting(existingReview));
  }, [visible, existingReview]);

  const firstName = trainerFirstName(trainerName);
  const initials = initialsFromName(trainerName);
  const hasExistingReview = Boolean(existingReview);
  const postButtonLabel = postButtonLabelForState(submitting, hasExistingReview);
  const canPost = rating > 0 && !submitting;
  const sheetTitle = `Review ${firstName}`;
  const characterCountLabel = `${reviewText.length}/${MAX_REVIEW_CHARS}`;
  const noticeIsVisible = Boolean(notice);

  let noticeTitle = 'Error';
  if (notice && notice.title) noticeTitle = notice.title;

  let noticeMessage;
  if (notice) noticeMessage = notice.message;

  const avatarFillColor = accentGradients[1][0];

  function toggleTagChip(tagLabel, tagWasSelected) {
    setTags((previousTags) => tagsAfterTogglingChip(previousTags, tagLabel, tagWasSelected));
  }

  async function saveReview() {
    // 1. Guard — need ids and at least one star.
    if (!trainerId || !clientId || rating <= 0) return;

    setSubmitting(true);
    try {
      // 2. Upsert reviews/{trainerId}_{clientId} with stars, tags, text.
      const reviewId = reviewDocumentId(trainerId, clientId);
      await setDoc(
        doc(db, REVIEWS_COLLECTION, reviewId),
        buildReviewDocumentPayload({
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

      // 3. Recompute this trainer's public average, then close.
      await refreshTrainerAverageRating(trainerId);
      finishReviewAndClose(onSubmitComplete, onClose);
    } catch (error) {
      console.error('WriteTrainerReviewPopup submit error:', error);
      setNotice({ title: 'Could not save', message: 'Could not save review. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRemoveReview() {
    // 1. Guard — need both ids.
    if (!trainerId || !clientId) return;

    setRemoving(true);
    try {
      // 2. Delete the pair doc and refresh trainer average.
      await deleteDoc(doc(db, REVIEWS_COLLECTION, reviewDocumentId(trainerId, clientId)));
      await refreshTrainerAverageRating(trainerId);
      setConfirmRemove(false);
      finishReviewAndClose(onSubmitComplete, onClose);
    } catch (error) {
      console.error('WriteTrainerReviewPopup remove error:', error);
      setConfirmRemove(false);
      setNotice({ title: 'Could not remove', message: 'Could not remove review. Please try again.' });
    } finally {
      setRemoving(false);
    }
  }

  if (!visible) return null;

  const starButtonViews = buildStarButtonViews(rating, colors, setRating);
  const tagChipViews = buildTagChipViews(tags, colors, toggleTagChip);

  let removeReviewControl = null;
  if (hasExistingReview) {
    let removeContent = (
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.nbMuted }}>Remove review</Text>
    );
    if (removing) {
      removeContent = <ActivityIndicator size="small" color={colors.nbMuted} />;
    }
    removeReviewControl = (
      <TouchableOpacity
        onPress={() => setConfirmRemove(true)}
        disabled={removing}
        style={{ alignItems: 'center', marginTop: 12 }}
      >
        {removeContent}
      </TouchableOpacity>
    );
  }

  return (
    <>
      <NbSheet visible={visible} onClose={onClose}>
        <View style={styles.body}>
          <View style={styles.headRow}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: avatarFillColor, borderColor: colors.nbBorder },
              ]}
            >
              <Text style={{ fontWeight: '900', color: colors.nbInk }}>{initials}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.title, { color: colors.nbInk }]}>{sheetTitle}</Text>
              <Text style={[styles.subtitle, { color: colors.nbMuted }]}>Visible on their profile.</Text>
            </View>
          </View>

          <View style={styles.starRow}>{starButtonViews}</View>

          <View style={styles.tagRow}>{tagChipViews}</View>

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
            {characterCountLabel}
          </Text>

          <View style={styles.actions}>
            <NbButton variant="ghost" onPress={onClose} style={{ flex: 1 }} disabled={submitting}>
              Not now
            </NbButton>
            <NbButton variant="fill" onPress={saveReview} style={{ flex: 1 }} disabled={!canPost}>
              {postButtonLabel}
            </NbButton>
          </View>

          {removeReviewControl}
        </View>
      </NbSheet>

      <NbNoticeSheet
        visible={noticeIsVisible}
        onClose={() => setNotice(null)}
        title={noticeTitle}
        message={noticeMessage}
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
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '900' },
  subtitle: { fontSize: 13, fontWeight: '600', marginTop: 2 },
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

// ===== PLUMBING — skip unless trainer average on profile looks wrong after post/remove =====

function ratingSummaryFromReviews(snapshot) {
  if (snapshot.empty) {
    return { rating: EMPTY_RATING_AVERAGE, reviewCount: EMPTY_REVIEW_COUNT };
  }
  let totalStars = 0;
  for (let docIndex = 0; docIndex < snapshot.docs.length; docIndex += 1) {
    const reviewDoc = snapshot.docs[docIndex];
    totalStars += reviewDoc.data().rating || 0;
  }
  const average = totalStars / snapshot.docs.length;
  return {
    rating: Math.round(average * RATING_DECIMAL_PLACES) / RATING_DECIMAL_PLACES,
    reviewCount: snapshot.docs.length,
  };
}

async function writeTrainerRatingToFirestore(trainerId, summary) {
  await setDoc(doc(db, USERS_COLLECTION, trainerId), summary, { merge: true });
  try {
    await setDoc(doc(db, TRAINERS_COLLECTION, trainerId), summary, { merge: true });
  } catch (ignoredError) {
    /* listing copy is optional */
  }
}

function refreshTrainerAverageRating(trainerId) {
  const reviewsQuery = query(
    collection(db, REVIEWS_COLLECTION),
    where('trainerId', '==', trainerId),
  );
  return getDocs(reviewsQuery).then(async (snapshot) => {
    const summary = ratingSummaryFromReviews(snapshot);
    await writeTrainerRatingToFirestore(trainerId, summary);
  });
}

function buildReviewDocumentPayload({
  trainerId,
  clientId,
  clientFirstName,
  rating,
  reviewText,
  tags,
  existingReview,
}) {
  let savedCreatedAt;
  if (existingReview) savedCreatedAt = existingReview.createdAt;

  let trimmedText = null;
  const cleanedText = reviewText.trim();
  if (cleanedText) trimmedText = cleanedText;

  let tagsToStore = null;
  if (Array.isArray(tags) && tags.length) tagsToStore = tags;

  return {
    trainerId,
    clientId,
    clientFirstName: clientFirstName || null,
    rating,
    text: trimmedText,
    tags: tagsToStore,
    createdAt: savedCreatedAt ?? serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}
