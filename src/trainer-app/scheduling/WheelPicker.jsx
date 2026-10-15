// Scroll-snap "slot machine" picker for session times, dates, and other short lists.
// Flow: snap each row to ITEM_H → on momentum end, round the offset to an index → onChange(that value).
// Used by: the trainer session form. Off-center rows dim and shrink; the center band stays full opacity.

import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ===== NAMED CONSTANTS =====

const ITEM_H = 44;
const VISIBLE_ROW_COUNT = 5;
const DEFAULT_PICKER_HEIGHT = ITEM_H * VISIBLE_ROW_COUNT;
const THEME_DARK = 'dark';
const THEME_LIGHT = 'light';
const SCROLL_EVENT_THROTTLE_MS = 16;
const NEIGHBOR_COUNT = 2;

const COLORS = {
  dark: {
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.55)',
    glass: 'rgba(255,255,255,0.05)',
    glassBorder: 'rgba(255,255,255,0.1)',
    fadeEdge: '#0A0A0F',
    accent: '#FF6B9D',
    accentBandBg: 'rgba(255,107,157,0.14)',
  },
  light: {
    text: '#000000',
    textSecondary: 'rgba(0,0,0,0.55)',
    glass: 'rgba(0,0,0,0.03)',
    glassBorder: 'rgba(0,0,0,0.1)',
    fadeEdge: '#FFFFFF',
    accent: '#FF6B9D',
    accentBandBg: 'rgba(255,107,157,0.12)',
  },
};

/** Off-center rows dim via opacity only — hue stays pure white/black */
const WHEEL_OPACITY_RANGE = {
  dark: [0.38, 0.62, 1, 0.62, 0.38],
  light: [0.32, 0.58, 1, 0.58, 0.32],
};

const WHEEL_SCALE_RANGE = [0.92, 0.96, 1.0, 0.96, 0.92];

// ===== HELPER FUNCTIONS =====

/**
 * Start from the named theme, then overlay any color props the parent passed (session form warm rim).
 * @param {string} theme
 * @param {object} overrides
 */
function mergePickerColors(theme, overrides) {
  const base = COLORS[theme] || COLORS.dark;
  const nextColors = { ...base };
  if (overrides.glass !== undefined) nextColors.glass = overrides.glass;
  if (overrides.glassBorder !== undefined) nextColors.glassBorder = overrides.glassBorder;
  if (overrides.fadeEdge !== undefined) nextColors.fadeEdge = overrides.fadeEdge;
  if (overrides.accent !== undefined) nextColors.accent = overrides.accent;
  if (overrides.accentBandBg !== undefined) nextColors.accentBandBg = overrides.accentBandBg;
  if (overrides.textOverride !== undefined) nextColors.text = overrides.textOverride;
  return nextColors;
}

/**
 * Index of `value` in `items`, or 0 when it is missing so the wheel still has a selected row.
 * @param {Array} items
 * @param {*} value
 * @returns {number}
 */
function selectedItemIndex(items, value) {
  const foundIndex = items.findIndex((item) => String(item) === String(value));
  return foundIndex >= 0 ? foundIndex : 0;
}

/**
 * Jump the scroll position to the selected row without animating (used when value changes from outside).
 * @param {object} scrollRef
 * @param {number} index
 */
function jumpScrollToIndex(scrollRef, index) {
  if (!scrollRef.current) return;
  try {
    scrollRef.current.scrollTo?.({ y: index * ITEM_H, animated: false });
  } catch {
    // Native scrollTo can throw if the list unmounted mid-jump.
  }
}

/**
 * Round the Y offset to the nearest row and tell the parent. `!= null` keeps a legitimate 0 value.
 * @param {object} nativeEvent
 * @param {Array} items
 * @param {Function} [onChange]
 */
function snapToNearestItem(nativeEvent, items, onChange) {
  const offsetY = nativeEvent?.contentOffset?.y || 0;
  const index = Math.round(offsetY / ITEM_H);
  const nextValue = items[index];
  if (nextValue != null) onChange?.(String(nextValue));
}

