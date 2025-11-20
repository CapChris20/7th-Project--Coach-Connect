import React from 'react';
import { Image, StyleSheet, Text } from 'react-native';

const icons = {
  profile: require('../../assets/icons/profile.png'),
  home: require('../../assets/icons/home.png'),
  workout: require('../../assets/icons/workout.png'),
  messages: require('../../assets/icons/messages.png'),
  nutrition: require('../../assets/icons/nutrition.png'),
  voice: require('../../assets/icons/mic.png'),
  gpt: require('../../assets/icons/gpticon.png'),
  // For icons you don't have, using emoji as fallback
  plus: null, // Will use emoji
};

export default function NavIcon({ name, size = 24, style }) {
  const iconSource = icons[name];
  
  // If no image, use emoji fallback
  if (!iconSource) {
    const emojiMap = {
      profile: '👤',
      home: '🏠',
      workout: '💪',
      voice: '🎤',
      plus: '+',
    };
    return (
      <Text style={[{ fontSize: size }, style]}>
        {emojiMap[name] || '❓'}
      </Text>
    );
  }

  return (
    <Image
      source={iconSource}
      style={[
        {
          width: size,
          height: size,
          resizeMode: 'contain',
        },
        style,
      ]}
    />
  );
}
