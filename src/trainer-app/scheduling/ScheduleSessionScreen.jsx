// Design Law "New session" form: client chips, session type, date strip, time chips, length, where, notes, Send invite.
// Flow: load editing session if any → pick client/type/date/time/duration/location → create or update via mySessions hooks.
// Used from the trainer calendar tab and client scheduling entry points. Do not touch BookSessionScreen.
// Read order: constants → form layout pieces → shell → main screen → PLUMBING (time/payload helpers).
//
// vocab: NbChip custom children = day letter + number stack (must not wrap in Text)
// vocab: NbPageHeader = back square + title; owns status-bar inset
// Manipulate here: TIME_SLOTS list, SESSION_TYPES labels, DURATIONS labels ("90 min" only on last)

import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
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
import DeleteSessionSheet from './DeleteSessionSheet';
import NbChip from '../../look-and-feel/NbChip';
import NbSegmented from '../../look-and-feel/NbSegmented';
import NbButton from '../../look-and-feel/NbButton';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import HardShadow from '../../look-and-feel/HardShadow';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_DURATION_MIN = 60;
const SCROLL_BOTTOM_PAD = 80;
const DEFAULT_TIME_CHIP = '6:30 PM';
const DEFAULT_STORED_TIME = '18:30';
const SESSION_STATUS_PENDING = 'pending';
const WHERE_IN_PERSON = 'in-person';
const WHERE_VIDEO = 'video';
const PLACEHOLDER_ZOOM_LINK = 'https://zoom.us/j/placeholder';
const NOON_ON_DAY_SUFFIX = 'T12:00:00';
const WEEK_LENGTH_DAYS = 7;
const WEEK_STARTS_ON_SUNDAY = 0;
const CLIENT_NAME_FALLBACK = 'Client';
const SESSION_TYPE_FALLBACK_ID = 'lower';
const SESSION_TYPE_FALLBACK_LABEL = 'Training';

// PNG LENGTH labels: "30" "45" "60" "90 min" (only the last says min)
const DURATIONS = [
  { id: '30', label: '30', min: 30 },
  { id: '45', label: '45', min: 45 },
  { id: '60', label: '60', min: DEFAULT_DURATION_MIN },
  { id: '90', label: '90 min', min: 90 },
];

const WHERE_OPTIONS = [
  { id: WHERE_IN_PERSON, label: 'In person' },
  { id: WHERE_VIDEO, label: 'Video link' },
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

// ===== HELPER FUNCTIONS =====

function WeekDayChip({ date, selected, colors, onSelect }) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const weekdayLetter = WEEKDAY_LABELS[date.getDay()];
  const dayNumberText = format(date, 'd');

  let inkColor = colors.nbInk;
  if (selected) {
    inkColor = colors.nbOnFill;
  }
  let dotFillColor = 'transparent';
  if (selected) {
    dotFillColor = inkColor;
  }

  const handlePress = () => {
    onSelect(date);
  };

  return (
    <NbChip
      selected={selected}
      onPress={handlePress}
      style={styles.dateChip}
      contentStyle={styles.dateChipInner}
    >
      <View style={styles.dateChipContent}>
        <Text style={[styles.dateChipDay, { color: inkColor }]}>{weekdayLetter}</Text>
        <Text style={[styles.dateChipDate, { color: inkColor }]}>{dayNumberText}</Text>
        <View
          style={[
            styles.dateDot,
            {
              borderColor: inkColor,
              backgroundColor: dotFillColor,
            },
          ]}
        />
      </View>
    </NbChip>
  );
}

