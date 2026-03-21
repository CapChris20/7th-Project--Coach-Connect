/**
 * SessionSchedulerScreen — Schedule tab for trainer client detail.
 * Week / Month / Year views; add/edit/delete blocks. Firestore: trainer_clients/{trainerId}_{clientId}/schedule/{blockId}
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getScheduleBlocks,
  subscribeScheduleBlocks,
  addScheduleBlock,
  updateScheduleBlock,
  deleteScheduleBlock,
} from '../services/scheduleService';

const BLOCK_COLORS = {
  Workout: '#64D2FF',
  Meal: '#FF9F0A',
  'Check-in': '#10B981',
  Session: '#AF52DE',
};

const BLOCK_ICONS = {
  Workout: 'barbell-outline',
  Meal: 'restaurant-outline',
  'Check-in': 'checkmark-circle-outline',
  Session: 'videocam-outline',
};

const BLOCK_TYPES = ['Workout', 'Meal', 'Check-in', 'Session'];
const REPEAT_OPTIONS = ['None', 'Daily', 'Weekly'];

const CARD_BG = 'rgba(255,255,255,0.05)';
const CARD_BORDER = 'rgba(255,255,255,0.10)';
const CYAN = '#64D2FF';
const SAVE_GRADIENT = ['#5B86E5', '#A855F7'];

function getWeekDays(centerDate) {
  const d = new Date(centerDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return x;
  });
}

function toDateKey(date) {
  return date.toISOString().split('T')[0];
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = String(timeStr).split(':').map(Number);
  if (h === 12) return `12:${String(m || 0).padStart(2, '0')} PM`;
  if (h > 12) return `${h - 12}:${String(m || 0).padStart(2, '0')} PM`;
  return `${h || 12}:${String(m || 0).padStart(2, '0')} AM`;
}

function timeToStr(date) {
  const h = date.getHours();
  const m = date.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isValidHttpsUrl(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  return t === '' || (t.startsWith('https://') && t.length > 8);
}

export default function SessionSchedulerScreen({
  isDark,
  trainerId,
  clientId,
  clientName,
}) {
  const [viewMode, setViewMode] = useState('Week');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [formType, setFormType] = useState('Session');
  const [formDate, setFormDate] = useState(() => new Date());
  const [formTime, setFormTime] = useState(() => new Date());
  const [formTitle, setFormTitle] = useState('');
  const [formSessionLink, setFormSessionLink] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formRepeat, setFormRepeat] = useState('None');

  const dateKey = toDateKey(selectedDate);
  const weekDays = getWeekDays(selectedDate);

  useEffect(() => {
    if (!trainerId || !clientId) {
      setBlocks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeScheduleBlocks(trainerId, clientId, dateKey, (list) => {
      setBlocks(list);
      setLoading(false);
    });
    return () => unsub();
  }, [trainerId, clientId, dateKey]);

  const openAdd = () => {
    setEditingBlock(null);
    setFormType('Session');
    setFormDate(new Date(selectedDate));
    setFormTime(new Date());
    setFormTitle('');
    setFormSessionLink('');
    setFormNotes('');
    setFormRepeat('None');
    setModalVisible(true);
  };

  const openEdit = (block) => {
    setEditingBlock(block);
    setFormType(block.type || 'Session');
    const d = block.date ? new Date(block.date + 'T12:00:00') : new Date(selectedDate);
    const [h, m] = (block.time || '09:00').split(':').map(Number);
    d.setHours(h || 9, m || 0, 0, 0);
    setFormDate(d);
    setFormTime(d);
    setFormTitle(block.title || '');
    setFormSessionLink(block.sessionLink || '');
    setFormNotes(block.notes || '');
    setFormRepeat(block.repeat || 'None');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      Alert.alert('Missing title', 'Please enter a title.');
      return;
    }
    if ((formType === 'Session' || formType === 'Check-in') && formSessionLink.trim() && !isValidHttpsUrl(formSessionLink.trim())) {
      Alert.alert('Invalid link', 'Session link must start with https://');
      return;
    }
    setSaving(true);
    try {
      const dateStr = toDateKey(formDate);
      const timeStr = timeToStr(formTime);
      if (editingBlock) {
        await updateScheduleBlock(trainerId, clientId, editingBlock.id, {
          type: formType,
          title: formTitle.trim(),
          date: dateStr,
          time: timeStr,
          sessionLink: (formType === 'Session' || formType === 'Check-in') ? (formSessionLink.trim() || null) : null,
          notes: formNotes.trim() || null,
          repeat: formRepeat,
        });
      } else {
        await addScheduleBlock(trainerId, clientId, {
          type: formType,
          title: formTitle.trim(),
          date: dateStr,
          time: timeStr,
          sessionLink: (formType === 'Session' || formType === 'Check-in') ? (formSessionLink.trim() || null) : null,
          notes: formNotes.trim() || null,
          repeat: formRepeat,
        });
      }
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (block) => {
    Alert.alert('Delete block', `Delete "${block.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteScheduleBlock(trainerId, clientId, block.id);
          } catch (e) {
            Alert.alert('Error', e.message || 'Failed to delete.');
          }
        },
      },
    ]);
  };

  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';

  return (
    <View style={styles.container}>
      {/* Header: Title + client name */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Schedule</Text>
        <Text style={[styles.headerSubtitle, { color: mutedColor }]} numberOfLines={1}>{clientName || 'Client'}</Text>
      </View>

      {/* Tabs: Week | Month | Year */}
      <View style={styles.tabsRow}>
        {['Week', 'Month', 'Year'].map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setViewMode(tab)}
            style={[styles.tab, viewMode === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, { color: viewMode === tab ? '#fff' : mutedColor }]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Week view: 7-day row */}
      {viewMode === 'Week' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekRow}>
          {weekDays.map((d) => {
            const key = toDateKey(d);
            const isSelected = key === dateKey;
            const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
            const num = d.getDate();
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setSelectedDate(new Date(d))}
                style={[styles.dayPill, isSelected && { backgroundColor: CYAN }]}
              >
                <Text style={[styles.dayLabel, { color: isSelected ? '#fff' : mutedColor }]}>{dayLabel}</Text>
                <Text style={[styles.dayNum, { color: isSelected ? '#fff' : textColor }]}>{num}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Block list for selected day */}
      <ScrollView style={styles.blockList} contentContainerStyle={styles.blockListContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={CYAN} />
            <Text style={[styles.loadingText, { color: mutedColor }]}>Loading...</Text>
          </View>
        ) : blocks.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="calendar-outline" size={48} color={mutedColor} />
            <Text style={[styles.emptyText, { color: mutedColor }]}>No blocks for this day</Text>
            <Text style={[styles.emptySubtext, { color: mutedColor }]}>Tap + to add one</Text>
          </View>
        ) : (
          blocks.map((block) => {
            const accent = BLOCK_COLORS[block.type] || BLOCK_COLORS.Session;
            const iconName = BLOCK_ICONS[block.type] || BLOCK_ICONS.Session;
            return (
              <View key={block.id} style={[styles.blockCard, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
                <View style={[styles.blockAccent, { backgroundColor: accent }]} />
                <View style={styles.blockBody}>
                  <View style={styles.blockTop}>
                    <View style={[styles.blockIconWrap, { backgroundColor: accent + '22' }]}>
                      <Ionicons name={iconName} size={18} color={accent} />
                    </View>
                    <Text style={[styles.blockTypeLabel, { color: mutedColor }]}>{block.type}</Text>
                    <View style={styles.blockActions}>
                      <TouchableOpacity onPress={() => openEdit(block)} hitSlop={8}>
                        <Ionicons name="pencil-outline" size={18} color={mutedColor} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(block)} hitSlop={8} style={{ marginLeft: 12 }}>
                        <Ionicons name="trash-outline" size={18} color={mutedColor} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <Text style={[styles.blockTime, { color: mutedColor }]}>{formatTime(block.time)}</Text>
                  <Text style={[styles.blockTitle, { color: textColor }]} numberOfLines={2}>{block.title}</Text>
                  {(block.type === 'Session' || block.type === 'Check-in') && block.sessionLink ? (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(block.sessionLink)}
                      style={styles.sessionLink}
                    >
                      <Ionicons name="link" size={14} color={CYAN} />
                      <Text style={styles.sessionLinkText}>Open Zoom/Teams</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={openAdd} style={styles.fab} activeOpacity={0.9}>
        <LinearGradient colors={SAVE_GRADIENT} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Add/Edit Block Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: isDark ? '#1a1a1e' : '#f5f5f7' }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: textColor }]}>{editingBlock ? 'Edit Block' : 'Add Block'}</Text>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.fieldLabel, { color: mutedColor }]}>Block Type</Text>
              <View style={styles.pillRow}>
                {BLOCK_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setFormType(t)}
                    style={[styles.pill, formType === t && { backgroundColor: BLOCK_COLORS[t] + '33', borderColor: BLOCK_COLORS[t] }]}
                  >
                    <Text style={[styles.pillText, { color: formType === t ? BLOCK_COLORS[t] : mutedColor }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: mutedColor }]}>Day</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderColor: CARD_BORDER }]}>
                <Text style={{ color: textColor }}>{formDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={formDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (d) setFormDate(d);
                  }}
                />
              )}

              <Text style={[styles.fieldLabel, { color: mutedColor }]}>Time</Text>
              <TouchableOpacity onPress={() => setShowTimePicker(true)} style={[styles.input, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderColor: CARD_BORDER }]}>
                <Text style={{ color: textColor }}>{formTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</Text>
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={formTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(e, d) => {
                    if (Platform.OS === 'android') setShowTimePicker(false);
                    if (d) setFormTime(d);
                  }}
                />
              )}

              <Text style={[styles.fieldLabel, { color: mutedColor }]}>Title</Text>
              <TextInput
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder="e.g. Push Day A, Meal 1, Weekly Check-in"
                placeholderTextColor={mutedColor}
                style={[styles.input, styles.textInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderColor: CARD_BORDER, color: textColor }]}
              />

              {(formType === 'Session' || formType === 'Check-in') && (
                <>
                  <Text style={[styles.fieldLabel, { color: mutedColor }]}>Session Link (https://)</Text>
                  <TextInput
                    value={formSessionLink}
                    onChangeText={setFormSessionLink}
                    placeholder="https://zoom.us/..."
                    placeholderTextColor={mutedColor}
                    keyboardType="url"
                    autoCapitalize="none"
                    style={[styles.input, styles.textInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderColor: CARD_BORDER, color: textColor }]}
                  />
                </>
              )}

              <Text style={[styles.fieldLabel, { color: mutedColor }]}>Notes (optional)</Text>
              <TextInput
                value={formNotes}
                onChangeText={setFormNotes}
                placeholder="Optional notes"
                placeholderTextColor={mutedColor}
                multiline
                numberOfLines={3}
                style={[styles.input, styles.textArea, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderColor: CARD_BORDER, color: textColor }]}
              />

              <Text style={[styles.fieldLabel, { color: mutedColor }]}>Repeat</Text>
              <View style={styles.pillRow}>
                {REPEAT_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setFormRepeat(r)}
                    style={[styles.pill, formRepeat === r && { backgroundColor: CYAN + '33', borderColor: CYAN }]}
                  >
                    <Text style={[styles.pillText, { color: formRepeat === r ? CYAN : mutedColor }]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.cancelBtn, { borderColor: CARD_BORDER }]}>
                <Text style={{ color: mutedColor }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtnWrap}>
                <LinearGradient colors={SAVE_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
                  <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 4, marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSubtitle: { fontSize: 13, marginTop: 2 },
  tabsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: CARD_BORDER },
  tabActive: { borderColor: CYAN, backgroundColor: CYAN + '22' },
  tabText: { fontSize: 13, fontWeight: '600' },
  weekRow: { flexDirection: 'row', gap: 8, marginBottom: 16, paddingVertical: 4 },
  dayPill: { width: 44, paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: CARD_BG, borderWidth: 1, borderColor: CARD_BORDER },
  dayLabel: { fontSize: 10, fontWeight: '600' },
  dayNum: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  blockList: { flex: 1 },
  blockListContent: { paddingBottom: 24 },
  loadingWrap: { alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 8, fontSize: 13 },
  emptyWrap: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptySubtext: { fontSize: 13, marginTop: 4 },
  blockCard: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  blockAccent: { width: 4 },
  blockBody: { flex: 1, padding: 14 },
  blockTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  blockIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  blockTypeLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', flex: 1 },
  blockActions: { flexDirection: 'row' },
  blockTime: { fontSize: 12, marginBottom: 2 },
  blockTitle: { fontSize: 16, fontWeight: '600' },
  sessionLink: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 },
  sessionLinkText: { fontSize: 13, color: CYAN, fontWeight: '600' },
  fab: { position: 'absolute', right: 20, bottom: 24, borderRadius: 28, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  fabGradient: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 34 : 20, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalScroll: { maxHeight: 400 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: CARD_BORDER },
  pillText: { fontSize: 13, fontWeight: '600' },
  input: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, marginBottom: 4 },
  textInput: { fontSize: 15 },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: CARD_BORDER },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  saveBtnWrap: { flex: 1 },
  saveBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
