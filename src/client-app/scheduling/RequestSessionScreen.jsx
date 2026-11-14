// Client “Request a session” form — day, time, length, where, notes.
// Flow: pick day with open times → time chip → length / where → notes → write pending session.
// Used from My sessions CTA. Writes under trainer_clients/{trainerId}/sessions (same keys as trainer).

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
const DAYS_IN_WEEK = 7;
const WEEK_STARTS_ON_SUNDAY = 0;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DEFAULT_DURATION_MINUTES = 60;
const NOON_HOUR = 12;
const HOURS_IN_HALF_DAY = 12;
const DEFAULT_TIME_24 = '18:30';
const DEFAULT_DISPLAY_TIME = '6:30 PM';
const ZOOM_PLACEHOLDER_URL = 'https://zoom.us/j/placeholder';
const TRAINER_CLIENTS_COLLECTION = 'trainer_clients';
const SESSIONS_SUBCOLLECTION = 'sessions';
const SESSION_STATUS_PENDING = 'pending';
const REQUESTED_BY_CLIENT = 'client';
const SESSION_REQUEST_TITLE = 'Session request';
const FALLBACK_TRAINER_WORD = 'your trainer';
const NOTICE_OK_LABEL = 'OK';
const NOTICE_NO_TRAINER_TITLE = 'No trainer';
const NOTICE_NO_TRAINER_MESSAGE = 'Link a trainer before requesting a session.';
const NOTICE_SEND_FAILED_TITLE = 'Could not send';
const NOTICE_SEND_FAILED_FALLBACK = 'Please try again.';

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

// ===== HELPER FUNCTIONS =====

function generateWeekDates(weekAnchor) {
  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: WEEK_STARTS_ON_SUNDAY });
  const days = [];
  for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex += 1) {
    days.push(addDays(weekStart, dayIndex));
  }
  return days;
}

function dateKeyFromDate(dateValue) {
  return format(dateValue, 'yyyy-MM-dd');
}

function firstName(fullName) {
  const text = String(fullName || FALLBACK_TRAINER_WORD).trim();
  const pieces = text.split(/\s+/);
  if (!pieces[0]) return text;
  return pieces[0];
}

function findMatchingWeekDay(weekDates, selectedDateKey) {
  for (const day of weekDates) {
    if (dateKeyFromDate(day) === selectedDateKey) return day;
  }
  return null;
}

function dayLabelForSelection(weekDates, selectedDateKey) {
  try {
    const matchingDay = findMatchingWeekDay(weekDates, selectedDateKey);
    if (!matchingDay) return selectedDateKey;
    return format(matchingDay, 'EEE, MMM d').toUpperCase();
  } catch {
    return selectedDateKey;
  }
}

function sessionsCollectionPath(trainerId) {
  return `${TRAINER_CLIENTS_COLLECTION}/${trainerId}/${SESSIONS_SUBCOLLECTION}`;
}

function alertMessageFromError(error) {
  if (error && error.message) return error.message;
  return NOTICE_SEND_FAILED_FALLBACK;
}

function callIfFunction(maybeFn) {
  if (typeof maybeFn !== 'function') return;
  maybeFn();
}

function noticeTitle(notice) {
  if (!notice) return '';
  if (notice.title) return notice.title;
  return '';
}

function noticeMessage(notice) {
  if (!notice) return undefined;
  return notice.message;
}

function noticeConfirmLabel(notice) {
  if (notice && notice.confirmLabel) return notice.confirmLabel;
  return NOTICE_OK_LABEL;
}

function noticeCancelLabel(notice) {
  if (!notice) return undefined;
  return notice.cancelLabel;
}

function noticeConfirmHandler(notice) {
  if (!notice) return undefined;
  return notice.onConfirm;
}

function WeekDayChip({ dateValue, isSelected, onSelect, colors }) {
  const dateKey = dateKeyFromDate(dateValue);
  const weekdayLetter = WEEKDAY_LABELS[dateValue.getDay()];
  const dayNumber = format(dateValue, 'd');
  const inkColor = isSelected ? colors.nbOnFill : colors.nbInk;
  const dotFill = isSelected ? inkColor : 'transparent';

  return (
    <NbChip
      selected={isSelected}
      onPress={() => onSelect(dateKey)}
      style={styles.weekChip}
      contentStyle={styles.weekChipInner}
    >
      <View style={styles.weekChipContent}>
        <Text style={[styles.weekDay, { color: inkColor }]}>{weekdayLetter}</Text>
        <Text style={[styles.weekDate, { color: inkColor }]}>{dayNumber}</Text>
        <View
          style={[
            styles.dot,
            { borderColor: inkColor, backgroundColor: dotFill },
          ]}
        />
      </View>
    </NbChip>
  );
}

function buildWeekDayChips(weekDates, selectedDateKey, onSelectDate, colors) {
  const chips = [];
  for (const dateValue of weekDates) {
    const dateKey = dateKeyFromDate(dateValue);
    const isSelected = dateKey === selectedDateKey;
    chips.push(
      <WeekDayChip
        key={dateKey}
        dateValue={dateValue}
        isSelected={isSelected}
        onSelect={onSelectDate}
        colors={colors}
      />,
    );
  }
  return chips;
}

function WeekDayStrip({ weekDates, selectedDateKey, onSelectDate, colors }) {
  const chips = buildWeekDayChips(weekDates, selectedDateKey, onSelectDate, colors);
  return <View style={styles.weekStrip}>{chips}</View>;
}

