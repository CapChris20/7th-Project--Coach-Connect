/**
 * Schedule Training Session — inline tab form, wheel pickers, theme-responsive.
 */
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
import { ArrowLeft, ArrowRight, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { format, getDaysInMonth, set as setDateParts } from 'date-fns';
import { FormRow } from '../../shared-ui';
import { useTheme } from '../../shared-ui/ThemeContext';
import { FORM_SCROLL_PROPS, useModalScrollBottomPad } from '../../navigation/bottomNavMetrics';
import {
  useCreateTrainingSession,
  useUpdateTrainingSession,
  useDeleteTrainingSession,
  useGetTrainingSession,
} from '../hooks/useMyTrainingSessions';
import {
  ACCENT_GRADIENT,
  DARK_PINK,
  getSessionSchedulingColors,
} from '../sessions/sessionSchedulingTheme';
import SessionWheelPicker from './components/SessionWheelPicker';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DURATIONS = [
  { label: '15m', min: 15 },
  { label: '30m', min: 30 },
  { label: '45m', min: 45 },
  { label: '1h', min: 60 },
  { label: '1h 15m', min: 75 },
  { label: '1h 30m', min: 90 },
  { label: '2h', min: 120 },
];

function parseTimeTo12(timeStr) {
  if (!timeStr) return { hour: 9, minute: 0, period: 'AM' };
  const [hStr, mStr] = String(timeStr).split(':');
  const h24 = parseInt(hStr, 10);
  const minute = Math.round(parseInt(mStr || '0', 10) / 5) * 5;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const hour = ((h24 + 11) % 12) + 1;
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

export function ScheduleTrainingSessionScreen(props = {}) {
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
  const colors = getSessionSchedulingColors(isDark);
  const scrollBottomPad = useModalScrollBottomPad(48);

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

  const [mounted, setMounted] = useState(false);
  const [month, setMonth] = useState(initDate.getMonth());
  const [day, setDay] = useState(initDate.getDate());
  const [year, setYear] = useState(initDate.getFullYear());
  const [hour, setHour] = useState(initTime.hour);
  const [minute, setMinute] = useState(initTime.minute);
  const [period, setPeriod] = useState(initTime.period);
  const [duration, setDuration] = useState(editing?.durationMin ?? editing?.duration ?? 60);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [videoLink, setVideoLink] = useState(editing?.zoomLink ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!editing) return;
    const d = buildInitialDate(editing, null, today);
    setMonth(d.getMonth());
    setDay(d.getDate());
    setYear(d.getFullYear());
    const t = parseTimeTo12(editing.time);
    setHour(t.hour);
    setMinute(t.minute);
    setPeriod(t.period);
    setDuration(editing.durationMin ?? editing.duration ?? 60);
    setNotes(editing.notes ?? '');
    setVideoLink(editing.zoomLink ?? '');
  }, [editing?.id, today]);

  const years = useMemo(() => {
    const start = today.getFullYear() - 1;
    const end = today.getFullYear() + 3;
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [today]);

  const daysInMonth = useMemo(() => getDaysInMonth(new Date(year, month, 1)), [year, month]);

  useEffect(() => {
    if (day > daysInMonth) setDay(daysInMonth);
  }, [day, daysInMonth]);

  const monthItems = useMemo(() => MONTHS.map((m, i) => ({ value: i, label: m })), []);
  const dayItems = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    [daysInMonth],
  );
  const yearItems = useMemo(() => years.map((y) => ({ value: y, label: String(y) })), [years]);
  const hourItems = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) })),
    [],
  );
  const minuteItems = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: String(i * 5).padStart(2, '0') })),
    [],
  );
  const periodItems = useMemo(
    () => [
      { value: 'AM', label: 'AM' },
      { value: 'PM', label: 'PM' },
    ],
    [],
  );

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

  const body = (
    <>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityLabel="Back">
          <ArrowLeft color={colors.text} size={22} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Schedule Session</Text>
      </View>

      <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <FormRow label="Client" mutedColor={colors.label} borderColor={colors.divider}>
          <Text style={[styles.readOnlyField, { color: DARK_PINK }]}>{clientName}</Text>
        </FormRow>

        <FormRow label="Date" mutedColor={colors.label} borderColor={colors.divider}>
          {mounted ? (
            <View style={[styles.wheelRow, { backgroundColor: colors.wheelShell }]}>
              <SessionWheelPicker
                data={monthItems}
                value={month}
                onValueChanged={({ item }) => setMonth(item.value)}
                inactiveTextColor={colors.wheelInactive}
              />
              <SessionWheelPicker
                data={dayItems}
                value={Math.min(day, daysInMonth)}
                onValueChanged={({ item }) => setDay(item.value)}
                inactiveTextColor={colors.wheelInactive}
              />
              <SessionWheelPicker
                data={yearItems}
                value={year}
                onValueChanged={({ item }) => setYear(item.value)}
                inactiveTextColor={colors.wheelInactive}
              />
            </View>
          ) : (
            <View style={[styles.wheelPlaceholder, { backgroundColor: colors.wheelShell }]} />
          )}
        </FormRow>

        <FormRow label="Time" mutedColor={colors.label} borderColor={colors.divider}>
          {mounted ? (
            <View style={[styles.wheelRow, styles.timeRow, { backgroundColor: colors.wheelShell }]}>
              <SessionWheelPicker
                data={hourItems}
                value={hour}
                onValueChanged={({ item }) => setHour(item.value)}
                inactiveTextColor={colors.wheelInactive}
              />
              <Text style={[styles.colon, { color: colors.muted }]}>:</Text>
              <SessionWheelPicker
                data={minuteItems}
                value={minute}
                onValueChanged={({ item }) => setMinute(item.value)}
                inactiveTextColor={colors.wheelInactive}
              />
              <SessionWheelPicker
                data={periodItems}
                value={period}
                onValueChanged={({ item }) => setPeriod(item.value)}
                inactiveTextColor={colors.wheelInactive}
              />
            </View>
          ) : (
            <View style={[styles.wheelPlaceholder, { backgroundColor: colors.wheelShell }]} />
          )}
        </FormRow>

        <FormRow label="Duration" mutedColor={colors.label} borderColor={colors.divider}>
          <View style={styles.durationRow}>
            {DURATIONS.map((d) => {
              const active = duration === d.min;
              if (active) {
                return (
                  <LinearGradient
                    key={d.min}
                    colors={ACCENT_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.durationPillActive}
                  >
                    <TouchableOpacity onPress={() => setDuration(d.min)} style={styles.durationPillHit}>
                      <Text style={styles.durationPillTextActive}>{d.label}</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                );
              }
              return (
                <TouchableOpacity
                  key={d.min}
                  onPress={() => setDuration(d.min)}
                  style={[
                    styles.durationPill,
                    { backgroundColor: colors.wheelShell, borderColor: colors.divider },
                  ]}
                >
                  <Text style={[styles.durationPillText, { color: colors.muted }]}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FormRow>

        <FormRow label="Notes" mutedColor={colors.label} borderColor={colors.divider}>
          <TextInput
            style={[styles.input, { borderColor: colors.divider, color: colors.text, backgroundColor: colors.inputBg }]}
            placeholder="Session focus, equipment, prep notes..."
            placeholderTextColor={colors.muted}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
            textAlignVertical="top"
          />
        </FormRow>

        <FormRow label="Video link" mutedColor={colors.label} borderColor={colors.divider}>
          <TextInput
            style={[styles.input, { borderColor: colors.divider, color: colors.text, backgroundColor: colors.inputBg }]}
            placeholder="https://zoom.us/j/..."
            placeholderTextColor={colors.muted}
            keyboardType="url"
            autoCapitalize="none"
            value={videoLink}
            onChangeText={setVideoLink}
          />
        </FormRow>
      </View>

      <TouchableOpacity onPress={handleSubmit} disabled={submitting} activeOpacity={0.9} style={styles.submitWrap}>
        <LinearGradient
          colors={ACCENT_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.submitGradient}
        >
          <Check color="#FFFFFF" size={18} />
          <Text style={styles.submitText}>{isEdit ? 'Update Session' : 'Create Session'}</Text>
          <ArrowRight color="#FFFFFF" size={18} />
        </LinearGradient>
      </TouchableOpacity>

      {isEdit ? (
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Delete Session</Text>
        </TouchableOpacity>
      ) : null}
    </>
  );

  if (embedded) {
    return <View style={[styles.embeddedRoot, { paddingBottom: scrollBottomPad }]}>{body}</View>;
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.bg }]}
      contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
      {...FORM_SCROLL_PROPS}
    >
      {body}
    </ScrollView>
  );
}

export default ScheduleTrainingSessionScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  embeddedRoot: {
    gap: 16,
  },
  scroll: {
    padding: 20,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  formCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  readOnlyField: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 4,
  },
  wheelRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  timeRow: { justifyContent: 'center' },
  colon: { fontSize: 24, fontWeight: '300', marginHorizontal: -2 },
  wheelPlaceholder: { height: 200, borderRadius: 10 },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  durationPill: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  durationPillActive: { borderRadius: 10, overflow: 'hidden' },
  durationPillHit: { paddingHorizontal: 14, paddingVertical: 10 },
  durationPillText: { fontSize: 14, fontWeight: '600' },
  durationPillTextActive: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 44,
  },
  submitWrap: { borderRadius: 12, overflow: 'hidden' },
  submitGradient: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  deleteBtn: { alignItems: 'center', paddingVertical: 8 },
  deleteText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});
