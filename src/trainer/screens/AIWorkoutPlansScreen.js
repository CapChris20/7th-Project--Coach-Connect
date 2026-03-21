import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/ui/ThemeContext';
import { db } from '../../app/config';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';

function useClientWorkoutPlans(clientId) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!clientId || !db) return;
    setLoading(true);
    setError(null);
    try {
      const results = [];

      // Primary: users/{clientId}/workoutPlans (collection)
      const colRef = collection(db, 'users', clientId, 'workoutPlans');
      try {
        const snap = await getDocs(query(colRef, orderBy('generatedAt', 'desc')));
        snap.forEach((d) => results.push({ id: d.id, ...d.data(), _source: 'usersSubcollection' }));
      } catch (e) {
        // ignore if collection missing
      }

      // Fallback: users/{clientId}/workoutPlan single doc
      if (!results.length) {
        const singleRef = doc(db, 'users', clientId, 'workoutPlan', 'current');
        const singleSnap = await getDoc(singleRef);
        if (singleSnap.exists()) {
          results.push({
            id: singleSnap.id,
            ...singleSnap.data(),
            _singleDoc: true,
            _path: ['users', clientId, 'workoutPlan', 'current'],
          });
        }
      }

      // Fallback: global workoutPlans with clientId
      if (!results.length) {
        const globalRef = collection(db, 'workoutPlans');
        const snap = await getDocs(
          query(globalRef, where('clientId', '==', clientId), orderBy('generatedAt', 'desc')),
        );
        snap.forEach((d) => results.push({ id: d.id, ...d.data(), _source: 'global' }));
      }

      setPlans(results);
    } catch (e) {
      setError(e?.message || 'Failed to load workout plans');
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  return { plans, loading, error, reload: load };
}

