/**
 * Custom Navigation Bar
 *
 * Purpose: Custom Navigation Bar — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/navigation
 * Key exports: CustomNavigationBar
 *
 * @file-header
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../shared-ui/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

const navItems = [
  'Calendar',
  'Nutrition', 
  'Progress',
  'Notes / Files',
];

const NAVBAR_WIDTH = Math.min(600, screenWidth - 20); // Increased from 500 to 600

export default function CustomNavigationBar({ onItemPress, activeItem = 'Calendar' }) {
  const { colors, spacing, isDark } = useTheme();
  const [hoveredItem, setHoveredItem] = useState(null);
  const [animatedValues] = useState(
    navItems.map(() => new Animated.Value(0))
  );

  const handleItemPress = (item, index) => {
    setHoveredItem(item);
    
    // Animate the outline
    Animated.timing(animatedValues[index], {
      toValue: 1,
      duration: 500,
      useNativeDriver: false,
    }).start();

    // Reset other animations
    animatedValues.forEach((value, i) => {
      if (i !== index) {
        Animated.timing(value, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }).start();
      }
    });

    if (onItemPress) {
      onItemPress(item);
    }
  };

  const getOutlineStyle = (index) => {
    const dashPatterns = [
      '0 3 8 72 8 9',   // Calendar
      '0 14 9 47 9 30', // Nutrition
      '0 27 8 24 8 53', // Progress
      '0 40 7 10 7 63', // Notes / Files
    ];

    return {
      strokeDashoffset: animatedValues[index].interpolate({
        inputRange: [0, 1],
        outputRange: [5, 0],
      }),
      strokeDasharray: hoveredItem === navItems[index] ? '0 0 10 40 10 40' : dashPatterns[index],
    };
  };

  const styles = createStyles(spacing, colors, isDark);

  return (
    <View style={styles.nav}>
      <View style={styles.container}>
        {navItems.map((item, index) => (
          <TouchableOpacity
            key={item}
            style={[
              styles.btn,
              activeItem === item && styles.activeBtn,
            ]}
            onPress={() => handleItemPress(item, index)}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.btnText,
              activeItem === item && styles.activeBtnText
            ]}>
              {item}
            </Text>
          </TouchableOpacity>
        ))}
        
        {/* Animated Outline */}
        <Animated.View style={styles.outlineContainer}>
          <View style={styles.outline}>
            {navItems.map((item, index) => (
              <Animated.View
                key={`outline-${item}`}
                style={[
                  styles.outlineRect,
                  getOutlineStyle(index)
                ]}
              />
            ))}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const createStyles = (spacing, colors, isDark) => StyleSheet.create({
  nav: {
    position: 'relative',
    width: NAVBAR_WIDTH,
    height: 60,
    alignSelf: 'center',
    marginVertical: spacing.md,
  },
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDark ? 'rgba(30, 27, 46, 0.9)' : 'rgba(88, 86, 214, 0.1)',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: isDark ? 'rgba(88, 86, 214, 0.3)' : 'rgba(88, 86, 214, 0.2)',
  },
  btn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    transition: 'all 0.1s ease',
  },
  activeBtn: {
    backgroundColor: colors.primary,
  },
  btnText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeBtnText: {
    color: '#FFFFFF',
  },
  outlineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  outline: {
    flex: 1,
    position: 'relative',
  },
  outlineRect: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 12,
    opacity: 0.8,
  },
});
