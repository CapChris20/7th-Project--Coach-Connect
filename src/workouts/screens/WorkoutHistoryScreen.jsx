import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTheme } from '../../shared/ui/ThemeContext';
import { auth } from '../../app/config';
import { fetchWorkoutHistory } from '../services/workoutService';
import FluidGlass from '../../shared/ui/FluidGlass';
import { Ionicons } from '@expo/vector-icons';
import BottomNavBar from '../../navigation/BottomNavBar';

export default function WorkoutHistoryScreen({ onClose, onNavigate }) {
  const { colors, spacing, isDark } = useTheme();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const user = auth.currentUser;
  const styles = createStyles(spacing, colors, isDark);

  useEffect(() => {
    loadWorkoutHistory();
  }, []);

  const loadWorkoutHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const history = await fetchWorkoutHistory(user.uid);
      setWorkouts(history);
    } catch (error) {
      console.error('Error loading workout history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadWorkoutHistory();
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown date';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      } else {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
        });
      }
    } catch (error) {
      return 'Unknown date';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch (error) {
      return '';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatVolume = (volume) => {
    if (!volume) return '0';
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}k`;
    }
    return volume.toString();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Workout History</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {workouts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No workout history</Text>
            <Text style={styles.emptySubtext}>
              Complete your first workout to see it here
            </Text>
          </View>
        ) : (
          workouts.map((workout) => (
            <FluidGlass
              key={workout.id}
              transmission={0.92}
              roughness={0.1}
              tint={isDark ? 'rgba(30, 27, 46, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
              style={styles.workoutCard}
            >
              <View style={styles.workoutCardHeader}>
                <View style={styles.workoutCardContent}>
                  <Text style={styles.workoutName}>{workout.workoutName || 'Workout'}</Text>
                  <View style={styles.workoutMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.metaText}>
                        {formatDate(workout.completedAt)} {formatTime(workout.completedAt)}
                      </Text>
                    </View>
                  </View>
                </View>
                <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
              </View>

              <View style={styles.workoutStats}>
                <View style={styles.statItem}>
                  <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.statValue}>{formatDuration(workout.duration)}</Text>
                  <Text style={styles.statLabel}>Duration</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="barbell-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.statValue}>{formatVolume(workout.totalVolume)}</Text>
                  <Text style={styles.statLabel}>Volume</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="fitness-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.statValue}>{workout.exercises?.length || 0}</Text>
                  <Text style={styles.statLabel}>Exercises</Text>
                </View>
              </View>

              {workout.completedSets && (
                <View style={styles.setsSummary}>
                  <Text style={styles.setsSummaryTitle}>Sets Completed:</Text>
                  <Text style={styles.setsSummaryValue}>
                    {workout.completedSets.reduce(
                      (total, sets) => total + (sets?.length || 0),
                      0
                    )}{' '}
                    total sets
                  </Text>
                </View>
              )}
            </FluidGlass>
          ))
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      {onNavigate && (
        <BottomNavBar
          onHomePress={() => onNavigate('home')}
          onProfilePress={() => onNavigate('profile')}
          onPlusPress={() => onNavigate('create')}
          onVoicePress={() => onNavigate('voice')}
          onWorkoutPress={() => onNavigate('workout')}
          onNutritionPress={() => onNavigate('nutrition')}
        />
      )}
    </View>
  );
}

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md + 8,
      paddingBottom: spacing.md,
    },
    closeButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: '800',
      color: colors.text,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing.md,
      gap: spacing.md,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    workoutCard: {
      padding: spacing.lg,
      borderRadius: 16,
      marginBottom: spacing.md,
    },
    workoutCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    workoutCardContent: {
      flex: 1,
    },
    workoutName: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    workoutMeta: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    metaText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    workoutStats: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statDivider: {
      width: 1,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.primary,
      marginTop: spacing.xs,
      marginBottom: spacing.xs / 2,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      textTransform: 'uppercase',
    },
    setsSummary: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    setsSummaryTitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.xs / 2,
    },
    setsSummaryValue: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing.xl * 2,
    },
    emptyText: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

