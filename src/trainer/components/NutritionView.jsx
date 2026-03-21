import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { db } from '../../app/config';
import { getFoodLogsForDate, calculateMacroTotals, getDailyGoals } from '../../nutrition/services/nutritionService';
import { doc, getDoc } from 'firebase/firestore';
import { calculateBMR, calculateTDEE } from '../../app/calculations';

export default function NutritionView({ clientId }) {
  const [loading, setLoading] = useState(true);
  const [nutritionData, setNutritionData] = useState([]);
  const [meals, setMeals] = useState([]);
  const [goals, setGoals] = useState(null);

  useEffect(() => {
    if (!clientId || !db) {
      setLoading(false);
      return;
    }

    const fetchNutritionData = async () => {
      try {
        setLoading(true);
        const today = new Date();
        
        // Fetch today's nutrition logs
        const nutritionLogs = await getFoodLogsForDate(clientId, today);
        const totals = calculateMacroTotals(nutritionLogs);
        
        // Fetch client's goals for targets
        const clientDoc = await getDoc(doc(db, 'users', clientId));
        const clientData = clientDoc.exists() ? clientDoc.data() : {};
        
        // Calculate calorie goal
        let calorieGoal = 2000;
        if (clientData.weight && clientData.height && clientData.age && clientData.gender) {
          const weightKg = clientData.weight / 2.20462;
          const heightCm = clientData.height * 2.54;
          const bmr = calculateBMR(weightKg, heightCm, clientData.age, clientData.gender);
          let activityLevel = 'sedentary';
          if (clientData.daysPerWeek >= 6) activityLevel = 'very_active';
          else if (clientData.daysPerWeek >= 4) activityLevel = 'active';
          else if (clientData.daysPerWeek >= 3) activityLevel = 'moderate';
          else if (clientData.daysPerWeek >= 1) activityLevel = 'light';
          const tdee = calculateTDEE(bmr, activityLevel);
          
          switch (clientData.primaryGoal) {
            case 'lose_fat': calorieGoal = Math.round(tdee - 500); break;
            case 'build_muscle': calorieGoal = Math.round(tdee + 300); break;
            case 'athletic_performance': calorieGoal = Math.round(tdee + 500); break;
            default: calorieGoal = Math.round(tdee);
          }
        }
        
        // Fetch daily goals
        const dailyGoals = await getDailyGoals(clientId);
        const proteinGoal = dailyGoals?.proteinTarget || 160;
        const carbsGoal = dailyGoals?.carbsTarget || 280;
        const fatGoal = dailyGoals?.fatTarget || 75;
        
        // Build nutrition data
        const data = [
          {
            label: 'CALORIES',
            value: totals.calories || 0,
            unit: 'kcal',
            target: `of ${calorieGoal} kcal`,
            percentage: calorieGoal > 0 ? Math.round((totals.calories / calorieGoal) * 100) : 0,
            color: '#FF9F0A'
          },
          {
            label: 'PROTEIN',
            value: Math.round(totals.protein || 0),
            unit: 'g',
            target: `of ${proteinGoal} g`,
            percentage: proteinGoal > 0 ? Math.round((totals.protein / proteinGoal) * 100) : 0,
            color: '#0A84FF'
          },
          {
            label: 'CARBS',
            value: Math.round(totals.carbs || 0),
            unit: 'g',
            target: `of ${carbsGoal} g`,
            percentage: carbsGoal > 0 ? Math.round((totals.carbs / carbsGoal) * 100) : 0,
            color: '#30D158'
          },
          {
            label: 'FAT',
            value: Math.round(totals.fat || 0),
            unit: 'g',
            target: `of ${fatGoal} g`,
            percentage: fatGoal > 0 ? Math.round((totals.fat / fatGoal) * 100) : 0,
            color: '#FF453A'
          },
        ];
        
        setNutritionData(data);
        
        // Format meals from logs
        const formattedMeals = nutritionLogs
          .map(log => ({
            name: log.food_name || 'Food',
            time: log.created_at?.toDate ? 
              formatTime(log.created_at.toDate()) : 
              'Recently',
            calories: log.calories || 0,
          }))
          .sort((a, b) => {
            // Sort by time (most recent first)
            return 0; // Already sorted by getFoodLogsForDate
          })
          .slice(0, 5); // Show last 5 meals
        
        setMeals(formattedMeals);
        setGoals(dailyGoals);
      } catch (error) {
        console.error('Error fetching nutrition data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNutritionData();
  }, [clientId]);

  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A84FF" />
        <Text style={styles.loadingText}>Loading nutrition data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Nutrition Tracking</Text>
        <Text style={styles.subtitle}>Today's macro breakdown</Text>
      </View>

      {nutritionData.map((item, index) => (
        <View key={index} style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <Text style={styles.macroLabel}>{item.label}</Text>
            <Text style={[styles.macroIcon, { color: item.color }]}>🔥</Text>
          </View>
          <View style={styles.macroNumbers}>
            <Text style={styles.macroValue}>{item.value}</Text>
            <Text style={styles.macroUnit}>{item.unit}</Text>
          </View>
          <Text style={styles.macroTarget}>{item.target}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(item.percentage, 100)}%`, backgroundColor: item.color }]} />
          </View>
          <Text style={styles.progressPercentage}>{item.percentage}% of target</Text>
        </View>
      ))}

      <View style={styles.mealSection}>
        <Text style={styles.sectionTitle}>Recent Meals</Text>
        {meals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🍽️</Text>
            <Text style={styles.emptyTitle}>No meals logged today</Text>
            <Text style={styles.emptySubtitle}>Client hasn't logged any meals yet</Text>
          </View>
        ) : (
          meals.map((meal, index) => (
            <View key={index} style={styles.mealCard}>
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{meal.name}</Text>
                <Text style={styles.mealTime}>{meal.time}</Text>
              </View>
              <Text style={styles.mealCalories}>{meal.calories} cal</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#8E8E93',
    marginTop: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
  },
  macroCard: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  macroLabel: {
    fontSize: 11,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  macroIcon: {
    fontSize: 20,
  },
  macroNumbers: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  macroValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  macroUnit: {
    fontSize: 16,
    color: '#8E8E93',
    marginLeft: 4,
  },
  macroTarget: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 12,
    color: '#8E8E93',
  },
  mealSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  mealCard: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mealInfo: {
    flex: 1,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mealTime: {
    fontSize: 13,
    color: '#8E8E93',
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0A84FF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
});
