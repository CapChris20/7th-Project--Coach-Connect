// Schedule / edit a training session: pick a date, a start time and a length, add notes, save.
// Flow: load the session being edited if any → pick date, time and length with chips → create or update through the mySessions hooks.
// Used from the trainer calendar tab and from client scheduling entry points.

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NavigationContext, NavigationRouteContext } from '@react-navigation/native';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { format, getDaysInMonth, set as setDateParts } from 'date-fns';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { NbButton } from '../../look-and-feel/nb/NbButton';
import { NbChip } from '../../look-and-feel/nb/NbChip';
import { NbField } from '../../look-and-feel/nb/NbField';
import { NbSegmented } from '../../look-and-feel/nb/NbSegmented';
import { NbSurface } from '../../look-and-feel/nb/NbSurface';
import {
  MINIMUM_TOUCH_SIZE,
  NB_RADIUS,
  NB_SPACING,
  NB_TEXT_ON_ACCENT,
  getNbAccent,
  getNbColors,
} from '../../look-and-feel/nb/nbTokens';
import { FORM_SCROLL_PROPS, useModalScrollBottomPad } from '../../navigation/bottomMenuSpacing';
import {
  useCreateTrainingSession,
  useUpdateTrainingSession,
  useDeleteTrainingSession,
  useGetTrainingSession,
} from '../scheduling/mySessions';

// ===== NAMED CONSTANTS =====

const NOON_HOUR_FOR_DATE_PARSE = 12;
const MINUTE_SNAP = 5;
const DEFAULT_DURATION_MIN = 60;
const SCROLL_BOTTOM_PAD = 48;
const HOURS_ON_12H_CLOCK = 12;
const DAY_CHIP_WIDTH = 56;
const DAY_CHIP_GAP = 8;
const DAYS_SHOWN_BEFORE_SELECTED = 2;
const HOUR_CHIP_WIDTH = 52;
const AVATAR_SIZE = 48;
const AVATAR_ACCENT_POSITION = 2;
const TITLE_FONT_SIZE = 24;
const SECTION_LABEL_FONT_SIZE = 12;

const QUARTER_HOUR_MINUTES = [0, 15, 30, 45];

const DURATIONS = [
  { label: '15m', min: 15 },
  { label: '30m', min: 30 },
  { label: '45m', min: 45 },
  { label: '1h', min: DEFAULT_DURATION_MIN },
  { label: '1h 15m', min: 75 },
  { label: '1h 30m', min: 90 },
  { label: '2h', min: 120 },
];

const PERIOD_CHOICES = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
];

// ===== HELPER FUNCTIONS =====

function parseTimeTo12(timeStr) {
  if (!timeStr) return { hour: 9, minute: 0, period: 'AM' };
  const [hStr, mStr] = String(timeStr).split(':');
  const h24 = parseInt(hStr, 10);
  const minute = Math.round(parseInt(mStr || '0', 10) / MINUTE_SNAP) * MINUTE_SNAP;
  const period = h24 >= NOON_HOUR_FOR_DATE_PARSE ? 'PM' : 'AM';
  const hour = ((h24 + 11) % HOURS_ON_12H_CLOCK) + 1;
  return { hour, minute, period };
}

function build24HourTime(hour12, minute, period) {
  let h24 = hour12 % 12;
  if (period === 'PM') h24 += 12;
  return { h24, minute };
}

