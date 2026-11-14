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
const FALLBACK_MOOD_ID = 'tired';
const NOTE_SECTION_LABEL = 'WHAT IS BEHIND IT? (OPTIONAL)';
const PRIVACY_LINE = 'Only your coach reads this note.';
const SAVE_LABEL = 'Save mood';
const SAVING_LABEL = 'Saving…';

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

// ===== HELPER FUNCTIONS =====

function moodIdIsKnown(moodId) {
  for (let index = 0; index < MOOD_TILES.length; index += 1) {
    const tile = MOOD_TILES[index];
    if (tile.id === moodId) {
      return true;
    }
  }
  return false;
}

// Accept a prop mood id if it is one of the five tiles; otherwise fall back to tired.
function moodIdFromProp(initialMood) {
  const normalized = String(initialMood || '').toLowerCase();
  if (moodIdIsKnown(normalized)) {
    return normalized;
  }
  return FALLBACK_MOOD_ID;
}

// Selected tiles invert to fill/onFill so the checkmark stays readable.
function tileColorsWhenSelected(isSelected, colors) {
  if (isSelected) {
    return {
      fill: colors.nbFill,
      ink: colors.nbOnFill,
      muted: colors.nbOnFill,
    };
  }
  return {
    fill: colors.nbSurface,
    ink: colors.nbInk,
    muted: colors.nbMuted,
  };
}

function pressOffsetStyle(pressed) {
  if (pressed) {
    return {
      opacity: 0.94,
      transform: [{ translateX: 2 }, { translateY: 2 }],
    };
  }
  return {
    opacity: 1,
    transform: [{ translateX: 0 }, { translateY: 0 }],
  };
}

// ===== SMALL UI PIECES =====

function MoodPickTile({ tile, selected, colors, onPress }) {
  const tileColors = tileColorsWhenSelected(selected, colors);
  const fill = tileColors.fill;
  const ink = tileColors.ink;
  const muted = tileColors.muted;

  let checkmark = null;
  if (selected) {
    checkmark = (
      <View style={styles.checkAbs}>
        <Ionicons name="checkmark" size={16} color={ink} />
      </View>
    );
  }

  function buildPressableStyle({ pressed }) {
    const pressLook = pressOffsetStyle(pressed);
    return [
      styles.tile,
      {
        backgroundColor: fill,
        borderColor: colors.nbBorder,
        shadowColor: colors.nbShadow,
        opacity: pressLook.opacity,
        transform: pressLook.transform,
      },
    ];
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={buildPressableStyle}
    >
      {checkmark}
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

function MoodTileGrid({ colors, selectedMoodId, onPickMood }) {
  const tileNodes = [];

  for (let index = 0; index < MOOD_TILES.length; index += 1) {
    const tile = MOOD_TILES[index];
    const isSelected = selectedMoodId === tile.id;

    tileNodes.push(
      <MoodPickTile
        key={tile.id}
        tile={tile}
        selected={isSelected}
        colors={colors}
        onPress={function onPressTile() {
          onPickMood(tile.id);
        }}
      />,
    );
  }

  return <View style={styles.grid}>{tileNodes}</View>;
}

function MoodNoteField({ colors, note, onNoteChange }) {
  const noteBoxStyle = [
    styles.noteBox,
    {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface,
      color: colors.nbInk,
    },
  ];

  return (
    <>
      <Text style={[styles.noteLabel, { color: colors.nbMuted }]}>{NOTE_SECTION_LABEL}</Text>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <TextInput
          style={noteBoxStyle}
          value={note}
          onChangeText={onNoteChange}
          placeholder="Long day at work and a poor night of sleep."
          placeholderTextColor={colors.nbMuted}
          multiline
          textAlignVertical="top"
        />
      </HardShadow>
      <Text style={[styles.privacy, { color: colors.nbMuted }]}>{PRIVACY_LINE}</Text>
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen mood check-in: five tiles + optional note, dual-write on Save.
 * @param {{ userId?: string|null, initialMood?: string, initialNote?: string, onBack?: Function }} props
 */
export default function MoodCheckInScreen({
  userId: userIdProp,
  initialMood = 'tired',
  initialNote = '',
  onBack,
}) {
  // 1. Theme + who we write for + today's date key.
  const { colors } = useTheme();
  const clientUserId = userIdProp || auth?.currentUser?.uid || null;
  const todayDateKey = getClientDateKey();

  // 2. Starting mood from the prop (must be one of the five tile ids).
  const startingMoodId = useMemo(() => moodIdFromProp(initialMood), [initialMood]);

  // 3. Local mood id + optional note + saving lock.
  // Keep hook order: useMemo above, then these three useState calls.
  const [mood, setMood] = useState(startingMoodId);
  const [note, setNote] = useState(String(initialNote || ''));
  const [saving, setSaving] = useState(false);

  const rootStyle = [styles.root, { backgroundColor: colors.nbBackground }];

  let saveButtonLabel = SAVE_LABEL;
  if (saving) {
    saveButtonLabel = SAVING_LABEL;
  }

  // 4. Save — mood_logs doc + dashboard_mood in daily metrics (same as LogMoodPopup).
  async function saveMood() {
    // 1. Need Firebase + user; ignore double-taps while saving
    if (!clientUserId || !db || saving) {
      return;
    }

    setSaving(true);
    try {
      // 2. Write mood_logs doc and dashboard_mood in daily metrics (parallel)
      await writeMoodCheckInToFirestore(clientUserId, todayDateKey, mood, note);
      // 3. Close this full-screen check-in
      if (onBack) {
        onBack();
      }
    } catch (error) {
      console.warn('MoodCheckInScreen save:', error?.message);
    } finally {
      setSaving(false);
    }
  }

  // 5. Header → tile grid → optional note → Save.
  return (
    <SafeAreaView style={rootStyle} edges={SHELL_SAFE_AREA_EDGES}>
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
        <MoodTileGrid colors={colors} selectedMoodId={mood} onPickMood={setMood} />

        <MoodNoteField colors={colors} note={note} onNoteChange={setNote} />

        <NbButton
          variant="fill"
          onPress={saveMood}
          disabled={saving}
          style={{ marginTop: spacing.lg }}
        >
          {saveButtonLabel}
        </NbButton>
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== PLUMBING — skip unless debugging =====

// Same dual write LogMoodPopup → executeLogMoodClient uses (mood_logs + daily metrics).
async function writeMoodCheckInToFirestore(userId, dateKey, moodId, noteText) {
  const trimmedNote = String(noteText || '').trim();

  // vocab: serverTimestamp = Firestore server clock, not the phone clock
  // vocab: setDoc merge:true = create or patch; do not wipe other fields on the doc
  await Promise.all([
    setDoc(
      doc(db, USERS_COLLECTION, userId, MOOD_LOGS_COLLECTION, dateKey),
      {
        mood: moodId,
        notes: trimmedNote,
        date: dateKey,
        logged_at: serverTimestamp(),
      },
      { merge: true },
    ),
    mergeClientDailyMetrics(userId, dateKey, {
      logs: { dashboard_mood: moodId },
      tracking: { mood: moodId },
    }),
  ]);
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
