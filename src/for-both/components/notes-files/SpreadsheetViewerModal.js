/**
 * Spreadsheet Viewer Modal
 *
 * Purpose: UI screen or component: Spreadsheet Viewer Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: SpreadsheetViewerModal
 *
 * @file-header
 */
/**
 * SpreadsheetViewerModal — read-only viewer for uploaded .csv / .xlsx files.
 *
 * NOTE: This is NOT SpreadsheetEditorModal (trainer edit UI lives at
 * src/trainer-app/documents/SpreadsheetEditorModal.js). Clients and trainers
 * use this modal to preview file attachments from a download URL.
 *
 * Flow:
 *   1. Parent passes visible + url + filename
 *   2. fetch(url) → parse CSV text OR XLSX binary
 *   3. Render rows in a scrollable table (horizontal + vertical ScrollViews)
 *
 * Props:
 *   visible — show/hide modal
 *   url     — Firebase Storage or HTTPS URL to the file
 *   name    — filename (used to detect .csv vs .xlsx)
 *   isDark  — light/dark chrome for header and cells
 *   onClose — back button / Android back
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import XLSX from '../../../utils/xlsx'; // SheetJS build for React Native

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_PADDING = 10;
const MIN_CELL_WIDTH = 80; // each column at least this wide for readability

/**
 * parseCSV — turn raw CSV/TSV text into a 2D array of strings.
 * Handles quoted fields and escaped quotes ("" inside quotes).
 */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false; // end of quoted field
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ',' || ch === '\t') {
      row.push(cell.trim());
      cell = '';
      if (ch === '\t' && row.length === 1 && !cell) continue;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++; // Windows CRLF
      row.push(cell.trim());
      cell = '';
      if (row.some((c) => c !== '')) rows.push(row); // skip blank lines
      row = [];
    } else {
      cell += ch;
    }
  }

  // Last row if file doesn't end with newline
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

/**
 * fetchSpreadsheetData — download file and return rows[][].
 * CSV → text + parseCSV. XLSX → arrayBuffer + SheetJS.
 */