function buildTimeSlotChips(selectedTime, onSelectTime) {
  const chips = [];
  for (const timeLabel of TIME_SLOTS) {
    const isSelected = selectedTime === timeLabel;
    chips.push(
      <NbChip
        key={timeLabel}
        selected={isSelected}
        onPress={() => onSelectTime(timeLabel)}
        style={styles.timeChip}
      >
        {timeLabel}
      </NbChip>,
    );
  }
  return chips;
}

function TimeSlotGrid({ selectedTime, onSelectTime }) {
  const chips = buildTimeSlotChips(selectedTime, onSelectTime);
  return <View style={styles.timeGrid}>{chips}</View>;
}

function buildPendingSessionFields({
  trainerId,
  clientId,
  selectedDateKey,
  time24,
  durationMin,
  trimmedNotes,
  wantsVideoLink,
}) {
  // Freeze: field letters stay as-is (date / time / durationMin / status / requestedBy / …).
  const fields = {
    trainerId,
    clientId,
    date: selectedDateKey,
    time: time24,
    durationMin,
    status: SESSION_STATUS_PENDING,
    requestedBy: REQUESTED_BY_CLIENT,
    title: SESSION_REQUEST_TITLE,
    focus: SESSION_REQUEST_TITLE,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (trimmedNotes) {
    fields.notes = trimmedNotes;
  }
  if (wantsVideoLink) {
    fields.zoomLink = ZOOM_PLACEHOLDER_URL;
  }
  return fields;
}

async function writePendingSessionRequest(trainerId, sessionFields) {
  const sessionsPath = sessionsCollectionPath(trainerId);
  await addDoc(collection(db, sessionsPath), sessionFields);
}

// ===== MAIN FUNCTION =====

/**
 * Client session request form — writes a pending session under the trainer.
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
  const [selectedTime, setSelectedTime] = useState(DEFAULT_DISPLAY_TIME);
  const [duration, setDuration] = useState('60');
  const [whereOption, setWhereOption] = useState('in-person');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  const showNotice = (title, message, extras = {}) => {
    setNotice({ title, message, ...extras });
  };

  const clearNotice = () => {
    setNotice(null);
  };

  const dayLabel = useMemo(
    () => dayLabelForSelection(weekDates, selectedDateKey),
    [selectedDateKey, weekDates],
  );

  const openTimesHint = `A dot means ${coachFirst} has open times that day.`;
  const headerSubtitle = `Open times from ${coachFirst}`;
  const disclaimerText = `${coachFirst} confirms or suggests another time. You are told either way.`;
  const submitButtonLabel = submitting ? 'Sending…' : 'Request session';
  const noticeIsVisible = Boolean(notice);
  const wantsVideoLink = whereOption === 'video';

  const handleSubmit = async () => {
    // 1. Guard — need linked trainer and Firestore.
    if (!clientId || !trainerId || !db) {
      showNotice(NOTICE_NO_TRAINER_TITLE, NOTICE_NO_TRAINER_MESSAGE);
      return;
    }

    setSubmitting(true);
    try {
      // 2. Build session doc with same field keys as trainer scheduling.
      const time24 = parseDisplayTimeTo24(selectedTime);
      const durationMin = parseInt(duration, 10) || DEFAULT_DURATION_MINUTES;
      const trimmedNotes = notes.trim();
      const sessionFields = buildPendingSessionFields({
        trainerId,
        clientId,
        selectedDateKey,
        time24,
        durationMin,
        trimmedNotes,
        wantsVideoLink,
      });

      // 3. Write the pending invite, then notify parent and go back.
      await writePendingSessionRequest(trainerId, sessionFields);
      callIfFunction(onSubmitted);
      callIfFunction(onBack);
    } catch (error) {
      showNotice(NOTICE_SEND_FAILED_TITLE, alertMessageFromError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <NbPageHeader
        title="Request a session"
        subtitle={headerSubtitle}
        onBack={onBack}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        <WeekDayStrip
          weekDates={weekDates}
          selectedDateKey={selectedDateKey}
          onSelectDate={setSelectedDateKey}
          colors={colors}
        />
        <Text style={[styles.hint, { color: colors.nbMuted }]}>{openTimesHint}</Text>

        <Text style={[styles.label, { color: colors.nbMuted }]}>{dayLabel}</Text>
        <TimeSlotGrid selectedTime={selectedTime} onSelectTime={setSelectedTime} />

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
          {submitButtonLabel}
        </NbButton>
        <Text style={[styles.disclaimer, { color: colors.nbMuted }]}>{disclaimerText}</Text>
      </ScrollView>

      <NbNoticeSheet
        visible={noticeIsVisible}
        onClose={clearNotice}
        title={noticeTitle(notice)}
        message={noticeMessage(notice)}
        confirmLabel={noticeConfirmLabel(notice)}
        cancelLabel={noticeCancelLabel(notice)}
        onConfirm={noticeConfirmHandler(notice)}
      />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

function parseDisplayTimeTo24(displayTime) {
  const match = String(displayTime).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return DEFAULT_TIME_24;

  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const period = match[3].toUpperCase();

  if (period === 'PM' && hour !== NOON_HOUR) {
    hour += HOURS_IN_HALF_DAY;
  }
  if (period === 'AM' && hour === NOON_HOUR) {
    hour = 0;
  }

  const hourText = String(hour).padStart(2, '0');
  return `${hourText}:${minute}`;
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
