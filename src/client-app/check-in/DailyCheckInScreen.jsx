// Design Law Daily check-in — soreness / energy / stress sliders + mood chips + note (07/08).
// Flow: hydrate today's dashboard_* metrics → edit locally → Save writes same keys as home card.
// Used by CLIENT_ROUTES.DailyCheckIn. Preserve storage keys: dashboard_soreness / energy / stress / mood / notes.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, onSnapshot } from 'firebase/firestore';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbButton from '../../look-and-feel/NbButton';
import NbSlider from '../../look-and-feel/NbSlider';
import NbProgressSteps from '../../look-and-feel/NbProgressSteps';
import HardShadow from '../../look-and-feel/HardShadow';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';
import { auth, db } from '../../app-start/cloudConnection';
import { saveDashboardMetricField } from '../../daily-stats/saveDailyStats';
import { getClientDateKey } from '../../helpers/dateStrings';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const TOTAL_SLOTS = 5;
const MOOD_CHIPS = ['Happy', 'Okay', 'Tired', 'Stressed', 'Anxious'];
// Same index map ClientHomeBlocks uses so home + this screen stay in sync
const MOOD_CHIP_TO_INDEX = { Happy: 4, Okay: 2, Tired: 1, Stressed: 0, Anxious: 0 };

// ===== HELPERS =====

function moodLabelFromSaved(moodRaw) {
  if (moodRaw == null || moodRaw === '') return null;
  const asNum = Number(moodRaw);
  if (Number.isFinite(asNum)) {
    return MOOD_CHIPS.find((c) => MOOD_CHIP_TO_INDEX[c] === asNum) || null;
  }
  const asWord = String(moodRaw).trim();
  const hit = MOOD_CHIPS.find((c) => c.toLowerCase() === asWord.toLowerCase());
  return hit || null;
}

function countDone({ soreness, energy, stress, mood, note }) {
  let n = 0;
  if (soreness != null && soreness !== '') n += 1;
  if (energy != null && energy !== '') n += 1;
  if (stress != null && stress !== '') n += 1;
  if (mood) n += 1;
  if (String(note || '').trim()) n += 1;
  return n;
}

// ===== MAIN =====

/**
 * @param {{
 *   userId?: string|null,
 *   trainerFirstName?: string,
 *   onBack?: Function,
 * }} props
 */
