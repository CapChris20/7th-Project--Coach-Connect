// Design Law "New session" form: client chips, session type, date strip, time chips, length, where, notes, Send invite.
// Flow: load editing session if any → pick client/type/date/time/duration/location → create or update via mySessions hooks.
// Used from the trainer calendar tab and client scheduling entry points. Do not touch BookSessionScreen.
// Read order: constants → form layout pieces → shell → main screen → PLUMBING (time/payload helpers).
//
// vocab: NbChip custom children = day letter + number stack (must not wrap in Text)
// vocab: NbPageHeader = back square + title; owns status-bar inset
// Manipulate here: TIME_SLOTS list, SESSION_TYPES labels, DURATIONS labels ("90 min" only on last)

import React, { useContext, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek, set as setDateParts } from 'date-fns';
import { auth } from '../../app-start/cloudConnection';
import { FORM_SCROLL_PROPS, useModalScrollBottomPad } from '../../navigation/bottomMenuSpacing';
import { useCreateTrainingSession, useUpdateTrainingSession, useDeleteTrainingSession, useGetTrainingSession } from '../scheduling/mySessions';
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
const DURATIONS = [{
  id: '30',
  label: '30',
  min: 30
}, {
  id: '45',
  label: '45',
  min: 45
}, {
  id: '60',
  label: '60',
  min: 60
}, {
  id: '90',
  label: '90 min',
  min: 90
}];
const WHERE_OPTIONS = [{
  id: WHERE_IN_PERSON,
  label: 'In person'
}, {
  id: WHERE_VIDEO,
  label: 'Video link'
}];

// Manipulate here: evening-heavy slots match PNG 11; keep AM slots for morning books
const TIME_SLOTS = ['5:30 AM', '6:00 AM', '6:30 AM', '7:00 AM', '7:30 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '12:15 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '5:30 PM', '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM'];
const SESSION_TYPES = [{
  id: 'lower',
  label: 'Lower body'
}, {
  id: 'upper',
  label: 'Upper body'
}, {
  id: 'full',
  label: 'Full body'
}, {
  id: 'checkin',
  label: 'Check-in call'
}, {
  id: 'custom',
  label: 'Custom'
}];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// ===== PURE LAYOUT (no hooks) =====