function ClientChipStrip({ clientChips, selectedClientId, onPickClient, colors }) {
  const hasNoClients = clientChips.length === 0;
  if (hasNoClients) {
    return (
      <Text style={[styles.hint, { color: colors.nbMuted }]}>
        Open this from a client profile, or add a client first.
      </Text>
    );
  }

  const chipElements = [];
  for (let index = 0; index < clientChips.length; index += 1) {
    const chip = clientChips[index];
    const chipIsSelected = chip.id === String(selectedClientId);
    const handlePress = () => {
      onPickClient(chip.id, chip.label);
    };
    chipElements.push(
      <NbChip key={chip.id} selected={chipIsSelected} onPress={handlePress}>
        {chip.label}
      </NbChip>,
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipStrip}
    >
      {chipElements}
    </ScrollView>
  );
}

function SessionTypeChipStrip({ sessionTypeId, onPickSessionType }) {
  const typeChipElements = [];
  for (let index = 0; index < SESSION_TYPES.length; index += 1) {
    const typeRow = SESSION_TYPES[index];
    const typeIsSelected = sessionTypeId === typeRow.id;
    const handlePress = () => {
      onPickSessionType(typeRow.id);
    };
    typeChipElements.push(
      <NbChip key={typeRow.id} selected={typeIsSelected} onPress={handlePress}>
        {typeRow.label}
      </NbChip>,
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipStrip}
    >
      {typeChipElements}
    </ScrollView>
  );
}

function StartTimeSection({
  colors,
  monthLabel,
  weekDates,
  selectedDateKey,
  onPickDate,
  selectedTime,
  onPickTime,
}) {
  const startTimeHeading = `START TIME · ${monthLabel.toUpperCase()}`;

  const weekDayElements = [];
  for (let index = 0; index < weekDates.length; index += 1) {
    const date = weekDates[index];
    const dateKey = format(date, 'yyyy-MM-dd');
    const dateIsSelected = dateKey === selectedDateKey;
    weekDayElements.push(
      <WeekDayChip
        key={dateKey}
        date={date}
        selected={dateIsSelected}
        colors={colors}
        onSelect={onPickDate}
      />,
    );
  }

  const timeChipElements = [];
  for (let index = 0; index < TIME_SLOTS.length; index += 1) {
    const timeChipLabel = TIME_SLOTS[index];
    const timeIsSelected = selectedTime === timeChipLabel;
    const handlePress = () => {
      onPickTime(timeChipLabel);
    };
    timeChipElements.push(
      <NbChip
        key={timeChipLabel}
        selected={timeIsSelected}
        onPress={handlePress}
        style={styles.timeChip}
        contentStyle={styles.timeChipInner}
      >
        {timeChipLabel}
      </NbChip>,
    );
  }

  return (
    <View style={styles.section}>
      <Text style={[styles.label, { color: colors.nbMuted }]}>{startTimeHeading}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.weekStrip}
      >
        {weekDayElements}
      </ScrollView>

      <View style={styles.timeGrid}>
        {timeChipElements}
      </View>
    </View>
  );
}

function ScheduleSessionFormBody({
  colors,
  clientChips,
  selectedClientId,
  onPickClient,
  sessionTypeId,
  onPickSessionType,
  monthLabel,
  weekDates,
  selectedDateKey,
  onPickDate,
  selectedTime,
  onPickTime,
  duration,
  onPickDuration,
  whereOption,
  onPickWhere,
  notes,
  onNotesChange,
  notifyHint,
  isEdit,
  onDeletePress,
}) {
  const notesInputStyle = [
    styles.notesInput,
    {
      borderColor: colors.nbBorder,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface,
    },
  ];

  let deleteSessionButton = null;
  if (isEdit) {
    deleteSessionButton = (
      <TouchableOpacity onPress={onDeletePress} style={styles.deleteBtn}>
        <Text style={[styles.deleteText, { color: colors.nbInk }]}>Delete Session</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.formContainer}>
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>CLIENT</Text>
        <ClientChipStrip
          clientChips={clientChips}
          selectedClientId={selectedClientId}
          onPickClient={onPickClient}
          colors={colors}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>SESSION</Text>
        <SessionTypeChipStrip
          sessionTypeId={sessionTypeId}
          onPickSessionType={onPickSessionType}
        />
      </View>

      <StartTimeSection
        colors={colors}
        monthLabel={monthLabel}
        weekDates={weekDates}
        selectedDateKey={selectedDateKey}
        onPickDate={onPickDate}
        selectedTime={selectedTime}
        onPickTime={onPickTime}
      />

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>LENGTH</Text>
        <NbSegmented segments={DURATIONS} selected={duration} onSelect={onPickDuration} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>WHERE</Text>
        <NbSegmented segments={WHERE_OPTIONS} selected={whereOption} onSelect={onPickWhere} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.nbMuted }]}>NOTES</Text>
        <TextInput
          style={notesInputStyle}
          placeholder="Box squat depth. Bring a resistance band."
          placeholderTextColor={colors.nbMuted}
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={onNotesChange}
          textAlignVertical="top"
        />
        <Text style={[styles.hint, { color: colors.nbMuted }]}>{notifyHint}</Text>
      </View>

      {deleteSessionButton}
    </View>
  );
}

