import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const ITEM_H = 44;

const COLORS = {
  dark: {
    /** Wheel row values — full white reads better on tinted glass than low-opacity #000 */
    text: '#FFFFFF',
    /** Column labels (DAY, HOUR, …) — high contrast on dark */
    textSecondary: 'rgba(255,255,255,0.9)',
    glass: 'rgba(255,255,255,0.05)',
    glassBorder: 'rgba(255,255,255,0.1)',
    fadeEdge: '#0A0A0F',
    accent: '#FF6B9D',
    accentBandBg: 'rgba(255,107,157,0.14)',
  },
  light: {
    text: '#0F172A',
    textSecondary: 'rgba(15,23,42,0.88)',
    glass: 'rgba(0,0,0,0.03)',
    glassBorder: 'rgba(0,0,0,0.1)',
    fadeEdge: '#FFFFFF',
    accent: '#FF6B9D',
    accentBandBg: 'rgba(255,107,157,0.12)',
  },
};

/** Min opacity for off-center rows — avoids “muddy” brown-gray on warm dark glass */
const WHEEL_OPACITY_RANGE = {
  dark: [0.62, 0.86, 1, 0.86, 0.62],
  light: [0.52, 0.8, 1, 0.8, 0.52],
};

export const WheelPicker = ({
  items = [],
  value,
  onChange,
  theme = 'dark',
  label,
  height = ITEM_H * 5,
  /** Optional overrides (e.g. session form warm pink + orange) */
  glass,
  glassBorder,
  fadeEdge,
  accent,
  accentBandBg,
  /** Optional label color (defaults to theme textSecondary) */
  labelColor,
}) => {
  const base = COLORS[theme] || COLORS.dark;
  const colors = {
    ...base,
    ...(glass !== undefined ? { glass } : {}),
    ...(glassBorder !== undefined ? { glassBorder } : {}),
    ...(fadeEdge !== undefined ? { fadeEdge } : {}),
    ...(accent !== undefined ? { accent } : {}),
    ...(accentBandBg !== undefined ? { accentBandBg } : {}),
  };
  const opacityKey = theme === 'light' ? 'light' : 'dark';
  const opacityOut = WHEEL_OPACITY_RANGE[opacityKey];
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  const index = useMemo(() => {
    const i = items.findIndex((x) => String(x) === String(value));
    return i >= 0 ? i : 0;
  }, [items, value]);

  useEffect(() => {
    if (!scrollRef.current) return;
    try {
      scrollRef.current.scrollTo?.({ y: index * ITEM_H, animated: false });
    } catch (_) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onMomentumEnd = (e) => {
    const y = e?.nativeEvent?.contentOffset?.y || 0;
    const i = Math.round(y / ITEM_H);
    const next = items[i];
    if (next != null) onChange?.(String(next));
  };

  const visiblePad = (height - ITEM_H) / 2;

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
        {/* fades */}
        <LinearGradient
          colors={[colors.fadeEdge, `${colors.fadeEdge}00`]}
          style={[styles.fade, { top: 0 }]}
          pointerEvents="none"
        />
        <LinearGradient
          colors={[`${colors.fadeEdge}00`, colors.fadeEdge]}
          style={[styles.fade, { bottom: 0 }]}
          pointerEvents="none"
        />

        {/* highlight band — pink ring like Loveable mock */}
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
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: visiblePad }}
        >
          {items.map(String).map((item, i) => {
            const inputRange = [
              (i - 2) * ITEM_H,
              (i - 1) * ITEM_H,
              i * ITEM_H,
              (i + 1) * ITEM_H,
              (i + 2) * ITEM_H,
            ];
            const opacity = scrollY.interpolate({
              inputRange,
              outputRange: opacityOut,
              extrapolate: 'clamp',
            });
            const scale = scrollY.interpolate({
              inputRange,
              outputRange: [0.92, 0.96, 1.0, 0.96, 0.92],
              extrapolate: 'clamp',
            });
            return (
              <View key={`${item}-${i}`} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.Text
                  style={[
                    styles.itemText,
                    {
                      color: colors.text,
                      opacity,
                      transform: [{ scale }],
                    },
                  ]}
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
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});