function buildInitialDate(editing, initialDate, today) {
  if (editing?.date) return new Date(`${editing.date}T12:00:00`);
  if (initialDate) return new Date(`${String(initialDate).slice(0, 10)}T12:00:00`);
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

/**
 * Quarter-hour choices, plus the saved minute when an older session used something else like :05.
 * @param {number} currentMinute
 * @returns {Array<{value: number, label: string}>}
 */
function buildMinuteChoices(currentMinute) {
  const minutes = QUARTER_HOUR_MINUTES.includes(currentMinute)
    ? QUARTER_HOUR_MINUTES
    : [...QUARTER_HOUR_MINUTES, currentMinute].sort((a, b) => a - b);
  return minutes.map((minute) => ({ value: minute, label: `:${String(minute).padStart(2, '0')}` }));
}

/**
 * @param {number} durationMin
 * @returns {string} The chip label for known lengths, otherwise "N min".
 */
function describeDuration(durationMin) {
  const known = DURATIONS.find((item) => item.min === durationMin);
  return known ? known.label : `${durationMin} min`;
}

/**
 * @param {number} hour
 * @param {number} minute
 * @param {string} period
 * @returns {string} For example "9:00 AM".
 */
function describeTime(hour, minute, period) {
  return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
}

// ===== IN-FILE PIECES =====

/**
 * Small uppercase title above each part of the form.
 * @param {object} props
 * @param {string} props.text
 * @param {string} props.color
 * @returns {JSX.Element}
 */
function SectionLabel({ text, color }) {
  return <Text style={[styles.sectionLabel, { color }]}>{text}</Text>;
}

/**
 * Square outlined button that holds one icon (back, previous month, next month).
 * @param {object} props
 * @param {Function} props.onPress
 * @param {string} props.label Screen-reader name.
 * @param {React.ReactNode} props.children The icon.
 * @returns {JSX.Element}
 */
function IconSquare({ onPress, label, children }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <NbSurface radius={NB_RADIUS.chip} hasShadow={false} innerStyle={styles.iconSquare}>
        {children}
      </NbSurface>
    </Pressable>
  );
}

/**
 * Who the session is with: a round initial and the name.
 * @param {object} props
 * @param {string} props.clientName
 * @param {object} props.colors
 * @returns {JSX.Element}
 */
function ClientBanner({ clientName, colors }) {
  const initial = String(clientName || 'C').trim().charAt(0).toUpperCase();
  return (
    <NbSurface innerStyle={styles.bannerInner}>
      <NbSurface accent={getNbAccent(AVATAR_ACCENT_POSITION)} radius={AVATAR_SIZE / 2} hasShadow={false} innerStyle={styles.avatar}>
        <Text style={styles.avatarLetter}>{initial}</Text>
      </NbSurface>
      <View style={styles.bannerText}>
        <Text numberOfLines={1} style={[styles.clientName, { color: colors.ink }]}>
          {clientName}
        </Text>
        <Text style={[styles.bannerSub, { color: colors.muted }]}>Training session</Text>
      </View>
    </NbSurface>
  );
}

/**
 * Month name with previous and next arrows, then one scrolling row of day chips for that month.
 * @param {object} props
 * @returns {JSX.Element}
 */
