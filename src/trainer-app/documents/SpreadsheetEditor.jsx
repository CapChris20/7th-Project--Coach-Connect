// Trainer spreadsheet and workout program editor.
// Flow: load or create sheet → select cells → formula / edit cell sheet → autosave to Firestore → share / export.
// Used by: TrainerHomeContent, TrainerMainScreen, and ManageTraineeScreen.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing } from '../../look-and-feel/colorPalette';
import {
  getTrainerDocument,
  saveTrainerSpreadsheet,
} from '../../for-both/files-and-notes/saveNotesAndFiles';
import SpreadsheetGrid from './spreadsheet-grid/SpreadsheetGrid';
import EditCellSheet from './spreadsheet-grid/EditCellSheet';
import SheetMenuModal from './spreadsheet-grid/SheetMenuModal';
import ShareDocumentPopup from './ShareDocumentPopup';
import {
  exportSpreadsheetAsCsv,
  exportSpreadsheetAsPdf,
} from './spreadsheet-grid/exportSpreadsheet';
import {
  buildBlankGridRows,
  buildCustomProgramStarterRows,
  buildStarterWeekSheets,
  columnLabelFromIndex,
  coordinateKey,
  PROGRAM_DAYS,
} from './spreadsheet-grid/spreadsheetConstants';

// ===== NAMED CONSTANTS =====

const DEFAULT_PROGRAM_TITLE = 'Week 3 program';
const DEFAULT_SPREADSHEET_TITLE = 'Spreadsheet';
const AUTOSAVE_DELAY_MILLISECONDS = 1500;
const SUBTITLE_SAVED_JUST_NOW = 'Spreadsheet · Saved just now';
const SUBTITLE_SAVING = 'Saving…';

// ===== HELPER FUNCTIONS =====

/**
 * Top header back button.
 */
function EditorBackButton({ isDark, onPressBack }) {
  const buttonBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const borderColor = isDark ? '#FFFFFF' : '#000000';
  const iconColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <TouchableOpacity
      onPress={onPressBack}
      activeOpacity={0.8}
      style={[
        styles.squareIconButton,
        {
          backgroundColor: buttonBg,
          borderColor,
        },
      ]}
    >
      <Ionicons name="chevron-back" size={24} color={iconColor} />
    </TouchableOpacity>
  );
}

/**
 * Top header sheet menu button [...].
 */
function EditorMenuButton({ isDark, onPressMenu }) {
  const buttonBg = isDark ? '#1C1C1E' : '#FFFFFF';
  const borderColor = isDark ? '#FFFFFF' : '#000000';
  const iconColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <TouchableOpacity
      onPress={onPressMenu}
      activeOpacity={0.8}
      style={[
        styles.squareIconButton,
        {
          backgroundColor: buttonBg,
          borderColor,
        },
      ]}
    >
      <Ionicons name="ellipsis-horizontal" size={22} color={iconColor} />
    </TouchableOpacity>
  );
}

/**
 * Single week tab item.
 */
function WeekTabItem({ weekName, isSelected, isDark, onSelectTab }) {
  const tabBg = isSelected ? (isDark ? '#FFFFFF' : '#000000') : (isDark ? '#1C1C1E' : '#FFFFFF');
  const textColor = isSelected ? (isDark ? '#000000' : '#FFFFFF') : (isDark ? '#FFFFFF' : '#000000');
  const borderColor = isDark ? '#FFFFFF' : '#000000';

  return (
    <TouchableOpacity
      onPress={onSelectTab}
      activeOpacity={0.8}
      style={[
        styles.weekTabButton,
        {
          backgroundColor: tabBg,
          borderColor,
        },
      ]}
    >
      <Text style={[styles.weekTabText, { color: textColor }]}>{weekName}</Text>
    </TouchableOpacity>
  );
}

/**
 * Build cell coordinate label like "B2" or "WED · BOX SQUAT".
 */