async function fetchSpreadsheetData(url, filename) {
  const isCsv = (filename || '').toLowerCase().endsWith('.csv');
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error('Failed to load file');

  if (isCsv) {
    const text = await res.text();
    return parseCSV(text);
  }

  const ab = await res.arrayBuffer();
  const wb = XLSX.read(ab, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const ws = wb.Sheets[firstSheetName];
  // header: 1 → array of rows (not array of objects)
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  return data;
}

export default function SpreadsheetViewerModal({ visible, url, name, rows: rowsProp = null, isDark = true, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortCol, setSortCol] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);

  const normalizeRows = (raw) => {
    const list = Array.isArray(raw) && raw.length ? raw : [];
    const maxCols = Math.max(0, ...list.map((r) => (Array.isArray(r) ? r.length : 1)));
    return list.map((r) => {
      const arr = Array.isArray(r) ? [...r] : [r];
      while (arr.length < maxCols) arr.push('');
      return arr.slice(0, maxCols);
    });
  };

  useEffect(() => {
    if (!visible) {
      setRows([]);
      setError(null);
      setLoading(true);
      setSortCol(null);
      return;
    }

    const inlineRows = normalizeRows(rowsProp);
    const hasInlineRows = inlineRows.some((row) =>
      row.some((cell) => String(cell ?? '').trim() !== ''),
    );

    if (!url) {
      setRows(hasInlineRows ? inlineRows : []);
      setError(hasInlineRows ? null : 'Could not load spreadsheet');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSpreadsheetData(url, name)
      .then((data) => {
        if (!cancelled) {
          let raw = Array.isArray(data) && data.length ? data : [];
          if (
            !raw.length &&
            hasInlineRows
          ) {
            raw = rowsProp;
          }
          const normalized = normalizeRows(raw);
          if (!normalized.length) {
            setError('Could not load spreadsheet');
          }
          setRows(normalized);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          if (hasInlineRows) {
            setRows(inlineRows);
            setError(null);
          } else {
            setError(e?.message || 'Could not load spreadsheet');
            setRows([]);
          }
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [visible, url, name, rowsProp]);

  const displayRows = useMemo(() => {
    if (!rows.length || sortCol == null || sortCol < 0) return rows;
    const header = rows[0];
    const body = rows.slice(1);
    const sorted = [...body].sort((a, b) => {
      const av = String(a[sortCol] ?? '');
      const bv = String(b[sortCol] ?? '');
      const an = Number(av);
      const bn = Number(bv);
      let cmp;
      if (Number.isFinite(an) && Number.isFinite(bn) && av.trim() !== '' && bv.trim() !== '') {
        cmp = an - bn;
      } else {
        cmp = av.localeCompare(bv, undefined, { sensitivity: 'base' });
      }
      return sortAsc ? cmp : -cmp;
    });
    return [header, ...sorted];
  }, [rows, sortCol, sortAsc]);

  const rowsToCsv = (data) =>
    (data || [])
      .map((row) =>
        (Array.isArray(row) ? row : [row])
          .map((cell) => {
            const s = String(cell ?? '');
            if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
            return s;
          })
          .join(','),
      )
      .join('\n');

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(rowsToCsv(displayRows));
      Alert.alert('Copied', 'Table copied to clipboard as CSV.');
    } catch (e) {
      Alert.alert('Copy failed', e?.message || 'Could not copy');
    }
  };

  const handleShareCsv = async () => {
    try {
      const csv = rowsToCsv(displayRows);
      await Share.share({
        message: csv,
        title: name || 'Spreadsheet',
      });
    } catch (e) {
      if (e?.message && !/User did not share/i.test(e.message)) {
        Alert.alert('Share failed', e.message);
      }
    }
  };

  const bg = isDark ? '#0A0A0A' : '#F9FAFB';
  const textColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.75)';
  const headerBg = 'rgba(255,255,255,0.08)';
  const tableBg = 'rgba(255,255,255,0.04)';
  const borderColor = 'rgba(255,255,255,0.08)';
  const rowAlt = 'rgba(255,255,255,0.02)';

  const colCount = (displayRows[0] || []).length || 1;
  const tableWidth = Math.max(SCREEN_WIDTH - 32, colCount * MIN_CELL_WIDTH);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#1a1040'} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#1a1040' }]} numberOfLines={1}>
            {name || 'Spreadsheet'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <TouchableOpacity onPress={handleCopy} style={styles.backBtn} hitSlop={8} accessibilityLabel="Copy CSV">
              <Ionicons name="copy-outline" size={22} color={isDark ? '#fff' : '#1a1040'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShareCsv} style={styles.backBtn} hitSlop={8} accessibilityLabel="Share CSV">
              <Ionicons name="share-outline" size={22} color={isDark ? '#fff' : '#1a1040'} />
            </TouchableOpacity>
          </View>
        </View>

        {!loading && !error && displayRows.length > 0 ? (
          <Text style={{ paddingHorizontal: 16, paddingBottom: 8, color: textColor, fontSize: 12 }}>
            Viewing in-app · tap a header cell to sort · copy or share as CSV
          </Text>
        ) : null}

        <View style={styles.content}>
          {loading && (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color="#10B981" />
              <Text style={[styles.loadingText, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }]}>
                Loading…
              </Text>
            </View>
          )}
          {error && (
            <View style={styles.errorBlock}>
              <Text style={[styles.errorText, { color: isDark ? 'rgba(255,255,255,0.8)' : '#1a1040' }]}>{error}</Text>
            </View>
          )}
          {!loading && !error && displayRows.length > 0 && (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              horizontal
              showsHorizontalScrollIndicator={true}
            >
              <ScrollView
                style={styles.scrollVertical}
                contentContainerStyle={[styles.scrollContentVertical, { width: tableWidth }]}
                showsVerticalScrollIndicator={true}
              >
                <View style={[styles.table, { backgroundColor: tableBg, borderColor }]}>
                  {displayRows.map((row, rIndex) => (
                    <View
                      key={rIndex}
                      style={[
                        styles.row,
                        rIndex === 0 && { backgroundColor: headerBg },
                        rIndex > 0 && rIndex % 2 === 0 && { backgroundColor: rowAlt },
                      ]}
                    >
                      {(Array.isArray(row) ? row : [row]).map((cell, cIndex) => (
                        <TouchableOpacity
                          key={cIndex}
                          disabled={rIndex !== 0}
                          onPress={() => {
                            if (sortCol === cIndex) setSortAsc((v) => !v);
                            else {
                              setSortCol(cIndex);
                              setSortAsc(true);
                            }
                          }}
                          style={[styles.cell, { borderColor }]}
                        >
                          <Text
                            style={[
                              styles.cellText,
                              { color: rIndex === 0 ? (isDark ? '#fff' : '#1a1040') : textColor },
                              rIndex === 0 && styles.headerText,
                            ]}
                            numberOfLines={2}
                          >
                            {cell != null && String(cell).trim() !== '' ? String(cell) : ''}
                            {rIndex === 0 && sortCol === cIndex ? (sortAsc ? ' ▲' : ' ▼') : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: { padding: 4 },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  content: { flex: 1, padding: 16 },
  loadingBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15 },
  errorBlock: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 15, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  scrollVertical: { flex: 1 },
  scrollContentVertical: { paddingBottom: 24 },
  table: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  cell: {
    minWidth: MIN_CELL_WIDTH,
    width: MIN_CELL_WIDTH,
    padding: CELL_PADDING,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  cellText: { fontSize: 12 },
  headerText: { fontWeight: '700' },
});
