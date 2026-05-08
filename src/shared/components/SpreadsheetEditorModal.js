import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTrainerDocument, saveTrainerSpreadsheet } from '../services/notesAndFilesService';

const MAGENTA = '#FF6B9D';
const FORMULA_C = '#06B6D4';

const ROW_NUM_W = 44;
const HEADER_H = 32;
const ROW_H = 40;
const DEFAULT_COL_W = 110;

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const colLetter = (index) => {
  let n = index;
  let letters = '';
  while (n >= 0) {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  }
  return letters;
};

const cellRef = (r, c) => `${colLetter(c)}${r + 1}`;

const makeEmptyRows = (rows = 24, cols = 8) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

const makeEmptyFormats = () => ({});

const now = () => new Date();

function formatSavedAgo(d) {
  if (!d) return '—';
  const diff = Math.round((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  return `${Math.round(diff / 60)}m ago`;
}

function parseRange(range) {
  const s = String(range || '').trim().toUpperCase();
  const m = s.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
  if (!m) return null;
  const colToNum = (letters) => {
    let sum = 0;
    for (let i = 0; i < letters.length; i++) sum = sum * 26 + (letters.charCodeAt(i) - 64);
    return sum - 1;
  };
  const c1 = colToNum(m[1]);
  const r1 = parseInt(m[2], 10) - 1;
  const c2 = colToNum(m[3]);
  const r2 = parseInt(m[4], 10) - 1;
  return {
    r1: Math.min(r1, r2),
    r2: Math.max(r1, r2),
    c1: Math.min(c1, c2),
    c2: Math.max(c1, c2),
  };
}

function evalCellValue(raw, getCellRaw, depth = 0) {
  const v = raw == null ? '' : String(raw);
  if (!v) return '';
  if (!v.startsWith('=')) return v;
  if (depth > 3) return '';
  const expr = v.slice(1).trim();
  // Simple functions: SUM/AVG/COUNT/MIN/MAX over a range like A1:A10
  const fm = expr.match(/^(SUM|AVG|AVERAGE|COUNT|MIN|MAX)\(([^)]+)\)$/i);
  if (fm) {
    const fn = fm[1].toUpperCase() === 'AVERAGE' ? 'AVG' : fm[1].toUpperCase();
    const range = parseRange(fm[2].trim());
    if (!range) return '';
    const nums = [];
    let count = 0;
    for (let r = range.r1; r <= range.r2; r++) {
      for (let c = range.c1; c <= range.c2; c++) {
        const rr = getCellRaw(r, c);
        const val = evalCellValue(rr, getCellRaw, depth + 1);
        if (val !== '') {
          count++;
          const n = parseFloat(String(val));
          if (!Number.isNaN(n)) nums.push(n);
        }
      }
    }
    if (fn === 'COUNT') return String(count);
    if (!nums.length) return '0';
    const sum = nums.reduce((a, b) => a + b, 0);
    if (fn === 'SUM') return String(sum);
    if (fn === 'AVG') return String(sum / nums.length);
    if (fn === 'MIN') return String(Math.min(...nums));
    if (fn === 'MAX') return String(Math.max(...nums));
    return '';
  }
  // Reference like =A1
  const ref = expr.match(/^([A-Z]+)(\d+)$/);
  if (ref) {
    const letters = ref[1];
    const row = parseInt(ref[2], 10) - 1;
    let col = 0;
    for (let i = 0; i < letters.length; i++) col = col * 26 + (letters.charCodeAt(i) - 64);
    col -= 1;
    return evalCellValue(getCellRaw(row, col), getCellRaw, depth + 1);
  }
  return '';
}

function displayValue(raw, getCellRaw) {
  const v = raw == null ? '' : String(raw);
  if (!v) return '';
  if (!v.startsWith('=')) return v;
  return evalCellValue(v, getCellRaw);
}

function ToolBtn({ active, disabled, onPress, children }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[
        styles.toolBtn,
        active
          ? {
              backgroundColor: MAGENTA,
              shadowColor: MAGENTA,
              shadowOpacity: 0.55,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 10,
            }
          : null,
        disabled ? { opacity: 0.35 } : null,
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

export default function SpreadsheetEditorModal({
  visible,
  trainerId,
  documentId = null,
  isDark = true,
  onClose,
  onSaved,
  initialRows,
  initialTitle,
}) {
  const mounted = useRef(false);
  const saveTimer = useRef(null);
  const lastSavedTimer = useRef(null);

  const [theme, setTheme] = useState(isDark ? 'dark' : 'light');
  const isSheetDark = theme === 'dark';

  const [title, setTitle] = useState(initialTitle || 'Untitled spreadsheet');
  const [docId, setDocId] = useState(documentId || null);
  const [favorite, setFavorite] = useState(false);
  const [status, setStatus] = useState('saved'); // saved | saving | unsaved
  const [lastSaved, setLastSaved] = useState(now());

  const [rows, setRows] = useState(() => {
    if (initialRows && initialRows.length) return initialRows.map((r) => (Array.isArray(r) ? r.map((x) => (x == null ? '' : String(x))) : []));
    return makeEmptyRows();
  });
  const [formats, setFormats] = useState(makeEmptyFormats);
  const [colWidths, setColWidths] = useState({});

  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState({ row: 0, col: 0, endRow: undefined, endCol: undefined });
  const [editing, setEditing] = useState(null); // { row, col } | null
  const [draft, setDraft] = useState('');

  // history for undo/redo (lightweight)
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  useEffect(() => {
    if (!visible) return;
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (lastSavedTimer.current) clearInterval(lastSavedTimer.current);
    };
  }, [visible]);

  const rowCount = rows.length;
  const colCount = rows[0] ? rows[0].length : 0;

  const getCellRaw = useCallback((r, c) => {
    if (r < 0 || c < 0) return '';
    const row = rows[r];
    if (!row) return '';
    return row[c] ?? '';
  }, [rows]);

  const colW = useCallback((c) => colWidths[c] ?? DEFAULT_COL_W, [colWidths]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h.slice(-30), { rows, formats, colWidths }]);
    setFuture([]);
  }, [rows, formats, colWidths]);

  const setCell = useCallback((r, c, value) => {
    pushHistory();
    setRows((prev) =>
      prev.map((row, rr) => {
        if (rr !== r) return row;
        return row.map((cell, cc) => (cc === c ? String(value ?? '') : cell));
      }),
    );
    setStatus('unsaved');
  }, [pushHistory]);

  const applyFormat = useCallback((patch) => {
    const ref = cellRef(selection.row, selection.col);
    pushHistory();
    setFormats((prev) => ({ ...prev, [ref]: { ...(prev[ref] || {}), ...patch } }));
    setStatus('unsaved');
  }, [pushHistory, selection.row, selection.col]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [{ rows, formats, colWidths }, ...f].slice(0, 30));
      setRows(prev.rows);
      setFormats(prev.formats);
      setColWidths(prev.colWidths);
      setStatus('unsaved');
      return h.slice(0, -1);
    });
  }, [rows, formats, colWidths]);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const next = f[0];
      setHistory((h) => [...h, { rows, formats, colWidths }].slice(-30));
      setRows(next.rows);
      setFormats(next.formats);
      setColWidths(next.colWidths);
      setStatus('unsaved');
      return f.slice(1);
    });
  }, [rows, formats, colWidths]);

  const insertRow = useCallback((at) => {
    pushHistory();
    setRows((prev) => {
      const idx = clamp(at, 0, prev.length);
      const empty = Array.from({ length: colCount || 8 }, () => '');
      return [...prev.slice(0, idx), empty, ...prev.slice(idx)];
    });
    setStatus('unsaved');
  }, [pushHistory, colCount]);

  const deleteRow = useCallback((at) => {
    if (rowCount <= 1) return;
    pushHistory();
    setRows((prev) => prev.filter((_, i) => i !== clamp(at, 0, prev.length - 1)));
    setSelection((s) => ({ ...s, row: Math.max(0, s.row - 1) }));
    setStatus('unsaved');
  }, [pushHistory, rowCount]);

  const insertCol = useCallback((at) => {
    pushHistory();
    setRows((prev) => {
      const idx = clamp(at, 0, (prev[0]?.length || 0));
      return prev.map((row) => [...row.slice(0, idx), '', ...row.slice(idx)]);
    });
    setStatus('unsaved');
  }, [pushHistory]);

  const deleteCol = useCallback((at) => {
    if (colCount <= 1) return;
    pushHistory();
    setRows((prev) => {
      const idx = clamp(at, 0, (prev[0]?.length || 1) - 1);
      return prev.map((row) => row.filter((_, i) => i !== idx));
    });
    setSelection((s) => ({ ...s, col: Math.max(0, s.col - 1) }));
    setStatus('unsaved');
  }, [pushHistory, colCount]);

  const sortByCol = useCallback((col, dir = 'asc') => {
    pushHistory();
    setRows((prev) => {
      const header = prev[0] || [];
      const body = prev.slice(1);
      const sorted = [...body].sort((a, b) => {
        const av = a[col] ?? '';
        const bv = b[col] ?? '';
        const an = parseFloat(String(av));
        const bn = parseFloat(String(bv));
        const bothNum = !Number.isNaN(an) && !Number.isNaN(bn);
        if (bothNum) return dir === 'asc' ? an - bn : bn - an;
        const cmp = String(av).localeCompare(String(bv));
        return dir === 'asc' ? cmp : -cmp;
      });
      return [header, ...sorted];
    });
    setStatus('unsaved');
  }, [pushHistory]);

  const queueSave = useCallback(() => {
    if (!trainerId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!mounted.current) return;
      setStatus('saving');
      try {
        const trimmedTitle = String(title || '').trim() || 'Untitled spreadsheet';
        const payload = {
          id: docId || undefined,
          title: trimmedTitle,
          rows,
          columnCount: colCount,
          rowCount,
          formats,
          colWidths,
          isFavorite: favorite,
          lastSavedAt: now(),
        };
        const res = await saveTrainerSpreadsheet(trainerId, payload);
        if (!mounted.current) return;
        if (!docId && res?.id) setDocId(res.id);
        setLastSaved(now());
        setStatus('saved');
        onSaved?.();
      } catch (e) {
        if (mounted.current) setStatus('unsaved');
      }
    }, 1200);
  }, [trainerId, title, docId, rows, colCount, rowCount, formats, colWidths, favorite, onSaved]);

  // Autosave when sheet changes
  useEffect(() => {
    if (!visible) return;
    if (status === 'saving') return;
    if (status === 'saved') return;
    queueSave();
  }, [rows, formats, colWidths, title, favorite]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live timer for “Saved Xs ago”
  useEffect(() => {
    if (!visible) return;
    if (lastSavedTimer.current) clearInterval(lastSavedTimer.current);
    lastSavedTimer.current = setInterval(() => {
      // trigger rerender
      setLastSaved((d) => new Date(d.getTime()));
    }, 2000);
    return () => clearInterval(lastSavedTimer.current);
  }, [visible]);

  // Load sheet from Firestore when editing existing
  useEffect(() => {
    if (!visible) return;
    setTheme(isDark ? 'dark' : 'light');
    setDocId(documentId || null);
    setStatus('saved');
    setFavorite(false);
    setFormats(makeEmptyFormats());
    setColWidths({});
    setHistory([]);
    setFuture([]);
    setSelection({ row: 0, col: 0, endRow: undefined, endCol: undefined });
    setEditing(null);
    setDraft('');

    if (documentId && trainerId && !initialRows) {
      setLoading(true);
      getTrainerDocument(trainerId, documentId)
        .then((doc) => {
          if (!mounted.current) return;
          if (!doc) return;
          setTitle(doc.title || 'Untitled spreadsheet');
          setFavorite(!!doc.isFavorite);
          const docRows = Array.isArray(doc.rows) && doc.rows.length ? doc.rows : makeEmptyRows();
          setRows(docRows.map((r) => (Array.isArray(r) ? r.map((x) => (x == null ? '' : String(x))) : [])));
          setFormats(doc.formats && typeof doc.formats === 'object' ? doc.formats : makeEmptyFormats());
          setColWidths(doc.colWidths && typeof doc.colWidths === 'object' ? doc.colWidths : {});
          setStatus('saved');
          setLastSaved(now());
        })
        .catch(() => {})
        .finally(() => mounted.current && setLoading(false));
    } else if (initialRows && initialRows.length) {
      setTitle(initialTitle || 'Untitled spreadsheet');
      setRows(initialRows.map((r) => (Array.isArray(r) ? r.map((x) => (x == null ? '' : String(x))) : [])));
      setStatus('saved');
      setLastSaved(now());
    } else {
      setTitle(initialTitle || 'Untitled spreadsheet');
      setRows(makeEmptyRows());
      setStatus('saved');
      setLastSaved(now());
    }
  }, [visible, documentId, trainerId, initialRows, initialTitle, isDark]);

  // Sync draft on edit start
  useEffect(() => {
    if (!editing) return;
    setDraft(getCellRaw(editing.row, editing.col));
  }, [editing, getCellRaw]);

  const currentRef = cellRef(selection.row, selection.col);
  const currentRaw = getCellRaw(selection.row, selection.col);
  const currentFmt = formats[currentRef] || {};

  const computedStats = useMemo(() => {
    const r1 = Math.min(selection.row, selection.endRow ?? selection.row);
    const r2 = Math.max(selection.row, selection.endRow ?? selection.row);
    const c1 = Math.min(selection.col, selection.endCol ?? selection.col);
    const c2 = Math.max(selection.col, selection.endCol ?? selection.col);
    const nums = [];
    let count = 0;
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const raw = getCellRaw(r, c);
        const disp = displayValue(raw, getCellRaw);
        if (disp !== '') {
          count++;
          const n = parseFloat(String(disp));
          if (!Number.isNaN(n)) nums.push(n);
        }
      }
    }
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = nums.length ? sum / nums.length : 0;
    const range = `${cellRef(r1, c1)}${r1 !== r2 || c1 !== c2 ? `:${cellRef(r2, c2)}` : ''}`;
    return { count, nums: nums.length, sum, avg, range };
  }, [selection, getCellRaw]);

  const bg = isSheetDark ? '#0A0A0F' : '#FFFFFF';
  const headerBg = isSheetDark ? 'rgba(20,20,25,0.92)' : 'rgba(250,250,250,0.95)';
  const toolbarBg = isSheetDark ? 'rgba(16,16,22,0.92)' : 'rgba(250,250,250,0.95)';
  const gridBg = isSheetDark ? '#0A0A0F' : '#FFFFFF';
  const gridLine = isSheetDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
  const text = isSheetDark ? '#FFFFFF' : '#0A0A0F';
  const muted = isSheetDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';

  const handleBackPress = useCallback(() => {
    if (status === 'unsaved' || status === 'saving') {
      Alert.alert('Unsaved changes', 'Leave without saving?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: onClose },
      ]);
      return;
    }
    onClose();
  }, [status, onClose]);

  const commitEdit = useCallback(() => {
    if (!editing) return;
    setCell(editing.row, editing.col, draft);
    setEditing(null);
  }, [editing, draft, setCell]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: bg }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
            {/* Header (matches screenshot) */}
            <View style={[styles.header, { backgroundColor: headerBg, borderBottomColor: gridLine }]}>
              <TouchableOpacity onPress={handleBackPress} style={styles.headerBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={20} color={text} />
              </TouchableOpacity>
              <View style={styles.sheetIcon}>
                <Ionicons name="document-text-outline" size={16} color={MAGENTA} />
              </View>
              <TextInput
                value={title}
                onChangeText={(t) => {
                  setTitle(t);
                  setStatus('unsaved');
                }}
                placeholder="Untitled spreadsheet"
                placeholderTextColor={muted}
                style={[styles.titleInput, { color: text }]}
                numberOfLines={1}
              />
              <Text style={[styles.savedLabel, { color: muted }]}>{status === 'saving' ? 'Saving…' : 'Saved'}</Text>
              <TouchableOpacity onPress={() => { setFavorite((v) => !v); setStatus('unsaved'); }} style={styles.headerBtn} hitSlop={12}>
                <Ionicons name={favorite ? 'star' : 'star-outline'} size={18} color={favorite ? MAGENTA : muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} style={styles.headerBtn} hitSlop={12}>
                <Ionicons name={isSheetDark ? 'sunny-outline' : 'moon-outline'} size={18} color={muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Menu', 'Export/Share coming next.')} style={styles.headerBtn} hitSlop={12}>
                <Ionicons name="ellipsis-vertical" size={18} color={muted} />
              </TouchableOpacity>
            </View>

            {/* Toolbar (sticky) */}
            <View style={[styles.toolbar, { backgroundColor: toolbarBg, borderBottomColor: gridLine }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarRow}>
                <ToolBtn disabled={!history.length} onPress={undo}>
                  <Ionicons name="arrow-undo-outline" size={16} color={muted} />
                </ToolBtn>
                <ToolBtn disabled={!future.length} onPress={redo}>
                  <Ionicons name="arrow-redo-outline" size={16} color={muted} />
                </ToolBtn>
                <View style={styles.divider} />
                <ToolBtn active={!!currentFmt.bold} onPress={() => applyFormat({ bold: !currentFmt.bold })}>
                  <Text style={{ color: currentFmt.bold ? '#0A0A0F' : muted, fontWeight: '900' }}>B</Text>
                </ToolBtn>
                <ToolBtn active={!!currentFmt.italic} onPress={() => applyFormat({ italic: !currentFmt.italic })}>
                  <Text style={{ color: currentFmt.italic ? '#0A0A0F' : muted, fontStyle: 'italic', fontWeight: '800' }}>I</Text>
                </ToolBtn>
                <ToolBtn active={!!currentFmt.strike} onPress={() => applyFormat({ strike: !currentFmt.strike })}>
                  <Text style={{ color: currentFmt.strike ? '#0A0A0F' : muted, textDecorationLine: 'line-through', fontWeight: '800' }}>S</Text>
                </ToolBtn>
                <View style={styles.divider} />
                <ToolBtn active={(currentFmt.align || 'left') === 'left'} onPress={() => applyFormat({ align: 'left' })}>
                  <Ionicons name="align-horizontal-left" size={16} color={(currentFmt.align || 'left') === 'left' ? '#0A0A0F' : muted} />
                </ToolBtn>
                <ToolBtn active={currentFmt.align === 'center'} onPress={() => applyFormat({ align: 'center' })}>
                  <Ionicons name="align-horizontal-center" size={16} color={currentFmt.align === 'center' ? '#0A0A0F' : muted} />
                </ToolBtn>
                <ToolBtn active={currentFmt.align === 'right'} onPress={() => applyFormat({ align: 'right' })}>
                  <Ionicons name="align-horizontal-right" size={16} color={currentFmt.align === 'right' ? '#0A0A0F' : muted} />
                </ToolBtn>
                <View style={styles.divider} />
                <ToolBtn onPress={() => {
                  Alert.alert('Formulas', 'Insert a template into the selected cell.', [
                    { text: 'SUM', onPress: () => setCell(selection.row, selection.col, '=SUM(A1:A10)') },
                    { text: 'AVG', onPress: () => setCell(selection.row, selection.col, '=AVG(A1:A10)') },
                    { text: 'COUNT', onPress: () => setCell(selection.row, selection.col, '=COUNT(A1:A10)') },
                    { text: 'MIN', onPress: () => setCell(selection.row, selection.col, '=MIN(A1:A10)') },
                    { text: 'MAX', onPress: () => setCell(selection.row, selection.col, '=MAX(A1:A10)') },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}>
                  <Ionicons name="calculator-outline" size={16} color={muted} />
                </ToolBtn>
                <ToolBtn onPress={() => insertRow(selection.row + 1)}>
                  <Ionicons name="add-outline" size={18} color={muted} />
                </ToolBtn>
                <ToolBtn onPress={() => deleteRow(selection.row)}>
                  <Ionicons name="trash-outline" size={16} color={muted} />
                </ToolBtn>
                <ToolBtn onPress={() => sortByCol(selection.col, 'asc')}>
                  <Ionicons name="swap-vertical-outline" size={16} color={muted} />
                </ToolBtn>
              </ScrollView>
            </View>

            {/* Formula bar */}
            <View style={[styles.formulaBar, { backgroundColor: toolbarBg, borderBottomColor: gridLine }]}>
              <View style={[styles.refPill, { borderColor: gridLine, backgroundColor: isSheetDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}>
                <Text style={{ color: muted, fontSize: 11, fontWeight: '800' }}>{currentRef}</Text>
              </View>
              <Text style={{ color: FORMULA_C, fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined, fontSize: 12, fontWeight: '800' }}>fx</Text>
              <TextInput
                value={editing ? draft : currentRaw}
                onChangeText={(v) => setDraft(v)}
                onFocus={() => {
                  setEditing({ row: selection.row, col: selection.col });
                  setDraft(currentRaw);
                }}
                onBlur={() => commitEdit()}
                placeholder="Enter value or =formula"
                placeholderTextColor={muted}
                style={[styles.formulaInput, { color: (editing ? draft : currentRaw).startsWith('=') ? FORMULA_C : text }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Grid */}
            <View style={{ flex: 1, backgroundColor: gridBg }}>
              {loading ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="large" color={MAGENTA} />
                </View>
              ) : (
                <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ minWidth: '100%' }}>
                  <View style={{ width: ROW_NUM_W + Array.from({ length: colCount }).reduce((a, _, c) => a + colW(c), 0) }}>
                    {/* Column header */}
                    <View style={[styles.colHeaderRow, { height: HEADER_H, backgroundColor: toolbarBg, borderBottomColor: gridLine }]}>
                      <View style={[styles.corner, { width: ROW_NUM_W, height: HEADER_H, backgroundColor: toolbarBg, borderRightColor: gridLine }]} />
                      {Array.from({ length: colCount }).map((_, c) => {
                        const selectedCol = selection.col === c;
                        return (
                          <TouchableOpacity
                            key={`col-${c}`}
                            activeOpacity={0.7}
                            onPress={() => setSelection({ row: 0, col: c, endRow: rowCount - 1, endCol: c })}
                            style={[
                              styles.colHeaderCell,
                              {
                                width: colW(c),
                                height: HEADER_H,
                                borderRightColor: gridLine,
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1, color: selectedCol ? MAGENTA : muted }}>
                              {colLetter(c)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <FlatList
                      data={rows}
                      keyExtractor={(_, idx) => `r-${idx}`}
                      renderItem={({ item: row, index: r }) => (
                        <View style={[styles.row, { height: ROW_H, borderBottomColor: gridLine }]}>
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setSelection({ row: r, col: 0, endRow: r, endCol: colCount - 1 })}
                            style={[styles.rowNum, { width: ROW_NUM_W, height: ROW_H, backgroundColor: toolbarBg, borderRightColor: gridLine }]}
                          >
                            <Text style={{ fontSize: 11, fontWeight: selection.row === r ? '800' : '700', color: selection.row === r ? MAGENTA : muted }}>
                              {r + 1}
                            </Text>
                          </TouchableOpacity>
                          <View style={{ flexDirection: 'row' }}>
                            {row.map((cell, c) => {
                              const ref = cellRef(r, c);
                              const fmt = formats[ref] || {};
                              const sel = selection.row === r && selection.col === c;
                              const isEditing = editing?.row === r && editing?.col === c;
                              const raw = cell ?? '';
                              const disp = displayValue(raw, getCellRaw);
                              const isFormula = String(raw).startsWith('=');
                              const align = fmt.align || 'left';
                              const justify =
                                align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
                              return (
                                <TouchableOpacity
                                  key={`${r}-${c}`}
                                  activeOpacity={1}
                                  onPress={() => setSelection({ row: r, col: c })}
                                  onLongPress={() => { setEditing({ row: r, col: c }); setDraft(raw); }}
                                  style={[
                                    styles.cell,
                                    {
                                      width: colW(c),
                                      height: ROW_H,
                                      borderRightColor: gridLine,
                                      backgroundColor: fmt.bg || (sel ? (isSheetDark ? 'rgba(255,107,157,0.10)' : 'rgba(255,107,157,0.14)') : 'transparent'),
                                      borderColor: sel ? MAGENTA : 'transparent',
                                    },
                                  ]}
                                >
                                  {isEditing ? (
                                    <TextInput
                                      value={draft}
                                      onChangeText={setDraft}
                                      autoFocus
                                      onBlur={commitEdit}
                                      style={[
                                        styles.cellInput,
                                        {
                                          color: draft.startsWith('=') ? FORMULA_C : (fmt.color || text),
                                          fontWeight: fmt.bold ? '800' : '400',
                                          fontStyle: fmt.italic ? 'italic' : 'normal',
                                          textDecorationLine: fmt.strike ? 'line-through' : 'none',
                                          textAlign: align,
                                        },
                                      ]}
                                      autoCapitalize="none"
                                      autoCorrect={false}
                                    />
                                  ) : (
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: justify, paddingHorizontal: 10 }}>
                                      <Text
                                        numberOfLines={1}
                                        style={{
                                          fontSize: 13,
                                          color: fmt.color || (isFormula ? FORMULA_C : text),
                                          fontWeight: fmt.bold ? '800' : '400',
                                          fontStyle: fmt.italic ? 'italic' : 'normal',
                                          textDecorationLine: fmt.strike ? 'line-through' : 'none',
                                        }}
                                      >
                                        {disp}
                                      </Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    />
                  </View>
                </ScrollView>
              )}
            </View>

            {/* Status bar */}
            <View style={[styles.statusBar, { backgroundColor: headerBg, borderTopColor: gridLine }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Text style={{ color: muted, fontSize: 11 }}>
                  <Text style={{ color: isSheetDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.70)', fontWeight: '800' }}>Selected:</Text> {computedStats.range}
                </Text>
                {computedStats.nums > 0 && (
                  <>
                    <Text style={{ color: muted, fontSize: 11 }}>
                      <Text style={{ color: isSheetDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.70)', fontWeight: '800' }}>Sum:</Text> {Math.round(computedStats.sum * 100) / 100}
                    </Text>
                    <Text style={{ color: muted, fontSize: 11 }}>
                      <Text style={{ color: isSheetDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.70)', fontWeight: '800' }}>Avg:</Text> {Math.round(computedStats.avg * 100) / 100}
                    </Text>
                  </>
                )}
                <Text style={{ color: muted, fontSize: 11 }}>
                  <Text style={{ color: isSheetDark ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.70)', fontWeight: '800' }}>Count:</Text> {computedStats.count}
                </Text>
              </ScrollView>
              <Text style={{ color: muted, fontSize: 11 }}>Saved {formatSavedAgo(lastSaved)}</Text>
            </View>
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = {
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  sheetIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,107,157,0.12)' },
  titleInput: { flex: 1, fontSize: 16, fontWeight: '800', paddingVertical: 4 },
  savedLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  toolbar: { borderBottomWidth: 1 },
  toolbarRow: { paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center', gap: 8 },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  divider: { width: 1, height: 18, backgroundColor: 'rgba(255,255,255,0.10)', marginHorizontal: 6 },
  formulaBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  refPill: { minWidth: 44, height: 28, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  formulaInput: { flex: 1, height: 28, fontSize: 13, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined },
  colHeaderRow: { flexDirection: 'row', borderBottomWidth: 1 },
  corner: { borderRightWidth: 1 },
  colHeaderCell: { alignItems: 'center', justifyContent: 'center', borderRightWidth: 1 },
  row: { flexDirection: 'row', borderBottomWidth: 1 },
  rowNum: { alignItems: 'flex-end', justifyContent: 'center', paddingRight: 8, borderRightWidth: 1 },
  cell: { borderRightWidth: 1, borderWidth: 1, borderTopWidth: 0, borderLeftWidth: 0 },
  cellInput: { flex: 1, paddingHorizontal: 10, fontSize: 13 },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
};

