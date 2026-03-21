import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { useTheme } from '../../shared/ui/ThemeContext';
import { auth } from '../../app/config';
import {
  getActiveWorkout,
  subscribeToActiveWorkout,
  updateActiveWorkout,
  completeWorkout,
  cancelWorkout,
} from '../services/workoutService';
import { fetchExerciseById } from '../services/exerciseDB';
import FluidGlass from '../../shared/ui/FluidGlass';
import { Ionicons } from '@expo/vector-icons';
import BottomNavBar from '../../navigation/BottomNavBar';
import Loader from '../../Loader';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';

export default function ActiveWorkoutScreen({ activeWorkoutId, onComplete, onCancel }) {
  const { colors, spacing, isDark } = useTheme();
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [currentExercise, setCurrentExercise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [completedSets, setCompletedSets] = useState([]);
  const restTimerRef = useRef(null);
  const unsubscribeRef = useRef(null);

  const user = auth.currentUser;
  const styles = createStyles(spacing, colors, isDark);

  useEffect(() => {
    if (activeWorkoutId) {
      loadActiveWorkout();
    } else {
      // Try to get active workout for user
      loadUserActiveWorkout();
    }

    return () => {
      if (restTimerRef.current) {
        clearInterval(restTimerRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [activeWorkoutId]);

  useEffect(() => {
    if (activeWorkout && activeWorkout.exercises) {
      loadCurrentExercise();
      if (!startTime) {
        setStartTime(new Date());
      }
    }
  }, [activeWorkout]);

  const loadActiveWorkout = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Subscribe to real-time updates
      unsubscribeRef.current = subscribeToActiveWorkout(user.uid, (workout) => {
        if (workout) {
          setActiveWorkout(workout);
          setCompletedSets(workout.completedSets || []);
        } else {
          // Workout was completed or canceled
          if (onComplete) {
            onComplete();
          }
        }
        setLoading(false);
      });

      // Also load initial state
      const workout = await getActiveWorkout(user.uid);
      if (workout) {
        setActiveWorkout(workout);
        setCompletedSets(workout.completedSets || []);
        if (!startTime) {
          setStartTime(workout.startedAt?.toDate() || new Date());
        }
      } else {
        Alert.alert('No Active Workout', 'No active workout found');
        if (onCancel) {
          onCancel();
        }
      }
    } catch (error) {
      console.error('Error loading active workout:', error);
      Alert.alert('Error', 'Failed to load active workout');
      if (onCancel) {
        onCancel();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserActiveWorkout = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const workout = await getActiveWorkout(user.uid);
      if (workout) {
        setActiveWorkout(workout);
        setCompletedSets(workout.completedSets || []);
        setStartTime(workout.startedAt?.toDate() || new Date());
        // Subscribe to updates
        unsubscribeRef.current = subscribeToActiveWorkout(user.uid, (updatedWorkout) => {
          if (updatedWorkout) {
            setActiveWorkout(updatedWorkout);
            setCompletedSets(updatedWorkout.completedSets || []);
          }
        });
      } else {
        Alert.alert('No Active Workout', 'No active workout found');
        if (onCancel) {
          onCancel();
        }
      }
    } catch (error) {
      console.error('Error loading active workout:', error);
      Alert.alert('Error', 'Failed to load active workout');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentExercise = async () => {
    if (!activeWorkout || !activeWorkout.exercises) return;

    const exerciseIndex = activeWorkout.currentExerciseIndex || 0;
    const exerciseData = activeWorkout.exercises[exerciseIndex];

    if (!exerciseData) {
      // All exercises completed
      handleCompleteWorkout();
      return;
    }

    try {
      const result = await fetchExerciseById(exerciseData.exerciseId);
      if (result.success) {
        setCurrentExercise({
          ...result.data,
          sets: exerciseData.sets,
          reps: exerciseData.reps,
          restSeconds: exerciseData.restSeconds,
        });
      } else {
        // Fallback if exercise not found
        setCurrentExercise({
          id: exerciseData.exerciseId,
          name: 'Exercise',
          sets: exerciseData.sets,
          reps: exerciseData.reps,
          restSeconds: exerciseData.restSeconds,
        });
      }
    } catch (error) {
      console.error('Error loading exercise:', error);
      setCurrentExercise({
        id: exerciseData.exerciseId,
        name: 'Exercise',
        sets: exerciseData.sets,
        reps: exerciseData.reps,
        restSeconds: exerciseData.restSeconds,
      });
    }
  };

  const handleCompleteSet = async () => {
    if (!activeWorkout || !currentExercise) return;

    const exerciseIndex = activeWorkout.currentExerciseIndex || 0;
    const currentSets = completedSets[exerciseIndex] || [];
    const newSets = [...currentSets, { completedAt: new Date() }];
    const updatedCompletedSets = [...completedSets];
    updatedCompletedSets[exerciseIndex] = newSets;

    setCompletedSets(updatedCompletedSets);

    // Update in Firestore
    await updateActiveWorkout(activeWorkout.id, {
      completedSets: updatedCompletedSets,
    });

    // Start rest timer if not last set
    if (newSets.length < currentExercise.sets) {
      startRestTimer(currentExercise.restSeconds);
    }
  };

  const startRestTimer = (seconds) => {
    setIsResting(true);
    setRestTimer(seconds);

    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
    }

    restTimerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev <= 1) {
          clearInterval(restTimerRef.current);
          setIsResting(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const skipRest = () => {
    if (restTimerRef.current) {
      clearInterval(restTimerRef.current);
    }
    setIsResting(false);
    setRestTimer(0);
  };

  const handleNextExercise = async () => {
    if (!activeWorkout) return;

    const nextIndex = (activeWorkout.currentExerciseIndex || 0) + 1;

    if (nextIndex >= activeWorkout.exercises.length) {
      // All exercises completed
      handleCompleteWorkout();
      return;
    }

    await updateActiveWorkout(activeWorkout.id, {
      currentExerciseIndex: nextIndex,
    });
  };

  const handleCompleteWorkout = async () => {
    if (!activeWorkout || !startTime) return;

    const duration = Math.floor((new Date() - startTime) / 1000);
    const totalVolume = calculateTotalVolume();

    const result = await completeWorkout(activeWorkout.id, duration, totalVolume);
    if (result.success) {
      Alert.alert('Workout Complete!', `Duration: ${formatDuration(duration)}`);
      if (onComplete) {
        onComplete();
      }
    } else {
      Alert.alert('Error', result.error || 'Failed to complete workout');
    }
  };

  const handleCancelWorkout = () => {
    Alert.alert(
      'Cancel Workout',
      'Are you sure you want to cancel this workout? Progress will be lost.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            if (activeWorkout) {
              await cancelWorkout(activeWorkout.id);
            }
            if (onCancel) {
              onCancel();
            }
          },
        },
      ]
    );
  };

  const calculateTotalVolume = () => {
    // Simple calculation - can be enhanced with weight tracking
    let volume = 0;
    completedSets.forEach((sets, exerciseIndex) => {
      if (activeWorkout?.exercises[exerciseIndex]) {
        const exercise = activeWorkout.exercises[exerciseIndex];
        volume += sets.length * exercise.reps;
      }
    });
    return volume;
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentSetNumber = () => {
    if (!activeWorkout || !currentExercise) return 0;
    const exerciseIndex = activeWorkout.currentExerciseIndex || 0;
    return (completedSets[exerciseIndex]?.length || 0) + 1;
  };

  const getCompletedSetsCount = () => {
    if (!activeWorkout || !currentExercise) return 0;
    const exerciseIndex = activeWorkout.currentExerciseIndex || 0;
    return completedSets[exerciseIndex]?.length || 0;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Loader />
          <Text style={styles.loadingText}>Loading workout...</Text>
        </View>
      </View>
    );
  }

  if (!activeWorkout || !currentExercise) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>No active workout</Text>
        </View>
      </View>
    );
  }

  const exerciseIndex = activeWorkout.currentExerciseIndex || 0;
  const totalExercises = activeWorkout.exercises?.length || 0;
  const currentSet = getCurrentSetNumber();
  const completedSetsCount = getCompletedSetsCount();

  return (
    <View style={styles.container}>
      <CoachConnectHeader
        isDark={isDark}
        onProfilePress={() => {
          // TODO: Navigate to profile
        }}
        onSettingsPress={() => {
          // TODO: Navigate to settings
        }}
      />
      
      <View style={styles.workoutHeader}>
        <TouchableOpacity onPress={handleCancelWorkout} style={styles.cancelButton}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Exercise {exerciseIndex + 1} of {totalExercises}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <FluidGlass
          transmission={0.92}
          roughness={0.1}
          tint={isDark ? 'rgba(30, 27, 46, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
          style={styles.exerciseCard}
        >
          <Text style={styles.exerciseName}>{currentExercise.name}</Text>
          {currentExercise.bodyPart && (
            <Text style={styles.exerciseBodyPart}>
              {currentExercise.bodyPart} • {currentExercise.target}
            </Text>
          )}

          <View style={styles.setsInfo}>
            <View style={styles.setsInfoItem}>
              <Text style={styles.setsInfoLabel}>Set Progress</Text>
              <Text style={styles.setsInfoValue}>
                Set {currentSet} of {currentExercise.sets}
              </Text>
            </View>
            <View style={styles.setsInfoItem}>
              <Text style={styles.setsInfoLabel}>Reps</Text>
              <Text style={styles.setsInfoValue}>{currentExercise.reps}</Text>
            </View>
            <View style={styles.setsInfoItem}>
              <Text style={styles.setsInfoLabel}>Rest</Text>
              <Text style={styles.setsInfoValue}>{currentExercise.restSeconds}s</Text>
            </View>
          </View>

          {currentExercise.gifUrl && (
            <View style={styles.exerciseImage}>
              <Text style={styles.exerciseImagePlaceholder}>Exercise Demo</Text>
            </View>
          )}
        </FluidGlass>

        {isResting && (
          <FluidGlass
            transmission={0.95}
            roughness={0.05}
            tint={isDark ? 'rgba(88, 86, 214, 0.2)' : 'rgba(88, 86, 214, 0.1)'}
            style={styles.restTimerCard}
          >
            <Text style={styles.restTimerLabel}>Rest</Text>
            <Text style={styles.restTimerValue}>{formatDuration(restTimer)}</Text>
            <TouchableOpacity style={styles.skipRestButton} onPress={skipRest}>
              <Text style={styles.skipRestText}>Skip Rest</Text>
            </TouchableOpacity>
          </FluidGlass>
        )}

        <View style={styles.actions}>
          {!isResting && currentSet <= currentExercise.sets && (
            <TouchableOpacity
              style={styles.completeSetButton}
              onPress={handleCompleteSet}
            >
              <Text style={styles.completeSetButtonText}>
                Complete Set {currentSet}
              </Text>
            </TouchableOpacity>
          )}

          {completedSetsCount >= currentExercise.sets && (
            <TouchableOpacity
              style={styles.nextExerciseButton}
              onPress={handleNextExercise}
            >
              <Text style={styles.nextExerciseButtonText}>
                {exerciseIndex + 1 >= totalExercises ? 'Finish Workout' : 'Next Exercise'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {/* Bottom Navigation Bar */}
      <BottomNavBar
        onHomePress={() => {
          // Navigate back to home
          if (onCancel) onCancel();
        }}
        onProfilePress={() => {
          // TODO: Navigate to profile
        }}
        onPlusPress={() => {
          // TODO: Show create modal
        }}
        onVoicePress={() => {
          // TODO: Navigate to voice
        }}
      />
    </View>
  );
}

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
    },
    workoutHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    cancelButton: {
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    content: {
      flex: 1,
      padding: spacing.lg,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    exerciseCard: {
      padding: spacing.xl,
      borderRadius: 20,
      marginBottom: spacing.lg,
    },
    exerciseName: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    exerciseBodyPart: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
      textTransform: 'capitalize',
    },
    setsInfo: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.lg,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      marginBottom: spacing.lg,
    },
    setsInfoItem: {
      alignItems: 'center',
    },
    setsInfoLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    setsInfoValue: {
      fontSize: 24,
      fontWeight: '700',
      color: colors.primary,
    },
    exerciseImage: {
      width: '100%',
      height: 200,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
    },
    exerciseImagePlaceholder: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    restTimerCard: {
      padding: spacing.xl,
      borderRadius: 20,
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    restTimerLabel: {
      fontSize: 18,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    restTimerValue: {
      fontSize: 48,
      fontWeight: '800',
      color: colors.primary,
      marginBottom: spacing.md,
    },
    skipRestButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: 8,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    },
    skipRestText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    actions: {
      gap: spacing.md,
    },
    completeSetButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      borderRadius: 16,
      alignItems: 'center',
    },
    completeSetButtonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: '700',
    },
    nextExerciseButton: {
      backgroundColor: isDark ? 'rgba(88, 86, 214, 0.3)' : 'rgba(88, 86, 214, 0.2)',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
      borderRadius: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    nextExerciseButtonText: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '700',
    },
  });












