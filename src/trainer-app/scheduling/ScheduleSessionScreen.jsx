// Design Law "New session" form: client chips, session type, date strip, time chips, length, where, notes, Send invite.
// Flow: load editing session if any → pick client/type/date/time/duration/location → create or update via mySessions hooks.
// Used from the trainer calendar tab and client scheduling entry points.
//
// vocab: NbChip custom children = day letter + number stack (must not wrap in Text)
// vocab: NbPageHeader = back square + title; owns status-bar inset
// Manipulate here: TIME_SLOTS list, SESSION_TYPES labels, DURATIONS labels ("90 min" only on last)

import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek, set as setDateParts } from 'date-fns';
import { auth } from '../../app-start/cloudConnection';
import { FORM_SCROLL_PROPS, useModalScrollBottomPad } from '../../navigation/bottomMenuSpacing';
import {
  useCreateTrainingSession,
  useUpdateTrainingSession,
  useDeleteTrainingSession,
  useGetTrainingSession,
} from '../scheduling/mySessions';
import { pagedTraineeList } from '../my-trainees/pagedTraineeList';
import NbChip from '../../look-and-feel/NbChip';
import NbSegmented from '../../look-and-feel/NbSegmented';
import NbButton from '../../look-and-feel/NbButton';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import HardShadow from '../../look-and-feel/HardShadow';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_DURATION_MIN = 60;
const SCROLL_BOTTOM_PAD = 80;

// PNG LENGTH labels: "30" "45" "60" "90 min" (only the last says min)
const DURATIONS = [
  { id: '30', label: '30', min: 30 },
  { id: '45', label: '45', min: 45 },
  { id: '60', label: '60', min: 60 },
  { id: '90', label: '90 min', min: 90 },
];

const WHERE_OPTIONS = [
  { id: 'in-person', label: 'In person' },
  { id: 'video', label: 'Video link' },
];

// Manipulate here: evening-heavy slots match PNG 11; keep AM slots for morning books
const TIME_SLOTS = [
  '5:30 AM', '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM',
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '12:15 PM', '1:00 PM',
  '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '5:30 PM', '6:00 PM',
  '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM',
];

const SESSION_TYPES = [
  { id: 'lower', label: 'Lower body' },
  { id: 'upper', label: 'Upper body' },
  { id: 'full', label: 'Full body' },
  { id: 'checkin', label: 'Check-in call' },
  { id: 'custom', label: 'Custom' },
];

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ===== HELPERS =====

function parseTime24ToDisplay(timeStr) {
  if (!timeStr) return '6:30 PM';
  const [hStr, mStr] = String(timeStr).split(':');
  const h24 = parseInt(hStr, 10);
  const minute = parseInt(mStr || '0', 10);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 || 12;
  const minuteStr = String(minute).padStart(2, '0');
  return `${hour12}:${minuteStr} ${period}`;
}

