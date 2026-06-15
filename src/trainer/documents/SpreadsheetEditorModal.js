/**
 * Spreadsheet Editor Modal
 *
 * Purpose: UI screen or component: Spreadsheet Editor Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: SpreadsheetEditorModal
 *
 * @file-header
 */
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
  Share,
  StyleSheet,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { deleteDoc, doc, collection } from 'firebase/firestore';
import { getTrainerDocument, saveTrainerSpreadsheet } from '../../shared/notes-files/manageNotesAndFiles';
import { db } from '../../app/config';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import ShareDocumentModal from './ShareDocumentModal';
import EditorStatusPill from './EditorStatusPill';
import {
  EditorIconButton,
  EditorTitleField,
  DEFAULT_SAVE_TITLE_SPREADSHEET,
} from './EditorHeaderActions';
import { formatEditorSavedAgo, getEditorTheme } from './editorTheme';
import {
  EditorGradientPill,
} from './editorGradients';

const HEADER_H = 44;
const ROW_NUM_W = 44;
const ROW_H = 44;
const ADD_STRIP_W = 44;
const DEFAULT_COL_W = 110;

const FILL_PALETTE = ['#FFFFFF', '#FEF3C7', '#DBEAFE', '#D1FAE5', '#FEE2E2', '#EDE9FE', '#374151'];
const TEXT_PALETTE = ['#111827', '#DC2626', '#2563EB', '#059669', '#7C3AED', '#FFFFFF'];
const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18];

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

const saveTitle = (raw) => {
  const t = String(raw || '').trim();
  return t || DEFAULT_SAVE_TITLE_SPREADSHEET;
};

const makeEmptyRows = (rows = 24, cols = 8) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));

const makeEmptyFormats = () => ({});

const now = () => new Date();

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
  return { r1: Math.min(r1, r2), r2: Math.max(r1, r2), c1: Math.min(c1, c2), c2: Math.max(c1, c2) };
}

