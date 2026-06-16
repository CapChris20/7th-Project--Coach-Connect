import React, { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OnboardingInputRow } from '../../../auth/OnboardingScreen';
import { resolveCurrentTrainerLocation } from '../../trainer-location/trainerLocationService';

/**
 * Trainer onboarding city field with optional GPS fill.
 */
export default function TrainerLocationField({
  value,
  onChangeText,
  t,
  label = 'City / location',
  placeholder = 'e.g. Austin, TX',
}) {
  const [loading, setLoading] = useState(false);

  const useCurrentLocation = async () => {
    setLoading(true);
    try {
      const place = await resolveCurrentTrainerLocation();
      if (place?.city) onChangeText?.(place.city);
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingInputRow
      iconName="location-outline"
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      t={t}
      rightElement={
        <TouchableOpacity
          onPress={useCurrentLocation}
          disabled={loading}
          accessibilityLabel="Use current location"
          style={{ padding: 8 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={t?.textSecondary || '#888'} />
          ) : (
            <Ionicons name="navigate" size={20} color={t?.textSecondary || '#888'} />
          )}
        </TouchableOpacity>
      }
    />
  );
}