function parseDisplayTimeTo24(displayTime) {
  const match = displayTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return '18:30';
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function generateWeekDates(anchorDate) {
  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function firstName(fullName) {
  const text = String(fullName || 'Client').trim();
  return text.split(/\s+/)[0] || text;
}

function matchSessionTypeId(title) {
  const t = String(title || '').toLowerCase();
  const hit = SESSION_TYPES.find((s) => t.includes(s.label.toLowerCase()) || t === s.id);
  return hit?.id || 'lower';
}

// ===== MAIN =====

/**
 * Neobrutalist session scheduler matching Design Law PNG 11/12.
 * @param {object} [props]
 */
export function ScheduleSessionScreen(props = {}) {
  const route = useContext(NavigationRouteContext);
  const navigation = useContext(NavigationContext);
  const routeParams = route?.params ?? {};

  const initialClientId =
    props.clientId ?? props.initialClientId ?? routeParams.clientId ?? routeParams.initialClientId;
  const initialClientName = props.clientName ?? routeParams.clientName ?? '';
  const sessionId = props.sessionId ?? routeParams.sessionId;
  const initialDate = props.initialDate ?? routeParams.initialDate ?? routeParams.date;
  const onNavigate = props.onNavigate;
  const embedded = props.embedded === true;

  const { colors } = useTheme();
  const scrollBottomPad = useModalScrollBottomPad(SCROLL_BOTTOM_PAD);

  const createSession = useCreateTrainingSession();
  const updateSession = useUpdateTrainingSession();
  const deleteSession = useDeleteTrainingSession();
  const getSession = useGetTrainingSession();

  // Client chip row — same roster the calendar uses (pagedTraineeList)
  const trainerUid = auth?.currentUser?.uid || null;
  const { clients } = pagedTraineeList(trainerUid);

  const editing = sessionId ? getSession(sessionId) : undefined;
  const isEdit = Boolean(editing);
  const today = useMemo(() => new Date(), []);

  const initDate = useMemo(() => {
    if (editing?.date) return new Date(`${editing.date}T12:00:00`);
    if (initialDate) return new Date(`${String(initialDate).slice(0, 10)}T12:00:00`);
    return today;
  }, [editing, initialDate, today]);

  const [selectedClientId, setSelectedClientId] = useState(
    String(editing?.clientId || initialClientId || ''),
  );
  const [selectedClientName, setSelectedClientName] = useState(
    editing?.clientName || initialClientName || '',
  );
  const [sessionTypeId, setSessionTypeId] = useState(
    matchSessionTypeId(editing?.title || editing?.focus || editing?.type),
  );
  const [selectedDate, setSelectedDate] = useState(initDate);
  const [selectedTime, setSelectedTime] = useState(
    editing?.time ? parseTime24ToDisplay(editing.time) : '6:30 PM',
  );
  const [duration, setDuration] = useState(
    String(editing?.durationMin ?? editing?.duration ?? DEFAULT_DURATION_MIN),
  );
  const [whereOption, setWhereOption] = useState(editing?.zoomLink ? 'video' : 'in-person');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Week strip anchored on the selected date so month/week stay in sync when editing
  const weekDates = useMemo(() => generateWeekDates(selectedDate), [selectedDate]);
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  // Dynamic month label (user requirement) — lives above the date strip
  const monthLabel = format(selectedDate, 'MMMM yyyy');

  const clientChips = useMemo(() => {
    const roster = (clients || []).map((c) => ({
      id: String(c.id),
      label: c.name || c.displayName || 'Client',
    }));
    // Ensure the preselected / editing client appears even if not on this page yet
    if (selectedClientId && !roster.some((c) => c.id === selectedClientId)) {
      roster.unshift({
        id: String(selectedClientId),
        label: selectedClientName || 'Client',
      });
    }
    return roster;
  }, [clients, selectedClientId, selectedClientName]);

  useEffect(() => {
    if (!editing) return;
    if (editing.date) setSelectedDate(new Date(`${editing.date}T12:00:00`));
    if (editing.time) setSelectedTime(parseTime24ToDisplay(editing.time));
    setDuration(String(editing.durationMin ?? editing.duration ?? DEFAULT_DURATION_MIN));
    setWhereOption(editing.zoomLink ? 'video' : 'in-person');
    setNotes(editing.notes ?? '');
    if (editing.clientId) setSelectedClientId(String(editing.clientId));
    if (editing.clientName) setSelectedClientName(editing.clientName);
    setSessionTypeId(matchSessionTypeId(editing.title || editing.focus || editing.type));
  }, [editing?.id]);

  // Prefer a real roster name once clients load
  useEffect(() => {
    if (!selectedClientId || selectedClientName) return;
    const found = (clients || []).find((c) => String(c.id) === String(selectedClientId));
    if (found?.name || found?.displayName) {
      setSelectedClientName(found.name || found.displayName);
    }
  }, [clients, selectedClientId, selectedClientName]);

  const goBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    onNavigate?.('/');
  };

  const handleSubmit = async () => {
    if (!selectedClientId) {
      Alert.alert('Pick a client', 'Choose who this session is for.');
      return;
    }

    const time24 = parseDisplayTimeTo24(selectedTime);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const [hStr, mStr] = time24.split(':');
    const merged = setDateParts(selectedDate, {
      hours: parseInt(hStr, 10),
      minutes: parseInt(mStr, 10),
      seconds: 0,
      milliseconds: 0,
    });

    const typeLabel =
      SESSION_TYPES.find((s) => s.id === sessionTypeId)?.label || 'Training';

    // Keep Firebase keys stable: clientId/date/time/durationMin/status/notes/zoomLink (+ title for type)
    const payload = {
      clientId: selectedClientId,
      clientName: selectedClientName || undefined,
      date: dateStr,
      time: time24,
      startAtMs: merged.getTime(),
      durationMin: parseInt(duration, 10),
      status: isEdit ? editing?.status || 'pending' : 'pending',
      notes: notes.trim() || undefined,
      title: typeLabel,
      focus: typeLabel,
      zoomLink:
        whereOption === 'video'
          ? editing?.zoomLink || 'https://zoom.us/j/placeholder'
          : undefined,
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

  const clientFirst = firstName(selectedClientName || 'Client');
  const notifyHint = `${clientFirst} gets: You have a new scheduled session.`;

  const body = (
    <View style={styles.formContainer}>
      {/* CLIENT chip strip (PNG) — single preselected client still renders as one chip */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>CLIENT</Text>
        {clientChips.length === 0 ? (
          <Text style={[styles.hint, { color: colors.nbMuted }]}>
            Open this from a client profile, or add a client first.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipStrip}
          >
            {clientChips.map((chip) => (
              <NbChip
                key={chip.id}
                selected={chip.id === String(selectedClientId)}
                onPress={() => {
                  setSelectedClientId(chip.id);
                  setSelectedClientName(chip.label);
                }}
              >
                {chip.label}
              </NbChip>
            ))}
          </ScrollView>
        )}
      </View>

      {/* SESSION type chips */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>SESSION</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipStrip}
        >
          {SESSION_TYPES.map((type) => (
            <NbChip
              key={type.id}
              selected={sessionTypeId === type.id}
              onPress={() => setSessionTypeId(type.id)}
            >
              {type.label}
            </NbChip>
          ))}
        </ScrollView>
      </View>

      {/* START TIME — dynamic month + date strip + time chips with visible labels */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>
          {`START TIME · ${monthLabel.toUpperCase()}`}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.weekStrip}
        >
          {weekDates.map((date) => {
            const id = format(date, 'yyyy-MM-dd');
            const selected = id === selectedDateKey;
            const ink = selected ? colors.nbOnFill : colors.nbInk;
            return (
              <NbChip
                key={id}
                selected={selected}
                onPress={() => setSelectedDate(date)}
                style={styles.dateChip}
                contentStyle={styles.dateChipInner}
              >
                <View style={styles.dateChipContent}>
                  <Text style={[styles.dateChipDay, { color: ink }]}>
                    {WEEKDAY_LABELS[date.getDay()]}
                  </Text>
                  <Text style={[styles.dateChipDate, { color: ink }]}>
                    {format(date, 'd')}
                  </Text>
                  <View
                    style={[
                      styles.dateDot,
                      {
                        borderColor: ink,
                        backgroundColor: selected ? ink : 'transparent',
                      },
                    ]}
                  />
                </View>
              </NbChip>
            );
          })}
        </ScrollView>

        <View style={styles.timeGrid}>
          {TIME_SLOTS.map((time) => (
            <NbChip
              key={time}
              selected={selectedTime === time}
              onPress={() => setSelectedTime(time)}
              style={styles.timeChip}
              contentStyle={styles.timeChipInner}
            >
              {time}
            </NbChip>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>LENGTH</Text>
        <NbSegmented segments={DURATIONS} selected={duration} onSelect={setDuration} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>WHERE</Text>
        <NbSegmented
          segments={WHERE_OPTIONS}
          selected={whereOption}
          onSelect={setWhereOption}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>NOTES</Text>
        <TextInput
          style={[
            styles.notesInput,
            {
              borderColor: colors.nbBorder,
              color: colors.nbInk,
              backgroundColor: colors.nbSurface,
            },
          ]}
          placeholder="Box squat depth. Bring a resistance band."
          placeholderTextColor={colors.nbMuted}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
          textAlignVertical="top"
        />
        <Text style={[styles.hint, { color: colors.nbMuted }]}>{notifyHint}</Text>
      </View>

      {isEdit ? (
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={[styles.deleteText, { color: colors.nbInk }]}>Delete Session</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const stickyFooter = (
    <View
      style={[
        styles.stickyCTA,
        { borderTopColor: colors.nbBorder, backgroundColor: colors.nbSurface },
      ]}
    >
      <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
        <TouchableOpacity
          onPress={goBack}
          style={[
            styles.footerBack,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
        </TouchableOpacity>
      </HardShadow>
      <View style={styles.footerCtaGrow}>
        <NbButton variant="fill" onPress={handleSubmit} disabled={submitting}>
          {isEdit ? 'Save changes' : 'Send invite'}
        </NbButton>
      </View>
    </View>
  );

  const header = (
    <NbPageHeader
      title={isEdit ? 'Edit session' : 'New session'}
      onBack={goBack}
    />
  );

  if (embedded) {
    return (
      <View style={[styles.embeddedRoot, { backgroundColor: colors.nbBackground }]}>
        {header}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
          {...FORM_SCROLL_PROPS}
        >
          {body}
        </ScrollView>
        {stickyFooter}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      {header}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        {body}
      </ScrollView>
      {stickyFooter}
    </View>
  );
}

export default ScheduleSessionScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  embeddedRoot: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  formContainer: { gap: spacing.lg },
  section: { gap: spacing.sm },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
  chipStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  dateChip: { minWidth: 52 },
  dateChipInner: {
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  dateChipContent: {
    alignItems: 'center',
    gap: 2,
  },
  dateChipDay: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  dateChipDate: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  dateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    marginTop: 4,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs || 4,
  },
  // Manipulate here: ~3 columns — fixed % + HardShadow sibling needs a little headroom
  timeChip: { width: '31%' },
  timeChipInner: {
    minHeight: 44,
    paddingVertical: 10,
    width: '100%',
  },
  notesInput: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    minHeight: 88,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  deleteText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    textDecorationLine: 'underline',
  },
  stickyCTA: {
    borderTopWidth: nb.borderWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  footerBack: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCtaGrow: { flex: 1 },
});
