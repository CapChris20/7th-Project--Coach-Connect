import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

const makeEmptyGrid = (rows = 10, cols = 5) => {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      id: `${r}-${c}`,
      value: '',
    })),
  );
};

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
  const [title, setTitle] = useState(initialTitle || '');
  const [grid, setGrid] = useState(() => {
    if (initialRows && initialRows.length) {
      return initialRows.map((row, r) =>
        (row || []).map((cell, c) => ({
          id: `${r}-${c}`,
          value: cell != null ? String(cell) : '',
        })),
      );
    }
    return makeEmptyGrid();
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTitle(initialTitle || '');
      if (initialRows && initialRows.length) {
        setGrid(
          initialRows.map((row, r) =>
            (row || []).map((cell, c) => ({
              id: `${r}-${c}`,
              value: cell != null ? String(cell) : '',
            })),
          ),
        );
      } else {
        setGrid(makeEmptyGrid());
      }
      setSaving(false);
      setLoading(false);
      setSelectedCell(null);
      setHasChanges(false);
      return;
    }
    if (documentId && trainerId && !initialRows) {
      setLoading(true);
      getTrainerDocument(trainerId, documentId)
        .then((doc) => {
          if (doc) {
            setTitle(doc.title || '');
            const docRows = Array.isArray(doc.rows) && doc.rows.length ? doc.rows : makeEmptyGrid();
            setGrid(
              docRows.map((row, r) =>
                (row || []).map((cell, c) => ({
                  id: `${r}-${c}`,
                  value: cell != null ? String(cell) : '',
                })),
              ),
            );
            setHasChanges(false);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [visible, documentId, trainerId, initialRows, initialTitle]);

  const rowCount = grid.length;
  const colCount = grid[0] ? grid[0].length : 0;
  const headerTitle = documentId ? (title.trim() || 'Edit Spreadsheet') : 'New Spreadsheet';

  const handleChangeCell = useCallback((rowIndex, colIndex, value) => {
    setGrid((prev) =>
      prev.map((row, r) =>
        row.map((cell, c) => {
          if (r === rowIndex && c === colIndex) {
            return { ...cell, value };
          }
          return cell;
        }),
      ),
    );
    setHasChanges(true);
  }, []);

  const handleAddRow = useCallback(() => {
    setGrid((prev) => {
      const nextIndex = prev.length;
      const cols = prev[0] ? prev[0].length : 5;
      const newRow = Array.from({ length: cols }, (_, c) => ({
        id: `${nextIndex}-${c}`,
        value: '',
      }));
      return [...prev, newRow];
    });
    setHasChanges(true);
  }, []);

  const handleAddColumn = useCallback(() => {
    setGrid((prev) =>
      prev.map((row, r) => {
        const nextIndex = row.length;
        return [
          ...row,
          {
            id: `${r}-${nextIndex}`,
            value: '',
          },
        ];
      }),
    );
    setHasChanges(true);
  }, []);

  const handleDeleteRow = useCallback(() => {
    if (!selectedCell || rowCount <= 1) return;
    const targetRow = selectedCell.row;
    setGrid((prev) => prev.filter((_, idx) => idx !== targetRow));
    setSelectedCell((prev) => {
      if (!prev) return null;
      const nextRow = Math.max(0, prev.row - 1);
      return { row: nextRow, col: prev.col };
    });
    setHasChanges(true);
  }, [rowCount, selectedCell]);

  const handleDeleteColumn = useCallback(() => {
    if (!selectedCell || colCount <= 1) return;
    const targetCol = selectedCell.col;
    setGrid((prev) =>
      prev.map((row) => row.filter((_, idx) => idx !== targetCol)),
    );
    setSelectedCell((prev) => {
      if (!prev) return null;
      const nextCol = Math.max(0, prev.col - 1);
      return { row: prev.row, col: nextCol };
    });
    setHasChanges(true);
  }, [colCount, selectedCell]);

  const handleBackPress = useCallback(() => {
    if (!hasChanges) {
      onClose();
      return;
    }
    Alert.alert('Unsaved changes', 'Leave without saving?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: onClose },
    ]);
  }, [hasChanges, onClose]);

  const rowsForSave = useMemo(
    () => grid.map((row) => row.map((cell) => cell.value)),
    [grid],
  );

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    if (!trainerId) {
      Alert.alert('Error', 'Not signed in as trainer.');
      return;
    }
    setSaving(true);
    try {
      await saveTrainerSpreadsheet(trainerId, {
        id: documentId || undefined,
        title: trimmedTitle,
        rows: rowsForSave,
        columnCount: colCount,
        rowCount,
      });
      onSaved?.();
      setHasChanges(false);
      onClose();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not save spreadsheet.');
    } finally {
      setSaving(false);
    }
  };

  const colLetter = (index) => {
    let n = index;
    let letters = '';
    while (n >= 0) {
      letters = String.fromCharCode(65 + (n % 26)) + letters;
      n = Math.floor(n / 26) - 1;
    }
    return letters;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: '#0A0A0F' }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16,
                height: 56,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(255,255,255,0.07)',
              }}
            >
              <TouchableOpacity
                onPress={handleBackPress}
                style={{ padding: 4 }}
                hitSlop={12}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>{headerTitle}</Text>
              <TouchableOpacity
                onPress={handleSave}
                disabled={!title.trim() || saving}
                style={{ minWidth: 56, alignItems: 'flex-end', opacity: !title.trim() || saving ? 0.4 : 1 }}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FF6B9D" />
                ) : (
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FF6B9D' }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="large" color="#FF6B9D" />
              </View>
            ) : (
              <>
                <TextInput
                  style={{
                    paddingHorizontal: 24,
                    paddingTop: 20,
                    paddingBottom: 12,
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#fff',
                  }}
                  placeholder="Spreadsheet title..."
                  placeholderTextColor="rgba(255,255,255,0.25)"
                  value={title}
                  onChangeText={(text) => {
                    setTitle(text);
                    setHasChanges(true);
                  }}
                  editable={!saving}
                  multiline={false}
                  numberOfLines={1}
                  returnKeyType="next"
                />

                <ScrollView
                  horizontal
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 }}
                  scrollEnabled={true}
                >
                  <View>
                    <View style={{ flexDirection: 'row' }}>
                      <View style={{ width: 36 }} />
                      {Array.from({ length: colCount }).map((_, c) => (
                        <View
                          key={c}
                          style={{
                            minWidth: 100,
                            height: 24,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRightWidth: 1,
                            borderRightColor: 'rgba(255,255,255,0.06)',
                          }}
                        >
                          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{colLetter(c)}</Text>
                        </View>
                      ))}
                    </View>

                    <ScrollView
                      style={{ maxHeight: '100%' }}
                      nestedScrollEnabled
                    >
                      <FlatList
                        data={grid}
                        keyExtractor={(_, index) => `row-${index}`}
                        renderItem={({ item: row, index: r }) => (
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View
                              style={{
                                width: 36,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{r + 1}</Text>
                            </View>
                            <FlatList
                              data={row}
                              keyExtractor={(cell) => cell.id}
                              horizontal
                              renderItem={({ item: cell, index: c }) => {
                                const isHeader = r === 0;
                                const isSelected =
                                  selectedCell && selectedCell.row === r && selectedCell.col === c;
                                return (
                                  <TextInput
                                    value={cell.value}
                                    onChangeText={(value) => handleChangeCell(r, c, value)}
                                    onFocus={() => setSelectedCell({ row: r, col: c })}
                                    style={{
                                      minWidth: 100,
                                      height: 40,
                                      borderRightWidth: 1,
                                      borderBottomWidth: 1,
                                      borderRightColor: 'rgba(255,255,255,0.06)',
                                      borderBottomColor: 'rgba(255,255,255,0.06)',
                                      paddingHorizontal: 10,
                                      fontSize: 13,
                                      color: '#fff',
                                      backgroundColor: isHeader
                                        ? 'rgba(255,255,255,0.08)'
                                        : isSelected
                                        ? 'rgba(255,107,157,0.08)'
                                        : 'transparent',
                                      fontWeight: isHeader ? '700' : '400',
                                      borderWidth: isSelected ? 1 : 0,
                                      borderColor: isSelected ? '#FF6B9D' : 'transparent',
                                    }}
                                    editable={!saving}
                                  />
                                );
                              }}
                            />
                          </View>
                        )}
                      />
                    </ScrollView>
                  </View>
                </ScrollView>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingBottom: 12,
                    paddingTop: 4,
                    borderTopWidth: 1,
                    borderTopColor: 'rgba(255,255,255,0.07)',
                  }}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    {[
                      { label: 'Add Row', onPress: handleAddRow },
                      { label: 'Add Column', onPress: handleAddColumn },
                      { label: 'Delete Row', onPress: handleDeleteRow },
                      { label: 'Delete Column', onPress: handleDeleteColumn },
                    ].map((action) => (
                      <TouchableOpacity
                        key={action.label}
                        onPress={action.onPress}
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.07)',
                          borderRadius: 8,
                          paddingVertical: 6,
                          paddingHorizontal: 12,
                          marginRight: 8,
                        }}
                      >
                        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>{action.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </>
            )}
          </SafeAreaView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