function DatePicker({ year, month, day, daysInMonth, colors, onPreviousMonth, onNextMonth, onPickDay }) {
  const scrollRef = useRef(null);
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const monthTitle = format(new Date(year, month, 1), 'MMMM yyyy');

  const scrollToSelectedDay = () => {
    const firstVisibleDay = Math.max(0, day - 1 - DAYS_SHOWN_BEFORE_SELECTED);
    scrollRef.current?.scrollTo({ x: firstVisibleDay * (DAY_CHIP_WIDTH + DAY_CHIP_GAP), animated: false });
  };

  return (
    <View style={styles.sectionGap}>
      <View style={styles.monthRow}>
        <IconSquare onPress={onPreviousMonth} label="Previous month">
          <ChevronLeft color={colors.ink} size={22} />
        </IconSquare>
        <Text style={[styles.monthTitle, { color: colors.ink }]}>{monthTitle}</Text>
        <IconSquare onPress={onNextMonth} label="Next month">
          <ChevronRight color={colors.ink} size={22} />
        </IconSquare>
      </View>
      <ScrollView
        key={`${year}-${month}`}
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={scrollToSelectedDay}
        contentContainerStyle={styles.chipRow}
      >
        {days.map((dayNumber) => (
          <NbChip
            key={dayNumber}
            width={DAY_CHIP_WIDTH}
            smallLabel={format(new Date(year, month, dayNumber), 'EEE')}
            label={String(dayNumber)}
            isSelected={dayNumber === day}
            onPress={() => onPickDay(dayNumber)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Hour chips, then minutes and AM/PM side by side.
 * @param {object} props
 * @returns {JSX.Element}
 */
function TimePicker({ hour, minute, period, onPickHour, onPickMinute, onPickPeriod }) {
  const hours = Array.from({ length: HOURS_ON_12H_CLOCK }, (_, index) => index + 1);
  return (
    <View style={styles.sectionGap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {hours.map((hourNumber) => (
          <NbChip
            key={hourNumber}
            width={HOUR_CHIP_WIDTH}
            label={String(hourNumber)}
            isSelected={hourNumber === hour}
            onPress={() => onPickHour(hourNumber)}
          />
        ))}
      </ScrollView>
      <View style={styles.minuteRow}>
        <NbSegmented style={styles.minuteSegments} choices={buildMinuteChoices(minute)} value={minute} onChange={onPickMinute} />
        <NbSegmented style={styles.periodSegments} choices={PERIOD_CHOICES} value={period} onChange={onPickPeriod} />
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Inline schedule / edit session form for the trainer calendar.
 * @param {object} [props]
 */
export function ScheduleSessionScreen(props = {}) {
  // 1. Read who the session is for and where we came from.
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

  const { isDark } = useTheme();
  const colors = getNbColors(isDark);
  const scrollBottomPad = useModalScrollBottomPad(SCROLL_BOTTOM_PAD);

  // 2. Hooks that create, update, delete and look up sessions.
  const createSession = useCreateTrainingSession();
  const updateSession = useUpdateTrainingSession();
  const deleteSession = useDeleteTrainingSession();
  const getSession = useGetTrainingSession();

  const editing = sessionId ? getSession(sessionId) : undefined;
  const isEdit = Boolean(editing);
  const today = useMemo(() => new Date(), []);

  const initDate = useMemo(
    () => buildInitialDate(editing, initialDate, today),
    [editing, initialDate, today],
  );
  const initTime = useMemo(() => parseTimeTo12(editing?.time), [editing?.time]);

  // 3. The form values the person is choosing.
  const [month, setMonth] = useState(initDate.getMonth());
  const [day, setDay] = useState(initDate.getDate());
  const [year, setYear] = useState(initDate.getFullYear());
  const [hour, setHour] = useState(initTime.hour);
  const [minute, setMinute] = useState(initTime.minute);
  const [period, setPeriod] = useState(initTime.period);
  const [duration, setDuration] = useState(editing?.durationMin ?? editing?.duration ?? DEFAULT_DURATION_MIN);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [videoLink, setVideoLink] = useState(editing?.zoomLink ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const initial = buildInitialDate(editing, null, today);
    setMonth(initial.getMonth());
    setDay(initial.getDate());
    setYear(initial.getFullYear());
    const parsedTime = parseTimeTo12(editing.time);
    setHour(parsedTime.hour);
    setMinute(parsedTime.minute);
    setPeriod(parsedTime.period);
    setDuration(editing.durationMin ?? editing.duration ?? DEFAULT_DURATION_MIN);
    setNotes(editing.notes ?? '');
    setVideoLink(editing.zoomLink ?? '');
  }, [editing?.id, today]);

  const daysInMonth = useMemo(() => getDaysInMonth(new Date(year, month, 1)), [year, month]);

  useEffect(() => {
    if (day > daysInMonth) setDay(daysInMonth);
  }, [day, daysInMonth]);

  // 4. Handlers: leave the screen, change month, save, delete.
  const goBack = () => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    onNavigate?.('/');
  };

  const goToPreviousMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
      return;
    }
    setMonth(month - 1);
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
      return;
    }
    setMonth(month + 1);
  };

  const handleSubmit = async () => {
    if (!clientId) {
      Alert.alert('Missing client', 'Open this screen from a client profile.');
      return;
    }

    const { h24, minute: mm } = build24HourTime(hour, minute, period);
    const merged = setDateParts(new Date(year, month, day), {
      hours: h24,
      minutes: mm,
      seconds: 0,
      milliseconds: 0,
    });

    const payload = {
      clientId,
      clientName: clientName || undefined,
      date: format(merged, 'yyyy-MM-dd'),
      time: format(merged, 'HH:mm'),
      startAtMs: merged.getTime(),
      durationMin: duration,
      status: isEdit ? editing?.status || 'pending' : 'pending',
      notes: notes.trim() || undefined,
      zoomLink: videoLink.trim() || undefined,
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

  // 5. Build the page: header, client, date, start time, length, notes, summary, actions.
  const summaryDate = format(new Date(year, month, day), 'EEE, MMM d');
  const summaryLine = `${summaryDate} · ${describeTime(hour, minute, period)} · ${describeDuration(duration)}`;
  const saveLabel = isEdit ? 'Update session' : 'Book session';

  const body = (
    <>
      <View style={styles.headerRow}>
        <IconSquare onPress={goBack} label="Back">
          <ArrowLeft color={colors.ink} size={22} />
        </IconSquare>
        <Text style={[styles.screenTitle, { color: colors.ink }]}>{isEdit ? 'Edit session' : 'New session'}</Text>
      </View>

      <ClientBanner clientName={clientName} colors={colors} />

      <View style={styles.sectionGap}>
        <SectionLabel text="Date" color={colors.ink} />
        <DatePicker
          year={year}
          month={month}
          day={day}
          daysInMonth={daysInMonth}
          colors={colors}
          onPreviousMonth={goToPreviousMonth}
          onNextMonth={goToNextMonth}
          onPickDay={setDay}
        />
      </View>

      <View style={styles.sectionGap}>
        <SectionLabel text="Start time" color={colors.ink} />
        <TimePicker
          hour={hour}
          minute={minute}
          period={period}
          onPickHour={setHour}
          onPickMinute={setMinute}
          onPickPeriod={setPeriod}
        />
      </View>

      <View style={styles.sectionGap}>
        <SectionLabel text="Length" color={colors.ink} />
        <View style={styles.wrapRow}>
          {DURATIONS.map((item) => (
            <NbChip
              key={item.min}
              label={item.label}
              isSelected={duration === item.min}
              onPress={() => setDuration(item.min)}
            />
          ))}
        </View>
      </View>

      <NbField
        label="Notes"
        multiline
        placeholder="Session focus, equipment, prep notes..."
        value={notes}
        onChangeText={setNotes}
      />

      <NbField
        label="Video link (optional)"
        placeholder="https://zoom.us/j/..."
        keyboardType="url"
        autoCapitalize="none"
        value={videoLink}
        onChangeText={setVideoLink}
      />

      <NbSurface innerStyle={styles.summaryInner}>
        <Text style={[styles.summaryEyebrow, { color: colors.muted }]}>Your session</Text>
        <Text style={[styles.summaryText, { color: colors.ink }]}>{summaryLine}</Text>
      </NbSurface>

      <NbButton label={saveLabel} onPress={handleSubmit} isLoading={submitting} />

      {isEdit ? (
        <NbButton label="Delete session" variant="plain" labelColor={colors.danger} onPress={handleDelete} />
      ) : null}
    </>
  );

  // 6. Embedded in the calendar tab, or a full screen on its own.
  if (embedded) {
    return <View style={[styles.embeddedRoot, { paddingBottom: scrollBottomPad }]}>{body}</View>;
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
      {...FORM_SCROLL_PROPS}
    >
      {body}
    </ScrollView>
  );
}

export default ScheduleSessionScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  embeddedRoot: { gap: NB_SPACING.huge },
  scroll: { padding: NB_SPACING.large + 4, gap: NB_SPACING.huge },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: NB_SPACING.medium },
  screenTitle: { fontSize: TITLE_FONT_SIZE, fontWeight: '800', letterSpacing: -0.4 },
  iconSquare: {
    width: MINIMUM_TOUCH_SIZE,
    height: MINIMUM_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: NB_SPACING.medium,
    padding: NB_SPACING.medium,
  },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 20, fontWeight: '800', color: NB_TEXT_ON_ACCENT },
  bannerText: { flex: 1 },
  clientName: { fontSize: 18, fontWeight: '800' },
  bannerSub: { fontSize: 13, fontWeight: '500' },
  sectionGap: { gap: NB_SPACING.medium },
  sectionLabel: {
    fontSize: SECTION_LABEL_FONT_SIZE,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthTitle: { fontSize: 18, fontWeight: '800' },
  chipRow: { gap: DAY_CHIP_GAP, paddingBottom: NB_SPACING.small, paddingRight: NB_SPACING.small },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: NB_SPACING.small },
  minuteRow: { flexDirection: 'row', gap: NB_SPACING.medium },
  minuteSegments: { flex: 2 },
  periodSegments: { flex: 1 },
  summaryInner: { padding: NB_SPACING.large, gap: NB_SPACING.tiny },
  summaryEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  summaryText: { fontSize: 17, fontWeight: '800' },
});
