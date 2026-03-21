import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, shadows } from '../../shared/ui/theme';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { auth, db } from '../../app/config';
import { getFoodLogsForDate, calculateMacroTotals } from '../../nutrition/services/nutritionService';
import { fetchWorkoutHistory, getActiveWorkout } from '../../workouts/services/workoutService';
import { calculateBMR, calculateTDEE } from '../../app/calculations';
import { Icon } from 'react-native-feather';

const { width } = Dimensions.get('window');

// Helper function to calculate calorie goal
const calculateCalorieGoal = (primaryGoal, weight, height, age, gender, daysPerWeek) => {
  if (!weight || !height || !age || !gender) return 2000;
  const weightKg = weight / 2.20462;
  const heightCm = height * 2.54;
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  let activityLevel = 'sedentary';
  if (daysPerWeek >= 6) activityLevel = 'very_active';
  else if (daysPerWeek >= 4) activityLevel = 'active';
  else if (daysPerWeek >= 3) activityLevel = 'moderate';
  else if (daysPerWeek >= 1) activityLevel = 'light';
  const tdee = calculateTDEE(bmr, activityLevel);
  switch (primaryGoal) {
    case 'lose_fat': return Math.round(tdee - 500);
    case 'build_muscle': return Math.round(tdee + 300);
    case 'athletic_performance': return Math.round(tdee + 500);
    default: return Math.round(tdee);
  }
};

// Helper function to calculate streak
const calculateStreak = (completedWorkouts) => {
  if (!completedWorkouts || completedWorkouts.length === 0) return 0;
  const sorted = [...completedWorkouts].sort((a, b) => {
    const aDate = a.completedAt?.toDate?.() || new Date(a.completedAt);
    const bDate = b.completedAt?.toDate?.() || new Date(b.completedAt);
    return bDate - aDate;
  });
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const workoutsByDate = {};
  sorted.forEach(workout => {
    const workoutDate = workout.completedAt?.toDate?.() || new Date(workout.completedAt);
    workoutDate.setHours(0, 0, 0, 0);
    const dateKey = workoutDate.toISOString().split('T')[0];
    if (!workoutsByDate[dateKey]) workoutsByDate[dateKey] = true;
  });
  let currentDate = new Date(today);
  while (workoutsByDate[currentDate.toISOString().split('T')[0]]) {
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }
  return streak;
};

