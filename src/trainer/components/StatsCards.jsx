import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '../../shared/ui/ThemeContext';

export default function StatsCards({
  adherence,
  workoutsCompleted,
  workoutsTotal,
  lastCheckin,
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.container}>
      {/* Adherence Card */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.cardLabel}>Adherence</Text>
          <View style={styles.adherenceContainer}>
            <Text style={styles.adherenceText}>{adherence}%</Text>
          </View>
        </View>
      </View>

      {/* This Week Card */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.cardLabel}>This Week</Text>
          <View style={styles.workoutContainer}>
            <Image source={require('../../assets/icons/This Week.png')} style={styles.workoutIcon} />
            <View style={styles.workoutNumbers}>
              <Text style={styles.workoutCount}>
                {workoutsCompleted}
                <Text style={styles.workoutTotal}>/{workoutsTotal}</Text>
              </Text>
              <Text style={styles.workoutLabel}>workouts</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Last Check-in Card */}
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.cardLabel}>Check-in</Text>
          <View style={styles.checkinContainer}>
            <Image source={require('../../assets/icons/Check in.png')} style={styles.checkinIcon} />
            <View style={styles.checkinNumbers}>
              <Text style={styles.checkinCount}>{lastCheckin}</Text>
              <Text style={styles.checkinLabel}>days ago</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
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
  cardContent: {
    position: 'relative',
    zIndex: 10,
  },
  cardLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    fontWeight: '600',
  },
  adherenceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  adherenceText: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.text
  },
  workoutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    marginBottom: 6,
  },
  workoutNumbers: {
    alignItems: 'center',
  },
  workoutCount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
  },
  workoutTotal: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  workoutLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
  },
  checkinContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
    marginBottom: 6,
  },
  checkinNumbers: {
    alignItems: 'center',
  },
  checkinCount: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
  },
  checkinLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