function evalCellValue(raw, getCellRaw, depth = 0) {
  const v = raw == null ? '' : String(raw);
  if (!v) return '';
  if (!v.startsWith('=')) return v;
  if (depth > 3) return '';
  const expr = v.slice(1).trim();
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

function displayValue(raw, getCellRaw, fmt = {}) {
  const v = raw == null ? '' : String(raw);
  if (!v) return '';
  const computed = v.startsWith('=') ? evalCellValue(v, getCellRaw) : v;
  if (computed === '' || Number.isNaN(Number(computed))) return computed;
  const num = Number(computed);
  switch (fmt.numberFormat) {
    case 'currency':
      return `$${num.toFixed(2)}`;
    case 'percent':
      return `${(num * 100).toFixed(num % 1 === 0 ? 0 : 1)}%`;
    case 'decimal0':
      return num.toFixed(0);
    case 'decimal2':
      return num.toFixed(2);
    default:
      return computed;
  }
}

function pickPaletteColor(title, palette, onPick) {
  Alert.alert(
    title,
    'Choose a color',
    [
      ...palette.map((hex) => ({
        text: hex,
        onPress: () => onPick(hex),
      })),
      { text: 'Clear', onPress: () => onPick(null) },
      { text: 'Cancel', style: 'cancel' },
    ],
  );
}

function parseCellRef(input) {
  const m = String(input || '').trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  let col = 0;
  for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
  col -= 1;
  const row = parseInt(m[2], 10) - 1;
  if (row < 0 || col < 0) return null;
  return { row, col };
}

function ToolBtn({ active, disabled, onPress, children, theme }) {
  const hitProps = {
    onPress,
    disabled,
    activeOpacity: 0.75,
    style: [styles.toolBtn, disabled ? { opacity: 0.35 } : null],
  };
  if (active) {
    return (
      <EditorGradientPill radius={8} style={styles.toolBtn} backgroundColor={theme?.accentSoft}>
        <TouchableOpacity {...hitProps}>{children}</TouchableOpacity>
      </EditorGradientPill>
    );
  }
  return <TouchableOpacity {...hitProps}>{children}</TouchableOpacity>;
}

function SheetActionChip({ label, icon, onPress, theme, disabled }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.sheetChip,
        {
          borderColor: theme.border,
          backgroundColor: theme.inputBg,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={14} color={theme.textMuted} />
      <Text style={{ color: theme.text, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function rowsToCsv(rows) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '');
          if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(','),
    )
    .join('\n');
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
  trainerNavChrome = null,
}) {
  const mounted = useRef(false);
  const titleInputRef = useRef(null);
  const saveTimer = useRef(null);
  const lastSavedTimer = useRef(null);
  const canAutoSaveRef = useRef(false);
  const titleRef = useRef('');
  const favoriteRef = useRef(false);
  const rowsRef = useRef([]);
  const formatsRef = useRef({});
  const colWidthsRef = useRef({});
  const docIdRef = useRef(null);
  const editingRef = useRef(null);
  const draftRef = useRef('');
  const saveChainRef = useRef(Promise.resolve());
  const statusRef = useRef('saved');
  const performSaveRef = useRef(null);
  const applyPendingCellEditRef = useRef(null);
  const userEditedRef = useRef(false);

  const [themeMode, setThemeMode] = useState(isDark ? 'dark' : 'light');
  const isSheetDark = themeMode === 'dark';
  const theme = useMemo(() => getEditorTheme(isSheetDark), [isSheetDark]);

  const [title, setTitle] = useState(initialTitle || '');
  const [titleFocused, setTitleFocused] = useState(false);
  const [docId, setDocId] = useState(documentId || null);
  const [favorite, setFavorite] = useState(false);
  const [status, setStatus] = useState('saved');
  const [lastSaved, setLastSaved] = useState(now());

  const [rows, setRows] = useState(() => {
    if (initialRows?.length) return initialRows.map((r) => (Array.isArray(r) ? r.map((x) => (x == null ? '' : String(x))) : []));
    return makeEmptyRows();
  });
  const [formats, setFormats] = useState(makeEmptyFormats);
  const [colWidths, setColWidths] = useState({});

  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState({ row: 0, col: 0, endRow: undefined, endCol: undefined });
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');

  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [showShare, setShowShare] = useState(false);
  const [sharedWith, setSharedWith] = useState([]);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    editingRef.current = editing;
  }, [editing]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    favoriteRef.current = favorite;
  }, [favorite]);

  useEffect(() => {
    formatsRef.current = formats;
  }, [formats]);

  useEffect(() => {
    colWidthsRef.current = colWidths;
  }, [colWidths]);

  useEffect(() => {
    docIdRef.current = docId;
  }, [docId]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (!visible) return;
    mounted.current = true;
    return () => {
      if (canAutoSaveRef.current && trainerId) {
        applyPendingCellEditRef.current?.();
        void performSaveRef.current?.();
      }
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (lastSavedTimer.current) clearInterval(lastSavedTimer.current);
    };
  }, [visible, trainerId]);

  useEffect(() => {
    if (visible) setThemeMode(isDark ? 'dark' : 'light');
  }, [visible, isDark]);

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
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    pushHistory();
    setRows((prev) =>
      prev.map((row, rr) => (rr !== r ? row : row.map((cell, cc) => (cc === c ? String(value ?? '') : cell)))),
    );
    setStatus('unsaved');
  }, [pushHistory]);

  const applyFormat = useCallback((patch) => {
    pushHistory();
    setFormats((prev) => {
      const next = { ...prev };
      const r1 = Math.min(selection.row, selection.endRow ?? selection.row);
      const r2 = Math.max(selection.row, selection.endRow ?? selection.row);
      const c1 = Math.min(selection.col, selection.endCol ?? selection.col);
      const c2 = Math.max(selection.col, selection.endCol ?? selection.col);
      for (let r = r1; r <= r2; r += 1) {
        for (let c = c1; c <= c2; c += 1) {
          const ref = cellRef(r, c);
          next[ref] = { ...(next[ref] || {}), ...patch };
        }
      }
      return next;
    });
    setStatus('unsaved');
  }, [pushHistory, selection]);

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
      const idx = clamp(at, 0, prev[0]?.length || 0);
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
        if (!Number.isNaN(an) && !Number.isNaN(bn)) return dir === 'asc' ? an - bn : bn - an;
        const cmp = String(av).localeCompare(String(bv));
        return dir === 'asc' ? cmp : -cmp;
      });
      return [header, ...sorted];
    });
    setStatus('unsaved');
  }, [pushHistory]);

  const ensureDocId = useCallback(() => {
    if (docIdRef.current) return docIdRef.current;
    if (!trainerId || !db) return null;
    const id = doc(collection(db, 'users', String(trainerId), 'documents')).id;
    docIdRef.current = id;
    setDocId(id);
    return id;
  }, [trainerId]);

  const applyPendingCellEdit = useCallback(() => {
    const edit = editingRef.current;
    if (!edit) return;
    const value = String(draftRef.current ?? '');
    const current = String(rowsRef.current[edit.row]?.[edit.col] ?? '');
    if (value === current) {
      editingRef.current = null;
      setEditing(null);
      return;
    }
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    const nextRows = rowsRef.current.map((row, rr) =>
      rr !== edit.row ? row : row.map((cell, cc) => (cc !== edit.col ? cell : value)),
    );
    rowsRef.current = nextRows;
    setRows(nextRows);
    editingRef.current = null;
    setEditing(null);
    setStatus('unsaved');
  }, []);

  const performSave = useCallback(async () => {
    if (!trainerId || !mounted.current || !canAutoSaveRef.current) return;

    const run = async () => {
      if (!mounted.current || !trainerId) return;
      applyPendingCellEdit();
      ensureDocId();
      setStatus('saving');
      try {
        const trimmedTitle = saveTitle(titleRef.current);
        const currentRows = rowsRef.current;
        const res = await saveTrainerSpreadsheet(trainerId, {
          id: docIdRef.current || undefined,
          title: trimmedTitle,
          rows: currentRows,
          columnCount: currentRows[0]?.length || 0,
          rowCount: currentRows.length,
          formats: formatsRef.current,
          colWidths: colWidthsRef.current,
          isFavorite: favoriteRef.current,
        });
        if (!mounted.current) return;
        if (res?.id) {
          docIdRef.current = res.id;
          setDocId(res.id);
        }
        setLastSaved(now());
        setStatus('saved');
        onSaved?.();
      } catch (e) {
        console.warn('Spreadsheet save failed', e?.code || e?.message || e);
        if (mounted.current) {
          setStatus('unsaved');
          Alert.alert(
            'Could not save',
            e?.message || 'Something went wrong saving your spreadsheet. Check your connection and try again.',
          );
        }
      }
    };

    saveChainRef.current = saveChainRef.current.then(run, run);
    return saveChainRef.current;
  }, [trainerId, onSaved, applyPendingCellEdit, ensureDocId]);

  performSaveRef.current = performSave;

  const queueSave = useCallback(() => {
    if (!trainerId) return;
    userEditedRef.current = true;
    canAutoSaveRef.current = true;
    setStatus('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      performSave();
    }, 1200);
  }, [trainerId, performSave]);

  const flushSave = useCallback(() => {
    if (!trainerId || !canAutoSaveRef.current) return Promise.resolve();
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    return performSave();
  }, [trainerId, performSave]);

  applyPendingCellEditRef.current = applyPendingCellEdit;

  useEffect(() => {
    if (!visible || !canAutoSaveRef.current || !userEditedRef.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      performSave();
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [rows, formats, colWidths, favorite, title, visible, performSave]);

  useEffect(() => {
    if (!visible) return;
    if (lastSavedTimer.current) clearInterval(lastSavedTimer.current);
    lastSavedTimer.current = setInterval(() => setLastSaved((d) => new Date(d.getTime())), 2000);
    return () => clearInterval(lastSavedTimer.current);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    userEditedRef.current = false;
    canAutoSaveRef.current = false;
    const nextDocId = documentId || null;
    docIdRef.current = nextDocId;
    setDocId(nextDocId);
    setStatus(documentId ? 'saved' : 'idle');
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
        .then((docData) => {
          if (!mounted.current || !docData) return;
          setTitle(docData.title && docData.title !== DEFAULT_SAVE_TITLE_SPREADSHEET ? docData.title : '');
          setFavorite(!!docData.isFavorite);
          setSharedWith(Array.isArray(docData.sharedWith) ? docData.sharedWith : []);
          const docRows = Array.isArray(docData.rows) && docData.rows.length ? docData.rows : makeEmptyRows();
          const normalizedRows = docRows.map((r) => (Array.isArray(r) ? r.map((x) => (x == null ? '' : String(x))) : []));
          rowsRef.current = normalizedRows;
          setRows(normalizedRows);
          setFormats(docData.formats && typeof docData.formats === 'object' ? docData.formats : makeEmptyFormats());
          setColWidths(docData.colWidths && typeof docData.colWidths === 'object' ? docData.colWidths : {});
          setStatus('saved');
          setLastSaved(now());
          canAutoSaveRef.current = true;
        })
        .catch(() => {})
        .finally(() => mounted.current && setLoading(false));
    } else if (initialRows?.length) {
      const normalizedRows = initialRows.map((r) => (Array.isArray(r) ? r.map((x) => (x == null ? '' : String(x))) : []));
      rowsRef.current = normalizedRows;
      setTitle(initialTitle || '');
      setRows(normalizedRows);
      setStatus(documentId ? 'saved' : 'idle');
      setLastSaved(now());
      canAutoSaveRef.current = !!documentId;
    } else {
      const emptyRows = makeEmptyRows();
      rowsRef.current = emptyRows;
      setTitle(initialTitle || '');
      setRows(emptyRows);
      setStatus('idle');
      setLastSaved(now());
      canAutoSaveRef.current = false;
    }
  }, [visible, documentId, trainerId, initialRows, initialTitle]);

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
    const primary = cellRef(r1, c1);
    const range =
      r1 !== r2 || c1 !== c2 ? `${primary}:${cellRef(r2, c2)}` : primary;
    return { count, nums: nums.length, sum, avg, range, primary };
  }, [selection, getCellRaw]);

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
    applyPendingCellEdit();
  }, [applyPendingCellEdit]);

  const handleCellPress = useCallback(
    (r, c, raw) => {
      if (editing && (editing.row !== r || editing.col !== c)) {
        commitEdit();
      }
      setSelection({ row: r, col: c });
      setEditing({ row: r, col: c });
      setDraft(raw == null ? '' : String(raw));
    },
    [editing, commitEdit],
  );

  const navigateToCell = () => {
    Alert.prompt?.('Go to cell', 'Enter a cell reference (e.g. C3)', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Go',
        onPress: (value) => {
          const parsed = parseCellRef(value);
          if (!parsed) {
            Alert.alert('Invalid cell', 'Use a reference like A1 or C3.');
            return;
          }
          if (parsed.row >= rowCount || parsed.col >= colCount) {
            Alert.alert('Out of range', 'That cell is outside the current sheet.');
            return;
          }
          setSelection({ row: parsed.row, col: parsed.col });
        },
      },
    ], 'plain-text', currentRef);
    if (!Alert.prompt) {
      Alert.alert('Go to cell', `Currently selected: ${currentRef}`);
    }
  };

  const handleRename = () => {
    titleInputRef.current?.focus();
  };

  const handleExportCsv = async () => {
    try {
      const csv = rowsToCsv(rows);
      const fileName = `${String(title || 'spreadsheet').replace(/[^a-z0-9_-]/gi, '_')}.csv`;
      const path = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export CSV' });
      } else {
        await Share.share({ message: csv, title });
      }
    } catch (e) {
      Alert.alert('Export failed', e?.message || 'Could not export CSV.');
    }
  };

  const handleDuplicate = async () => {
    if (!trainerId) return;
    try {
      setStatus('saving');
      const res = await saveTrainerSpreadsheet(trainerId, {
        title: `${saveTitle(title)} (copy)`,
        rows,
        columnCount: colCount,
        rowCount,
        formats,
        colWidths,
        isFavorite: favorite,
      });
      if (res?.id) setDocId(res.id);
      setStatus('saved');
      setLastSaved(now());
      onSaved?.();
      Alert.alert('Duplicated', 'A copy was saved to your documents.');
    } catch (e) {
      setStatus('unsaved');
      Alert.alert('Duplicate failed', e?.message || 'Could not duplicate spreadsheet.');
    }
  };

  const handleDelete = () => {
    if (!trainerId || !docId) {
      Alert.alert('Save first', 'Save the spreadsheet before deleting.');
      return;
    }
    Alert.alert('Delete spreadsheet?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteDoc(doc(db, 'users', String(trainerId), 'documents', String(docId)));
            onClose();
            onSaved?.();
          } catch (e) {
            Alert.alert('Delete failed', e?.message || 'Could not delete spreadsheet.');
          }
        },
      },
    ]);
  };

  const handleSharePress = () => {
    userEditedRef.current = true;
    flushSave()
      .then(() => {
        if (!docIdRef.current) {
          Alert.alert('Save first', 'Add a title or cell so the spreadsheet saves before sharing with clients.');
          return;
        }
        if (statusRef.current !== 'saved') {
          Alert.alert('Saving…', 'Wait a moment for your changes to save, then try sharing again.');
          return;
        }
        setShowShare(true);
      })
      .catch(() => {});
  };

  const handleAddPress = () => {
    Alert.alert('Add to sheet', undefined, [
      { text: 'Add row below', onPress: () => insertRow(selection.row + 1) },
      { text: 'Add row at bottom', onPress: () => insertRow(rowCount) },
      { text: 'Add column right', onPress: () => insertCol(selection.col + 1) },
      { text: 'Add column at end', onPress: () => insertCol(colCount) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openMoreMenu = () => {
    Alert.alert('Spreadsheet options', undefined, [
      { text: 'Rename', onPress: handleRename },
      { text: 'Export CSV', onPress: handleExportCsv },
      { text: 'Duplicate', onPress: handleDuplicate },
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openRowMenu = useCallback(
    (rowIndex) => {
      Alert.alert(`Row ${rowIndex + 1}`, undefined, [
        { text: 'Insert above', onPress: () => insertRow(rowIndex) },
        { text: 'Insert below', onPress: () => insertRow(rowIndex + 1) },
        ...(rowCount > 1
          ? [{ text: 'Delete row', style: 'destructive', onPress: () => deleteRow(rowIndex) }]
          : []),
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [insertRow, deleteRow, rowCount],
  );

  const openColMenu = useCallback(
    (colIndex) => {
      Alert.alert(`Column ${colLetter(colIndex)}`, undefined, [
        { text: 'Insert left', onPress: () => insertCol(colIndex) },
        { text: 'Insert right', onPress: () => insertCol(colIndex + 1) },
        ...(colCount > 1
          ? [{ text: 'Delete column', style: 'destructive', onPress: () => deleteCol(colIndex) }]
          : []),
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [insertCol, deleteCol, colCount],
  );

  const gridWidth =
    ROW_NUM_W +
    ADD_STRIP_W +
    Array.from({ length: colCount }).reduce((sum, _, c) => sum + colW(c), 0);

  const iconColor = (active) => (active ? theme.text : theme.textMuted);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBackPress}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: theme.canvasBg }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.canvasBg }}>
          {trainerNavChrome ? (
            <CoachConnectHeader
              title="Spreadsheet"
              skipTopSafeInset
              appearanceIsDark={isSheetDark}
              onBack={handleBackPress}
              onProfilePress={trainerNavChrome.onProfilePress}
              onSettingsPress={trainerNavChrome.onSettingsPress}
            />
          ) : (
            <View style={[styles.backRow, { backgroundColor: theme.headerBg }]}>
              <TouchableOpacity onPress={handleBackPress} style={styles.headerBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.titleSection, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
            <EditorTitleField
              inputRef={titleInputRef}
              value={title}
              onChangeText={(t) => {
                userEditedRef.current = true;
                canAutoSaveRef.current = true;
                setTitle(t);
                setStatus('unsaved');
              }}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
              focused={titleFocused}
              theme={theme}
            />
            <View style={styles.metaRow}>
              <EditorStatusPill status={status} theme={theme} />
              <View style={{ flex: 1 }} />
              <EditorIconButton
                icon="share-outline"
                onPress={handleSharePress}
                theme={theme}
                accessibilityLabel="Share with clients"
              />
              <EditorIconButton
                icon={favorite ? 'star' : 'star-outline'}
                onPress={() => {
                  setFavorite((v) => {
                    favoriteRef.current = !v;
                    return !v;
                  });
                  queueSave();
                }}
                theme={theme}
                active={favorite}
                accessibilityLabel="Favorite"
              />
              <EditorIconButton
                icon={isSheetDark ? 'sunny-outline' : 'moon-outline'}
                onPress={() => setThemeMode((t) => (t === 'dark' ? 'light' : 'dark'))}
                theme={theme}
                accessibilityLabel="Toggle theme"
              />
            </View>
          </View>

          <View style={{ flex: 1 }}>
              <View style={[styles.toolbar, { backgroundColor: theme.toolbarBg, borderBottomColor: theme.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarRow}>
                  <ToolBtn theme={theme} disabled={!history.length} onPress={undo}>
                    <Ionicons name="arrow-undo-outline" size={18} color={theme.textMuted} />
                  </ToolBtn>
                  <ToolBtn theme={theme} disabled={!future.length} onPress={redo}>
                    <Ionicons name="arrow-redo-outline" size={18} color={theme.textMuted} />
                  </ToolBtn>
                  <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                  <ToolBtn theme={theme} active={currentFmt.numberFormat === 'currency'} onPress={() => applyFormat({ numberFormat: 'currency' })}>
                    <Text style={{ color: iconColor(currentFmt.numberFormat === 'currency'), fontWeight: '800', fontSize: 13 }}>$</Text>
                  </ToolBtn>
                  <ToolBtn theme={theme} active={currentFmt.numberFormat === 'percent'} onPress={() => applyFormat({ numberFormat: 'percent' })}>
                    <Text style={{ color: iconColor(currentFmt.numberFormat === 'percent'), fontWeight: '800', fontSize: 13 }}>%</Text>
                  </ToolBtn>
                  <ToolBtn theme={theme} active={currentFmt.numberFormat === 'decimal0'} onPress={() => applyFormat({ numberFormat: 'decimal0' })}>
                    <Text style={{ color: iconColor(currentFmt.numberFormat === 'decimal0'), fontWeight: '700', fontSize: 11 }}>.0</Text>
                  </ToolBtn>
                  <ToolBtn theme={theme} active={currentFmt.numberFormat === 'decimal2'} onPress={() => applyFormat({ numberFormat: 'decimal2' })}>
                    <Text style={{ color: iconColor(currentFmt.numberFormat === 'decimal2'), fontWeight: '700', fontSize: 11 }}>.00</Text>
                  </ToolBtn>
                  <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                  <ToolBtn
                    theme={theme}
                    onPress={() => {
                      const cur = currentFmt.fontSize || 13;
                      const idx = FONT_SIZES.indexOf(cur);
                      const next = FONT_SIZES[Math.max(0, (idx === -1 ? 2 : idx) - 1)];
                      applyFormat({ fontSize: next });
                    }}
                  >
                    <Ionicons name="remove" size={16} color={theme.textMuted} />
                  </ToolBtn>
                  <View style={[styles.fontSizePill, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
                    <Text style={{ color: theme.text, fontSize: 12, fontWeight: '700' }}>{currentFmt.fontSize || 13}</Text>
                  </View>
                  <ToolBtn
                    theme={theme}
                    onPress={() => {
                      const cur = currentFmt.fontSize || 13;
                      const idx = FONT_SIZES.indexOf(cur);
                      const next = FONT_SIZES[Math.min(FONT_SIZES.length - 1, (idx === -1 ? 2 : idx) + 1)];
                      applyFormat({ fontSize: next });
                    }}
                  >
                    <Ionicons name="add" size={16} color={theme.textMuted} />
                  </ToolBtn>
                  <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                  <ToolBtn theme={theme} active={!!currentFmt.bold} onPress={() => applyFormat({ bold: !currentFmt.bold })}>
                    <Text style={{ color: iconColor(!!currentFmt.bold), fontWeight: '900' }}>B</Text>
                  </ToolBtn>
                  <ToolBtn theme={theme} active={!!currentFmt.italic} onPress={() => applyFormat({ italic: !currentFmt.italic })}>
                    <Text style={{ color: iconColor(!!currentFmt.italic), fontStyle: 'italic', fontWeight: '800' }}>I</Text>
                  </ToolBtn>
                  <ToolBtn theme={theme} active={!!currentFmt.strike} onPress={() => applyFormat({ strike: !currentFmt.strike })}>
                    <Text style={{ color: iconColor(!!currentFmt.strike), textDecorationLine: 'line-through', fontWeight: '800' }}>S</Text>
                  </ToolBtn>
                  <ToolBtn
                    theme={theme}
                    onPress={() => pickPaletteColor('Text color', TEXT_PALETTE, (color) => applyFormat({ color: color || undefined }))}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ color: currentFmt.color || theme.text, fontWeight: '900', fontSize: 14 }}>A</Text>
                      <View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: currentFmt.color || theme.text, marginTop: 1 }} />
                    </View>
                  </ToolBtn>
                  <ToolBtn
                    theme={theme}
                    onPress={() => pickPaletteColor('Fill color', FILL_PALETTE, (bg) => applyFormat({ bg: bg || undefined }))}
                  >
                    <Ionicons name="color-fill-outline" size={18} color={currentFmt.bg ? theme.text : theme.textMuted} />
                  </ToolBtn>
                  <ToolBtn
                    theme={theme}
                    active={currentFmt.border === 'all'}
                    onPress={() => applyFormat({ border: currentFmt.border === 'all' ? undefined : 'all' })}
                  >
                    <MaterialIcons name="border-all" size={18} color={iconColor(currentFmt.border === 'all')} />
                  </ToolBtn>
                  <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                  <ToolBtn theme={theme} active={(currentFmt.align || 'left') === 'left'} onPress={() => applyFormat({ align: 'left' })}>
                    <MaterialIcons name="format-align-left" size={18} color={iconColor((currentFmt.align || 'left') === 'left')} />
                  </ToolBtn>
                  <ToolBtn theme={theme} active={currentFmt.align === 'center'} onPress={() => applyFormat({ align: 'center' })}>
                    <MaterialIcons name="format-align-center" size={18} color={iconColor(currentFmt.align === 'center')} />
                  </ToolBtn>
                  <ToolBtn theme={theme} active={currentFmt.align === 'right'} onPress={() => applyFormat({ align: 'right' })}>
                    <MaterialIcons name="format-align-right" size={18} color={iconColor(currentFmt.align === 'right')} />
                  </ToolBtn>
                  <ToolBtn theme={theme} active={currentFmt.vAlign === 'top'} onPress={() => applyFormat({ vAlign: 'top' })}>
                    <MaterialIcons name="vertical-align-top" size={18} color={iconColor(currentFmt.vAlign === 'top')} />
                  </ToolBtn>
                  <ToolBtn theme={theme} active={(currentFmt.vAlign || 'middle') === 'middle'} onPress={() => applyFormat({ vAlign: 'middle' })}>
                    <MaterialIcons name="vertical-align-center" size={18} color={iconColor((currentFmt.vAlign || 'middle') === 'middle')} />
                  </ToolBtn>
                  <ToolBtn theme={theme} active={currentFmt.vAlign === 'bottom'} onPress={() => applyFormat({ vAlign: 'bottom' })}>
                    <MaterialIcons name="vertical-align-bottom" size={18} color={iconColor(currentFmt.vAlign === 'bottom')} />
                  </ToolBtn>
                  <ToolBtn theme={theme} active={!!currentFmt.wrap} onPress={() => applyFormat({ wrap: !currentFmt.wrap })}>
                    <MaterialIcons name="wrap-text" size={18} color={iconColor(!!currentFmt.wrap)} />
                  </ToolBtn>
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.toolbarRow, styles.toolbarRowSecondary]}>
                  <SheetActionChip theme={theme} label="Row +" icon="arrow-down-outline" onPress={() => insertRow(selection.row + 1)} />
                  <SheetActionChip theme={theme} label="Row −" icon="remove-outline" onPress={() => deleteRow(selection.row)} disabled={rowCount <= 1} />
                  <SheetActionChip theme={theme} label="Col +" icon="arrow-forward-outline" onPress={() => insertCol(selection.col + 1)} />
                  <SheetActionChip theme={theme} label="Col −" icon="remove-outline" onPress={() => deleteCol(selection.col)} disabled={colCount <= 1} />
                  <View style={[styles.divider, { backgroundColor: theme.divider }]} />
                  <ToolBtn
                    theme={theme}
                    onPress={() => {
                      Alert.alert('Formulas', 'Insert a formula into the selected cell.', [
                        { text: 'SUM', onPress: () => setCell(selection.row, selection.col, '=SUM(A1:A10)') },
                        { text: 'AVG', onPress: () => setCell(selection.row, selection.col, '=AVG(A1:A10)') },
                        { text: 'COUNT', onPress: () => setCell(selection.row, selection.col, '=COUNT(A1:A10)') },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }}
                  >
                    <Text style={{ color: theme.textMuted, fontWeight: '800', fontSize: 15 }}>Σ</Text>
                  </ToolBtn>
                  <ToolBtn theme={theme} onPress={() => sortByCol(selection.col, 'asc')}>
                    <Ionicons name="swap-vertical-outline" size={18} color={theme.textMuted} />
                  </ToolBtn>
                  <ToolBtn theme={theme} onPress={handleSharePress}>
                    <Ionicons name="share-outline" size={18} color={theme.textMuted} />
                  </ToolBtn>
                </ScrollView>
              </View>

              <View style={[styles.formulaBar, { backgroundColor: theme.toolbarBg, borderBottomColor: theme.border }]}>
                <TouchableOpacity
                  onPress={navigateToCell}
                  style={[styles.refPill, { borderColor: theme.border, backgroundColor: theme.inputBg, minHeight: 44 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`Selected cell ${currentRef}`}
                >
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: '800' }}>{currentRef}</Text>
                </TouchableOpacity>
                <Text style={{ color: theme.formula, fontSize: 13, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined }}>fx</Text>
                <TextInput
                  value={editing ? draft : currentRaw}
                  onChangeText={(t) => {
                    draftRef.current = t;
                    setDraft(t);
                    userEditedRef.current = true;
                    if (!editing) {
                      setEditing({ row: selection.row, col: selection.col });
                    }
                    queueSave();
                  }}
                  onFocus={() => {
                    setEditing({ row: selection.row, col: selection.col });
                    setDraft(currentRaw);
                  }}
                  onBlur={commitEdit}
                  placeholder="Tap a cell or type here"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.formulaInput,
                    {
                      color: (editing ? draft : currentRaw).startsWith('=') ? theme.formula : theme.text,
                      borderColor: theme.border,
                      backgroundColor: theme.inputBg,
                    },
                  ]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={{ flex: 1 }}>
              <View style={{ flex: 1, backgroundColor: theme.pageBg }}>
                {loading ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={theme.accent} />
                  </View>
                ) : (
                  <ScrollView horizontal style={{ flex: 1 }} contentContainerStyle={{ minWidth: '100%' }}>
                    <View style={{ width: gridWidth }}>
                      <View style={[styles.colHeaderRow, { height: HEADER_H, backgroundColor: theme.gridHeaderBg, borderBottomColor: theme.gridLine }]}>
                        <View style={[styles.corner, { width: ROW_NUM_W, height: HEADER_H, backgroundColor: theme.cornerBg, borderRightColor: theme.gridLine }]} />
                        {Array.from({ length: colCount }).map((_, c) => {
                          const selectedCol = selection.col === c;
                          return (
                            <TouchableOpacity
                              key={`col-${c}`}
                              activeOpacity={0.7}
                              onPress={() => setSelection({ row: 0, col: c, endRow: rowCount - 1, endCol: c })}
                              onLongPress={() => openColMenu(c)}
                              delayLongPress={280}
                              style={[styles.colHeaderCell, { width: colW(c), height: HEADER_H, borderRightColor: theme.gridLine }]}
                            >
                              {selectedCol ? (
                                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text }}>
                                  {colLetter(c)}
                                </Text>
                              ) : (
                                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.textMuted }}>
                                  {colLetter(c)}
                                </Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                        <TouchableOpacity
                          onPress={() => insertCol(colCount)}
                          accessibilityRole="button"
                          accessibilityLabel="Add column"
                          style={[
                            styles.addStripBtn,
                            {
                              width: ADD_STRIP_W,
                              height: HEADER_H,
                              backgroundColor: theme.cornerBg,
                              borderRightColor: theme.gridLine,
                            },
                          ]}
                        >
                          <Ionicons name="add" size={20} color={theme.textMuted} />
                        </TouchableOpacity>
                      </View>

                      <FlatList
                        data={rows}
                        keyExtractor={(_, idx) => `r-${idx}`}
                        ListFooterComponent={
                          <TouchableOpacity
                            onPress={() => insertRow(rowCount)}
                            accessibilityRole="button"
                            accessibilityLabel="Add row"
                            style={[
                              styles.addRowFooter,
                              {
                                height: ROW_H,
                                backgroundColor: theme.gridHeaderBg,
                                borderTopColor: theme.gridLine,
                                borderBottomColor: theme.gridLine,
                              },
                            ]}
                          >
                            <Ionicons name="add" size={16} color={theme.textMuted} />
                            <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '700', marginLeft: 6 }}>Add row</Text>
                          </TouchableOpacity>
                        }
                        renderItem={({ item: row, index: r }) => (
                          <View style={[styles.row, { height: ROW_H, borderBottomColor: theme.gridLine }]}>
                            <TouchableOpacity
                              activeOpacity={0.7}
                              onPress={() => setSelection({ row: r, col: 0, endRow: r, endCol: colCount - 1 })}
                              onLongPress={() => openRowMenu(r)}
                              delayLongPress={280}
                              style={[styles.rowNum, { width: ROW_NUM_W, height: ROW_H, backgroundColor: theme.gridHeaderBg, borderRightColor: theme.gridLine }]}
                            >
                              {selection.row === r ? (
                                <Text style={{ fontSize: 12, fontWeight: '800', color: theme.text, textAlign: 'center' }}>
                                  {String(r + 1)}
                                </Text>
                              ) : (
                                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textMuted, textAlign: 'center' }}>
                                  {r + 1}
                                </Text>
                              )}
                            </TouchableOpacity>
                            <View style={{ flexDirection: 'row' }}>
                              {row.map((cell, c) => {
                                const ref = cellRef(r, c);
                                const fmt = formats[ref] || {};
                                const sel = selection.row === r && selection.col === c;
                                const isEditing = editing?.row === r && editing?.col === c;
                                const raw = cell ?? '';
                                const disp = displayValue(raw, getCellRaw, fmt);
                                const isFormula = String(raw).startsWith('=');
                                const align = fmt.align || 'left';
                                const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
                                const vAlign = fmt.vAlign || 'middle';
                                const contentAlign = vAlign === 'top' ? 'flex-start' : vAlign === 'bottom' ? 'flex-end' : 'center';
                                const cellBg = fmt.bg || theme.pageBg;
                                const borderStyle = fmt.border === 'all' ? { borderWidth: 1, borderColor: theme.textMuted } : null;
                                return (
                                  <TouchableOpacity
                                    key={`${r}-${c}`}
                                    activeOpacity={1}
                                    onPress={() => handleCellPress(r, c, raw)}
                                    style={[
                                      styles.cell,
                                      {
                                        width: colW(c),
                                        height: ROW_H,
                                        borderRightColor: theme.gridLine,
                                        borderBottomColor: theme.gridLine,
                                        backgroundColor: cellBg,
                                        ...borderStyle,
                                        ...(sel
                                          ? {
                                              borderWidth: 2,
                                              borderColor: theme.selectionBorder,
                                              backgroundColor: theme.selectionFill,
                                              zIndex: 2,
                                            }
                                          : { borderRightWidth: 1, borderBottomWidth: 1 }),
                                      },
                                    ]}
                                  >
                                    {isEditing ? (
                                      <TextInput
                                        value={draft}
                                        onChangeText={(t) => {
                                          draftRef.current = t;
                                          setDraft(t);
                                          userEditedRef.current = true;
                                          queueSave();
                                        }}
                                        autoFocus
                                        onBlur={commitEdit}
                                        style={[
                                          styles.cellInput,
                                          {
                                            color: draft.startsWith('=') ? theme.formula : (fmt.color || theme.text),
                                            fontWeight: fmt.bold ? '800' : '400',
                                            fontStyle: fmt.italic ? 'italic' : 'normal',
                                            textDecorationLine: fmt.strike ? 'line-through' : 'none',
                                            textAlign: align,
                                            fontSize: fmt.fontSize || 13,
                                          },
                                        ]}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                      />
                                    ) : (
                                      <View style={{ flex: 1, justifyContent: contentAlign, alignItems: justify, paddingHorizontal: 10 }}>
                                        <Text
                                          numberOfLines={fmt.wrap ? 3 : 1}
                                          style={{
                                            fontSize: fmt.fontSize || 13,
                                            color: fmt.color || (isFormula ? theme.formula : theme.text),
                                            fontWeight: fmt.bold ? '800' : '400',
                                            fontStyle: fmt.italic ? 'italic' : 'normal',
                                            textDecorationLine: fmt.strike ? 'line-through' : 'none',
                                            textAlign: align,
                                            width: '100%',
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
                            <View
                              style={{
                                width: ADD_STRIP_W,
                                height: ROW_H,
                                backgroundColor: theme.cornerBg,
                                borderRightWidth: 1,
                                borderRightColor: theme.gridLine,
                              }}
                            />
                          </View>
                        )}
                      />
                    </View>
                  </ScrollView>
                )}
              </View>
                </View>
              </TouchableWithoutFeedback>

              <View style={[styles.statusBar, { backgroundColor: theme.headerBg, borderTopColor: theme.border }]}>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                  {computedStats.range}
                  {'  |  '}
                  Sum: {Math.round(computedStats.sum * 100) / 100}
                  {'  '}
                  Average: {Math.round(computedStats.avg * 100) / 100}
                  {'  '}
                  Count: {computedStats.count}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12 }}>{formatEditorSavedAgo(lastSaved)}</Text>
              </View>
          </View>

          <ShareDocumentModal
            visible={showShare}
            onClose={() => setShowShare(false)}
            trainerId={trainerId}
            documentId={docId}
            initialSharedWith={sharedWith}
            isDark={isSheetDark}
            onSaved={() => {
              onSaved?.();
              if (trainerId && docId) {
                getTrainerDocument(trainerId, docId).then((d) => {
                  if (d && mounted.current) setSharedWith(Array.isArray(d.sharedWith) ? d.sharedWith : []);
                });
              }
            }}
          />

          {trainerNavChrome ? (
            <BottomNavBar
              appearanceIsDark={isSheetDark}
              activeTabKey={trainerNavChrome.activeTabKey || 'files'}
              onHomePress={trainerNavChrome.onHomePress}
              onPlusPress={trainerNavChrome.onPlusPress}
              onVoicePress={trainerNavChrome.onVoicePress}
              onNutritionPress={trainerNavChrome.onNutritionPress}
              onWorkoutPress={trainerNavChrome.onWorkoutPress}
              onMessagesPress={trainerNavChrome.onMessagesPress}
            />
          ) : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backRow: {
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  titleSection: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  toolbar: { borderBottomWidth: StyleSheet.hairlineWidth },
  toolbarRow: { paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', gap: 4 },
  toolbarRowSecondary: { paddingTop: 0, paddingBottom: 8 },
  fontSizePill: {
    minWidth: 34,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sheetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  addStripBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
  },
  addRowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: { width: 1, height: 20, marginHorizontal: 4 },
  formulaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  refPill: {
    minWidth: 52,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formulaInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 14,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined,
  },
  colHeaderRow: { flexDirection: 'row', borderBottomWidth: 1 },
  corner: { borderRightWidth: 1 },
  colHeaderCell: { alignItems: 'center', justifyContent: 'center', borderRightWidth: 1 },
  row: { flexDirection: 'row', borderBottomWidth: 1 },
  rowNum: { alignItems: 'center', justifyContent: 'center', borderRightWidth: 1 },
  cell: { overflow: 'hidden' },
  cellInput: { flex: 1, paddingHorizontal: 10, fontSize: 13 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
});
