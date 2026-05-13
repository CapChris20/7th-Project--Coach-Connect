import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
  Modal,
  Alert,
  Pressable,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Trash2,
  Video,
  StickyNote,
  Calendar,
  Clock,
  Hourglass,
  ChevronDown,
  Check,
  Users,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSessions } from '../../hooks/use-sessions';
import MarketplaceHeroCard from '../../client/components/MarketplaceHeroCard';
import { WheelPicker } from '../../components/WheelPicker';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DURATIONS = [15, 30, 45, 60, 75, 90, 120];

/** Dark pink + dark orange wheel chrome (Date / Time on session form) */
const warmWheelChrome = (isDark) =>
  isDark
    ? {
        glass: 'rgba(255, 107, 157, 0.07)',
        glassBorder: 'rgba(194, 65, 12, 0.38)',
        fadeEdge: '#0A0A0F',
        accent: '#FF6B9D',
        accentBandBg: 'rgba(234, 88, 12, 0.18)',
      }
    : {
        glass: 'rgba(255, 107, 157, 0.1)',
        glassBorder: 'rgba(194, 65, 12, 0.28)',
        fadeEdge: '#FFFFFF',
        accent: '#DB2777',
        accentBandBg: 'rgba(234, 88, 12, 0.12)',
      };

const warmSectionShell = (isDark) =>
  isDark
    ? {
        borderColor: 'rgba(249, 115, 22, 0.35)',
        backgroundColor: 'rgba(255, 107, 157, 0.05)',
        shadowColor: '#EA580C',
      }
    : {
        borderColor: 'rgba(219, 39, 119, 0.28)',
        backgroundColor: 'rgba(249, 115, 22, 0.07)',
        shadowColor: '#F97316',
      };

const COLORS = {
  dark: {
    bg: '#0A0A0F',
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.1)',
    glass: 'rgba(255,255,255,0.04)',
    glassBorder: 'rgba(255,255,255,0.08)',
    primary: '#FF6B9D',
    primaryLight: 'rgba(255,107,157,0.15)',
  },
  light: {
    bg: '#FFFFFF',
    text: '#000000',
    textSecondary: 'rgba(0,0,0,0.6)',
    border: 'rgba(0,0,0,0.1)',
    glass: 'rgba(0,0,0,0.04)',
    glassBorder: 'rgba(0,0,0,0.08)',
    primary: '#FF6B9D',
    primaryLight: 'rgba(255,107,157,0.15)',
  },
};

const pad = (n) => String(n).padStart(2, '0');
const daysInMonth = (year, month0) => new Date(year, month0 + 1, 0).getDate();

const AVATAR_GRADIENTS = [
  ['#FF6B9D', '#C084FC'],
  ['#8B5CF6', '#6366F1'],
  ['#EC4899', '#F472B6'],
  ['#14B8A6', '#0EA5E9'],
  ['#F59E0B', '#EF4444'],
  ['#A855F7', '#EC4899'],
];

const clientInitials = (name) => {
  if (!name || !String(name).trim()) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  const w = parts[0];
  return w.length >= 2 ? w.slice(0, 2).toUpperCase() : `${w[0]}`.toUpperCase();
};

const avatarGradientForClient = (id, name) => {
  const s = String(id || name || 'x');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
};

const SESSION_HERO_BENEFITS = [
  'Choose the client this appointment is for',
  'Set date, time, duration, and notes in one guided flow',
  'Optional Zoom link keeps everyone aligned',
  'They see the booking in their app when you save',
];