/**
 * Five-stop interpolator so rows two away from center are dimmest.
 * @param {number} index
 * @returns {number[]}
 */
function opacityInputRange(index) {
  return [
    (index - NEIGHBOR_COUNT) * ITEM_H,
    (index - 1) * ITEM_H,
    index * ITEM_H,
    (index + 1) * ITEM_H,
    (index + NEIGHBOR_COUNT) * ITEM_H,
  ];
}

// ===== MAIN FUNCTION =====

/**
 * Scroll-snap wheel picker. Center row sits in the accent band; neighbors fade and shrink.
 * vocab: Animated.event wires native scroll Y into an Animated.Value without JS on every pixel.
 * @param {{ items?: Array, value: *, onChange?: Function, theme?: string, label?: string, height?: number, glass?: string, glassBorder?: string, fadeEdge?: string, accent?: string, accentBandBg?: string, text?: string, labelColor?: string }} props
 */
export const WheelPicker = ({
  items = [],
  value,
  onChange,
  theme = THEME_DARK,
  label,
  height = DEFAULT_PICKER_HEIGHT,
  glass,
  glassBorder,
  fadeEdge,
  accent,
  accentBandBg,
  text: textOverride,
  labelColor,
}) => {
  const colors = mergePickerColors(theme, {
    glass,
    glassBorder,
    fadeEdge,
    accent,
    accentBandBg,
    textOverride,
  });
  const opacityKey = theme === THEME_LIGHT ? THEME_LIGHT : THEME_DARK;
  const opacityOut = WHEEL_OPACITY_RANGE[opacityKey];
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const index = useMemo(() => selectedItemIndex(items, value), [items, value]);

  useEffect(() => {
    jumpScrollToIndex(scrollRef, index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onMomentumEnd = (event) => {
    snapToNearestItem(event?.nativeEvent, items, onChange);
  };

  const visiblePad = (height - ITEM_H) / 2;
  const fadeToTransparent = `${colors.fadeEdge}00`;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: labelColor ?? colors.textSecondary }]}>{label}</Text>
      ) : null}

      <View
        style={[
          styles.picker,
          {
            height,
            backgroundColor: colors.glass,
            borderColor: colors.glassBorder,
          },
        ]}
      >
        <LinearGradient
          colors={[colors.fadeEdge, fadeToTransparent]}
          style={[styles.fade, { top: 0 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[fadeToTransparent, colors.fadeEdge]}
          style={[styles.fade, { bottom: 0 }]}
          pointerEvents="none"
        />

        <View
          style={[
            styles.band,
            {
              top: visiblePad,
              height: ITEM_H,
              borderColor: colors.accent,
              backgroundColor: colors.accentBandBg,
            },
          ]}
          pointerEvents="none"
        />

        <Animated.ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          bounces={false}
          onMomentumScrollEnd={onMomentumEnd}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
          contentContainerStyle={{ paddingVertical: visiblePad }}
        >
          {items.map(String).map((item, rowIndex) => {
            const inputRange = opacityInputRange(rowIndex);
            const opacity = scrollY.interpolate({
              inputRange,
              outputRange: opacityOut,
              extrapolate: 'clamp',
            });
            const scale = scrollY.interpolate({
              inputRange,
              outputRange: WHEEL_SCALE_RANGE,
              extrapolate: 'clamp',
            });
            return (
              <View
                key={`${item}-${rowIndex}`}
                style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}
              >
                <Animated.Text
                  style={[
                    styles.itemText,
                    {
                      color: colors.text,
                      opacity,
                      transform: [{ scale }],
                    },
                  ]}
                  allowFontScaling={false}
                >
                  {item}
                </Animated.Text>
              </View>
            );
          })}
        </Animated.ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 6 },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingLeft: 4,
  },
  picker: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 40,
    zIndex: 5,
  },
  band: {
    position: 'absolute',
    left: 8,
    right: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    zIndex: 4,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
