/**
 * Profile Card Icon
 *
 * Purpose: UI screen or component: Profile Card Icon. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: ProfileIcon
 *
 * @file-header
 */
import React from 'react';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  PROFILE_CARD_ICON_SIZE,
  resolveProfileIconSource,
} from '../../for-both/profileCardIconSizes';
import CalendarIcon from './CalendarIcon';

/**
 * Filled PNG icon for workout profile cards — shared by ClientAppStart and TrainerAppStart
 * (CreateWorkoutPlanScreen) and client ViewMyMyProfileScreen rows.
 */
export default function ProfileIcon({
  itemId,
  onboardingData,
  size = PROFILE_CARD_ICON_SIZE,
  fallbackIcon = 'ellipse-outline',
}) {
  if (itemId === 'frequency') {
    return <CalendarIcon size={size} />;
  }
  const source = resolveProfileIconSource(itemId, onboardingData);
  if (source) {
    return (
      <Image
        source={source}
        style={{ width: size, height: size }}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={0}
      />
    );
  }
  return <Ionicons name={fallbackIcon} size={Math.round(size * 0.65)} color="#9333EA" />;
}
