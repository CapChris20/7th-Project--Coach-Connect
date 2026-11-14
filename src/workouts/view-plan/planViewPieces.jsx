// Shared styles for the workout plan viewer cards, day headers, and empty states.
// Flow: build named style groups → merge → StyleSheet.create → WorkoutPlanView imports planViewerRefStyles.
// Used by: WorkoutPlanView. Padding and colors stay as layout numbers; platform bottom inset is extracted.

import { Platform, StyleSheet } from 'react-native';
import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const IOS_PLATFORM = 'ios';

// Manipulate here: extra bottom pad on the log sheet so the save button clears the home indicator.
const IOS_LOG_SHEET_BOTTOM_PADDING = 28;
const ANDROID_LOG_SHEET_BOTTOM_PADDING = 16;

const ERROR_TITLE_FONT_SIZE = 24;
const ERROR_BUTTON_MARGIN_TOP = 24;
const EMPTY_CONTAINER_PADDING = 24;
const EMPTY_BUTTON_MARGIN_TOP = 24;
const BUTTON_HORIZONTAL_PADDING = 24;
const LOG_CONTENT_MAX_HEIGHT = 420;

const DROPDOWN_SHADOW_COLOR = '#000';
const DROPDOWN_SHADOW_OFFSET = { width: 0, height: 4 };
const DROPDOWN_SHADOW_OPACITY = 0.2;
const DROPDOWN_SHADOW_RADIUS = 8;
const DAY_SHORT_COLOR = lightColors.white;
const DAY_FOCUS_COLOR = 'rgba(255,255,255,0.88)';
const DETAIL_BADGE_BACKGROUND = 'rgba(255,255,255,0.06)';
const MODAL_OVERLAY_SCRIM = 'rgba(0,0,0,0.45)';
const SAVE_BUTTON_TEXT_COLOR = lightColors.white;
const ERROR_BUTTON_TEXT_COLOR = lightColors.white;
const EMPTY_BUTTON_TEXT_COLOR = lightColors.white;

// ===== HELPER FUNCTIONS =====

/**
 * Bottom padding for the log bottom sheet — iOS needs more for the home indicator.
 * @returns {number}
 */
function bottomPaddingForLogSheet() {
  if (Platform.OS === IOS_PLATFORM) {
    return IOS_LOG_SHEET_BOTTOM_PADDING;
  }
  return ANDROID_LOG_SHEET_BOTTOM_PADDING;
}

/** Thin border wrappers used around gradient cards. */
function buildBorderCardStyles() {
  return {
    borderCardContainer: { width: '100%' },
    borderGradient: { width: '100%' },
    borderCardInner: { width: '100%' },
  };
}

/** Per-exercise log inputs (set rows, add/remove set buttons). */
function buildLogExerciseStyles() {
  return {
    logExerciseContainer: {
      borderRadius: 14,
      borderWidth: 1,
      padding: 14,
      marginBottom: 12,
    },
    logExerciseName: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
    setInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      flexWrap: 'wrap',
    },
    setLabel: { fontSize: 12, width: 48 },
    setInput: {
      flex: 1,
      minWidth: 80,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      fontSize: 14,
    },
    setButtonRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
    setActionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
    },
    setActionText: { fontSize: 13, fontWeight: '600' },
  };
}

/** Top bar + overflow menu (Edit / Share / Delete). */
function buildHeaderMenuStyles() {
  return {
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
    menuContainer: { position: 'relative', width: 44, alignItems: 'flex-end' },
    dropdownMenu: {
      position: 'absolute',
      top: 46,
      right: 0,
      minWidth: 200,
      borderRadius: 12,
      borderWidth: 1,
      paddingVertical: 6,
      zIndex: 50,
      elevation: 8,
      shadowColor: DROPDOWN_SHADOW_COLOR,
      shadowOffset: DROPDOWN_SHADOW_OFFSET,
      shadowOpacity: DROPDOWN_SHADOW_OPACITY,
      shadowRadius: DROPDOWN_SHADOW_RADIUS,
    },
    menuItem: { paddingVertical: 12, paddingHorizontal: 14 },
    menuItemText: { fontSize: 15, fontWeight: '600' },
  };
}

/** Expandable day cards (header strip + expanded body / recovery). */
function buildDayCardStyles() {
  return {
    planContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
    dayCardContainer: { marginBottom: 14 },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    dayHeaderContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    dayShort: {
      fontSize: 13,
      fontWeight: '800',
      color: DAY_SHORT_COLOR,
      opacity: 0.95,
      letterSpacing: 0.5,
    },
    dayInfo: { flex: 1 },
    dayName: { fontSize: 16, fontWeight: '800', color: lightColors.white },
    dayFocus: { fontSize: 13, color: DAY_FOCUS_COLOR, marginTop: 2 },
    dayExpanded: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 14,
      paddingBottom: 14,
      paddingTop: 12,
    },
    recoveryContainer: { alignItems: 'center', paddingVertical: 12 },
    recoveryTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
    recoveryNote: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  };
}