export default function DashboardScreen({ navigation }) {
  const user = auth.currentUser;
  const [loading, setLoading] = useState(true);
  const [userStats, setUserStats] = useState({
    weight: null,
    goal: null,
    streak: 0,
    caloriesBurned: 0,
    caloriesConsumed: 0,
    waterIntake: 0,
  });

  const [todayWorkout, setTodayWorkout] = useState(null);
  const [recentMeals, setRecentMeals] = useState([]);
  const [calorieGoal, setCalorieGoal] = useState(2000);

  const [quickActions] = useState([
    { label: 'Messages', icon: 'MessageSquare' },
    { label: 'Photo Gallery', imageSource: require('../../assets/icons/picture.png') },
    { label: 'AI Workouts', imageSource: require('../../assets/Ai Workouts.png') },
  ]);

  // Fetch real data on mount
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.uid || !db) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // 1. Fetch user document with onboarding data
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Set user stats from onboarding data
          setUserStats(prev => ({
            ...prev,
            weight: userData.weight || null,
            goal: userData.primaryGoal || null,
          }));

          // Calculate calorie goal
          const goal = calculateCalorieGoal(
            userData.primaryGoal,
            userData.weight,
            userData.height,
            userData.age,
            userData.gender,
            userData.daysPerWeek
          );
          setCalorieGoal(goal);
        }

        // 2. Fetch today's nutrition logs
        const today = new Date();
        const nutritionLogs = await getFoodLogsForDate(user.uid, today);
        const totals = calculateMacroTotals(nutritionLogs);
        
        // Group meals by meal type and format for display
        const mealsByType = {
          breakfast: [],
          lunch: [],
          dinner: [],
          snack: [],
        };
        
        nutritionLogs.forEach(log => {
          const mealType = log.mealType || 'snack';
          const mealName = log.food?.name || log.foodName || 'Food';
          const calories = log.calories || 0;
          const time = log.created_at?.toDate?.() || new Date(log.created_at);
          const timeStr = time.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
          
          mealsByType[mealType] = mealsByType[mealType] || [];
          mealsByType[mealType].push({
            name: mealName,
            calories: calories,
            time: timeStr,
          });
        });

        // Get most recent meals (up to 3)
        const allMeals = [
          ...mealsByType.breakfast,
          ...mealsByType.lunch,
          ...mealsByType.dinner,
          ...mealsByType.snack,
        ].sort((a, b) => {
          // Sort by time (most recent first)
          return b.time.localeCompare(a.time);
        }).slice(0, 3);

        setRecentMeals(allMeals);
        setUserStats(prev => ({
          ...prev,
          caloriesConsumed: totals.calories || 0,
          waterIntake: totals.water || 0,
        }));

        // 3. Fetch completed workouts for streak and calories burned
        const completedWorkouts = await fetchWorkoutHistory(user.uid, 100);
        const calculatedStreak = calculateStreak(completedWorkouts);
        setUserStats(prev => ({
          ...prev,
          streak: calculatedStreak,
        }));

        // Calculate calories burned from today's workouts
        const todayKey = today.toISOString().split('T')[0];
        const todayWorkouts = completedWorkouts.filter(w => {
          const workoutDate = w.completedAt?.toDate?.() || new Date(w.completedAt);
          return workoutDate.toISOString().split('T')[0] === todayKey;
        });
        const burned = todayWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
        setUserStats(prev => ({
          ...prev,
          caloriesBurned: burned,
        }));

        // 4. Fetch today's active workout
        const activeWorkout = await getActiveWorkout(user.uid);
        if (activeWorkout) {
          setTodayWorkout({
            name: activeWorkout.workoutName || 'Active Workout',
            duration: `${Math.round((activeWorkout.duration || 0) / 60)} min`,
            exercises: activeWorkout.exercises?.length || 0,
            completed: false,
          });
        } else {
          // Check if there's a scheduled workout for today
          // TODO: Query workout templates or scheduled workouts
          setTodayWorkout(null);
        }

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.uid]);

  const StatCard = ({ title, value, subtitle, color = colors.primary, onPress }) => (
    <TouchableOpacity style={[styles.statCard, { borderLeftColor: color }]} onPress={onPress}>
      <Text style={styles.statTitle} selectable={true}>{title}</Text>
      <Text style={[styles.statValue, { color }]} selectable={true}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle} selectable={true}>{subtitle}</Text>}
    </TouchableOpacity>
  );

  const QuickActionCard = ({ action, index }) => {
  const textColor = colors.text;
  const BADGE_COLOR = '#C084FC'; // Same as TrainerApp
  
  // Define border colors for each action
  const getBorderColor = () => {
    switch (action.label) {
      case 'Messages': return 'rgba(255,107,157,0.35)';
      case 'Photo Gallery': return 'rgba(6,182,212,0.35)';
      case 'AI Workouts': return 'rgba(249,115,22,0.35)';
      default: return 'rgba(255,107,157,0.35)';
    }
  };
  
  return (
    <TouchableOpacity
      key={action.label}
      style={{ flex: 1 }}
      activeOpacity={0.8}
      onPress={() => {
        // Handle navigation based on label
        if (action.label === 'Messages') {
          // Navigate to messages screen
          navigation.navigate('Messages');
        } else if (action.label === 'Photo Gallery') {
          // Navigate to photo gallery
          navigation.navigate('Gallery');
        } else if (action.label === 'AI Workouts') {
          // Navigate to AI workouts
          navigation.navigate('Workout');
        }
      }}
    >
      <View style={{ 
        flex: 1, 
        backgroundColor: 'rgba(255,255,255,0.05)', 
        borderRadius: 16, 
        borderWidth: 1, 
        borderColor: getBorderColor() 
      }}>
        <View style={{ padding: 16, alignItems: 'center', gap: 10 }}>
          <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {action.imageSource ? (
              <Image source={action.imageSource} style={{ width: action.label === 'AI Workouts' ? 100 : 70, height: action.label === 'AI Workouts' ? 130 : 70 }} resizeMode="contain" />
            ) : (
              <Icon name={action.icon} size={28} color={textColor} />
            )}
            {action.label === 'Messages' && false && ( // Add unread count logic here if needed
              <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: BADGE_COLOR, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>1</Text>
              </View>
            )}
          </View>
          <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>{action.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

  const MealItem = ({ meal }) => (
    <View style={styles.mealItem}>
      <View style={styles.mealInfo}>
        <Text style={styles.mealName} selectable={true}>{meal.name}</Text>
        <Text style={styles.mealTime} selectable={true}>{meal.time}</Text>
      </View>
      <Text style={styles.mealCalories} selectable={true}>{meal.calories} cal</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Get goal display text
  const getGoalText = (goal) => {
    switch (goal) {
      case 'lose_fat': return 'Lose Fat';
      case 'build_muscle': return 'Build Muscle';
      case 'maintain_health': return 'Maintain Health';
      case 'athletic_performance': return 'Athletic Performance';
      default: return 'Set Goal';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting} selectable={true}>Good morning!</Text>
            <Text style={styles.userName} selectable={true}>
              {userStats.goal ? `Ready to ${getGoalText(userStats.goal).toLowerCase()}? 💪` : 'Ready to crush your goals? 💪'}
            </Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText} selectable={true}>
                {user?.displayName?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            title="Weight"
            value={userStats.weight ? `${userStats.weight} lbs` : '--'}
            subtitle={userStats.goal ? `Goal: ${getGoalText(userStats.goal)}` : 'Set your goal'}
            color={colors.primary}
            onPress={() => navigation.navigate('Body')}
          />
          <StatCard
            title="Streak"
            value={userStats.streak === 0 ? 'Start' : `${userStats.streak} days`}
            subtitle={userStats.streak === 0 ? 'Start your streak today!' : 'Keep it up!'}
            color={colors.success}
          />
          <StatCard
            title="Calories"
            value={`${userStats.caloriesConsumed}/${calorieGoal}`}
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
            <Text style={styles.sectionTitle} selectable={true}>Today's Workout</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Workout')}>
              <Text style={styles.sectionAction} selectable={true}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {todayWorkout ? (
            <View style={styles.workoutCard}>
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutName} selectable={true}>{todayWorkout.name}</Text>
                <Text style={styles.workoutDetails} selectable={true}>
                  {todayWorkout.duration} • {todayWorkout.exercises} exercises
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.workoutButton, { backgroundColor: colors.accent }]}
                onPress={() => navigation.navigate('Workout')}
              >
                <Text style={styles.workoutButtonText} selectable={true}>
                  {todayWorkout.completed ? 'Completed' : 'Start'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyWorkoutCard}>
              <Text style={styles.emptyWorkoutText}>No workout scheduled for today</Text>
              <TouchableOpacity
                style={[styles.workoutButton, { backgroundColor: colors.accent }]}
                onPress={() => navigation.navigate('Workout')}
              >
                <Text style={styles.workoutButtonText} selectable={true}>Generate Workout</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} selectable={true}>Quick Actions</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {quickActions.map((action, index) => (
              <QuickActionCard key={index} action={action} index={index} />
            ))}
          </View>
        </View>

        {/* Recent Meals */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} selectable={true}>Recent Meals</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Nutrition')}>
              <Text style={styles.sectionAction} selectable={true}>Log Food</Text>
            </TouchableOpacity>
          </View>
          
          {recentMeals.length > 0 ? (
            <View style={styles.mealsList}>
              {recentMeals.map((meal, index) => (
                <MealItem key={index} meal={meal} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyMealsCard}>
              <Text style={styles.emptyMealsText}>No meals logged today</Text>
              <TouchableOpacity
                style={[styles.workoutButton, { backgroundColor: colors.success }]}
                onPress={() => navigation.navigate('Nutrition')}
              >
                <Text style={styles.workoutButtonText} selectable={true}>Log Your First Meal</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Progress Chart Placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle} selectable={true}>Weekly Progress</Text>
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartText} selectable={true}>📊 Progress Chart</Text>
            <Text style={styles.chartSubtext} selectable={true}>Weight tracking over the last 7 days</Text>
          </View>
        </View>

        {/* Motivational Quote */}
        <View style={styles.quoteSection}>
          <Text style={styles.quoteText} selectable={true}>
            "The only bad workout is the one that didn't happen."
          </Text>
          <Text style={styles.quoteAuthor} selectable={true}>- Anonymous</Text>
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
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - spacing.md * 3) / 2,
    backgroundColor: colors.white,
    padding: spacing.md,
    marginBottom: spacing.md,
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
    marginBottom: spacing.md,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptyWorkoutCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyWorkoutText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  emptyMealsCard: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyMealsText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
});


