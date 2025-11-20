import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, shadows } from '../../config/theme';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const [userStats, setUserStats] = useState({
    weight: 75,
    goal: 'muscle_gain',
    streak: 7,
    caloriesBurned: 450,
    caloriesConsumed: 1800,
    waterIntake: 6,
  });

  const [todayWorkout, setTodayWorkout] = useState({
    name: 'Upper Body Strength',
    duration: '45 min',
    exercises: 8,
    completed: false,
  });

  const [recentMeals, setRecentMeals] = useState([
    { name: 'Breakfast', calories: 450, time: '8:00 AM' },
    { name: 'Lunch', calories: 650, time: '1:00 PM' },
    { name: 'Snack', calories: 200, time: '4:00 PM' },
  ]);

  const [quickActions] = useState([
    { title: 'Start Workout', icon: '💪', color: colors.accent, screen: 'Workout' },
    { title: 'Log Food', icon: '🍎', color: colors.success, screen: 'Nutrition' },
    { title: 'Body Photo', icon: '📸', color: colors.info, screen: 'Body' },
    { title: 'Voice Coach', icon: '🎤', color: colors.warning, screen: 'Voice' },
  ]);

  const StatCard = ({ title, value, subtitle, color = colors.primary, onPress }) => (
    <TouchableOpacity style={[styles.statCard, { borderLeftColor: color }]} onPress={onPress}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );

  const QuickActionCard = ({ action }) => (
    <TouchableOpacity
      style={[styles.quickActionCard, { backgroundColor: action.color + '20' }]}
      onPress={() => navigation.navigate(action.screen)}
    >
      <Text style={styles.quickActionIcon}>{action.icon}</Text>
      <Text style={styles.quickActionTitle}>{action.title}</Text>
    </TouchableOpacity>
  );

  const MealItem = ({ meal }) => (
    <View style={styles.mealItem}>
      <View style={styles.mealInfo}>
        <Text style={styles.mealName}>{meal.name}</Text>
        <Text style={styles.mealTime}>{meal.time}</Text>
      </View>
      <Text style={styles.mealCalories}>{meal.calories} cal</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning!</Text>
            <Text style={styles.userName}>Ready to crush your goals? 💪</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Weight"
            value={`${userStats.weight} kg`}
            subtitle="Goal: 80kg"
            color={colors.primary}
            onPress={() => navigation.navigate('Body')}
          />
          <StatCard
            title="Streak"
            value={`${userStats.streak} days`}
            subtitle="Keep it up!"
            color={colors.success}
          />
          <StatCard
            title="Calories"
            value={`${userStats.caloriesConsumed}/${userStats.caloriesBurned + 2000}`}
            subtitle="Today's intake"
            color={colors.warning}
            onPress={() => navigation.navigate('Nutrition')}
          />
          <StatCard
            title="Water"
            value={`${userStats.waterIntake}/8`}
            subtitle="glasses today"
            color={colors.info}
          />
        </View>

        {/* Today's Workout */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Workout</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Workout')}>
              <Text style={styles.sectionAction}>View All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.workoutCard}>
            <View style={styles.workoutInfo}>
              <Text style={styles.workoutName}>{todayWorkout.name}</Text>
              <Text style={styles.workoutDetails}>
                {todayWorkout.duration} • {todayWorkout.exercises} exercises
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.workoutButton, { backgroundColor: colors.accent }]}
              onPress={() => navigation.navigate('Workout')}
            >
              <Text style={styles.workoutButtonText}>
                {todayWorkout.completed ? 'Completed' : 'Start'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <QuickActionCard key={index} action={action} />
            ))}
          </View>
        </View>

        {/* Recent Meals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Meals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Nutrition')}>
              <Text style={styles.sectionAction}>Log Food</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.mealsList}>
            {recentMeals.map((meal, index) => (
              <MealItem key={index} meal={meal} />
            ))}
          </View>
        </View>

        {/* Progress Chart Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Weekly Progress</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartText}>📊 Progress Chart</Text>
            <Text style={styles.chartSubtext}>Weight tracking over the last 7 days</Text>
          </View>
        </View>

        {/* Motivational Quote */}
        <View style={styles.quoteSection}>
          <Text style={styles.quoteText}>
            "The only bad workout is the one that didn't happen."
          </Text>
          <Text style={styles.quoteAuthor}>- Anonymous</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  greeting: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  userName: {
    ...typography.body,
    color: colors.textSecondary,
  },
  profileButton: {
    padding: spacing.sm,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...typography.h4,
    color: colors.white,
    fontWeight: 'bold',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    width: (width - spacing.md * 3) / 2,
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: 12,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  statTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.h4,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  statSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h5,
    color: colors.text,
    fontWeight: 'bold',
  },
  sectionAction: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: '600',
  },
  workoutCard: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.sm,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    ...typography.h6,
    color: colors.text,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  workoutDetails: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  workoutButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  workoutButtonText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: 'bold',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: (width - spacing.md * 3) / 2,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  quickActionIcon: {
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  quickActionTitle: {
    ...typography.bodySmall,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  mealsList: {
    backgroundColor: colors.white,
    borderRadius: 12,
    ...shadows.sm,
  },
  mealItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  mealTime: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  mealCalories: {
    ...typography.bodySmall,
    color: colors.accent,
    fontWeight: 'bold',
  },
  chartPlaceholder: {
    backgroundColor: colors.white,
    padding: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    ...shadows.sm,
  },
  chartText: {
    ...typography.h6,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  chartSubtext: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  quoteSection: {
    backgroundColor: colors.gray[50],
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.xl,
  },
  quoteText: {
    ...typography.body,
    color: colors.text,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  quoteAuthor: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});


