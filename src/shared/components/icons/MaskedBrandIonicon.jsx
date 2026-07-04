/**
 * Original Ionicons + brand gradient via MaskedView (barbell tab only).
 * Kept separate from SVG nav icons — matches the legacy workout tab look.
 */
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
} from '../../../shared-ui/brandGradients';

export default function MaskedBrandIonicon({
  name,
  size = 36,
  colors = BRAND_NAV_ICON_GRADIENT,
  locations = BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
}) {
  return (
    <MaskedView
      style={{ width: size, height: size }}
      collapsable={false}
      maskElement={
        <View
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          }}
        >
          <Ionicons name={name} size={size} color="#000" />
        </View>
      }
    >
      <LinearGradient
        colors={colors}
        locations={locations}
        start={start}
        end={end}
        style={{ width: size, height: size }}
      />
    </MaskedView>
  );
}
