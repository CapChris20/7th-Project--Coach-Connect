import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import WorkoutCard from './WorkoutCard';

export default function CalendarView({
  workouts,
  weekStart,
  onPrevWeek,
  onNextWeek,
}) {
  return (
    <ScrollView style={styles.container}>
      {/* Week Header */}
      <View style={styles.weekHeader}>
        <View>
          <Text style={styles.weekTitle}>Week of {weekStart}</Text>
          <Text style={styles.weekSubtitle}>Plan and track workouts</Text>
        </View>
        <View style={styles.navButtons}>
          <TouchableOpacity style={styles.navButton} onPress={onPrevWeek}>
            <Text style={styles.navButtonText}>‹</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={onNextWeek}>
            <Text style={styles.navButtonText}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Workout Cards */}
      <View style={styles.workoutList}>
        {workouts.map((workout, index) => (
          <WorkoutCard
            key={index}
            workout={workout}
            onAddWorkout={() => console.log('Add workout for', workout.day)}
          />
        ))}
      </View>

      {/* Color Legend */}
      <View style={styles.legendContainer}>
        {[
          { label: 'Strength', color: '#0A84FF' },
          { label: 'Cardio', color: '#FF453A' },
          { label: 'Mobility', color: '#30D158' },
          { label: 'Rest', color: '#8E8E93' },
        ].map((type) => (
          <View key={type.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: type.color }]} />
            <Text style={styles.legendText}>{type.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  weekTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  weekSubtitle: {
    fontSize: 13,
    color: '#8E8E93',
  },
  navButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    // Glass morphism effect
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  navButtonText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  workoutList: {
    gap: 12,
    marginBottom: 24,
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    // Glass morphism effect
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
  },
});
