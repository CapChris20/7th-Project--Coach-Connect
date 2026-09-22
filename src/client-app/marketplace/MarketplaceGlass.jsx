// Frosted-glass panel used for every card/sheet in the trainer marketplace.
// Flow: three stacked layers — a gradient "light stroke" edge, a blur backdrop, then a translucent
// tinted surface holding the children.
// Why three layers: real frosted glass reads as blur + a slight tint + a bright top edge catching
// the light. Any one layer alone looks flat or muddy.
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
// vocab: expo-linear-gradient = native gradient view; `colors` are the stops, start/end set direction
import { LinearGradient } from 'expo-linear-gradient';
import BlurBackdropPlate from '../../theme/BlurBackdropPlate';
import { getGlass } from './marketplaceFilters';

/**
 * Frosted glass panel — blur backdrop + translucent tint + soft top-lit border (web .glass-card).
 */
export function MarketplaceGlass({
  children,
  // Three separate style hooks, one per layer: `style` = the outer frame, `contentWrapperStyle` =
  // inside the blur plate, `contentStyle` = the tinted surface holding the children.
  style,
  contentStyle,
  contentWrapperStyle,
  isDark = true,
  intensity,
  // Manipulate here: 22 is the standard marketplace card radius; overflow 'hidden' is what clips
  // the blur and gradient to those rounded corners (pass 'visible' if a child must escape the card).
  borderRadius = 22,
  overflow = 'hidden',
}) {
  // Shared glass tokens (blur amount, surface tint, border color) so every marketplace panel matches.
  const glass = getGlass(isDark);
  const tint = isDark ? 'dark' : 'light';
  // vocab/symbol: ?? = use glass.blur only when `intensity` is null/undefined, so a caller can pass
  // 0 to disable blur entirely (|| would have treated 0 as "unset" and re-applied the default).
  const blur = intensity ?? glass.blur;
  // The top-lit edge: bright at the top, nearly gone at the bottom, mimicking light falling from
  // above. Manipulate here — in light mode the top stroke is near-opaque white to read against a
  // light background; in dark mode it's a faint 16% so it suggests an edge without glowing.
  const strokeTop = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.95)';
  const strokeBottom = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.35)';

  return (
    // LAYER 0 — the frame: border, corner radius, and the drop shadow that lifts the card.
    <View
      style={[
        glassStyles.outer,
        { borderRadius, overflow, borderWidth: 1, borderColor: glass.border },
        // iOS and Android use different shadow systems, so there's no shared set of props.
        // Manipulate here: a large shadowRadius with a downward offset is what makes the panel look
        // like it's floating. Opacity is much higher in dark mode — a soft black shadow is nearly
        // invisible on a dark background. `default: {}` covers web, which gets no shadow.
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.38 : 0.12,
            shadowRadius: 20,
          },
          android: { elevation: 8 },
          default: {},
        }),
        style,
      ]}
    >
      {/* LAYER 1 — the light stroke. It fills the whole panel but sits UNDER the blur plate; only
          its 1px outer ring (see glassStyles.stroke padding) shows through as the lit edge.
          pointerEvents="none" is essential: this covers the entire card, so without it no tap
          would ever reach the children. */}
      <LinearGradient
        pointerEvents="none"
        colors={[strokeTop, strokeBottom]}
        // start/end are fractions of the box: (0.5, 0) → (0.5, 1) is straight top-to-bottom.
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          glassStyles.stroke,
          {
            borderRadius,
            // vocab: borderCurve 'continuous' = Apple's squircle corners (smoother than a plain
            // circular arc). iOS-only, so it's conditionally spread rather than always set.
            ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
          },
        ]}
      />
      {/* LAYER 2 — the actual blur of whatever is behind the card. Its radius is borderRadius - 1
          so it sits exactly inside the 1px stroke ring above, leaving that edge visible. */}
      <BlurBackdropPlate
        intensity={blur}
        tint={tint}
        style={[
          glassStyles.blur,
          {
            borderRadius: borderRadius - 1,
            ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
          },
        ]}
        contentWrapperStyle={contentWrapperStyle}
      >
        {/* LAYER 3 — the tinted surface. Blur alone looks washed out, so this translucent fill gives
            the glass its color and improves text contrast over busy backgrounds.
            Matches the blur's radius so the two stay concentric. */}
        <View
          style={[
            glassStyles.surface,
            {
              backgroundColor: glass.surface,
              borderRadius: borderRadius - 1,
              ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </BlurBackdropPlate>
    </View>
  );
}

const glassStyles = StyleSheet.create({
  // relative is the positioning context for the absolutely-filled stroke layer below.
  outer: {
    position: 'relative',
  },
  stroke: {
    // vocab: StyleSheet.absoluteFillObject = position absolute with all four edges at 0, i.e. cover
    // the parent completely.
    ...StyleSheet.absoluteFillObject,
    // Manipulate here: this 1px inset IS the visible edge thickness — the blur plate covers
    // everything inside it. Raise it for a chunkier lit rim.
    padding: 1,
  },
  blur: {
    // Clips the blurred content to the rounded corners; without it the blur renders as a rectangle
    // poking past the card's curves.
    overflow: 'hidden',
  },
  // Intentionally empty: every surface property is data-driven above. Kept as a named style so the
  // layer stays easy to target.
  surface: {},
});

// Both named and default exported because call sites in the marketplace use each form.
export default MarketplaceGlass;
