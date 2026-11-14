// Filled icon for one workout-profile row: calendar, a PNG, or a plain fallback glyph.
// Flow: frequency → shared calendar SVG → else profile PNG → else generic ionicon.
// Used by the client profile screen and create-workout-plan profile rows.

import React from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  PROFILE_CARD_ICON_SIZE,
  resolveProfileIconSource,
} from '../../for-both/profileCardIconSizes';
import CalendarIcon from './CalendarIcon';

// ===== NAMED CONSTANTS =====

// Manipulate here: row id for the schedule line — it always uses CalendarIcon, not a body PNG.
const SCHEDULE_FREQUENCY_ROW_ID = 'frequency';

const FALLBACK_GLYPH_NAME = 'ellipse-outline';
const FALLBACK_GLYPH_COLOR = '#0A0A0A';
const PHOTO_CONTENT_FIT = 'contain';
const PHOTO_CACHE_POLICY = 'memory-disk';

// Manipulate here: 0 skips the fade so a row of icons does not blink in one by one.
const PHOTO_TRANSITION_MS = 0;

// Manipulate here: fraction of the card size when no PNG exists. Lower = smaller glyph.
const FALLBACK_GLYPH_SCALE = 0.65;

const ART_KIND_CALENDAR = 'calendar';
const ART_KIND_PHOTO = 'photo';
const ART_KIND_FALLBACK = 'fallback';

// ===== HELPER FUNCTIONS =====

function rowIsFrequencySchedule(itemId) {
  return itemId === SCHEDULE_FREQUENCY_ROW_ID;
}

function makeSquareStyle(edgeLength) {
  return { width: edgeLength, height: edgeLength };
}

function fallbackGlyphEdge(cardEdge) {
  return Math.round(cardEdge * FALLBACK_GLYPH_SCALE);
}

// Decide which art to paint: schedule calendar, onboarding PNG, or generic glyph.
function chooseProfileArt(itemId, onboardingData) {
  if (rowIsFrequencySchedule(itemId)) {
    return { artKind: ART_KIND_CALENDAR, photoSource: null };
  }

  // vocab: resolveProfileIconSource = maps itemId + onboarding answers to a bundled PNG (or null).
  const photoSource = resolveProfileIconSource(itemId, onboardingData);
  if (photoSource) {
    return { artKind: ART_KIND_PHOTO, photoSource };
  }

  return { artKind: ART_KIND_FALLBACK, photoSource: null };
}

function paintFrequencyCalendar(cardEdge) {
  return <CalendarIcon size={cardEdge} />;
}

function paintOnboardingPhoto(photoSource, cardEdge) {
  const photoBox = makeSquareStyle(cardEdge);

  // vocab: contentFit = how the PNG sits in the box. contain scales it down without cropping.
  // vocab: cachePolicy memory-disk = keep the PNG in memory and on disk so scrolling does not refetch.
  return (
    <Image
      source={photoSource}
      style={photoBox}
      contentFit={PHOTO_CONTENT_FIT}
      cachePolicy={PHOTO_CACHE_POLICY}
      transition={PHOTO_TRANSITION_MS}
    />
  );
}

function paintFallbackGlyph(ioniconName, cardEdge) {
  const glyphEdge = fallbackGlyphEdge(cardEdge);
  return (
    <Ionicons
      name={ioniconName}
      size={glyphEdge}
      color={FALLBACK_GLYPH_COLOR}
    />
  );
}

function paintChosenProfileArt(artChoice, cardEdge, fallbackIcon) {
  if (artChoice.artKind === ART_KIND_CALENDAR) {
    return paintFrequencyCalendar(cardEdge);
  }
  if (artChoice.artKind === ART_KIND_PHOTO) {
    return paintOnboardingPhoto(artChoice.photoSource, cardEdge);
  }
  return paintFallbackGlyph(fallbackIcon, cardEdge);
}

// ===== MAIN FUNCTION =====

/**
 * Icon for one profile / onboarding row (calendar, body PNG, or fallback glyph).
 * @param {object} props
 * @param {string} props.itemId
 * @param {object} [props.onboardingData]
 * @param {number} [props.size]
 * @param {string} [props.fallbackIcon]
 */
export default function ProfileIcon({
  itemId,
  onboardingData,
  size = PROFILE_CARD_ICON_SIZE,
  fallbackIcon = FALLBACK_GLYPH_NAME,
}) {
  // 1. Pick calendar / photo / fallback from the row id + onboarding answers.
  const artChoice = chooseProfileArt(itemId, onboardingData);

  // 2. Paint that choice at the card size (default PROFILE_CARD_ICON_SIZE).
  return paintChosenProfileArt(artChoice, size, fallbackIcon);
}
