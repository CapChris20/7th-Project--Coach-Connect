import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { auth, db } from '../../app/config';
import { getProgressHistory } from '../services/clientCRMService';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

export default function ProgressView({ clientId }) {
  const [loading, setLoading] = useState(true);
  const [progressData, setProgressData] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [previousMetrics, setPreviousMetrics] = useState(null);
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    if (!clientId || !db) {
      setLoading(false);
      return;
    }

    const fetchProgressData = async () => {
      try {
        setLoading(true);
        
        // Fetch progress history - try both paths
        let progressHistory = [];
        try {
          // Try new path: trainer_clients/{trainerId}/clients/{clientId}/progress
          const trainerId = auth.currentUser?.uid;
          if (trainerId) {
            const progressRef = collection(db, `trainer_clients/${trainerId}/clients/${clientId}/progress`);
            const progressSnapshot = await getDocs(progressRef);
            progressSnapshot.forEach((doc) => {
              progressHistory.push({
                id: doc.id,
                ...doc.data(),
              });
            });
          }
        } catch (newPathError) {
          console.log('New progress path failed, trying legacy path:', newPathError);
          // Fallback to legacy path
          progressHistory = await getProgressHistory(clientId);
        }
        
        // Sort by createdAt descending (newest first)
        progressHistory.sort((a, b) => {
          const timeA = a.createdAt?.toDate?.() || a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toDate?.() || b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
        
        // Get current and previous entries for comparison
        if (progressHistory.length > 0) {
          const current = progressHistory[0]; // Newest
          const previous = progressHistory.length > 1 ? progressHistory[1] : null;
          
          setCurrentMetrics(current);
          setPreviousMetrics(previous);
          
          // Calculate changes
          const weightChange = previous && current.weight && previous.weight
            ? (current.weight - previous.weight).toFixed(1)
            : null;
          const bodyFatChange = previous && current.bodyFat && previous.bodyFat
            ? (current.bodyFat - previous.bodyFat).toFixed(1)
            : null;
          
          // Build progress cards
          const data = [];
          
          if (current.weight) {
            data.push({
              label: 'WEIGHT',
              value: current.weight.toFixed(1),
              unit: 'lbs',
              change: weightChange ? (weightChange > 0 ? `+${weightChange}` : weightChange) : null,
              changeType: weightChange && parseFloat(weightChange) < 0 ? 'negative' : 'positive',
              color: '#0A84FF'
            });
          }
          
          if (current.bodyFat) {
            data.push({
              label: 'BODY FAT',
              value: current.bodyFat.toFixed(1),
              unit: '%',
              change: bodyFatChange ? (bodyFatChange < 0 ? bodyFatChange : `+${bodyFatChange}`) : null,
              changeType: bodyFatChange && parseFloat(bodyFatChange) < 0 ? 'negative' : 'positive',
              color: '#FF453A'
            });
          }
          
          // Get client's current weight from user document for muscle mass estimate
          const clientDoc = await getDoc(doc(db, 'users', clientId));
          if (clientDoc.exists()) {
            const clientData = clientDoc.data();
            if (current.weight && current.bodyFat) {
              const muscleMass = current.weight * (1 - current.bodyFat / 100);
              const previousMuscleMass = previous && previous.weight && previous.bodyFat
                ? previous.weight * (1 - previous.bodyFat / 100)
                : null;
              const muscleChange = previousMuscleMass
                ? (muscleMass - previousMuscleMass).toFixed(1)
                : null;
              
              data.push({
                label: 'MUSCLE MASS',
                value: muscleMass.toFixed(0),
                unit: 'lbs',
                change: muscleChange ? (muscleChange > 0 ? `+${muscleChange}` : muscleChange) : null,
                changeType: muscleChange && parseFloat(muscleChange) > 0 ? 'positive' : 'negative',
                color: '#30D158'
              });
            }
          }
          
          setProgressData(data);
        } else {
          // No progress data - show empty state
          setProgressData([]);
        }
        
        // Fetch client goals from user document
        const clientDoc = await getDoc(doc(db, 'users', clientId));
        if (clientDoc.exists()) {
          const clientData = clientDoc.data();
          const goalsList = [];
          
          if (clientData.primaryGoal) {
            const goalText = {
              'lose_fat': 'Lose Weight',
              'build_muscle': 'Build Muscle',
              'maintain_health': 'Maintain Health',
              'athletic_performance': 'Improve Performance'
            }[clientData.primaryGoal] || clientData.primaryGoal;
            
            goalsList.push({
              goal: goalText,
              progress: 0, // Would need to calculate based on progress
              deadline: null
            });
          }
          
          setGoals(goalsList);
        }
      } catch (error) {
        console.error('Error fetching progress data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgressData();
  }, [clientId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0A84FF" />
        <Text style={styles.loadingText}>Loading progress data...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Progress Tracking</Text>
        <Text style={styles.subtitle}>Client's physical metrics over time</Text>
      </View>

      {progressData.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No progress data yet</Text>
          <Text style={styles.emptySubtitle}>Client hasn't logged any progress entries</Text>
        </View>
      ) : (
        <>
          <View style={styles.progressGrid}>
            {progressData.map((item, index) => (
              <View key={index} style={styles.progressCard}>
                <Text style={styles.progressLabel}>{item.label}</Text>
                <View style={styles.progressValueRow}>
                  <Text style={styles.progressValue}>{item.value}</Text>
                  <Text style={styles.progressUnit}>{item.unit}</Text>
                </View>
                {item.change && (
                  <Text style={[styles.progressChange, { color: item.changeType === 'positive' ? '#30D158' : '#FF453A' }]}>
                    {item.changeType === 'positive' && parseFloat(item.change) > 0 ? '+' : ''}{item.change}
                  </Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.chartSection}>
            <Text style={styles.sectionTitle}>Weight Progress</Text>
            <View style={styles.chartCard}>
              {currentMetrics?.weight ? (
                <>
                  <Text style={styles.chartValue}>{currentMetrics.weight.toFixed(1)} lbs</Text>
                  <Text style={styles.chartSubtitle}>
                    {currentMetrics.createdAt?.toDate ? 
                      `Last updated: ${currentMetrics.createdAt.toDate().toLocaleDateString()}` :
                      'Current weight'
                    }
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.chartPlaceholder}>📈</Text>
                  <Text style={styles.chartSubtitle}>No weight data available</Text>
                </>
              )}
            </View>
          </View>

          {goals.length > 0 && (
            <View style={styles.goalsSection}>
              <Text style={styles.sectionTitle}>Goals</Text>
              {goals.map((goal, index) => (
                <View key={index} style={styles.goalCard}>
                  <View style={styles.goalHeader}>
                    <Text style={styles.goalName}>{goal.goal}</Text>
                    {goal.deadline && (
                      <Text style={styles.goalDeadline}>{goal.deadline}</Text>
                    )}
                  </View>
                  <View style={styles.goalProgress}>
                    <View style={styles.goalProgressBar}>
                      <View style={[styles.goalProgressFill, { width: `${goal.progress}%` }]} />
                    </View>
                    <Text style={styles.goalProgressText}>{goal.progress}%</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  progressGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  progressCard: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    width: '48%',
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
  progressLabel: {
    fontSize: 11,
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    fontWeight: '600',
  },
  progressValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressUnit: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
  },
  progressChange: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  chartCard: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  chartValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  chartPlaceholder: {
    fontSize: 32,
    marginBottom: 8,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  goalsSection: {
    marginBottom: 24,
  },
  goalCard: {
    backgroundColor: 'rgba(44, 44, 46, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  goalDeadline: {
    fontSize: 13,
    color: '#8E8E93',
  },
  goalProgress: {
    alignItems: 'center',
  },
  goalProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    marginBottom: 8,
  },
  goalProgressFill: {
    height: '100%',
    backgroundColor: '#0A84FF',
    borderRadius: 4,
  },
  goalProgressText: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