function StickySubmitFooter({ colors, onBack, onSubmit, submitting, isEdit }) {
  const footerShellStyle = [
    styles.stickyCTA,
    { borderTopColor: colors.nbBorder, backgroundColor: colors.nbSurface },
  ];
  const backButtonStyle = [
    styles.footerBack,
    { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
  ];
  let submitLabel = 'Send invite';
  if (isEdit) {
    submitLabel = 'Save changes';
  }

  return (
    <View style={footerShellStyle}>
      <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
        <TouchableOpacity
          onPress={onBack}
          style={backButtonStyle}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
        </TouchableOpacity>
      </HardShadow>
      <View style={styles.footerCtaGrow}>
        <NbButton variant="fill" onPress={onSubmit} disabled={submitting}>
          {submitLabel}
        </NbButton>
      </View>
    </View>
  );
}

function ScheduleSessionScreenShell({
  embedded,
  colors,
  scrollBottomPad,
  header,
  formBody,
  stickyFooter,
  deleteSheet,
  noticeSheet,
}) {
  let rootStyle = styles.root;
  if (embedded) {
    rootStyle = styles.embeddedRoot;
  }
  const scrollContentStyle = [styles.scrollContent, { paddingBottom: scrollBottomPad }];

  return (
    <View style={[rootStyle, { backgroundColor: colors.nbBackground }]}>
      {header}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={scrollContentStyle}
        {...FORM_SCROLL_PROPS}
      >
        {formBody}
      </ScrollView>
      {stickyFooter}
      {deleteSheet}
      {noticeSheet}
    </View>
  );
}

function storedTimeToChipLabel(timeStr) {
  if (!timeStr) {
    return DEFAULT_TIME_CHIP;
  }

  const parts = String(timeStr).split(':');
  const hourText = parts[0];
  const minuteText = parts[1] || '0';
  const hour24 = parseInt(hourText, 10);
  const minute = parseInt(minuteText, 10);
  let period = 'AM';
  if (hour24 >= 12) {
    period = 'PM';
  }
  const hour12 = hour24 % 12 || 12;
  const minutePadded = String(minute).padStart(2, '0');
  return `${hour12}:${minutePadded} ${period}`;
}

function chipLabelToStoredTime(displayTime) {
  const match = displayTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    return DEFAULT_STORED_TIME;
  }

  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const period = match[3].toUpperCase();
  if (period === 'PM' && hour !== 12) {
    hour += 12;
  }
  if (period === 'AM' && hour === 12) {
    hour = 0;
  }
  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function weekDatesStartingSunday(anchorDate) {
  const weekStart = startOfWeek(anchorDate, { weekStartsOn: WEEK_STARTS_ON_SUNDAY });
  const dates = [];
  for (let dayIndex = 0; dayIndex < WEEK_LENGTH_DAYS; dayIndex += 1) {
    dates.push(addDays(weekStart, dayIndex));
  }
  return dates;
}

function firstNameOnly(fullName) {
  const text = String(fullName || CLIENT_NAME_FALLBACK).trim();
  return text.split(/\s+/)[0] || text;
}

function sessionTypeIdFromStoredTitle(title) {
  const titleLower = String(title || '').toLowerCase();
  for (let index = 0; index < SESSION_TYPES.length; index += 1) {
    const typeRow = SESSION_TYPES[index];
    const labelLower = typeRow.label.toLowerCase();
    if (titleLower.includes(labelLower) || titleLower === typeRow.id) {
      return typeRow.id;
    }
  }
  return SESSION_TYPE_FALLBACK_ID;
}

function findSessionTypeLabel(sessionTypeId) {
  for (let index = 0; index < SESSION_TYPES.length; index += 1) {
    const typeRow = SESSION_TYPES[index];
    if (typeRow.id === sessionTypeId) {
      return typeRow.label;
    }
  }
  return SESSION_TYPE_FALLBACK_LABEL;
}

function resolveDuration(editing) {
  if (editing == null) {
    return String(DEFAULT_DURATION_MIN);
  }
  if (editing.durationMin != null) {
    return String(editing.durationMin);
  }
  if (editing.duration != null) {
    return String(editing.duration);
  }
  return String(DEFAULT_DURATION_MIN);
}

function clientChipLabel(clientRow) {
  if (clientRow.name) {
    return clientRow.name;
  }
  if (clientRow.displayName) {
    return clientRow.displayName;
  }
  return CLIENT_NAME_FALLBACK;
}

function findClientById(clients, clientId) {
  const roster = clients || [];
  for (let index = 0; index < roster.length; index += 1) {
    const clientRow = roster[index];
    if (String(clientRow.id) === String(clientId)) {
      return clientRow;
    }
  }
  return null;
}

function buildClientChipList(clients, selectedClientId, selectedClientName) {
  const roster = [];
  const clientRows = clients || [];
  for (let index = 0; index < clientRows.length; index += 1) {
    const clientRow = clientRows[index];
    roster.push({
      id: String(clientRow.id),
      label: clientChipLabel(clientRow),
    });
  }

  if (!selectedClientId) {
    return roster;
  }

  let alreadyOnRoster = false;
  for (let index = 0; index < roster.length; index += 1) {
    if (roster[index].id === selectedClientId) {
      alreadyOnRoster = true;
      break;
    }
  }
  if (alreadyOnRoster) {
    return roster;
  }

  roster.unshift({
    id: String(selectedClientId),
    label: selectedClientName || CLIENT_NAME_FALLBACK,
  });
  return roster;
}

function buildSessionSavePayload({
  selectedClientId,
  selectedClientName,
  selectedDate,
  selectedTime,
  duration,
  whereOption,
  notes,
  sessionTypeId,
  isEdit,
  editing,
}) {
  const time24 = chipLabelToStoredTime(selectedTime);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const timeParts = time24.split(':');
  const hourText = timeParts[0];
  const minuteText = timeParts[1];
  const mergedStart = setDateParts(selectedDate, {
    hours: parseInt(hourText, 10),
    minutes: parseInt(minuteText, 10),
    seconds: 0,
    milliseconds: 0,
  });

  const typeLabel = findSessionTypeLabel(sessionTypeId);
  const trimmedNotes = notes.trim();

  let statusValue = SESSION_STATUS_PENDING;
  if (isEdit && editing != null && editing.status) {
    statusValue = editing.status;
  }

  let zoomLinkValue;
  if (whereOption === WHERE_VIDEO) {
    zoomLinkValue = PLACEHOLDER_ZOOM_LINK;
    if (editing != null && editing.zoomLink) {
      zoomLinkValue = editing.zoomLink;
    }
  }

  let clientNameValue;
  if (selectedClientName) {
    clientNameValue = selectedClientName;
  }

  let notesValue;
  if (trimmedNotes) {
    notesValue = trimmedNotes;
  }

  return {
    clientId: selectedClientId,
    clientName: clientNameValue,
    date: dateStr,
    time: time24,
    startAtMs: mergedStart.getTime(),
    durationMin: parseInt(duration, 10),
    status: statusValue,
    notes: notesValue,
    title: typeLabel,
    focus: typeLabel,
    zoomLink: zoomLinkValue,
  };
}

function extractNoticeProps(notice) {
  if (!notice) {
    return {
      title: '',
      message: undefined,
      confirmLabel: 'OK',
      cancelLabel: undefined,
      onConfirm: undefined,
    };
  }
  let title = '';
  if (notice.title) {
    title = notice.title;
  }
  let confirmLabel = 'OK';
  if (notice.confirmLabel) {
    confirmLabel = notice.confirmLabel;
  }
  return {
    title,
    message: notice.message,
    confirmLabel,
    cancelLabel: notice.cancelLabel,
    onConfirm: notice.onConfirm,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Neobrutalist session scheduler matching Design Law PNG 11/12.
 * Hooks stay in this order — do not reorder.
 */
export function ScheduleSessionScreen(props = {}) {
  const route = useContext(NavigationRouteContext);
  const navigation = useContext(NavigationContext);

  let routeParams = {};
  if (route != null && route.params != null) {
    routeParams = route.params;
  }

  let initialClientId = props.clientId;
  if (!initialClientId) {
    initialClientId = props.initialClientId;
  }
  if (!initialClientId) {
    initialClientId = routeParams.clientId;
  }
  if (!initialClientId) {
    initialClientId = routeParams.initialClientId;
  }

  let initialClientName = props.clientName;
  if (!initialClientName) {
    initialClientName = routeParams.clientName;
  }
  if (!initialClientName) {
    initialClientName = '';
  }

  let sessionId = props.sessionId;
  if (!sessionId) {
    sessionId = routeParams.sessionId;
  }

  let initialDate = props.initialDate;
  if (!initialDate) {
    initialDate = routeParams.initialDate;
  }
  if (!initialDate) {
    initialDate = routeParams.date;
  }

  const onNavigate = props.onNavigate;
  const embedded = props.embedded === true;

  const { colors } = useTheme();
  const scrollBottomPad = useModalScrollBottomPad(SCROLL_BOTTOM_PAD);

  const createSession = useCreateTrainingSession();
  const updateSession = useUpdateTrainingSession();
  const deleteSession = useDeleteTrainingSession();
  const getSession = useGetTrainingSession();

  let trainerUid = null;
  if (auth != null && auth.currentUser != null) {
    trainerUid = auth.currentUser.uid || null;
  }
  const { clients } = pagedTraineeList(trainerUid);

  let editing = undefined;
  if (sessionId) {
    editing = getSession(sessionId);
  }
  const isEdit = Boolean(editing);
  const today = useMemo(() => new Date(), []);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message, extras = {}) => setNotice({ title, message, ...extras });

  const initDate = useMemo(() => {
    if (editing != null && editing.date) {
      return new Date(`${editing.date}${NOON_ON_DAY_SUFFIX}`);
    }
    if (initialDate) {
      const dayKey = String(initialDate).slice(0, 10);
      return new Date(`${dayKey}${NOON_ON_DAY_SUFFIX}`);
    }
    return today;
  }, [editing, initialDate, today]);

  let startingClientId = '';
  if (editing != null && editing.clientId) {
    startingClientId = String(editing.clientId);
  }
  if (!startingClientId && initialClientId) {
    startingClientId = String(initialClientId);
  }

  let startingClientName = '';
  if (editing != null && editing.clientName) {
    startingClientName = editing.clientName;
  }
  if (!startingClientName && initialClientName) {
    startingClientName = initialClientName;
  }

  let startingSessionTypeSource = null;
  if (editing != null) {
    startingSessionTypeSource = editing.title || editing.focus || editing.type;
  }

  let startingTimeChip = DEFAULT_TIME_CHIP;
  if (editing != null && editing.time) {
    startingTimeChip = storedTimeToChipLabel(editing.time);
  }

  const startingDuration = resolveDuration(editing);

  let startingWhere = WHERE_IN_PERSON;
  if (editing != null && editing.zoomLink) {
    startingWhere = WHERE_VIDEO;
  }

  let startingNotes = '';
  if (editing != null && editing.notes != null) {
    startingNotes = editing.notes;
  }

  const [selectedClientId, setSelectedClientId] = useState(startingClientId);
  const [selectedClientName, setSelectedClientName] = useState(startingClientName);
  const [sessionTypeId, setSessionTypeId] = useState(
    sessionTypeIdFromStoredTitle(startingSessionTypeSource),
  );
  const [selectedDate, setSelectedDate] = useState(initDate);
  const [selectedTime, setSelectedTime] = useState(startingTimeChip);
  const [duration, setDuration] = useState(startingDuration);
  const [whereOption, setWhereOption] = useState(startingWhere);
  const [notes, setNotes] = useState(startingNotes);
  const [submitting, setSubmitting] = useState(false);

  const weekDates = useMemo(() => weekDatesStartingSunday(selectedDate), [selectedDate]);
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const monthLabel = format(selectedDate, 'MMMM yyyy');

  const clientChips = useMemo(
    () => buildClientChipList(clients, selectedClientId, selectedClientName),
    [clients, selectedClientId, selectedClientName],
  );

  let editingIdForEffect = null;
  if (editing != null) {
    editingIdForEffect = editing.id;
  }

  useEffect(() => {
    if (!editing) {
      return;
    }
    if (editing.date) {
      setSelectedDate(new Date(`${editing.date}${NOON_ON_DAY_SUFFIX}`));
    }
    if (editing.time) {
      setSelectedTime(storedTimeToChipLabel(editing.time));
    }
    setDuration(resolveDuration(editing));
    let nextWhere = WHERE_IN_PERSON;
    if (editing.zoomLink) {
      nextWhere = WHERE_VIDEO;
    }
    setWhereOption(nextWhere);
    let nextNotes = '';
    if (editing.notes != null) {
      nextNotes = editing.notes;
    }
    setNotes(nextNotes);
    if (editing.clientId) {
      setSelectedClientId(String(editing.clientId));
    }
    if (editing.clientName) {
      setSelectedClientName(editing.clientName);
    }
    setSessionTypeId(sessionTypeIdFromStoredTitle(editing.title || editing.focus || editing.type));
  }, [editingIdForEffect]);

  useEffect(() => {
    if (!selectedClientId || selectedClientName) {
      return;
    }
    const foundClient = findClientById(clients, selectedClientId);
    if (!foundClient) {
      return;
    }
    if (foundClient.name) {
      setSelectedClientName(foundClient.name);
      return;
    }
    if (foundClient.displayName) {
      setSelectedClientName(foundClient.displayName);
    }
  }, [clients, selectedClientId, selectedClientName]);

  const goBack = () => {
    let canGoBack = false;
    if (navigation != null && typeof navigation.canGoBack === 'function') {
      canGoBack = navigation.canGoBack();
    }
    if (canGoBack) {
      navigation.goBack();
      return;
    }
    if (typeof onNavigate === 'function') {
      onNavigate('/');
    }
  };

  const handleSubmit = async () => {
    if (!selectedClientId) {
      showNotice('Pick a client', 'Choose who this session is for.');
      return;
    }

    const payload = buildSessionSavePayload({
      selectedClientId,
      selectedClientName,
      selectedDate,
      selectedTime,
      duration,
      whereOption,
      notes,
      sessionTypeId,
      isEdit,
      editing,
    });

    setSubmitting(true);
    try {
      if (isEdit && sessionId) {
        await updateSession(sessionId, payload);
      } else {
        await createSession(payload);
      }
      goBack();
    } catch (error) {
      let errorMessage = 'Failed to save session';
      if (error != null && error.message) {
        errorMessage = error.message;
      }
      showNotice('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteSheet(true);
  };

  const confirmDelete = async () => {
    if (!sessionId) {
      return;
    }

    setDeleteBusy(true);
    try {
      await deleteSession(sessionId);
      setShowDeleteSheet(false);
      goBack();
    } catch (error) {
      let errorMessage = 'Failed to delete session';
      if (error != null && error.message) {
        errorMessage = error.message;
      }
      showNotice('Error', errorMessage);
    } finally {
      setDeleteBusy(false);
    }
  };

  const clientFirstName = firstNameOnly(selectedClientName || CLIENT_NAME_FALLBACK);
  const notifyHint = `${clientFirstName} gets: You have a new scheduled session.`;

  const handlePickClient = (clientId, clientLabel) => {
    setSelectedClientId(clientId);
    setSelectedClientName(clientLabel);
  };

  const handleCloseNotice = () => {
    setNotice(null);
  };

  const handleCloseDeleteSheet = () => {
    if (deleteBusy) {
      return;
    }
    setShowDeleteSheet(false);
  };

  const formBody = (
    <ScheduleSessionFormBody
      colors={colors}
      clientChips={clientChips}
      selectedClientId={selectedClientId}
      onPickClient={handlePickClient}
      sessionTypeId={sessionTypeId}
      onPickSessionType={setSessionTypeId}
      monthLabel={monthLabel}
      weekDates={weekDates}
      selectedDateKey={selectedDateKey}
      onPickDate={setSelectedDate}
      selectedTime={selectedTime}
      onPickTime={setSelectedTime}
      duration={duration}
      onPickDuration={setDuration}
      whereOption={whereOption}
      onPickWhere={setWhereOption}
      notes={notes}
      onNotesChange={setNotes}
      notifyHint={notifyHint}
      isEdit={isEdit}
      onDeletePress={handleDelete}
    />
  );

  const stickyFooter = (
    <StickySubmitFooter
      colors={colors}
      onBack={goBack}
      onSubmit={handleSubmit}
      submitting={submitting}
      isEdit={isEdit}
    />
  );

  let headerTitle = 'New session';
  if (isEdit) {
    headerTitle = 'Edit session';
  }
  const header = (
    <NbPageHeader
      title={headerTitle}
      onBack={goBack}
    />
  );

  const noticeProps = extractNoticeProps(notice);
  const noticeSheet = (
    <NbNoticeSheet
      visible={Boolean(notice)}
      onClose={handleCloseNotice}
      title={noticeProps.title}
      message={noticeProps.message}
      confirmLabel={noticeProps.confirmLabel}
      cancelLabel={noticeProps.cancelLabel}
      onConfirm={noticeProps.onConfirm}
    />
  );

  let deleteSheetClientName = selectedClientName;
  if (!deleteSheetClientName && editing != null) {
    deleteSheetClientName = editing.clientName;
  }
  const deleteSheet = (
    <DeleteSessionSheet
      visible={showDeleteSheet}
      onClose={handleCloseDeleteSheet}
      onConfirm={confirmDelete}
      clientName={deleteSheetClientName}
      busy={deleteBusy}
    />
  );

  return (
    <ScheduleSessionScreenShell
      embedded={embedded}
      colors={colors}
      scrollBottomPad={scrollBottomPad}
      header={header}
      formBody={formBody}
      stickyFooter={stickyFooter}
      deleteSheet={deleteSheet}
      noticeSheet={noticeSheet}
    />
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
