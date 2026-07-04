/**
 * Google Gemini mark — filled with the brand gradient (original nav icon).
 */
import React from 'react';
import { View, Image } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
} from '../../../shared-ui/brandGradients';

const GEMINI_MARK = require('../../../assets/icons/google_gemini.png');

export default function GradientGeminiNavIcon({
  size = 36,
  colors = BRAND_NAV_ICON_GRADIENT,
  locations = BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
}) {
  const dim = size * 0.9;
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
          <Image source={GEMINI_MARK} style={{ width: dim, height: dim }} resizeMode="contain" />
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