/** One exercise row inside an expanded day (sets, badges, complete, log link). */
function buildExerciseRowStyles() {
  return {
    exerciseItem: { marginBottom: 14 },
    exerciseHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10,
    },
    exerciseName: { fontSize: 15, fontWeight: '700', flex: 1 },
    exerciseSets: { fontSize: 14, fontWeight: '700' },
    exerciseDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
    detailBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: DETAIL_BADGE_BACKGROUND,
    },
    detailText: { fontSize: 12 },
    exerciseNotes: { fontSize: 13, marginTop: 8, lineHeight: 19 },
    completeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    completeButtonText: { fontSize: 15, fontWeight: '700' },
    logLink: { alignItems: 'center', paddingVertical: 12 },
    logLinkText: { fontSize: 15, fontWeight: '700' },
  };
}

/** Bottom sheet used when logging sets for an exercise. */
function buildLogSheetStyles() {
  return {
    modalOverlay: {
      flex: 1,
      backgroundColor: MODAL_OVERLAY_SCRIM,
      justifyContent: 'flex-end',
    },
    logBottomSheet: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      borderWidth: 1,
      maxHeight: '88%',
      paddingBottom: bottomPaddingForLogSheet(),
    },
    logHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 8,
    },
    logTitle: { fontSize: 18, fontWeight: '800' },
    logContent: { paddingHorizontal: 16, maxHeight: LOG_CONTENT_MAX_HEIGHT },
    saveBtnGradient: { marginHorizontal: 16, marginTop: 8, borderRadius: 14, overflow: 'hidden' },
    saveButton: { paddingVertical: 16, alignItems: 'center' },
    saveButtonText: { color: SAVE_BUTTON_TEXT_COLOR, fontSize: 16, fontWeight: '800' },
  };
}

/** Overview card, warm-up rows, error / loader / empty states. */
function buildOverviewAndEmptyStyles() {
  return {
    subSectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      marginBottom: 8,
      marginTop: 4,
    },
    warmRow: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: 10,
    },
    warmName: { flex: 1, fontSize: 14, fontWeight: '600' },
    warmMeta: { fontSize: 12 },
    overviewCard: {
      borderRadius: 14,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
    },
    overviewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 8 },
    overviewBody: { fontSize: 14, lineHeight: 22 },
    metaLine: { fontSize: 13, marginBottom: 14 },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    errorTitle: { fontSize: ERROR_TITLE_FONT_SIZE, fontWeight: '700', marginTop: 16 },
    errorMessage: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
    errorButton: {
      marginTop: ERROR_BUTTON_MARGIN_TOP,
      paddingVertical: 12,
      paddingHorizontal: BUTTON_HORIZONTAL_PADDING,
      borderRadius: 12,
    },
    errorButtonText: { color: ERROR_BUTTON_TEXT_COLOR, fontWeight: '700' },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loaderText: { marginTop: 16, fontSize: 14 },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginHorizontal: 32,
      borderRadius: 16,
      padding: EMPTY_CONTAINER_PADDING,
    },
    emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16 },
    emptyMessage: { fontSize: 14, marginTop: 8, textAlign: 'center' },
    emptyButton: {
      marginTop: EMPTY_BUTTON_MARGIN_TOP,
      paddingVertical: 12,
      paddingHorizontal: BUTTON_HORIZONTAL_PADDING,
      borderRadius: 12,
    },
    emptyButtonText: { color: EMPTY_BUTTON_TEXT_COLOR, fontWeight: '700' },
    noExerciseText: { fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  };
}

/**
 * Merge every style group into one plain object for StyleSheet.create.
 * Flow: 1. border  2. log exercise  3. header  4. day  5. exercise row  6. sheet + empty
 * @returns {object}
 */
function buildAllPlanViewerStyleGroups() {
  // 1. Border card wrappers.
  const borderCardStyles = buildBorderCardStyles();

  // 2. Log-exercise inputs.
  const logExerciseStyles = buildLogExerciseStyles();

  // 3. Header + overflow menu.
  const headerMenuStyles = buildHeaderMenuStyles();

  // 4. Day cards.
  const dayCardStyles = buildDayCardStyles();

  // 5. Exercise rows inside a day.
  const exerciseRowStyles = buildExerciseRowStyles();

  // 6. Log sheet + overview / empty / error / loader.
  const logSheetStyles = buildLogSheetStyles();
  const overviewAndEmptyStyles = buildOverviewAndEmptyStyles();

  return {
    ...borderCardStyles,
    ...logExerciseStyles,
    ...headerMenuStyles,
    ...dayCardStyles,
    ...exerciseRowStyles,
    ...logSheetStyles,
    ...overviewAndEmptyStyles,
  };
}

// ===== MAIN FUNCTION =====

// vocab: StyleSheet.create = RN freezes style objects once (faster re-renders than inline objects).
/**
 * Frozen style map imported by WorkoutPlanView as planViewerRefStyles.
 * Keys (dayHeader, logBottomSheet, …) are frozen — screens look them up by name.
 */
const planViewerRefStyles = StyleSheet.create(buildAllPlanViewerStyleGroups());

export { planViewerRefStyles };

// ===== PLUMBING — skip unless debugging =====
// Style group builders live under HELPER FUNCTIONS above — open those when a key looks wrong.
