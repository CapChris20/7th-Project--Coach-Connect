import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/ThemeContext';

import iconProfile from '../../assets/icons/people.png';
import iconHome from '../../assets/house.png';
import iconWorkout from '../../assets/dumbbell (1).png';
import iconMessages from '../../assets/icons/box.png';
import iconNutrition from '../../assets/icons/food.png';
import iconVoice from '../../assets/icons/google_gemini.png';
import iconGpt from '../../assets/icons/gpticon.png';

const icons = {
  profile: iconProfile,
  home: iconHome,
  workout: iconWorkout,
  messages: iconMessages,
  nutrition: iconNutrition,
  voice: iconVoice,
  gpt: iconGpt,
  plus: null, // Uses text fallback
};

const ioniconNames = {
  home: 'home-outline',
  workout: 'barbell-outline',
  voice: 'mic-outline',
  nutrition: 'restaurant-outline',
};

export default function NavIcon({ name, size = 24, style }) {
  const { isDark, colors } = useTheme();
  const iconSource = icons[name];

  if (ioniconNames[name]) {
    const color = isDark ? '#C084FC' : 'rgba(15,23,42,0.8)';
    return (
      <View style={[styles.outer, style]}>
        <Ionicons name={ioniconNames[name]} size={size} color={color} />
      </View>
    );
  }
  if (!iconSource) {
    return (
      <Text
        style={[{ fontSize: size, color: isDark ? '#FFFFFF' : colors.text, fontWeight: '300' }, style]}
        selectable={true}
      >
        {name === 'plus' ? '+' : ''}
      </Text>
    );
  }

  return (
    <View style={[styles.outer, style]}>
      <Image source={iconSource} style={[styles.icon, { width: size, height: size }]} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    resizeMode: 'contain',
  },
});