function WeekDayChip({
  date,
  selected,
  colors,
  onSelect
}) {
  const dateKey = format(date, 'yyyy-MM-dd');
  const weekdayLetter = WEEKDAY_LABELS[date.getDay()];
  const dayNumberText = format(date, 'd');

  // Name ink before JSX — selected chips flip to on-fill text.
  const inkColor = selected ? colors.nbOnFill : colors.nbInk;
  const dotFillColor = selected ? inkColor : 'transparent';
  const handlePress = () => {
    onSelect(date);
  };
  return <NbChip selected={selected} onPress={handlePress} style={styles.dateChip} contentStyle={styles.dateChipInner}>
      <View style={styles.dateChipContent}>
        <Text style={[styles.dateChipDay, {
        color: inkColor
      }]}>{weekdayLetter}</Text>
        <Text style={[styles.dateChipDate, {
        color: inkColor
      }]}>{dayNumberText}</Text>
        <View style={[styles.dateDot, {
        borderColor: inkColor,
        backgroundColor: dotFillColor
      }]} />
      </View>
    </NbChip>;
}
function ClientChipStrip({
  clientChips,
  selectedClientId,
  onPickClient,
  colors
}) {
  const hasNoClients = clientChips.length === 0;
  if (hasNoClients) {
    return <Text style={[styles.hint, {
      color: colors.nbMuted
    }]}>
        Open this from a client profile, or add a client first.
      </Text>;
  }
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
      {clientChips.map(chip => {
      const chipIsSelected = chip.id === String(selectedClientId);
      const handlePress = () => {
        onPickClient(chip.id, chip.label);
      };
      return <NbChip key={chip.id} selected={chipIsSelected} onPress={handlePress}>
            {chip.label}
          </NbChip>;
    })}
    </ScrollView>;
}
function SessionTypeChipStrip({
  sessionTypeId,
  onPickSessionType
}) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipStrip}>
      {SESSION_TYPES.map(typeRow => {
      const typeIsSelected = sessionTypeId === typeRow.id;
      const handlePress = () => {
        onPickSessionType(typeRow.id);
      };
      return <NbChip key={typeRow.id} selected={typeIsSelected} onPress={handlePress}>
            {typeRow.label}
          </NbChip>;
    })}
    </ScrollView>;
}
function StartTimeSection({
  colors,
  monthLabel,
  weekDates,
  selectedDateKey,
  onPickDate,
  selectedTime,
  onPickTime
}) {
  const startTimeHeading = `START TIME · ${monthLabel.toUpperCase()}`;
  return <View style={styles.section}>
      <Text style={[styles.label, {
      color: colors.nbMuted
    }]}>{startTimeHeading}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
        {weekDates.map(date => {
        const dateKey = format(date, 'yyyy-MM-dd');
        const dateIsSelected = dateKey === selectedDateKey;
        return <WeekDayChip key={dateKey} date={date} selected={dateIsSelected} colors={colors} onSelect={onPickDate} />;
      })}
      </ScrollView>

      <View style={styles.timeGrid}>
        {TIME_SLOTS.map(timeChipLabel => {
        const timeIsSelected = selectedTime === timeChipLabel;
        const handlePress = () => {
          onPickTime(timeChipLabel);
        };
        return <NbChip key={timeChipLabel} selected={timeIsSelected} onPress={handlePress} style={styles.timeChip} contentStyle={styles.timeChipInner}>
              {timeChipLabel}
            </NbChip>;
      })}
      </View>
    </View>;
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
  onDeletePress
}) {
  const notesInputStyle = [styles.notesInput, {
    borderColor: colors.nbBorder,
    color: colors.nbInk,
    backgroundColor: colors.nbSurface
  }];
  return <View style={styles.formContainer}>
      <View style={styles.section}>
        <Text style={[styles.label, {
        color: colors.nbMuted
      }]}>CLIENT</Text>
        <ClientChipStrip clientChips={clientChips} selectedClientId={selectedClientId} onPickClient={onPickClient} colors={colors} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, {
        color: colors.nbMuted
      }]}>SESSION</Text>
        <SessionTypeChipStrip sessionTypeId={sessionTypeId} onPickSessionType={onPickSessionType} />
      </View>

      <StartTimeSection colors={colors} monthLabel={monthLabel} weekDates={weekDates} selectedDateKey={selectedDateKey} onPickDate={onPickDate} selectedTime={selectedTime} onPickTime={onPickTime} />

      <View style={styles.section}>
        <Text style={[styles.label, {
        color: colors.nbMuted
      }]}>LENGTH</Text>
        <NbSegmented segments={DURATIONS} selected={duration} onSelect={onPickDuration} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, {
        color: colors.nbMuted
      }]}>WHERE</Text>
        <NbSegmented segments={WHERE_OPTIONS} selected={whereOption} onSelect={onPickWhere} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.label, {
        color: colors.nbMuted
      }]}>NOTES</Text>
        <TextInput style={notesInputStyle} placeholder="Box squat depth. Bring a resistance band." placeholderTextColor={colors.nbMuted} multiline numberOfLines={3} value={notes} onChangeText={onNotesChange} textAlignVertical="top" />
        <Text style={[styles.hint, {
        color: colors.nbMuted
      }]}>{notifyHint}</Text>
      </View>

      {isEdit ? <TouchableOpacity onPress={onDeletePress} style={styles.deleteBtn}>
          <Text style={[styles.deleteText, {
        color: colors.nbInk
      }]}>Delete Session</Text>
        </TouchableOpacity> : null}
    </View>;
}
function StickySubmitFooter({
  colors,
  onBack,
  onSubmit,
  submitting,
  isEdit
}) {
  const footerShellStyle = [styles.stickyCTA, {
    borderTopColor: colors.nbBorder,
    backgroundColor: colors.nbSurface
  }];
  const backButtonStyle = [styles.footerBack, {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface
  }];
  const submitLabel = isEdit ? 'Save changes' : 'Send invite';
  return <View style={footerShellStyle}>
      <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
        <TouchableOpacity onPress={onBack} style={backButtonStyle} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
        </TouchableOpacity>
      </HardShadow>
      <View style={styles.footerCtaGrow}>
        <NbButton variant="fill" onPress={onSubmit} disabled={submitting}>
          {submitLabel}
        </NbButton>
      </View>
    </View>;
}
function ScheduleSessionScreenShell({
  embedded,
  colors,
  scrollBottomPad,
  header,
  formBody,
  stickyFooter,
  deleteSheet,
  noticeSheet
}) {
  const rootStyle = embedded ? styles.embeddedRoot : styles.root;
  const scrollContentStyle = [styles.scrollContent, {
    paddingBottom: scrollBottomPad
  }];
  return <View style={[rootStyle, {
    backgroundColor: colors.nbBackground
  }]}>
      {header}
      <ScrollView style={styles.scrollView} contentContainerStyle={scrollContentStyle} {...FORM_SCROLL_PROPS}>
        {formBody}
      </ScrollView>
      {stickyFooter}
      {deleteSheet}
      {noticeSheet}
    </View>;
}

