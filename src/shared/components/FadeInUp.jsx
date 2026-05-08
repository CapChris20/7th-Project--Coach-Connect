import React, { useEffect, useMemo } from 'react';
import { Animated } from 'react-native';

/**
 * Tiny reusable entrance animation wrapper:
 * fades in + lifts up a few px. Safe to use around images/cards/text.
 */
export default function FadeInUp({ children, delay = 0, duration = 420, dy = 10, style }) {
  const v = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      delay,
      duration,
      useNativeDriver: true,
    }).start();
  }, [v, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

