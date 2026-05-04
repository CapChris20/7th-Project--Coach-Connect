import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export function WorkoutCard({
  status = 'awaiting',
  scheduledTime = '6:00 PM',
  workoutName = 'Upper Body Strength',
  duration = '52 min',
  focus = 'Push / Chest',
  intensity = 'High',
}) {
  const isLogged = status === 'logged';

  const borderGradient = isLogged
    ? ['#10b981', '#06b6d4'] // Green → Cyan (logged)
    : ['#a78bfa', '#06b6d4']; // Purple → Cyan (awaiting)

  const accentColor = isLogged ? '#10b981' : '#a78bfa';

  return (
    <LinearGradient
      colors={borderGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.border}
    >
      <View style={styles.card}>
        {/* Header: Icon + Title + Badge */}
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <View style={[styles.iconContainer, { backgroundColor: `${accentColor}22` }]}>
              <Ionicons name="barbell" size={24} color={accentColor} weight="bold" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>TODAY'S WORKOUT</Text>
              <Text style={styles.title}>{isLogged ? workoutName : 'Awaiting Check-in'}</Text>
            </View>
          </View>

          <View style={[styles.badge, { backgroundColor: `${accentColor}22` }]}>
            <Ionicons
              name={isLogged ? 'checkmark-circle' : 'time'}
              size={14}
              color={accentColor}
              weight="bold"
            />
            <Text style={[styles.badgeText, { color: accentColor }]}>
              {isLogged ? 'Logged' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.details}>
          {isLogged ? (
            <>
              <Stat label="DURATION" value={duration} color="#06b6d4" />
              <Stat label="FOCUS" value={focus} color="#a78bfa" />
              <Stat label="INTENSITY" value={intensity} color="#fcd34d" icon="flash" />
            </>
          ) : (
            <>
              <Stat label="CLIENT" value="Hasn't logged yet" color="rgba(255,255,255,0.5)" />
              <Stat label="SCHEDULED" value={scheduledTime} color="#06b6d4" icon="time" />
            </>
          )}
        </View>
      </View>
    </LinearGradient>
  );
}

function Stat({ label, value, color, icon }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        {icon ? <Ionicons name={icon} size={14} color={color} weight="bold" /> : null}
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  border: {
    borderRadius: 20,
    padding: 2,
  },
  card: {
    borderRadius: 18,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  details: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  stat: {
    minWidth: 110,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});