// ===== MAIN =====

/**
 * Neobrutalist session scheduler matching Design Law PNG 11/12.
 * Hooks stay in this order — do not reorder.
 */
export function ScheduleSessionScreen(props = {}) {
  var _optObj;
  // vocab: NavigationRouteContext = route params without useRoute (works when embedded too)
  const route = useContext(NavigationRouteContext);
  const navigation = useContext(NavigationContext);
  // vocab/symbol: ?? = use right side only when left is null/undefined
  const routeParams = (route == null ? void 0 : route.params) ?? {};
  const initialClientId = props.clientId ?? props.initialClientId ?? routeParams.clientId ?? routeParams.initialClientId;
  const initialClientName = props.clientName ?? routeParams.clientName ?? '';
  const sessionId = props.sessionId ?? routeParams.sessionId;
  const initialDate = props.initialDate ?? routeParams.initialDate ?? routeParams.date;
  const onNavigate = props.onNavigate;
  const embedded = props.embedded === true;
  const {
    colors
  } = useTheme();
  const scrollBottomPad = useModalScrollBottomPad(SCROLL_BOTTOM_PAD);
  const createSession = useCreateTrainingSession();
  const updateSession = useUpdateTrainingSession();
  const deleteSession = useDeleteTrainingSession();
  const getSession = useGetTrainingSession();

  // Client chip row — same roster the calendar uses (pagedTraineeList)
  const trainerUid = ((_optObj = auth == null ? void 0 : auth.currentUser) == null ? void 0 : _optObj.uid) || null;
  const {
    clients
  } = pagedTraineeList(trainerUid);
  const editing = sessionId ? getSession(sessionId) : undefined;
  const isEdit = Boolean(editing);
  const today = useMemo(() => new Date(), []);
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message, extras = {}) => setNotice({
    title,
    message,
    ...extras
  });
  const initDate = useMemo(() => {
    if (editing == null ? void 0 : editing.date) {
      return new Date(`${editing.date}${NOON_ON_DAY_SUFFIX}`);
    }
    if (initialDate) {
      const dayKey = String(initialDate).slice(0, 10);
      return new Date(`${dayKey}${NOON_ON_DAY_SUFFIX}`);
    }
    return today;
  }, [editing, initialDate, today]);
  const [selectedClientId, setSelectedClientId] = useState(String((editing == null ? void 0 : editing.clientId) || initialClientId || ''));
  const [selectedClientName, setSelectedClientName] = useState((editing == null ? void 0 : editing.clientName) || initialClientName || '');
  const [sessionTypeId, setSessionTypeId] = useState(sessionTypeIdFromStoredTitle((editing == null ? void 0 : editing.title) || (editing == null ? void 0 : editing.focus) || (editing == null ? void 0 : editing.type)));
  const [selectedDate, setSelectedDate] = useState(initDate);
  const [selectedTime, setSelectedTime] = useState((editing == null ? void 0 : editing.time) ? storedTimeToChipLabel(editing.time) : DEFAULT_TIME_CHIP);
  const [duration, setDuration] = useState(String((editing == null ? void 0 : editing.durationMin) ?? (editing == null ? void 0 : editing.duration) ?? DEFAULT_DURATION_MIN));
  const [whereOption, setWhereOption] = useState((editing == null ? void 0 : editing.zoomLink) ? WHERE_VIDEO : WHERE_IN_PERSON);
  const [notes, setNotes] = useState((editing == null ? void 0 : editing.notes) ?? '');
  const [submitting, setSubmitting] = useState(false);

  // Week strip anchored on the selected date so month/week stay in sync when editing
  const weekDates = useMemo(() => weekDatesStartingSunday(selectedDate), [selectedDate]);
  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  // Dynamic month label (user requirement) — lives above the date strip
  const monthLabel = format(selectedDate, 'MMMM yyyy');
  const clientChips = useMemo(() => buildClientChipList(clients, selectedClientId, selectedClientName), [clients, selectedClientId, selectedClientName]);

  // When the editing session doc arrives, push its fields into the form.
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
    setDuration(String(editing.durationMin ?? editing.duration ?? DEFAULT_DURATION_MIN));
    setWhereOption(editing.zoomLink ? WHERE_VIDEO : WHERE_IN_PERSON);
    setNotes(editing.notes ?? '');
    if (editing.clientId) {
      setSelectedClientId(String(editing.clientId));
    }
    if (editing.clientName) {
      setSelectedClientName(editing.clientName);
    }
    setSessionTypeId(sessionTypeIdFromStoredTitle(editing.title || editing.focus || editing.type));
  }, [editing == null ? void 0 : editing.id]);

  // Prefer a real roster name once clients load (preselect may only have an id).
  useEffect(() => {
    if (!selectedClientId || selectedClientName) {
      return;
    }
    const foundClient = (clients || []).find(clientRow => String(clientRow.id) === String(selectedClientId));
    if ((foundClient == null ? void 0 : foundClient.name) || (foundClient == null ? void 0 : foundClient.displayName)) {
      setSelectedClientName(foundClient.name || foundClient.displayName);
    }
  }, [clients, selectedClientId, selectedClientName]);
  const goBack = () => {
    var _optFn;
    if ((_optFn = navigation == null ? void 0 : navigation.canGoBack) == null ? void 0 : _optFn()) {
      navigation.goBack();
      return;
    }
    onNavigate == null ? void 0 : onNavigate('/');
  };
  const handleSubmit = async () => {
    // 1. Client is required — nothing to save without an id.
    if (!selectedClientId) {
      showNotice('Pick a client', 'Choose who this session is for.');
      return;
    }

    // 2. Build Firestore payload (keys frozen: clientId, date, time, durationMin, …).
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
      editing
    });

    // 3. Create or update, then pop the screen.
    setSubmitting(true);
    try {
      if (isEdit && sessionId) {
        await updateSession(sessionId, payload);
      } else {
        await createSession(payload);
      }
      goBack();
    } catch (error) {
      showNotice('Error', (error == null ? void 0 : error.message) || 'Failed to save session');
    } finally {
      setSubmitting(false);
    }
  };
  const handleDelete = () => {
    setShowDeleteSheet(true);
  };
  const confirmDelete = async () => {
    // 1. Need a session id to delete.
    if (!sessionId) {
      return;
    }

    // 2. Delete, close the sheet, then leave the screen.
    setDeleteBusy(true);
    try {
      await deleteSession(sessionId);
      setShowDeleteSheet(false);
      goBack();
    } catch (error) {
      showNotice('Error', (error == null ? void 0 : error.message) || 'Failed to delete session');
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
  const formBody = <ScheduleSessionFormBody colors={colors} clientChips={clientChips} selectedClientId={selectedClientId} onPickClient={handlePickClient} sessionTypeId={sessionTypeId} onPickSessionType={setSessionTypeId} monthLabel={monthLabel} weekDates={weekDates} selectedDateKey={selectedDateKey} onPickDate={setSelectedDate} selectedTime={selectedTime} onPickTime={setSelectedTime} duration={duration} onPickDuration={setDuration} whereOption={whereOption} onPickWhere={setWhereOption} notes={notes} onNotesChange={setNotes} notifyHint={notifyHint} isEdit={isEdit} onDeletePress={handleDelete} />;
  const stickyFooter = <StickySubmitFooter colors={colors} onBack={goBack} onSubmit={handleSubmit} submitting={submitting} isEdit={isEdit} />;
  const headerTitle = isEdit ? 'Edit session' : 'New session';
  const header = <NbPageHeader title={headerTitle} onBack={goBack} />;
  const noticeSheet = <NbNoticeSheet visible={!!notice} onClose={handleCloseNotice} title={(notice == null ? void 0 : notice.title) || ''} message={notice == null ? void 0 : notice.message} confirmLabel={(notice == null ? void 0 : notice.confirmLabel) || 'OK'} cancelLabel={notice == null ? void 0 : notice.cancelLabel} onConfirm={notice == null ? void 0 : notice.onConfirm} />;
  const deleteSheetClientName = selectedClientName || (editing == null ? void 0 : editing.clientName);
  const deleteSheet = <DeleteSessionSheet visible={showDeleteSheet} onClose={handleCloseDeleteSheet} onConfirm={confirmDelete} clientName={deleteSheetClientName} busy={deleteBusy} />;
  return <ScheduleSessionScreenShell embedded={embedded} colors={colors} scrollBottomPad={scrollBottomPad} header={header} formBody={formBody} stickyFooter={stickyFooter} deleteSheet={deleteSheet} noticeSheet={noticeSheet} />;
}
export default ScheduleSessionScreen;

// ===== PLUMBING — skip unless debugging =====
// Time chip ↔ stored 24h string, week dates, save payload. Main screen stays above.

function storedTimeToChipLabel(timeStr) {
  if (!timeStr) {
    return DEFAULT_TIME_CHIP;
  }
  const [hourText, minuteText] = String(timeStr).split(':');
  const hour24 = parseInt(hourText, 10);
  const minute = parseInt(minuteText || '0', 10);
  const period = hour24 >= 12 ? 'PM' : 'AM';
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
  const weekStart = startOfWeek(anchorDate, {
    weekStartsOn: WEEK_STARTS_ON_SUNDAY
  });
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
  for (const typeRow of SESSION_TYPES) {
    const labelLower = typeRow.label.toLowerCase();
    if (titleLower.includes(labelLower) || titleLower === typeRow.id) {
      return typeRow.id;
    }
  }
  return SESSION_TYPE_FALLBACK_ID;
}
function findSessionTypeLabel(sessionTypeId) {
  for (const typeRow of SESSION_TYPES) {
    if (typeRow.id === sessionTypeId) {
      return typeRow.label;
    }
  }
  return SESSION_TYPE_FALLBACK_LABEL;
}
function buildClientChipList(clients, selectedClientId, selectedClientName) {
  const roster = [];
  for (const clientRow of clients || []) {
    roster.push({
      id: String(clientRow.id),
      label: clientRow.name || clientRow.displayName || CLIENT_NAME_FALLBACK
    });
  }

  // Ensure the preselected / editing client appears even if not on this page yet.
  if (!selectedClientId) {
    return roster;
  }
  const alreadyOnRoster = roster.some(chip => chip.id === selectedClientId);
  if (alreadyOnRoster) {
    return roster;
  }
  roster.unshift({
    id: String(selectedClientId),
    label: selectedClientName || CLIENT_NAME_FALLBACK
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
  editing
}) {
  const time24 = chipLabelToStoredTime(selectedTime);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const [hourText, minuteText] = time24.split(':');
  const mergedStart = setDateParts(selectedDate, {
    hours: parseInt(hourText, 10),
    minutes: parseInt(minuteText, 10),
    seconds: 0,
    milliseconds: 0
  });
  const typeLabel = findSessionTypeLabel(sessionTypeId);
  const trimmedNotes = notes.trim();
  const statusValue = isEdit ? (editing == null ? void 0 : editing.status) || SESSION_STATUS_PENDING : SESSION_STATUS_PENDING;
  let zoomLinkValue;
  if (whereOption === WHERE_VIDEO) {
    zoomLinkValue = (editing == null ? void 0 : editing.zoomLink) || PLACEHOLDER_ZOOM_LINK;
  }
  return {
    clientId: selectedClientId,
    clientName: selectedClientName || undefined,
    date: dateStr,
    time: time24,
    startAtMs: mergedStart.getTime(),
    durationMin: parseInt(duration, 10),
    status: statusValue,
    notes: trimmedNotes || undefined,
    title: typeLabel,
    focus: typeLabel,
    zoomLink: zoomLinkValue
  };
}
const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  embeddedRoot: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm
  },
  formContainer: {
    gap: spacing.lg
  },
  section: {
    gap: spacing.sm
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase'
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16
  },
  chipStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2
  },
  weekStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 4
  },
  dateChip: {
    minWidth: 52
  },
  dateChipInner: {
    minHeight: 64,
    paddingVertical: 8,
    paddingHorizontal: 10
  },
  dateChipContent: {
    alignItems: 'center',
    gap: 2
  },
  dateChipDay: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase'
  },
  dateChipDate: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16
  },
  dateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    marginTop: 4
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs || 4
  },
  // Manipulate here: ~3 columns — fixed % + HardShadow sibling needs a little headroom
  timeChip: {
    width: '31%'
  },
  timeChipInner: {
    minHeight: 44,
    paddingVertical: 10,
    width: '100%'
  },
  notesInput: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    minHeight: 88
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  deleteText: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk_700Bold',
    textDecorationLine: 'underline'
  },
  stickyCTA: {
    borderTopWidth: nb.borderWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  footerBack: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  footerCtaGrow: {
    flex: 1
  }
});
