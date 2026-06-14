import React from 'react';
import { Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PROFILE_CARD_ICON_SIZE,
  resolveProfileCardIconSource,
} from '../workout/profileCardIcons';

/**
 * Filled PNG icon for workout profile cards — shared by ClientApp and TrainerApp
 * (WorkoutPlanGeneratorScreen) and client ProfileScreen rows.
 */
export default function ProfileCardIcon({
  itemId,
  onboardingData,
  size = PROFILE_CARD_ICON_SIZE,
  fallbackIcon = 'ellipse-outline',
}) {
  const source = resolveProfileCardIconSource(itemId, onboardingData);
  if (source) {
    return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  return <Ionicons name={fallbackIcon} size={Math.round(size * 0.65)} color="#9333EA" />;
}