export default function AIWorkoutPlansScreen({
  route,
  navigation,
  client: clientProp,
  onBack,
  onViewPlan,
  viewerRole = 'trainer', // 'trainer' | 'client'
}) {
  const { colors, isDark } = useTheme();
  const clientId = clientProp?.id || route?.params?.clientId;
  const clientName = clientProp?.name || route?.params?.clientName || 'Client';
  const [filter, setFilter] = useState('all'); // all | assigned | draft
  const { plans, loading, error, reload } = useClientWorkoutPlans(clientId);

  const handleViewPlan = useCallback((plan) => {
    if (onViewPlan) onViewPlan(plan);
  }, [onViewPlan]);

  const filteredPlans = useMemo(() => {
    if (filter === 'assigned') return plans.filter((p) => p.assigned);
    if (filter === 'draft') return plans.filter((p) => !p.assigned);
    return plans;
  }, [plans, filter]);

  const stats = useMemo(() => {
    const total = plans.length;
    const assigned = plans.filter((p) => p.assigned).length;
    const draft = total - assigned;
    return { total, assigned, draft };
  }, [plans]);

  const handleToggleAssigned = async (plan) => {
    if (!db || !clientId || !plan?.id) return;
    try {
      const nextAssigned = !plan.assigned;
      // Try to update based on where we loaded from
      if (plan._singleDoc && plan._path) {
        const ref = doc(db, ...plan._path);
        await setDoc(ref, { assigned: nextAssigned }, { merge: true });
      } else if (plan._source === 'usersSubcollection') {
        const ref = doc(db, 'users', clientId, 'workoutPlans', plan.id);
        await setDoc(ref, { assigned: nextAssigned }, { merge: true });
      } else {
        const ref = doc(db, 'workoutPlans', plan.id);
        await setDoc(ref, { assigned: nextAssigned }, { merge: true });
      }
      reload();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not update plan.');
    }
  };

  const handleDeletePlan = (plan) => {
    if (!db || !clientId || !plan?.id) return;
    Alert.alert('Delete plan', 'Are you sure you want to delete this workout plan?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (plan._singleDoc && plan._path) {
              const ref = doc(db, ...plan._path);
              await deleteDoc(ref);
            } else if (plan._source === 'usersSubcollection') {
              const ref = doc(db, 'users', clientId, 'workoutPlans', plan.id);
              await deleteDoc(ref);
            } else {
              const ref = doc(db, 'workoutPlans', plan.id);
              await deleteDoc(ref);
            }
            reload();
          } catch (e) {
            Alert.alert('Error', e?.message || 'Could not delete plan.');
          }
        },
      },
    ]);
  };

  const bg = isDark ? '#020617' : '#F9FAFB';
  const cardBg = isDark ? 'rgba(15,23,42,0.9)' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.5)';
  const text = isDark ? '#F9FAFB' : '#0F172A';

  const renderPlan = ({ item }) => {
    const assigned = !!item.assigned;
    const generatedAt = item.generatedAt?.toDate
      ? item.generatedAt.toDate()
      : item.generatedAt instanceof Date
      ? item.generatedAt
      : null;
    const dateStr = generatedAt
      ? generatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Unknown date';
    const exercisesCount = item.exercisesCount || item.exerciseCount || item.days?.reduce((acc, d) => acc + (d.exercises?.length || 0), 0);

    return (
      <View
        style={{
          backgroundColor: cardBg,
          borderColor,
          borderWidth: 1,
          borderRadius: 16,
          padding: 18,
          marginBottom: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: '700',
              color: text,
            }}
            numberOfLines={1}
          >
            {item.title || 'Workout Plan'}
          </Text>
          {viewerRole === 'trainer' ? (
            <TouchableOpacity
              onPress={() =>
                Alert.alert('Plan options', '', [
                  {
                    text: assigned ? 'Unassign from client' : 'Assign to client',
                    onPress: () => handleToggleAssigned(item),
                  },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDeletePlan(item) },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
              hitSlop={12}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color="rgba(148,163,184,0.9)" />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>

        <View style={{ flexDirection: 'row', marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
          <View
            style={{
              paddingVertical: 5,
              paddingHorizontal: 10,
              borderRadius: 6,
              backgroundColor: assigned ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.2)',
            }}
          >
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                color: assigned ? '#10B981' : 'rgba(226,232,240,0.9)',
              }}
            >
              {assigned ? 'Assigned' : 'Draft'}
            </Text>
          </View>
          {!!item.daysPerWeek && (
            <View
              style={{
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 6,
                backgroundColor: 'rgba(56,189,248,0.18)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#22D3EE' }}>
                {item.daysPerWeek} days/week
              </Text>
            </View>
          )}
          {!!item.difficulty && (
            <View
              style={{
                paddingVertical: 5,
                paddingHorizontal: 10,
                borderRadius: 6,
                backgroundColor: 'rgba(168,85,247,0.18)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#C084FC' }}>
                {String(item.difficulty)}
              </Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <Ionicons name="calendar-outline" size={12} color="rgba(148,163,184,0.9)" />
          <Text
            style={{
              marginLeft: 4,
              fontSize: 12,
              color: 'rgba(148,163,184,0.9)',
            }}
          >
            {dateStr}
          </Text>
          {exercisesCount ? (
            <>
              <Text style={{ marginHorizontal: 6, fontSize: 12, color: 'rgba(148,163,184,0.9)' }}>•</Text>
              <Ionicons name="barbell-outline" size={12} color="rgba(148,163,184,0.9)" />
              <Text
                style={{
                  marginLeft: 4,
                  fontSize: 12,
                  color: 'rgba(148,163,184,0.9)',
                }}
              >
                {exercisesCount} exercises
              </Text>
            </>
          ) : null}
        </View>

        {!!item.days?.length && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 6 }}>
            {item.days.map((day, index) => (
              <View
                key={day.label || index}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: 'rgba(148,163,184,0.18)',
                }}
              >
                <Text style={{ fontSize: 11, color: '#E5E7EB' }}>
                  Day {index + 1}
                  {day.label ? ` · ${day.label}` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ flexDirection: 'row', marginTop: 14, gap: 8 }}>
          <TouchableOpacity
            style={{
              flex: 1,
              height: 38,
              borderRadius: 10,
              backgroundColor: '#FF6B9D',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={() => handleViewPlan(item)}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>View Plan</Text>
          </TouchableOpacity>
          {viewerRole === 'trainer' ? (
            <TouchableOpacity
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                backgroundColor: 'rgba(148,163,184,0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={() => handleToggleAssigned(item)}
            >
              <Text style={{ color: '#E5E7EB', fontSize: 13, fontWeight: '600' }}>
                {assigned ? 'Unassign' : 'Assign to Client'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const headerBg = isDark ? '#020617' : '#FFFFFF';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <View
        style={{
          height: 56,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(148,163,184,0.25)',
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: headerBg,
        }}
      >
        <TouchableOpacity
          onPress={() => (onBack ? onBack() : navigation?.goBack())}
          hitSlop={12}
          style={{ padding: 4 }}
        >
          <Ionicons name="chevron-back" size={24} color={text} />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 16,
            fontWeight: '700',
            color: text,
          }}
          numberOfLines={1}
        >
          Workout Plans
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, paddingTop: 16 }}
      >
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View
            style={[
              styles.statCard,
              {
                borderLeftColor: '#FF6B9D',
              },
            ]}
          >
            <Text style={[styles.statLabel, { color: 'rgba(148,163,184,0.9)' }]}>Total plans</Text>
            <Text style={[styles.statValue, { color: '#FF6B9D' }]}>{stats.total}</Text>
          </View>
          <View
            style={[
              styles.statCard,
              {
                borderLeftColor: '#10B981',
              },
            ]}
          >
            <Text style={[styles.statLabel, { color: 'rgba(148,163,184,0.9)' }]}>Assigned</Text>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.assigned}</Text>
          </View>
          <View
            style={[
              styles.statCard,
              {
                borderLeftColor: 'rgba(148,163,184,0.8)',
              },
            ]}
          >
            <Text style={[styles.statLabel, { color: 'rgba(148,163,184,0.9)' }]}>Draft</Text>
            <Text style={[styles.statValue, { color: 'rgba(226,232,240,0.9)' }]}>{stats.draft}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', marginTop: 16, gap: 8 }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'assigned', label: 'Assigned' },
            { key: 'draft', label: 'Draft' },
          ].map((pill) => {
            const selected = filter === pill.key;
            return (
              <TouchableOpacity
                key={pill.key}
                onPress={() => setFilter(pill.key)}
                style={{
                  paddingHorizontal: 16,
                  height: 32,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: selected ? '#FF6B9D' : 'rgba(148,163,184,0.5)',
                  backgroundColor: selected ? '#FF6B9D' : 'rgba(15,23,42,0.6)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: selected ? '#FFFFFF' : 'rgba(226,232,240,0.9)',
                  }}
                >
                  {pill.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
            <ActivityIndicator size="large" color="#FF6B9D" />
            <Text style={{ marginTop: 10, color: 'rgba(148,163,184,0.9)' }}>Loading plans…</Text>
          </View>
        )}

        {error && !loading && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
            <Text style={{ color: '#F97373', textAlign: 'center', marginBottom: 8 }}>{error}</Text>
            <TouchableOpacity
              onPress={reload}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: '#FF6B9D',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !error && filteredPlans.length === 0 && (
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 56 }}>
            <Ionicons name="barbell-outline" size={48} color="rgba(148,163,184,0.7)" />
            <Text
              style={{
                marginTop: 12,
                fontSize: 16,
                fontWeight: '700',
                color: text,
              }}
            >
              No workout plans yet
            </Text>
            <Text
              style={{
                marginTop: 6,
                fontSize: 13,
                color: 'rgba(148,163,184,0.9)',
              }}
            >
              Add a workout plan from your generator.
            </Text>
          </View>
        )}

        {!loading && !error && filteredPlans.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <FlatList
              data={filteredPlans}
              keyExtractor={(item) => item.id}
              renderItem={renderPlan}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(30,64,175,0.6)',
    borderLeftWidth: 3,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
});