export const SessionFormScreen = ({ sessionId, theme = 'dark', onNavigate, initialDate, initialClientId, trainerName }) => {
  const colors = COLORS[theme] || COLORS.dark;
  const insets = useSafeAreaInsets();
  const { clients, addSession, updateSession, deleteSession, getSession } = useSessions();
  const editing = sessionId ? getSession(sessionId) : undefined;
  const isEdit = Boolean(editing);

  const today = new Date();
  const [clientId, setClientId] = useState(editing?.clientId ?? initialClientId ?? clients[0]?.id ?? '');
  const init = editing
    ? new Date(editing.date + 'T00:00:00')
    : initialDate
      ? new Date(String(initialDate).slice(0, 10) + 'T00:00:00')
      : today;
  const [year, setYear] = useState(init.getFullYear());
  const [month, setMonth] = useState(init.getMonth());
  const [day, setDay] = useState(init.getDate());

  const initHH = editing?.time ? parseInt(editing.time.split(':')[0], 10) : 9;
  const initMM = editing?.time ? parseInt(editing.time.split(':')[1], 10) : 0;
  const [hour12, setHour12] = useState(((initHH + 11) % 12) + 1);
  const [minute, setMinute] = useState(Math.round(initMM / 5) * 5);
  const [ampm, setAmpm] = useState(initHH >= 12 ? 'PM' : 'AM');

  const [duration, setDuration] = useState(editing?.durationMin ?? 60);
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [zoomLink, setZoomLink] = useState(editing?.zoomLink ?? '');

  const years = useMemo(() => {
    const arr = [];
    for (let y = today.getFullYear() - 1; y <= today.getFullYear() + 3; y++) arr.push(y);
    return arr;
  }, [today]);

  const maxDay = daysInMonth(year, month);
  const dayItems = useMemo(
    () => Array.from({ length: maxDay }, (_, i) => String(i + 1)),
    [maxDay]
  );
  const monthItems = useMemo(() => [...MONTHS], []);
  const yearItems = useMemo(() => years.map(String), [years]);

  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [maxDay, day]);

  useEffect(() => {
    if (!editing && !clientId && clients[0]?.id) setClientId(clients[0].id);
  }, [clients, editing, clientId]);

  useEffect(() => {
    if (!editing && initialClientId) setClientId((prev) => (prev ? prev : initialClientId));
  }, [editing, initialClientId]);

  const selectedClient = clients.find((c) => c.id === clientId);

  const handleSubmit = async () => {
    if (!clientId) {
      Alert.alert('Error', 'Pick a client first');
      return;
    }

    let h24 = hour12 % 12;
    if (ampm === 'PM') h24 += 12;
    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
    const timeStr = `${pad(h24)}:${pad(minute)}`;
    const startLocal = new Date(year, month, day, h24, minute);
    const payload = {
      clientId,
      clientName: selectedClient?.name || undefined,
      date: dateStr,
      time: timeStr,
      startAtMs: startLocal.getTime(),
      durationMin: duration,
      status: isEdit ? (editing?.status || 'pending') : 'pending',
      notes: notes.trim() || undefined,
      zoomLink: zoomLink.trim() || undefined,
    };

    try {
      if (isEdit && editing) {
        await updateSession(editing.id, payload);
      } else {
        await addSession(payload);
      }
      onNavigate?.('/');
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to save session');
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Session', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            if (editing) {
              await deleteSession(editing.id);
              onNavigate?.('/');
            }
          } catch (e) {
            Alert.alert('Error', e?.message || 'Failed to delete session');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const isDarkUi = theme === 'dark';
  const warmWheel = warmWheelChrome(isDarkUi);
  const warmShell = warmSectionShell(isDarkUi);
  const dateTimeIconOrange = isDarkUi ? '#FB923C' : '#C2410C';
  const dateTimeIconPink = isDarkUi ? '#FF6B9D' : '#DB2777';
  /** DATE / TIME headings + helper copy — higher contrast than default textSecondary */
  const dateTimeHeadingColor = isDarkUi ? 'rgba(255,255,255,0.94)' : 'rgba(15,23,42,0.92)';
  const dateTimeCaptionColor = isDarkUi ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.76)';

  return (
    <View style={[styles.root, { backgroundColor: isDarkUi ? '#0A0A0F' : '#FFFFFF' }]}>
      <View style={styles.container}>
        {/* Header — glass pills */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity
            onPress={() => onNavigate?.('/')}
            style={[styles.headerPill, { borderColor: colors.glassBorder, backgroundColor: colors.glass }]}
            activeOpacity={0.85}
          >
            <ArrowLeft color={colors.text} size={18} />
            <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
          </TouchableOpacity>
        </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: (isEdit ? 88 : 28) + insets.bottom }}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <MarketplaceHeroCard
          isDark={isDarkUi}
          onPress={handleSubmit}
          ctaLabel={isEdit ? 'Save changes' : 'Create session'}
          ctaIcon="checkmark-circle"
          label="Session hub"
          headline={isEdit ? 'Edit session' : 'New session'}
          subhead={
            isEdit
              ? 'Update any field below — your client sees the latest details after you save.'
              : 'Schedule a session — set date, time, and options below, then save from the button in this card.'
          }
          subheadColor={isDarkUi ? 'rgba(255,255,255,0.84)' : 'rgba(15,23,42,0.84)'}
          benefitTextColor={isDarkUi ? 'rgba(255,255,255,0.96)' : 'rgba(15,23,42,0.9)'}
          benefits={SESSION_HERO_BENEFITS}
          outerStyle={{ marginHorizontal: -16 }}
          accessibilityLabel="Session form overview"
        >
          {trainerName ? (
            <View
              style={[
                styles.heroTrainerRow,
                { borderColor: isDarkUi ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,15,0.1)' },
              ]}
            >
              <Users color={isDarkUi ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,15,0.55)'} size={16} />
              <Text
                style={[styles.heroTrainerText, { color: isDarkUi ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,15,0.62)' }]}
                numberOfLines={1}
              >
                Trainer: {trainerName}
              </Text>
            </View>
          ) : null}
          <Text
            style={[styles.heroFieldLabel, { color: isDarkUi ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)' }]}
          >
            Client
          </Text>
          <ClientDropdown
            clientId={clientId}
            onChangeClient={setClientId}
            clients={clients}
            colors={colors}
            triggerStyle={{
              backgroundColor: isDarkUi ? 'rgba(255,255,255,0.07)' : '#FFFFFF',
              borderColor: isDarkUi ? 'rgba(255,255,255,0.14)' : colors.glassBorder,
            }}
          />
          {selectedClient ? (
            <View
              style={[
                styles.clientBadge,
                { backgroundColor: colors.primaryLight, borderColor: 'rgba(255,107,157,0.35)' },
              ]}
            >
              <Text style={[styles.clientBadgeText, { color: colors.primary }]}>{selectedClient.name}</Text>
            </View>
          ) : null}
        </MarketplaceHeroCard>

        {/* Date — inline wheels (no full-screen modal lists) */}
        <FormSection
          title="Date"
          icon={<Calendar color={dateTimeIconOrange} size={16} />}
          colors={colors}
          shellStyle={warmShell}
          titleColor={dateTimeHeadingColor}
        >
          <View style={styles.dateGrid}>
            <WheelPicker
              label="Day"
              items={dayItems}
              value={String(day)}
              onChange={(v) => setDay(parseInt(v, 10))}
              theme={theme}
              height={176}
              {...warmWheel}
            />
            <WheelPicker
              label="Month"
              items={monthItems}
              value={MONTHS[month]}
              onChange={(v) => {
                const idx = MONTHS.indexOf(v);
                if (idx >= 0) setMonth(idx);
              }}
              theme={theme}
              height={176}
              {...warmWheel}
            />
            <WheelPicker
              label="Year"
              items={yearItems}
              value={String(year)}
              onChange={(v) => setYear(parseInt(v, 10))}
              theme={theme}
              height={176}
              {...warmWheel}
            />
          </View>
        </FormSection>

        {/* Time */}
        <FormSection
          title="Time"
          icon={<Clock color={dateTimeIconPink} size={16} />}
          colors={colors}
          shellStyle={warmShell}
          titleColor={dateTimeHeadingColor}
        >
          <View style={styles.timeGrid}>
            <WheelPicker
              label="Hour"
              items={Array.from({ length: 12 }, (_, i) => String(i + 1))}
              value={String(hour12)}
              onChange={(v) => setHour12(parseInt(v, 10))}
              theme={theme}
              {...warmWheel}
            />
            <WheelPicker
              label="Min"
              items={Array.from({ length: 12 }, (_, i) => pad(i * 5))}
              value={pad(minute)}
              onChange={(v) => setMinute(parseInt(v, 10))}
              theme={theme}
              {...warmWheel}
            />
            <WheelPicker
              label="AM/PM"
              items={['AM', 'PM']}
              value={ampm}
              onChange={(v) => setAmpm(v)}
              theme={theme}
              {...warmWheel}
            />
          </View>
          <Text style={[styles.timeNote, { color: dateTimeCaptionColor }]}>Scroll or drag · 5-minute steps</Text>
        </FormSection>

        {/* Duration */}
        <FormSection title="Duration" icon={<Hourglass color={colors.textSecondary} size={16} />} colors={colors}>
          <View style={styles.durationGrid}>
            {DURATIONS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.durationBtn,
                  {
                    backgroundColor: duration === d ? colors.primary : colors.glass,
                    borderColor: duration === d ? colors.primary : colors.glassBorder,
                  },
                ]}
                onPress={() => setDuration(d)}
                activeOpacity={0.85}
              >
                <Text style={[styles.durationBtnText, { color: duration === d ? 'white' : colors.text }]}>
                  {d < 60 ? `${d}m` : d % 60 === 0 ? `${d / 60}h` : `${Math.floor(d / 60)}h ${d % 60}m`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </FormSection>

        {/* Notes */}
        <FormSection title="Notes" icon={<StickyNote color={colors.textSecondary} size={16} />} colors={colors}>
          <TextInput
            style={[
              styles.textarea,
              {
                backgroundColor: colors.glass,
                borderColor: colors.glassBorder,
                color: colors.text,
              },
            ]}
            placeholder="Session focus, equipment, prep notes..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            value={notes}
            onChangeText={setNotes}
          />
        </FormSection>

        {/* Zoom */}
        <FormSection title="Video Link" icon={<Video color={colors.textSecondary} size={16} />} colors={colors}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.glass,
                borderColor: colors.glassBorder,
                color: colors.text,
              },
            ]}
            placeholder="https://zoom.us/j/..."
            placeholderTextColor={colors.textSecondary}
            value={zoomLink}
            onChangeText={setZoomLink}
            autoCapitalize="none"
          />
        </FormSection>

      </ScrollView>

      {isEdit ? (
        <View
          style={[
            styles.actionBar,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              borderTopColor: colors.glassBorder,
              backgroundColor: isDarkUi ? '#0A0A0F' : '#FFFFFF',
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.deleteBarBtn, { borderColor: 'rgba(239,68,68,0.45)', backgroundColor: isDarkUi ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.06)' }]}
            onPress={handleDelete}
            activeOpacity={0.85}
          >
            <Trash2 color="#EF4444" size={18} />
            <Text style={styles.deleteBarBtnText}>Delete session</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      </View>
    </View>
  );
};

export default SessionFormScreen;

const FormSection = ({ title, icon, colors, children, shellStyle, titleColor }) => (
  <View
    style={[
      styles.formSection,
      {
        backgroundColor: colors.glass,
        borderColor: colors.glassBorder,
        shadowColor: '#FF6B9D',
      },
      shellStyle,
    ]}
  >
    <View style={styles.formSectionHeader}>
      {icon}
      <Text style={[styles.formSectionTitle, { color: titleColor ?? colors.textSecondary }]}>{title.toUpperCase()}</Text>
    </View>
    <View style={styles.formSectionContent}>{children}</View>
  </View>
);

const ClientDropdown = ({ clientId, onChangeClient, clients, colors, triggerStyle }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const selectedClient = clients.find((c) => c.id === clientId);
  const sheetMaxH = Math.round(Dimensions.get('window').height * 0.52);

  return (
    <>
      <TouchableOpacity
        style={[styles.dropdown, { backgroundColor: colors.bg, borderColor: colors.glassBorder }, triggerStyle]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <View style={[styles.clientDot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.dropdownValue, { color: colors.text }]} numberOfLines={1}>
          {selectedClient?.name || 'Select a client'}
        </Text>
        <ChevronDown color={colors.textSecondary} size={18} />
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)} />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.bg,
                borderColor: colors.glassBorder,
                paddingBottom: Math.max(insets.bottom, 12),
                maxHeight: sheetMaxH + Math.max(insets.bottom, 12) + 24,
              },
            ]}
          >
            <View style={styles.modalGrabberWrap}>
              <View style={[styles.modalGrabber, { backgroundColor: colors.glassBorder }]} />
            </View>

            <View style={[styles.modalHeader, { borderBottomColor: colors.glassBorder }]}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalHeaderIcon, { backgroundColor: colors.primaryLight }]}>
                  <Users color={colors.primary} size={18} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Select client</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Who is this session for?
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={12}>
                <Text style={[styles.modalClose, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={clients}
              keyExtractor={(item) => item.id}
              style={{ maxHeight: sheetMaxH - 100 }}
              contentContainerStyle={styles.clientListContent}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item.id === clientId;
                const g = avatarGradientForClient(item.id, item.name);
                return (
                  <TouchableOpacity
                    style={[
                      styles.clientRow,
                      {
                        borderColor: selected ? colors.primary : colors.glassBorder,
                        backgroundColor: selected ? colors.primaryLight : colors.glass,
                        marginBottom: 8,
                      },
                    ]}
                    onPress={() => {
                      onChangeClient(item.id);
                      setModalVisible(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <LinearGradient
                      colors={g}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.clientAvatar}
                    >
                      <Text style={styles.clientAvatarText}>{clientInitials(item.name)}</Text>
                    </LinearGradient>
                    <Text style={[styles.clientRowName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {selected ? (
                      <View style={[styles.clientCheck, { backgroundColor: colors.primary }]}>
                        <Check color="#FFFFFF" size={14} strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={styles.clientCheckPlaceholder} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.clientListEmpty, { color: colors.textSecondary }]}>
                  No clients yet — add clients from your roster first.
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 600 },
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  backText: { fontSize: 14, fontWeight: '600' },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  formSection: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  formSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  formSectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  formSectionContent: { gap: 12 },
  dropdown: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clientDot: { width: 8, height: 8, borderRadius: 4 },
  dropdownValue: { fontSize: 15, fontWeight: '600', flex: 1 },
  heroTrainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  heroTrainerText: { flex: 1, fontSize: 13, fontWeight: '700' },
  heroFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  clientBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
    borderWidth: 1,
  },
  clientBadgeText: { fontSize: 12, fontWeight: '600' },
  dateGrid: { flexDirection: 'row', gap: 8 },
  timeGrid: { flexDirection: 'row', gap: 8 },
  timeNote: { fontSize: 11, marginTop: 8, textAlign: 'center' },
  durationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBtnText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, borderWidth: 1 },
  textarea: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    textAlignVertical: 'top',
    minHeight: 100,
  },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  deleteBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  deleteBarBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalGrabberWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  modalGrabber: { width: 40, height: 4, borderRadius: 2, opacity: 0.9 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 },
  modalHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  modalSubtitle: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  modalClose: { fontSize: 15, fontWeight: '700' },
  clientListContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 16 },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  clientRowName: { flex: 1, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  clientCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientCheckPlaceholder: { width: 26, height: 26 },
  clientListEmpty: { textAlign: 'center', paddingVertical: 28, paddingHorizontal: 24, fontSize: 14, lineHeight: 20 },
});

