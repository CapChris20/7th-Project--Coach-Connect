// Filled icon for one workout-profile row: calendar, a PNG, or a plain fallback glyph.
// Flow: frequency uses the calendar → otherwise a profile PNG → otherwise a generic ionicon.
// Used by the client profile screen and the create-workout-plan profile rows.

import React from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  PROFILE_CARD_ICON_SIZE,
  resolveProfileIconSource,
} from '../../for-both/profileCardIconSizes';
import CalendarIcon from './CalendarIcon';

// ===== NAMED CONSTANTS =====

const FREQUENCY_ITEM_ID = 'frequency';
const FALLBACK_ICON_NAME = 'ellipse-outline';
const FALLBACK_ICON_COLOR = '#9333EA';
const IMAGE_CONTENT_FIT = 'contain';
const IMAGE_CACHE_POLICY = 'memory-disk';
// Manipulate here: 0 skips the fade so a row of icons does not blink in one by one.
const IMAGE_TRANSITION_MS = 0;
// Manipulate here: fraction of the card size used when no PNG exists. Lower = smaller glyph.
const FALLBACK_ICON_SCALE = 0.65;

// ===== HELPER FUNCTIONS =====

/**
 * Frequency is the schedule row. It uses the shared calendar glyph instead of a body or equipment PNG.
 * @param {string} itemId
 * @returns {boolean}
 */
function isFrequencyProfileItem(itemId) {
  return itemId === FREQUENCY_ITEM_ID;
}

/**
 * @param {number} iconSize
 * @returns {number}
 */
function fallbackGlyphSize(iconSize) {
  return Math.round(iconSize * FALLBACK_ICON_SCALE);
}

/**
 * PNG for a profile row. Called as a function so the tree stays an Image, not an extra wrapper component.
 * @param {object} iconSource
 * @param {number} iconSize
 * @returns {JSX.Element}
 */
function profilePhotoIcon(iconSource, iconSize) {
  return (
    <Image
      source={iconSource}
      style={{ width: iconSize, height: iconSize }}
      // vocab: contentFit = how the PNG sits in the box. contain scales it down without cropping.
      contentFit={IMAGE_CONTENT_FIT}
      // vocab: cachePolicy memory-disk = keep the PNG in memory and on disk so scrolling does not fetch it again.
      cachePolicy={IMAGE_CACHE_POLICY}
      transition={IMAGE_TRANSITION_MS}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Icon for one workout-profile card row.
 * @param {object} props
 * @param {string} props.itemId Which profile row this is (frequency, equipment, and so on).
 * @param {object} [props.onboardingData] Answers used to pick the right PNG.
 * @param {number} [props.size]
 * @param {string} [props.fallbackIcon] Ionicon name used when no PNG exists.
 * @returns {JSX.Element}
 */
export default function ProfileIcon({
  itemId,
  onboardingData,
  size = PROFILE_CARD_ICON_SIZE,
  fallbackIcon = FALLBACK_ICON_NAME,
}) {
  if (isFrequencyProfileItem(itemId)) {
    return <CalendarIcon size={size} />;
  }

  const iconSource = resolveProfileIconSource(itemId, onboardingData);
  if (iconSource) {
    return profilePhotoIcon(iconSource, size);
  }

  return (
    <Ionicons
      name={fallbackIcon}
      size={fallbackGlyphSize(size)}
      color={FALLBACK_ICON_COLOR}
    />
  );
}
