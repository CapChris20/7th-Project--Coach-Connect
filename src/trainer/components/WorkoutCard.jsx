/**
 * Workout Card
 *
 * Purpose: UI screen or component: Workout Card. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: WorkoutCard
 *
 * @file-header
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';

const workoutConfig = {
  strength: {
    color: '#0A84FF',
    label: 'STRENGTH',
    icon: require('../../assets/icons/Progress.png'),
  },
  cardio: {
    color: '#FF453A',
    label: 'CARDIO',
    icon: require('../../assets/icons/This Week.png'),
  },
  mobility: {
    color: '#30D158',
    label: 'MOBILITY',
    icon: require('../../assets/icons/Schedule.png'),
  },
  rest: {
    color: '#8E8E93',
    label: 'REST',
    icon: require('../../assets/icons/Check in.png'),
  },
  empty: {
    color: '#8E8E93',
    label: '',
    icon: require('../../assets/icons/delete.png'),
  },
};

export default function WorkoutCard({ workout, onAddWorkout }) {
  const config = workoutConfig[workout.type];

  if (workout.type === 'empty') {
    return (
      <TouchableOpacity
        style={styles.emptyCard}
        onPress={onAddWorkout}
        activeOpacity={0.7}
      >
        <View style={styles.emptyLeft}>
          <Text style={styles.emptyDay}>{workout.day}</Text>
          <Text style={styles.emptyDate}>{workout.date}</Text>
        </View>
        <View style={styles.emptyRight}>
          <Image source={config.icon} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>Add workout</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (workout.type === 'rest') {
    return (
      <View style={[styles.card, styles.restCard]}>
        <View style={styles.left}>
          <Text style={styles.day}>{workout.day}</Text>
          <Text style={styles.date}>{workout.date}</Text>
        </View>
        <View style={styles.right}>
          <Image source={config.icon} style={styles.icon} />
          <View style={styles.workoutInfo}>
            <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
            <Text style={styles.name}>{workout.name}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        workout.completed && styles.completedCard,
        { borderColor: workout.completed ? '#30D158' : config.color }
      ]}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <Text style={styles.day}>{workout.day}</Text>
        <Text style={styles.date}>{workout.date}</Text>
      </View>
      <View style={styles.right}>
        <Image source={config.icon} style={styles.icon} />
        <View style={styles.workoutInfo}>
          <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
          <Text style={styles.name}>{workout.name}</Text>
          {workout.completed && (
            <Text style={styles.completedText}>Completed</Text>
          )}
        </View>
        {workout.completed && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 140,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 2,
    // Glass morphism effect
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    // Inner shadow effect
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  completedCard: {
    backgroundColor: 'rgba(44, 44, 46, 0.8)',
    borderColor: '#30D158',
    shadowColor: '#30D158',
    shadowOpacity: 0.25,
  },
  restCard: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderColor: '#8E8E9340',
  },
  emptyCard: {
    height: 140,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#3A3A3C',
    backgroundColor: 'transparent',
  },
  left: {
    flexShrink: 0,
  },
  day: {
    fontSize: 10,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    fontWeight: '600',
  },
  date: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 32,
  },
  emptyLeft: {
    flexShrink: 0,
  },
  emptyDay: {
    fontSize: 10,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    fontWeight: '600',
  },
  emptyDate: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3A3A3C',
    lineHeight: 32,
  },
  right: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    width: 28,
    height: 28,
    resizeMode: 'contain',
  },
  emptyIcon: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  emptyText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '600',
  },
  workoutInfo: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
    fontWeight: '700',
  },
  name: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
    lineHeight: 20,
  },
  completedText: {
    fontSize: 12,
    color: '#30D158',
    marginTop: 4,
    fontWeight: '600',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#30D158',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkmarkText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
