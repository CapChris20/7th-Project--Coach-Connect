/**
 * In-app spreadsheet viewer for .csv and .xlsx files.
 * Parses and renders first sheet as a scrollable table. No external app.
 */

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import XLSX from '../../utils/xlsx';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_PADDING = 10;
const MIN_CELL_WIDTH = 80;

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
          cell += '"';
          i++;
        } else {
          inQuotes = false;
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
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      cell = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}

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
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  return data;
}

export default function SpreadsheetViewerModal({ visible, url, name, isDark = true, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible || !url) {
      setRows([]);
      setError(null);
      setLoading(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSpreadsheetData(url, name)
      .then((data) => {
        if (!cancelled) {
          const raw = Array.isArray(data) && data.length ? data : [];
          const maxCols = Math.max(0, ...raw.map((r) => (Array.isArray(r) ? r.length : 1)));
          const normalized = raw.map((r) => {
            const arr = Array.isArray(r) ? [...r] : [r];
            while (arr.length < maxCols) arr.push('');
            return arr.slice(0, maxCols);
          });
          setRows(normalized);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || 'Could not load spreadsheet');
          setRows([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [visible, url, name]);

  const bg = isDark ? '#0A0A0A' : '#F9FAFB';
  const textColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.75)';
  const headerBg = 'rgba(255,255,255,0.08)';
  const tableBg = 'rgba(255,255,255,0.04)';
  const borderColor = 'rgba(255,255,255,0.08)';
  const rowAlt = 'rgba(255,255,255,0.02)';

  const colCount = (rows[0] || []).length || 1;
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
          <View style={{ width: 40 }} />
        </View>
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
          {!loading && !error && rows.length > 0 && (
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
                  {rows.map((row, rIndex) => (
                    <View
                      key={rIndex}
                      style={[
                        styles.row,
                        rIndex === 0 && { backgroundColor: headerBg },
                        rIndex > 0 && rIndex % 2 === 0 && { backgroundColor: rowAlt },
                      ]}
                    >
                      {(Array.isArray(row) ? row : [row]).map((cell, cIndex) => (
                        <View key={cIndex} style={[styles.cell, { borderColor }]}>
                          <Text
                            style={[
                              styles.cellText,
                              { color: rIndex === 0 ? (isDark ? '#fff' : '#1a1040') : textColor },
                              rIndex === 0 && styles.headerText,
                            ]}
                            numberOfLines={2}
                          >
                            {cell != null && String(cell).trim() !== '' ? String(cell) : ''}
                          </Text>
                        </View>
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
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },
  errorBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollVertical: {
    flex: 1,
  },
  scrollContentVertical: {
    paddingBottom: 24,
  },
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
  cellText: {
    fontSize: 12,
  },
  headerText: {
    fontWeight: '700',
  },
});
