import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

export default function QuickActions({ onMessage, onCall, onSchedule, onProgress }) {
  const actions = [
    { icon: require('../../assets/icons/Message.png'), label: 'Message', color: '#0A84FF', onPress: onMessage },
    { icon: require('../../assets/icons/Call.png'), label: 'Call', color: '#30D158', onPress: onCall },
    { icon: require('../../assets/icons/Schedule.png'), label: 'Schedule', color: '#FF9F0A', onPress: onSchedule },
    { icon: require('../../assets/icons/Progress.png'), label: 'Progress', color: '#FF453A', onPress: onProgress },
  ];

  return (
    <View style={styles.container}>
      {actions.map((action, index) => (
        <TouchableOpacity
          key={index}
          style={styles.actionButton}
          activeOpacity={0.7}
          onPress={action.onPress}
        >
          <View style={[styles.iconContainer, { backgroundColor: `${action.color}20` }]}>
            <Image source={action.icon} style={styles.icon} />
          </View>
          <Text style={styles.label}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  actionButton: {
    alignItems: 'center',
    width: 70,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    // Glass morphism effect
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  icon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  label: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
    textAlign: 'center',
  },
});
