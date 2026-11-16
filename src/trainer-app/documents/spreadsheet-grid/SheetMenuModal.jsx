// Sheet menu bottom sheet modal for the spreadsheet editor.
// Flow: tap [...] menu button → sheet opens → pick format, insert, delete, sort, or export → action runs.
// Used by: SpreadsheetEditor.

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, spacing } from '../../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const MENU_TITLE_DEFAULT = 'Sheet menu';
const BUTTON_CLOSE = 'Close';

// Sub-menu state identifiers
const SUBVIEW_MAIN = 'main';
const SUBVIEW_FORMAT = 'format';
const SUBVIEW_INSERT = 'insert';
const SUBVIEW_DELETE = 'delete';
const SUBVIEW_SORT = 'sort';
const SUBVIEW_EXPORT = 'export';

// ===== HELPER FUNCTIONS =====

/**
 * One navigable menu row matching Image 3.
 */
function SheetMenuRow({ title, subtitle, themeColors, onPressRow }) {
  return (
    <TouchableOpacity
      onPress={onPressRow}
      activeOpacity={0.7}
      style={[
        styles.menuRow,
        {
          borderBottomColor: themeColors.rowBorder,
        },
      ]}
    >
      <View style={styles.menuRowTextContainer}>
        <Text style={[styles.menuRowTitle, { color: themeColors.text }]}>{title}</Text>
        <Text style={[styles.menuRowSubtitle, { color: themeColors.textMuted }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={themeColors.text} />
    </TouchableOpacity>
  );
}

/**
 * Action button inside a sub-view.
 */
function SubViewActionButton({ title, subtitle, themeColors, isDestructive, onActionPress }) {
  const titleColor = isDestructive ? '#EF4444' : themeColors.text;

  return (
    <TouchableOpacity
      onPress={onActionPress}
      activeOpacity={0.7}
      style={[
        styles.actionOptionButton,
        {
          backgroundColor: themeColors.subSurface,
          borderColor: themeColors.border,
        },
      ]}
    >
      <View style={styles.menuRowTextContainer}>
        <Text style={[styles.actionOptionTitle, { color: titleColor }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.menuRowSubtitle, { color: themeColors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Sheet menu bottom modal.
 * Flow: 1. setup sub-view state  2. render main options or sub-actions  3. handle close
 * @param {{
 *   visible: boolean,
 *   isDark: boolean,
 *   onClose: Function,
 *   onToggleBold: Function,
 *   onToggleItalic: Function,
 *   onSetNumberFormat: Function,
 *   onInsertRowAbove: Function,
 *   onInsertRowBelow: Function,
 *   onInsertColumnLeft: Function,
 *   onInsertColumnRight: Function,
 *   onDeleteCurrentRow: Function,
 *   onDeleteCurrentColumn: Function,
 *   onSortColumnAscending: Function,
 *   onSortColumnDescending: Function,
 *   onExportCsv: Function,
 *   onExportPdf: Function,
 * }} props
 */
export default function SheetMenuModal({
  visible,
  isDark,
  onClose,
  onToggleBold,
  onToggleItalic,
  onSetNumberFormat,
  onInsertRowAbove,
  onInsertRowBelow,
  onInsertColumnLeft,
  onInsertColumnRight,
  onDeleteCurrentRow,
  onDeleteCurrentColumn,
  onSortColumnAscending,
  onSortColumnDescending,
  onExportCsv,
  onExportPdf,
}) {
  const [activeSubView, setActiveSubView] = useState(SUBVIEW_MAIN);

  const themeColors = {
    overlay: 'rgba(0, 0, 0, 0.55)',
    surface: isDark ? '#121212' : '#FFFFFF',
    subSurface: isDark ? '#1C1C1E' : '#F9F9F9',
    text: isDark ? '#FFFFFF' : '#000000',
    textMuted: isDark ? '#8E8E93' : '#666666',
    border: isDark ? '#FFFFFF' : '#000000',
    rowBorder: isDark ? '#2C2C2E' : '#E5E5E5',
    handle: isDark ? '#555555' : '#CCCCCC',
  };

  const handleCloseEntireMenu = () => {
    setActiveSubView(SUBVIEW_MAIN);
    onClose();
  };

  const confirmDeleteRow = () => {
    Alert.alert(
      'Delete row',
      'Are you sure you want to delete this row?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteCurrentRow();
            handleCloseEntireMenu();
          },
        },
      ],
    );
  };

  const confirmDeleteColumn = () => {
    Alert.alert(
      'Delete column',
      'Are you sure you want to delete this column?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDeleteCurrentColumn();
            handleCloseEntireMenu();
          },
        },
      ],
    );
  };

  const renderMainMenuList = () => (
    <View style={styles.menuItemsList}>
      <SheetMenuRow
        title="Format cells"
        subtitle="Bold, italic, number format"
        themeColors={themeColors}
        onPressRow={() => setActiveSubView(SUBVIEW_FORMAT)}
      />
      <SheetMenuRow
        title="Insert row or column"
        subtitle="Above, below, left, right"
        themeColors={themeColors}
        onPressRow={() => setActiveSubView(SUBVIEW_INSERT)}
      />
      <SheetMenuRow
        title="Delete row or column"
        subtitle="Asks first"
        themeColors={themeColors}
        onPressRow={() => setActiveSubView(SUBVIEW_DELETE)}
      />
      <SheetMenuRow
        title="Sort"
        subtitle="A to Z or by column"
        themeColors={themeColors}
        onPressRow={() => setActiveSubView(SUBVIEW_SORT)}
      />
      <SheetMenuRow
        title="Export"
        subtitle="CSV or PDF"
        themeColors={themeColors}
        onPressRow={() => setActiveSubView(SUBVIEW_EXPORT)}
      />
    </View>
  );

  const renderSubViewContent = () => {
    if (activeSubView === SUBVIEW_FORMAT) {
      return (
        <View style={styles.subViewContainer}>
          <SubViewActionButton
            title="Toggle Bold"
            subtitle="Bold / Unbold cell text"
            themeColors={themeColors}
            onActionPress={() => { onToggleBold(); handleCloseEntireMenu(); }}
          />
          <SubViewActionButton
            title="Toggle Italic"
            subtitle="Italic / Unitalic cell text"
            themeColors={themeColors}
            onActionPress={() => { onToggleItalic(); handleCloseEntireMenu(); }}
          />
          <SubViewActionButton
            title="Format as Number"
            subtitle="Plain number format"
            themeColors={themeColors}
            onActionPress={() => { onSetNumberFormat('number'); handleCloseEntireMenu(); }}
          />
          <SubViewActionButton
            title="Format as Currency"
            subtitle="Show with dollar sign ($)"
            themeColors={themeColors}
            onActionPress={() => { onSetNumberFormat('currency'); handleCloseEntireMenu(); }}
          />
        </View>
      );
    }

    if (activeSubView === SUBVIEW_INSERT) {
      return (
        <View style={styles.subViewContainer}>
          <SubViewActionButton
            title="Insert row above"
            themeColors={themeColors}
            onActionPress={() => { onInsertRowAbove(); handleCloseEntireMenu(); }}
          />
          <SubViewActionButton
            title="Insert row below"
            themeColors={themeColors}
            onActionPress={() => { onInsertRowBelow(); handleCloseEntireMenu(); }}
          />
          <SubViewActionButton
            title="Insert column left"
            themeColors={themeColors}
            onActionPress={() => { onInsertColumnLeft(); handleCloseEntireMenu(); }}
          />
          <SubViewActionButton
            title="Insert column right"
            themeColors={themeColors}
            onActionPress={() => { onInsertColumnRight(); handleCloseEntireMenu(); }}
          />
        </View>
      );
    }

    if (activeSubView === SUBVIEW_DELETE) {
      return (
        <View style={styles.subViewContainer}>
          <SubViewActionButton
            title="Delete current row"
            subtitle="Removes the selected row"
            themeColors={themeColors}
            isDestructive={true}
            onActionPress={confirmDeleteRow}
          />
          <SubViewActionButton
            title="Delete current column"
            subtitle="Removes the selected column"
            themeColors={themeColors}
            isDestructive={true}
            onActionPress={confirmDeleteColumn}
          />
        </View>
      );
    }

    if (activeSubView === SUBVIEW_SORT) {
      return (
        <View style={styles.subViewContainer}>
          <SubViewActionButton
            title="Sort A to Z"
            subtitle="Ascending order"
            themeColors={themeColors}
            onActionPress={() => { onSortColumnAscending(); handleCloseEntireMenu(); }}
          />
          <SubViewActionButton
            title="Sort Z to A"
            subtitle="Descending order"
            themeColors={themeColors}
            onActionPress={() => { onSortColumnDescending(); handleCloseEntireMenu(); }}
          />
        </View>
      );
    }

    if (activeSubView === SUBVIEW_EXPORT) {
      return (
        <View style={styles.subViewContainer}>
          <SubViewActionButton
            title="Export as CSV"
            subtitle="Spreadsheet comma-separated file"
            themeColors={themeColors}
            onActionPress={() => { onExportCsv(); handleCloseEntireMenu(); }}
          />
          <SubViewActionButton
            title="Export as PDF"
            subtitle="Formatted printable document"
            themeColors={themeColors}
            onActionPress={() => { onExportPdf(); handleCloseEntireMenu(); }}
          />
        </View>
      );
    }

    return renderMainMenuList();
  };

  const isAtSubView = activeSubView !== SUBVIEW_MAIN;
  const currentSheetTitle = isAtSubView ? activeSubView.toUpperCase() : MENU_TITLE_DEFAULT;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCloseEntireMenu}
    >
      <View style={[styles.modalOverlay, { backgroundColor: themeColors.overlay }]}>
        <Pressable style={styles.backdropPressable} onPress={handleCloseEntireMenu} />

        <View style={[styles.sheetCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
          {/* Top drag handle indicator */}
          <View style={styles.handleWrapper}>
            <View style={[styles.handleBar, { backgroundColor: themeColors.handle }]} />
          </View>

          {/* Title Header with back chevron if inside subview */}
          <View style={styles.titleHeaderRow}>
            {isAtSubView ? (
              <TouchableOpacity
                onPress={() => setActiveSubView(SUBVIEW_MAIN)}
                style={styles.backButton}
              >
                <Ionicons name="arrow-back" size={20} color={themeColors.text} />
              </TouchableOpacity>
            ) : null}
            <Text style={[styles.sheetTitleText, { color: themeColors.text }]}>
              {currentSheetTitle}
            </Text>
          </View>

          {/* Content: Main rows or subview actions */}
          {renderSubViewContent()}

          {/* Bottom Close Button */}
          <TouchableOpacity
            onPress={handleCloseEntireMenu}
            activeOpacity={0.8}
            style={[
              styles.closeButton,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.border,
              },
            ]}
          >
            <Text style={[styles.closeButtonLabel, { color: themeColors.text }]}>{BUTTON_CLOSE}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  sheetCard: {
    width: '100%',
    borderTopLeftRadius: borderRadius.nbSheet,
    borderTopRightRadius: borderRadius.nbSheet,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  handleWrapper: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  titleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  backButton: {
    marginRight: 10,
    padding: 4,
  },
  sheetTitleText: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  menuItemsList: {
    marginBottom: spacing.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1.5,
  },
  menuRowTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  menuRowTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  menuRowSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  subViewContainer: {
    marginBottom: spacing.lg,
    gap: 8,
  },
  actionOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 2,
    borderRadius: 12,
  },
  actionOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  closeButton: {
    borderWidth: 2.5,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonLabel: {
    fontSize: 16,
    fontWeight: '900',
  },
});
