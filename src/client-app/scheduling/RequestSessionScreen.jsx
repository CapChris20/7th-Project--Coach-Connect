// Design Law client “Request a session” form (scheduling PNG 21/22).
// Flow: pick day with open times → time chip → length / where → notes → write pending session.
// Used from My sessions CTA. Writes under trainer_clients/{trainerId}/sessions (same keys as trainer).
//
// vocab: requestedBy = 'client' marks invite originated from trainee (trainer still confirms)
// Manipulate here: TIME_SLOTS, DURATIONS, week length

import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { addDays, format, startOfWeek } from 'date-fns';
import { db } from '../../app-start/cloudConnection';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbButton from '../../look-and-feel/NbButton';
import NbChip from '../../look-and-feel/NbChip';
import NbSegmented from '../../look-and-feel/NbSegmented';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { nb, spacing } from '../../look-and-feel/colorPalette';
import { getLocalDateKey } from '../../helpers/getLocalDay';

// ===== NAMED CONSTANTS =====

const SCROLL_BOTTOM_PAD = 48;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DURATIONS = [
  { id: '30', label: '30' },
  { id: '45', label: '45' },
  { id: '60', label: '60 min' },
];
const WHERE_OPTIONS = [
  { id: 'in-person', label: 'In person' },
  { id: 'video', label: 'Video link' },
];
// Manipulate here: default open slots shown on the request form
const TIME_SLOTS = ['7:00 AM', '12:15 PM', '5:30 PM', '6:30 PM', '7:30 PM'];

// ===== HELPERS =====

function generateWeekDates(anchor) {
  const weekStart = startOfWeek(anchor, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function dateKeyFromDate(dateValue) {
  return format(dateValue, 'yyyy-MM-dd');
}

function parseDisplayTimeTo24(displayTime) {
  const match = String(displayTime).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '18:30';
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function firstName(fullName) {
  const text = String(fullName || 'your trainer').trim();
  return text.split(/\s+/)[0] || text;
}

// ===== MAIN =====

/**
 * @param {{
 *   clientId: string,
 *   trainerId: string|null,
 *   trainerName?: string,
 *   onBack: Function,
 *   onSubmitted?: Function,
 * }} props
 */
export default function RequestSessionScreen({
  clientId,
  trainerId,
  trainerName,
  onBack,
  onSubmitted,
}) {
  const { colors } = useTheme();
  const scrollBottomPad = useShellBottomNavInset(SCROLL_BOTTOM_PAD);
  const coachFirst = firstName(trainerName);

  const [weekAnchor] = useState(() => new Date());
  const weekDates = useMemo(() => generateWeekDates(weekAnchor), [weekAnchor]);
  const [selectedDateKey, setSelectedDateKey] = useState(() => getLocalDateKey());
  const [selectedTime, setSelectedTime] = useState('6:30 PM');
  const [duration, setDuration] = useState('60');
  const [whereOption, setWhereOption] = useState('in-person');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message, extras = {}) => setNotice({ title, message, ...extras });

  const dayLabel = useMemo(() => {
    try {
      const d = weekDates.find((day) => dateKeyFromDate(day) === selectedDateKey);
      if (!d) return selectedDateKey;
      return format(d, 'EEE, MMM d').toUpperCase();
    } catch (_e) {
      return selectedDateKey;
    }
  }, [selectedDateKey, weekDates]);

  const handleSubmit = async () => {
    if (!clientId || !trainerId || !db) {
      showNotice('No trainer', 'Link a trainer before requesting a session.');
      return;
    }
    setSubmitting(true);
    try {
      const time24 = parseDisplayTimeTo24(selectedTime);
      const durationMin = parseInt(duration, 10) || 60;
      await addDoc(collection(db, `trainer_clients/${trainerId}/sessions`), {
        trainerId,
        clientId,
        date: selectedDateKey,
        time: time24,
        durationMin,
        status: 'pending',
        requestedBy: 'client',
        notes: notes.trim() || undefined,
        title: 'Session request',
        focus: 'Session request',
        zoomLink: whereOption === 'video' ? 'https://zoom.us/j/placeholder' : undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onSubmitted?.();
      onBack?.();
    } catch (e) {
      showNotice('Could not send', e?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <NbPageHeader
        title="Request a session"
        subtitle={`Open times from ${coachFirst}`}
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        <View style={styles.weekStrip}>
          {weekDates.map((date) => {
            const id = dateKeyFromDate(date);
            const selected = id === selectedDateKey;
            const ink = selected ? colors.nbOnFill : colors.nbInk;
            return (
              <NbChip
                key={id}
                selected={selected}
                onPress={() => setSelectedDateKey(id)}
                style={styles.weekChip}
                contentStyle={styles.weekChipInner}
              >
                <View style={styles.weekChipContent}>
                  <Text style={[styles.weekDay, { color: ink }]}>
                    {WEEKDAY_LABELS[date.getDay()]}
                  </Text>
                  <Text style={[styles.weekDate, { color: ink }]}>{format(date, 'd')}</Text>
                  <View
                    style={[
                      styles.dot,
                      { borderColor: ink, backgroundColor: selected ? ink : 'transparent' },
                    ]}
                  />
                </View>
              </NbChip>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.nbMuted }]}>
          {`A dot means ${coachFirst} has open times that day.`}
        </Text>

        <Text style={[styles.label, { color: colors.nbMuted }]}>{dayLabel}</Text>
        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((time) => (
            <NbChip
              key={time}
              selected={selectedTime === time}
              onPress={() => setSelectedTime(time)}
              style={styles.timeChip}
            >
              {time}
            </NbChip>
          ))}
        </View>

        <Text style={[styles.label, { color: colors.nbMuted }]}>LENGTH</Text>
        <NbSegmented segments={DURATIONS} selected={duration} onSelect={setDuration} />

        <Text style={[styles.label, { color: colors.nbMuted }]}>WHERE</Text>
        <NbSegmented segments={WHERE_OPTIONS} selected={whereOption} onSelect={setWhereOption} />

        <Text style={[styles.label, { color: colors.nbMuted }]}>NOTES</Text>
        <TextInput
          style={[
            styles.notes,
            {
              borderColor: colors.nbBorder,
              color: colors.nbInk,
              backgroundColor: colors.nbSurface,
            },
          ]}
          placeholder="Want to check squat depth."
          placeholderTextColor={colors.nbMuted}
          multiline
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />

        <NbButton variant="fill" onPress={handleSubmit} disabled={submitting}>
          {submitting ? 'Sending…' : 'Request session'}
        </NbButton>
        <Text style={[styles.disclaimer, { color: colors.nbMuted }]}>
          {`${coachFirst} confirms or suggests another time. You are told either way.`}
        </Text>
      </ScrollView>
      <NbNoticeSheet
        visible={!!notice}
        onClose={() => setNotice(null)}
        title={notice?.title || ''}
        message={notice?.message}
        confirmLabel={notice?.confirmLabel || 'OK'}
        cancelLabel={notice?.cancelLabel}
        onConfirm={notice?.onConfirm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  weekStrip: { flexDirection: 'row', gap: 6 },
  weekChip: { flex: 1, minWidth: 0 },
  weekChipInner: {
    minHeight: 68,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: '100%',
  },
  weekChipContent: { alignItems: 'center', gap: 2 },
  weekDay: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  weekDate: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    marginTop: 4,
  },
  hint: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.1,
  },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { minWidth: '30%' },
  notes: {
    borderWidth: nb.borderWidth,
    borderRadius: 14,
    minHeight: 88,
    padding: 14,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
  },
  disclaimer: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