export default function DailyCheckInScreen({
  userId: userIdProp,
  trainerFirstName = '',
  onBack,
}) {
  const { colors } = useTheme();
  const uid = userIdProp || auth?.currentUser?.uid || null;
  const dateKey = getClientDateKey();

  const [soreness, setSoreness] = useState(3);
  const [energy, setEnergy] = useState(6);
  const [stress, setStress] = useState(4);
  const [mood, setMood] = useState('Okay');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState({
    soreness: false,
    energy: false,
    stress: false,
    mood: false,
  });
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Live hydrate from dailyLogs so reopening the screen shows today's values
  useEffect(() => {
    if (!db || !uid) {
      setHydrated(true);
      return undefined;
    }
    const ref = doc(db, USERS_COLLECTION, uid, DAILY_LOGS_COLLECTION, dateKey);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setHydrated(true);
          return;
        }
        const data = snap.data() || {};
        if (data.dashboard_soreness != null && data.dashboard_soreness !== '') {
          setSoreness(Number(data.dashboard_soreness) || 3);
          setTouched((t) => ({ ...t, soreness: true }));
        }
        if (data.dashboard_energy != null && data.dashboard_energy !== '') {
          setEnergy(Number(data.dashboard_energy) || 6);
          setTouched((t) => ({ ...t, energy: true }));
        }
        if (data.dashboard_stress != null && data.dashboard_stress !== '') {
          setStress(Number(data.dashboard_stress) || 4);
          setTouched((t) => ({ ...t, stress: true }));
        }
        const moodHit = moodLabelFromSaved(data.dashboard_mood);
        if (moodHit) {
          setMood(moodHit);
          setTouched((t) => ({ ...t, mood: true }));
        }
        if (data.dashboard_notes) setNote(String(data.dashboard_notes));
        setHydrated(true);
      },
      () => setHydrated(true),
    );
  }, [uid, dateKey]);

  const doneCount = useMemo(() => {
    return countDone({
      soreness: touched.soreness ? soreness : null,
      energy: touched.energy ? energy : null,
      stress: touched.stress ? stress : null,
      mood: touched.mood ? mood : null,
      note,
    });
  }, [soreness, energy, stress, mood, note, touched]);

  // vocab: NbProgressSteps current is 1-indexed; fraction fills the active segment
  const progressCurrent = Math.min(TOTAL_SLOTS, Math.max(1, doneCount || 1));
  const progressFraction = doneCount === 0 ? 0.25 : doneCount >= TOTAL_SLOTS ? 1 : 0.7;

  const noteLabel = trainerFirstName
    ? `NOTE TO ${String(trainerFirstName).toUpperCase()}`
    : 'NOTE TO TRAINER';

  const saveCheckIn = async () => {
    if (!uid || saving) return;
    setSaving(true);
    try {
      const writes = [
        saveDashboardMetricField(uid, 'dashboard_soreness', String(soreness), dateKey),
        saveDashboardMetricField(uid, 'dashboard_energy', String(energy), dateKey),
        saveDashboardMetricField(uid, 'dashboard_stress', String(stress), dateKey),
        saveDashboardMetricField(
          uid,
          'dashboard_mood',
          String(MOOD_CHIP_TO_INDEX[mood] ?? 2),
          dateKey,
        ),
      ];
      if (String(note || '').trim()) {
        writes.push(
          saveDashboardMetricField(uid, 'dashboard_notes', String(note).trim(), dateKey),
        );
      }
      await Promise.all(writes);
      onBack?.();
    } catch (err) {
      console.warn('DailyCheckInScreen save:', err?.message);
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
        title="Daily check-in"
        subtitle={`${doneCount} of ${TOTAL_SLOTS} done`}
        onBack={onBack}
      />
      <View style={styles.progressWrap}>
        <NbProgressSteps
          total={4}
          current={progressCurrent > 4 ? 5 : progressCurrent}
          fraction={progressFraction}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!hydrated ? (
          <Text style={{ color: colors.nbMuted, fontWeight: '600' }}>Loading…</Text>
        ) : (
          <>
            <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
              <View
                style={[
                  styles.sliderCard,
                  { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                ]}
              >
                <NbSlider
                  label="Muscle soreness"
                  valueLabel={`${soreness}/8`}
                  value={soreness}
                  min={1}
                  max={8}
                  colors={accentGradients[1]}
                  onChange={(n) => {
                    setSoreness(n);
                    setTouched((t) => ({ ...t, soreness: true }));
                  }}
                  style={{ marginBottom: 14 }}
                />
                <NbSlider
                  label="Energy level"
                  valueLabel={`${energy}/8`}
                  value={energy}
                  min={1}
                  max={8}
                  colors={accentGradients[0]}
                  onChange={(n) => {
                    setEnergy(n);
                    setTouched((t) => ({ ...t, energy: true }));
                  }}
                  style={{ marginBottom: 14 }}
                />
                <NbSlider
                  label="Stress level"
                  valueLabel={`${stress}/8`}
                  value={stress}
                  min={1}
                  max={8}
                  colors={accentGradients[2]}
                  onChange={(n) => {
                    setStress(n);
                    setTouched((t) => ({ ...t, stress: true }));
                  }}
                />
              </View>
            </HardShadow>

            <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>MOOD</Text>
            <View style={styles.moodRow}>
              {MOOD_CHIPS.map((chip) => {
                const selected = mood === chip && touched.mood;
                return (
                  <TouchableOpacity
                    key={chip}
                    onPress={() => {
                      setMood(chip);
                      setTouched((t) => ({ ...t, mood: true }));
                    }}
                    style={[
                      styles.moodChip,
                      {
                        borderColor: colors.nbBorder,
                        backgroundColor: selected ? colors.nbFill : colors.nbSurface,
                        shadowColor: colors.nbShadow,
                      },
                      selected && styles.moodChipShadow,
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '900',
                        color: selected ? colors.nbOnFill : colors.nbInk,
                      }}
                    >
                      {chip}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{noteLabel}</Text>
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
              placeholder="Slept badly, long day at work."
              placeholderTextColor={colors.nbMuted}
              multiline
              textAlignVertical="top"
            />

            <NbButton
              variant="fill"
              onPress={saveCheckIn}
              disabled={saving}
              style={{ marginTop: spacing.lg }}
            >
              {saving ? 'Saving…' : 'Save check-in'}
            </NbButton>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  progressWrap: {
    paddingHorizontal: nb.screenGutter,
    marginBottom: spacing.sm,
  },
  scroll: {
    paddingHorizontal: nb.screenGutter,
    paddingBottom: spacing.xl,
  },
  sliderCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: spacing.md,
    marginBottom: 8,
  },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  moodChipShadow: {
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  noteBox: {
    minHeight: 96,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
});
