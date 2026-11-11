// Schedule / edit a training session: neobrutalist date chips, time slots, duration/where segmented controls.
// Flow: load editing session if any → pick date/time/duration/location → create or update via mySessions hooks.
// Used from the trainer calendar tab and client scheduling entry points.
//
// vocab: neobrutalist = thick outlines, hard shadows, gradient when active. Replaced wheel pickers with chip grids.

import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { ArrowLeft } from 'lucide-react-native';
import { format, addDays, startOfWeek, set as setDateParts } from 'date-fns';
import { FORM_SCROLL_PROPS, useModalScrollBottomPad } from '../../navigation/bottomMenuSpacing';
import {
  useCreateTrainingSession,
  useUpdateTrainingSession,
  useDeleteTrainingSession,
  useGetTrainingSession,
} from '../scheduling/mySessions';
import NbChip from '../../look-and-feel/NbChip';
import NbSegmented from '../../look-and-feel/NbSegmented';
import NbButton from '../../look-and-feel/NbButton';
import { lightColors, darkColors, nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: default session length and available time slots
const DEFAULT_DURATION_MIN = 60;
const SCROLL_BOTTOM_PAD = 80; // Extra space for sticky CTA

// Duration options (30/45/60/90 min)
const DURATIONS = [
  { id: '30', label: '30m', min: 30 },
  { id: '45', label: '45m', min: 45 },
  { id: '60', label: '60m', min: 60 },
  { id: '90', label: '90m', min: 90 },
];

// Where options (In person/Video)
const WHERE_OPTIONS = [
  { id: 'in-person', label: 'In person' },
  { id: 'video', label: 'Video' },
];

// Common time slots (3-column grid)
const TIME_SLOTS = [
  '6:00 AM', '7:00 AM', '7:30 AM', '8:00 AM', '9:00 AM', '9:30 AM',
  '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM',
  '4:00 PM', '4:30 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM',
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ===== HELPER FUNCTIONS =====

// Parse 24-hour time string to display format (e.g. "14:30" → "2:30 PM")
function parseTime24ToDisplay(timeStr) {
  if (!timeStr) return '9:00 AM';
  const [hStr, mStr] = String(timeStr).split(':');
  const h24 = parseInt(hStr, 10);
  const minute = parseInt(mStr || '0', 10);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 || 12;
  const minuteStr = String(minute).padStart(2, '0');
  return `${hour12}:${minuteStr} ${period}`;
}

// Parse display time to 24-hour format (e.g. "2:30 PM" → "14:30")
function parseDisplayTimeTo24(displayTime) {
  const match = displayTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '09:00';
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const period = match[3].toUpperCase();
  
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

// Generate week strip starting from today
function generateWeekDates(startDate) {
  const weekStart = startOfWeek(startDate, { weekStartsOn: 0 }); // Sunday
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

// ===== MAIN FUNCTION =====

/**
 * Neobrutalist session scheduler: date chip strip, time-slot grid, segmented controls, sticky CTA.
 * @param {object} [props]
 */
export function ScheduleSessionScreen(props = {}) {
  const route = useContext(NavigationRouteContext);
  const navigation = useContext(NavigationContext);
  const routeParams = route?.params ?? {};

  const clientId =
    props.clientId ?? props.initialClientId ?? routeParams.clientId ?? routeParams.initialClientId;
  const clientName = props.clientName ?? routeParams.clientName ?? 'Client';
  const sessionId = props.sessionId ?? routeParams.sessionId;
  const initialDate = props.initialDate ?? routeParams.initialDate ?? routeParams.date;
  const onNavigate = props.onNavigate;
  const embedded = props.embedded === true;

  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const scrollBottomPad = useModalScrollBottomPad(SCROLL_BOTTOM_PAD);

  const createSession = useCreateTrainingSession();
  const updateSession = useUpdateTrainingSession();
  const deleteSession = useDeleteTrainingSession();
  const getSession = useGetTrainingSession();

  const editing = sessionId ? getSession(sessionId) : undefined;
  const isEdit = Boolean(editing);
  const today = useMemo(() => new Date(), []);

  // Parse initial date from editing session or route params
  const initDate = useMemo(() => {
    if (editing?.date) return new Date(`${editing.date}T12:00:00`);
    if (initialDate) return new Date(`${String(initialDate).slice(0, 10)}T12:00:00`);
    return today;
  }, [editing, initialDate, today]);

  // State: selected date (Date object), selected time (display string), duration, where, notes
  const [selectedDate, setSelectedDate] = useState(initDate);
  const [selectedTime, setSelectedTime] = useState(
    editing?.time ? parseTime24ToDisplay(editing.time) : '9:00 AM'
  );
  const [duration, setDuration] = useState(String(editing?.durationMin ?? editing?.duration ?? DEFAULT_DURATION_MIN));
  const [whereOption, setWhereOption] = useState(
    editing?.zoomLink ? 'video' : 'in-person'
  );
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Generate week chip data
  const weekDates = useMemo(() => generateWeekDates(today), [today]);
  const weekChips = useMemo(() => {
    return weekDates.map((date) => ({
      id: format(date, 'yyyy-MM-dd'),
      label: (
        <View style={styles.dateChipContent}>
          <Text style={styles.dateChipDay}>{WEEKDAY_LABELS[date.getDay()]}</Text>
          <Text style={styles.dateChipDate}>{format(date, 'd')}</Text>
        </View>
      ),
    }));
  }, [weekDates]);

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');

  // When editing session loads, sync state
  useEffect(() => {
    if (!editing) return;
    if (editing.date) {
      const editDate = new Date(`${editing.date}T12:00:00`);
      setSelectedDate(editDate);
    }
    if (editing.time) {
      setSelectedTime(parseTime24ToDisplay(editing.time));
    }
    setDuration(String(editing.durationMin ?? editing.duration ?? DEFAULT_DURATION_MIN));
    setWhereOption(editing.zoomLink ? 'video' : 'in-person');
    setNotes(editing.notes ?? '');
  }, [editing?.id]);

  const goBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    onNavigate?.('/');
  };

  const handleSubmit = async () => {
    if (!clientId) {
      Alert.alert('Missing client', 'Open this screen from a client profile.');
      return;
    }

    // Build final date-time
    const time24 = parseDisplayTimeTo24(selectedTime);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const [hStr, mStr] = time24.split(':');
    const merged = setDateParts(selectedDate, {
      hours: parseInt(hStr, 10),
      minutes: parseInt(mStr, 10),
      seconds: 0,
      milliseconds: 0,
    });

    const payload = {
      clientId,
      clientName: clientName || undefined,
      date: dateStr,
      time: time24,
      startAtMs: merged.getTime(),
      durationMin: parseInt(duration, 10),
      status: isEdit ? editing?.status || 'pending' : 'pending',
      notes: notes.trim() || undefined,
      zoomLink: whereOption === 'video' ? (editing?.zoomLink || 'https://zoom.us/j/placeholder') : undefined,
    };

    setSubmitting(true);
    try {
      if (isEdit && sessionId) await updateSession(sessionId, payload);
      else await createSession(payload);
      goBack();
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Session', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (sessionId) {
              await deleteSession(sessionId);
              goBack();
            }
          } catch (e) {
            Alert.alert('Error', e?.message || 'Failed to delete session');
          }
        },
      },
    ]);
  };

  // Build live summary for CTA
  const durationLabel = DURATIONS.find((d) => d.id === duration)?.label || '60m';
  const dayOfWeek = format(selectedDate, 'EEE'); // Mon, Tue, etc.
  const monthDay = format(selectedDate, 'MMM d'); // Nov 9
  const ctaSummary = `Book ${dayOfWeek}, ${monthDay} · ${selectedTime} · ${durationLabel}`;

  const body = (
    <View style={styles.formContainer}>
      {/* Header with back button */}
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityLabel="Back">
          <ArrowLeft color={colors.nbInk} size={22} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.nbInk }]}>New session</Text>
      </View>

      {/* Client card */}
      <View style={[styles.clientCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
        <Text style={[styles.clientName, { color: colors.nbInk }]}>{clientName}</Text>
      </View>

      {/* Date strip (horizontal scroll week chips) */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>DATE · NOVEMBER</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStrip}
        >
          {weekChips.map((chip) => (
            <NbChip
              key={chip.id}
              selected={chip.id === selectedDateKey}
              onPress={() => {
                const foundDate = weekDates.find((d) => format(d, 'yyyy-MM-dd') === chip.id);
                if (foundDate) setSelectedDate(foundDate);
              }}
              style={styles.dateChip}
            >
              {chip.label}
            </NbChip>
          ))}
        </ScrollView>
      </View>

      {/* Time slots (3-column grid) */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>START TIME</Text>
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
      </View>

      {/* Duration segmented control */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>LENGTH</Text>
        <NbSegmented
          segments={DURATIONS}
          selected={duration}
          onSelect={setDuration}
        />
      </View>

      {/* Where segmented control */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>WHERE</Text>
        <NbSegmented
          segments={WHERE_OPTIONS}
          selected={whereOption}
          onSelect={setWhereOption}
        />
      </View>

      {/* Notes field */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>NOTES FOR {clientName.toUpperCase()}</Text>
        <TextInput
          style={[
            styles.notesInput,
            {
              borderColor: colors.nbBorder,
              color: colors.nbInk,
              backgroundColor: colors.nbSurface,
            },
          ]}
          placeholder="Focus, equipment, what to bring"
          placeholderTextColor={colors.nbMuted}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />
      </View>

      {/* Delete button for edit mode */}
      {isEdit && (
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete Session</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  if (embedded) {
    return (
      <View style={[styles.embeddedRoot, { backgroundColor: colors.nbBackground }]}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
          {...FORM_SCROLL_PROPS}
        >
          {body}
        </ScrollView>
        {/* Sticky CTA */}
        <View style={[styles.stickyCTA, { borderTopColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
          <NbButton
            variant="brand"
            onPress={handleSubmit}
            disabled={submitting}
          >
            {ctaSummary}
          </NbButton>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        {body}
      </ScrollView>
      {/* Sticky CTA */}
      <View style={[styles.stickyCTA, { borderTopColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
        <NbButton
          variant="brand"
          onPress={handleSubmit}
          disabled={submitting}
        >
          {ctaSummary}
        </NbButton>
      </View>
    </View>
  );
}

export default ScheduleSessionScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  embeddedRoot: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  formContainer: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  backBtn: {
    padding: 4,
    marginLeft: -4,
  },
  headerTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    letterSpacing: -0.3,
  },
  clientCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: spacing.md,
    alignItems: 'center',
  },
  clientName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  section: {
    gap: spacing.sm,
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  weekStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  dateChip: {
    minWidth: 52,
  },
  dateChipContent: {
    alignItems: 'center',
    gap: 2,
  },
  dateChipDay: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  dateChipDate: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeChip: {
    width: '31%', // 3 columns with gaps
  },
  notesInput: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbChip,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    minHeight: 80,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '600',
  },
  stickyCTA: {
    borderTopWidth: nb.borderWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
  },
});
