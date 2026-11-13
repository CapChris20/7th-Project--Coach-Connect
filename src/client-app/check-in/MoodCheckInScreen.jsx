// Design Law Mood check-in — 5 mood tiles + optional note (missing-screens 09/10).
// Flow: pick a mood tile → optional note → Save writes mood_logs + dashboard_mood (same as LogMoodPopup).
// Used by CLIENT_ROUTES.MoodCheckIn. Mood ids: happy | okay | tired | stressed | anxious.

import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbButton from '../../look-and-feel/NbButton';
import HardShadow from '../../look-and-feel/HardShadow';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';
import { auth, db } from '../../app-start/cloudConnection';
import { mergeClientDailyMetrics } from '../../daily-stats/saveDailyStats';
import { getClientDateKey } from '../../helpers/dateStrings';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const MOOD_LOGS_COLLECTION = 'mood_logs';

// Manipulate here: tile copy + icons must match PNG 09/10; ids must match LogMoodPopup / carryOutAction
const MOOD_TILES = [
  {
    id: 'happy',
    label: 'Happy',
    sub: 'Good energy',
    icon: require('../../assets/icons/handoff/energy.png'),
    gradient: accentGradients[0],
  },
  {
    id: 'okay',
    label: 'Okay',
    sub: 'Steady',
    icon: require('../../assets/icons/handoff/progress.png'),
    gradient: accentGradients[1],
  },
  {
    id: 'tired',
    label: 'Tired',
    sub: 'Low battery',
    icon: require('../../assets/icons/handoff/sleeping.png'),
    gradient: accentGradients[2],
  },
  {
    id: 'stressed',
    label: 'Stressed',
    sub: 'Wound up',
    icon: require('../../assets/icons/handoff/stress.png'),
    gradient: accentGradients[3],
  },
  {
    id: 'anxious',
    label: 'Anxious',
    sub: 'On edge',
    icon: require('../../assets/icons/handoff/injury.png'),
    gradient: accentGradients[4],
  },
];

// ===== UI PIECES =====

function MoodTile({ tile, selected, colors, onPress }) {
  const fill = selected ? colors.nbFill : colors.nbSurface;
  const ink = selected ? colors.nbOnFill : colors.nbInk;
  const muted = selected ? colors.nbOnFill : colors.nbMuted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: fill,
          borderColor: colors.nbBorder,
          shadowColor: colors.nbShadow,
          opacity: pressed ? 0.94 : 1,
          transform: [{ translateX: pressed ? 2 : 0 }, { translateY: pressed ? 2 : 0 }],
        },
      ]}
    >
      {selected ? (
        <View style={styles.checkAbs}>
          <Ionicons name="checkmark" size={16} color={ink} />
        </View>
      ) : null}
      <View style={[styles.iconChip, { borderColor: colors.nbBorder }]}>
        <LinearGradient
          colors={tile.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Image source={tile.icon} style={styles.iconImg} resizeMode="contain" />
      </View>
      <Text style={[styles.tileLabel, { color: ink }]}>{tile.label}</Text>
      <Text style={[styles.tileSub, { color: muted }]}>{tile.sub}</Text>
    </Pressable>
  );
}

// ===== MAIN =====

/**
 * @param {{ userId?: string|null, initialMood?: string, initialNote?: string, onBack?: Function }} props
 */
export default function MoodCheckInScreen({
  userId: userIdProp,
  initialMood = 'tired',
  initialNote = '',
  onBack,
}) {
  const { colors } = useTheme();
  const uid = userIdProp || auth?.currentUser?.uid || null;
  const dateKey = getClientDateKey();

  const validInitial = useMemo(() => {
    const id = String(initialMood || '').toLowerCase();
    return MOOD_TILES.some((t) => t.id === id) ? id : 'tired';
  }, [initialMood]);

  const [mood, setMood] = useState(validInitial);
  const [note, setNote] = useState(String(initialNote || ''));
  const [saving, setSaving] = useState(false);

  const saveMood = async () => {
    if (!uid || !db || saving) return;
    setSaving(true);
    try {
      const trimmed = String(note || '').trim();
      // Same dual write LogMoodPopup → executeLogMoodClient uses (mood_logs + daily metrics)
      await Promise.all([
        setDoc(
          doc(db, USERS_COLLECTION, uid, MOOD_LOGS_COLLECTION, dateKey),
          {
            mood,
            notes: trimmed,
            date: dateKey,
            logged_at: serverTimestamp(),
          },
          { merge: true },
        ),
        mergeClientDailyMetrics(uid, dateKey, {
          logs: { dashboard_mood: mood },
          tracking: { mood },
        }),
      ]);
      onBack?.();
    } catch (err) {
      console.warn('MoodCheckInScreen save:', err?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader
        title="Mood check-in"
        subtitle="How are you feeling?"
        onBack={onBack}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {MOOD_TILES.map((tile) => (
            <MoodTile
              key={tile.id}
              tile={tile}
              selected={mood === tile.id}
              colors={colors}
              onPress={() => setMood(tile.id)}
            />
          ))}
        </View>

        <Text style={[styles.noteLabel, { color: colors.nbMuted }]}>
          WHAT IS BEHIND IT? (OPTIONAL)
        </Text>
        <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
          <TextInput
            style={[
              styles.noteBox,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
                color: colors.nbInk,
              },
            ]}
            value={note}
            onChangeText={setNote}
            placeholder="Long day at work and a poor night of sleep."
            placeholderTextColor={colors.nbMuted}
            multiline
            textAlignVertical="top"
          />
        </HardShadow>
        <Text style={[styles.privacy, { color: colors.nbMuted }]}>
          Only your coach reads this note.
        </Text>

        <NbButton
          variant="fill"
          onPress={saveMood}
          disabled={saving}
          style={{ marginTop: spacing.lg }}
        >
          {saving ? 'Saving…' : 'Save mood'}
        </NbButton>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: nb.screenGutter,
    paddingBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Manipulate here: gap between mood tiles (PNG ~10–12)
    gap: 12,
  },
  tile: {
    width: '47%',
    flexGrow: 0,
    flexShrink: 0,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    minHeight: 118,
    shadowOffset: { width: nb.shadowOffsetCard, height: nb.shadowOffsetCard },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  checkAbs: { position: 'absolute', top: 10, right: 10 },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconImg: { width: 22, height: 22 },
  tileLabel: { fontSize: 16, fontWeight: '900' },
  tileSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  noteLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.0,
    marginTop: spacing.lg,
    marginBottom: 8,
  },
  noteBox: {
    minHeight: 100,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  privacy: { fontSize: 12, fontWeight: '600', marginTop: 8 },
});