function cellDescriptorLabel(rowIndex, columnIndex, gridRows, isProgramMode) {
  if (rowIndex <= 0 || columnIndex <= 0) return 'Cell';

  if (isProgramMode) {
    const exerciseName = gridRows[rowIndex]?.[0] || 'Exercise';
    const dayName = gridRows[0]?.[columnIndex] || 'Day';
    return `${dayName.toUpperCase()} · ${exerciseName.toUpperCase()}`;
  }

  const columnLetter = columnLabelFromIndex(columnIndex - 1);
  return `${columnLetter}${rowIndex}`;
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen spreadsheet and program editor for trainers.
 * Flow: 1. initialize sheets  2. handle autosave  3. render header, tabs, formula bar, grid, and toolbar
 * @param {{
 *   visible: boolean,
 *   trainerId: string,
 *   documentId: string|null,
 *   isDark: boolean,
 *   initialTitle: string,
 *   initialRows: string[][]|null,
 *   isProgramStarter: boolean,
 *   onClose: Function,
 *   onSaved: Function,
 * }} props
 */
export default function SpreadsheetEditor({
  visible,
  trainerId,
  documentId: initialDocumentId,
  isDark = false,
  initialTitle = '',
  initialRows = null,
  isProgramStarter = false,
  onClose,
  onSaved,
}) {
  const [documentId, setDocumentId] = useState(initialDocumentId);
  const [documentTitle, setDocumentTitle] = useState(initialTitle || DEFAULT_PROGRAM_TITLE);
  const [subtitleStatus, setSubtitleStatus] = useState(SUBTITLE_SAVED_JUST_NOW);
  const [isProgramMode, setIsProgramMode] = useState(isProgramStarter || !initialDocumentId);

  // Multi-week sheets state
  const [weekSheets, setWeekSheets] = useState(() => buildStarterWeekSheets(4));
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(2); // Default to Week 3 matching screenshot

  // Active grid data (standard or current week)
  const [standardRows, setStandardRows] = useState(() => initialRows || buildBlankGridRows());
  const [selectedRowIndex, setSelectedRowIndex] = useState(2);
  const [selectedColumnIndex, setSelectedColumnIndex] = useState(2);

  // Formatting & Modals
  const [cellStylesMap, setCellStylesMap] = useState({});
  const [showSheetMenu, setShowSheetMenu] = useState(false);
  const [showEditCellSheet, setShowEditCellSheet] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharedWithClients, setSharedWithClients] = useState([]);

  const autosaveTimerRef = useRef(null);

  // Current active 2D rows (from weekSheets if program mode, or standardRows)
  const currentGridRows = isProgramMode && weekSheets[selectedWeekIndex]
    ? weekSheets[selectedWeekIndex].rows
    : standardRows;

  // 1. Load existing document from Firestore on open
  useEffect(() => {
    if (!visible || !trainerId || !documentId) return;

    let isMounted = true;
    getTrainerDocument(trainerId, documentId).then((loadedDoc) => {
      if (!isMounted || !loadedDoc) return;
      if (loadedDoc.title) setDocumentTitle(loadedDoc.title);
      if (Array.isArray(loadedDoc.sharedWith)) setSharedWithClients(loadedDoc.sharedWith);
      if (Array.isArray(loadedDoc.sheets) && loadedDoc.sheets.length > 0) {
        setWeekSheets(loadedDoc.sheets);
        setIsProgramMode(true);
      } else if (Array.isArray(loadedDoc.rows) && loadedDoc.rows.length > 0) {
        setStandardRows(loadedDoc.rows);
      }
    }).catch((error) => {
      console.warn('Could not load spreadsheet document:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [visible, trainerId, documentId]);

  // 2. Autosave changes to Firestore
  const triggerDebouncedAutosave = useCallback((updatedTitle, updatedRows, updatedSheets) => {
    if (!trainerId) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setSubtitleStatus(SUBTITLE_SAVING);

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        const result = await saveTrainerSpreadsheet(trainerId, {
          id: documentId || undefined,
          title: updatedTitle || DEFAULT_SPREADSHEET_TITLE,
          rows: updatedRows,
          sheets: updatedSheets,
          columnCount: updatedRows[0]?.length || 8,
          rowCount: updatedRows.length || 20,
        });

        if (result && result.id && !documentId) {
          setDocumentId(result.id);
        }

        setSubtitleStatus(SUBTITLE_SAVED_JUST_NOW);
        onSaved?.();
      } catch (saveError) {
        console.warn('Autosave spreadsheet failed:', saveError);
        setSubtitleStatus(SUBTITLE_SAVED_JUST_NOW);
      }
    }, AUTOSAVE_DELAY_MILLISECONDS);
  }, [trainerId, documentId, onSaved]);

  // Helper to update current grid rows and save
  const updateGridRows = (newRows) => {
    if (isProgramMode && weekSheets[selectedWeekIndex]) {
      const updatedWeekSheets = weekSheets.map((sheet, index) => {
        if (index === selectedWeekIndex) {
          return { ...sheet, rows: newRows };
        }
        return sheet;
      });
      setWeekSheets(updatedWeekSheets);
      triggerDebouncedAutosave(documentTitle, newRows, updatedWeekSheets);
      return;
    }

    setStandardRows(newRows);
    triggerDebouncedAutosave(documentTitle, newRows, null);
  };

  // 3. Cell Actions
  const handleSelectCell = (rowIndex, columnIndex) => {
    setSelectedRowIndex(rowIndex);
    setSelectedColumnIndex(columnIndex);
  };

  const handleOpenEditCellSheet = (rowIndex = selectedRowIndex, columnIndex = selectedColumnIndex) => {
    setSelectedRowIndex(rowIndex);
    setSelectedColumnIndex(columnIndex);
    setShowEditCellSheet(true);
  };

  const handleSaveEditedCell = (newCellValue, formatType) => {
    const updatedRows = currentGridRows.map((rowItems, rowIndex) => {
      if (rowIndex !== selectedRowIndex) return [...rowItems];
      const updatedRow = [...rowItems];
      updatedRow[selectedColumnIndex] = newCellValue;
      return updatedRow;
    });

    const cellKey = coordinateKey(selectedRowIndex, selectedColumnIndex);
    if (formatType) {
      setCellStylesMap((prevMap) => ({
        ...prevMap,
        [cellKey]: { ...prevMap[cellKey], format: formatType },
      }));
    }

    updateGridRows(updatedRows);
  };

  // 4. Quick Toolbar Actions
  const handleToggleBold = () => {
    const cellKey = coordinateKey(selectedRowIndex, selectedColumnIndex);
    setCellStylesMap((prevMap) => {
      const isCurrentlyBold = Boolean(prevMap[cellKey]?.bold);
      return {
        ...prevMap,
        [cellKey]: { ...prevMap[cellKey], bold: !isCurrentlyBold },
      };
    });
  };

  const handleToggleItalic = () => {
    const cellKey = coordinateKey(selectedRowIndex, selectedColumnIndex);
    setCellStylesMap((prevMap) => {
      const isCurrentlyItalic = Boolean(prevMap[cellKey]?.italic);
      return {
        ...prevMap,
        [cellKey]: { ...prevMap[cellKey], italic: !isCurrentlyItalic },
      };
    });
  };

  const handleAddRow = () => {
    const columnCount = currentGridRows[0]?.length || 4;
    const newRow = new Array(columnCount).fill('');
    if (!isProgramMode) {
      newRow[0] = String(currentGridRows.length);
    }
    const updatedRows = [...currentGridRows, newRow];
    updateGridRows(updatedRows);
  };

  const handleAddColumn = () => {
    const updatedRows = currentGridRows.map((rowItems, rowIndex) => {
      if (rowIndex === 0) {
        const nextColIndex = rowItems.length - 1;
        const newColLabel = columnLabelFromIndex(nextColIndex);
        return [...rowItems, newColLabel];
      }
      return [...rowItems, ''];
    });
    updateGridRows(updatedRows);
  };

  const handleInsertSumFormula = () => {
    if (selectedRowIndex <= 1 || selectedColumnIndex <= 0) return;
    const colLetter = columnLabelFromIndex(selectedColumnIndex - 1);
    const sumFormula = `=SUM(${colLetter}2:${colLetter}${selectedRowIndex})`;
    handleSaveEditedCell(sumFormula, 'number');
  };

  // 5. Menu Sub-actions
  const handleSetNumberFormat = (formatType) => {
    const cellKey = coordinateKey(selectedRowIndex, selectedColumnIndex);
    setCellStylesMap((prevMap) => ({
      ...prevMap,
      [cellKey]: { ...prevMap[cellKey], format: formatType },
    }));
  };

  const handleDeleteCurrentRow = () => {
    if (selectedRowIndex <= 0 || currentGridRows.length <= 2) return;
    const updatedRows = currentGridRows.filter((_, index) => index !== selectedRowIndex);
    updateGridRows(updatedRows);
  };

  const handleDeleteCurrentColumn = () => {
    if (selectedColumnIndex <= 0 || currentGridRows[0].length <= 2) return;
    const updatedRows = currentGridRows.map((rowItems) =>
      rowItems.filter((_, colIndex) => colIndex !== selectedColumnIndex),
    );
    updateGridRows(updatedRows);
  };

  const handleSortColumn = (isAscending) => {
    if (selectedColumnIndex <= 0 || currentGridRows.length <= 2) return;
    const header = currentGridRows[0];
    const body = [...currentGridRows.slice(1)];

    body.sort((leftRow, rightRow) => {
      const leftVal = String(leftRow[selectedColumnIndex] || '');
      const rightVal = String(rightRow[selectedColumnIndex] || '');
      const compareResult = leftVal.localeCompare(rightVal, undefined, { numeric: true });
      return isAscending ? compareResult : -compareResult;
    });

    updateGridRows([header, ...body]);
  };

  // 6. Theme tokens
  const themeColors = {
    screenBg: isDark ? '#000000' : '#F5F5F7',
    surface: isDark ? '#121212' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    textMuted: isDark ? '#8E8E93' : '#666666',
    border: isDark ? '#FFFFFF' : '#000000',
    cardBorder: isDark ? '#FFFFFF' : '#000000',
    badgeBg: isDark ? '#1C1C1E' : '#FFFFFF',
    pillButtonBg: isDark ? '#FFFFFF' : '#000000',
    pillButtonText: isDark ? '#000000' : '#FFFFFF',
  };

  const activeCellValue = currentGridRows[selectedRowIndex]?.[selectedColumnIndex] || '';
  const activeCellDescriptor = cellDescriptorLabel(
    selectedRowIndex,
    selectedColumnIndex,
    currentGridRows,
    isProgramMode,
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.screenContainer, { backgroundColor: themeColors.screenBg }]}>
        {/* Header Bar */}
        <View style={styles.topHeaderBar}>
          <EditorBackButton isDark={isDark} onPressBack={onClose} />

          <View style={styles.titleInfoBlock}>
            <TextInput
              style={[styles.documentTitleInput, { color: themeColors.text }]}
              value={documentTitle}
              onChangeText={(newTitle) => {
                setDocumentTitle(newTitle);
                triggerDebouncedAutosave(newTitle, currentGridRows, isProgramMode ? weekSheets : null);
              }}
              placeholder="Program Title"
              placeholderTextColor={themeColors.textMuted}
            />
            <Text style={[styles.documentSubtitle, { color: themeColors.textMuted }]}>
              {subtitleStatus}
            </Text>
          </View>

          <EditorMenuButton isDark={isDark} onPressMenu={() => setShowSheetMenu(true)} />
        </View>

        {/* Multi-Week Tabs Bar (Program Mode) */}
        {isProgramMode ? (
          <View style={styles.weekTabsContainer}>
            {weekSheets.map((weekItem, index) => (
              <WeekTabItem
                key={weekItem.id}
                weekName={weekItem.name}
                isSelected={selectedWeekIndex === index}
                isDark={isDark}
                onSelectTab={() => setSelectedWeekIndex(index)}
              />
            ))}
          </View>
        ) : null}

        {/* Active Cell / Formula Bar */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleOpenEditCellSheet()}
          style={[
            styles.formulaBarContainer,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          {isProgramMode ? (
            <View style={styles.programFormulaContent}>
              <Text style={[styles.programCellLabel, { color: themeColors.textMuted }]}>
                {activeCellDescriptor}
              </Text>
              <Text style={[styles.programCellValue, { color: themeColors.text }]}>
                {String(activeCellValue || '')}
              </Text>
            </View>
          ) : (
            <View style={styles.standardFormulaContent}>
              <View style={[styles.cellBadge, { borderColor: themeColors.border, backgroundColor: themeColors.badgeBg }]}>
                <Text style={[styles.cellBadgeText, { color: themeColors.text }]}>
                  {activeCellDescriptor}
                </Text>
              </View>
              <Text style={[styles.standardCellValue, { color: themeColors.text }]}>
                {String(activeCellValue || '')}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* The Spreadsheet Grid Table */}
        <View style={styles.gridSection}>
          <SpreadsheetGrid
            gridRows={currentGridRows}
            selectedRowIndex={selectedRowIndex}
            selectedColumnIndex={selectedColumnIndex}
            isDark={isDark}
            isProgramMode={isProgramMode}
            cellStylesMap={cellStylesMap}
            onSelectCell={handleSelectCell}
            onEditCell={handleOpenEditCellSheet}
          />
        </View>

        {/* Action Controls & Hint Text below grid */}
        {isProgramMode ? (
          <View style={styles.programControlsBlock}>
            <Text style={[styles.hintHelperText, { color: themeColors.textMuted }]}>
              Swipe sideways for the other columns. The first column stays put.
            </Text>

            <View style={styles.programButtonRow}>
              <TouchableOpacity
                onPress={handleAddRow}
                activeOpacity={0.8}
                style={[
                  styles.addRowOutlineButton,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <Text style={[styles.addRowButtonText, { color: themeColors.text }]}>Add row</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleOpenEditCellSheet()}
                activeOpacity={0.8}
                style={[
                  styles.editCellSolidButton,
                  {
                    backgroundColor: themeColors.pillButtonBg,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <Text style={[styles.editCellButtonText, { color: themeColors.pillButtonText }]}>
                  Edit cell
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.standardControlsBlock}>
            {/* Quick Action Toolbar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarScroll}>
              <View style={styles.toolbarRow}>
                <TouchableOpacity
                  onPress={handleToggleBold}
                  style={[styles.toolbarButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                >
                  <Text style={[styles.toolbarButtonText, { color: themeColors.text, fontWeight: '900' }]}>B</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleToggleItalic}
                  style={[styles.toolbarButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                >
                  <Text style={[styles.toolbarButtonText, { color: themeColors.text, fontStyle: 'italic' }]}>I</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAddRow}
                  style={[styles.toolbarButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                >
                  <Text style={[styles.toolbarButtonText, { color: themeColors.text }]}>+ Row</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleAddColumn}
                  style={[styles.toolbarButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                >
                  <Text style={[styles.toolbarButtonText, { color: themeColors.text }]}>+ Col</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleInsertSumFormula}
                  style={[styles.toolbarButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
                >
                  <Text style={[styles.toolbarButtonText, { color: themeColors.text }]}>Σ Sum</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <Text style={[styles.hintHelperText, { color: themeColors.textMuted }]}>
              Tap a cell to edit it. The bar above shows its value or formula. Row and column headers stay put.
            </Text>

            <TouchableOpacity
              onPress={() => setShowShareModal(true)}
              activeOpacity={0.8}
              style={[
                styles.shareCtaButton,
                {
                  backgroundColor: themeColors.pillButtonBg,
                  borderColor: themeColors.border,
                },
              ]}
            >
              <Text style={[styles.shareCtaButtonText, { color: themeColors.pillButtonText }]}>
                Share with clients
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Edit Cell Bottom Sheet */}
        <EditCellSheet
          visible={showEditCellSheet}
          cellCoordinateLabel={activeCellDescriptor}
          currentValue={activeCellValue}
          currentFormat={cellStylesMap[coordinateKey(selectedRowIndex, selectedColumnIndex)]?.format}
          isDark={isDark}
          onClose={() => setShowEditCellSheet(false)}
          onSaveCell={handleSaveEditedCell}
        />

        {/* Sheet Menu Bottom Modal */}
        <SheetMenuModal
          visible={showSheetMenu}
          isDark={isDark}
          onClose={() => setShowSheetMenu(false)}
          onToggleBold={handleToggleBold}
          onToggleItalic={handleToggleItalic}
          onSetNumberFormat={handleSetNumberFormat}
          onInsertRowAbove={handleAddRow}
          onInsertRowBelow={handleAddRow}
          onInsertColumnLeft={handleAddColumn}
          onInsertColumnRight={handleAddColumn}
          onDeleteCurrentRow={handleDeleteCurrentRow}
          onDeleteCurrentColumn={handleDeleteCurrentColumn}
          onSortColumnAscending={() => handleSortColumn(true)}
          onSortColumnDescending={() => handleSortColumn(false)}
          onExportCsv={() => exportSpreadsheetAsCsv(documentTitle, currentGridRows)}
          onExportPdf={() => exportSpreadsheetAsPdf(documentTitle, currentGridRows)}
        />

        {/* Share with Clients Modal */}
        {trainerId && documentId ? (
          <ShareDocumentPopup
            visible={showShareModal}
            documentId={documentId}
            trainerId={trainerId}
            documentTitle={documentTitle}
            initialSharedWith={sharedWithClients}
            onClose={() => setShowShareModal(false)}
            onUpdated={(updatedIds) => setSharedWithClients(updatedIds)}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: 12,
  },
  squareIconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleInfoBlock: {
    flex: 1,
  },
  documentTitleInput: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'SpaceGrotesk_700Bold',
    padding: 0,
    margin: 0,
  },
  documentSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  weekTabsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  weekTabButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekTabText: {
    fontSize: 14,
    fontWeight: '800',
  },
  formulaBarContainer: {
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginVertical: spacing.sm,
  },
  programFormulaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  programCellLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  programCellValue: {
    fontSize: 16,
    fontWeight: '900',
  },
  standardFormulaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cellBadge: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cellBadgeText: {
    fontSize: 14,
    fontWeight: '900',
  },
  standardCellValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  gridSection: {
    marginVertical: spacing.xs,
  },
  programControlsBlock: {
    marginTop: spacing.sm,
  },
  hintHelperText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginVertical: spacing.sm,
  },
  programButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.xs,
  },
  addRowOutlineButton: {
    flex: 1,
    borderWidth: 2.5,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRowButtonText: {
    fontSize: 16,
    fontWeight: '900',
  },
  editCellSolidButton: {
    flex: 1,
    borderWidth: 2.5,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCellButtonText: {
    fontSize: 16,
    fontWeight: '900',
  },
  standardControlsBlock: {
    marginTop: spacing.xs,
  },
  toolbarScroll: {
    marginVertical: spacing.xs,
  },
  toolbarRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarButton: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  toolbarButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  shareCtaButton: {
    borderWidth: 2.5,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  shareCtaButtonText: {
    fontSize: 16,
    fontWeight: '900',
  },
});
