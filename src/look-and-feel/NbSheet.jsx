// Neobrutalist bottom sheet — slides up over a dimmed backdrop.
// Flow: Modal open → tap backdrop to close → drag handle → optional title → scroll body.
// Where used: pickers, forms, notice sheets that need a thick-bordered bottom panel.
//
// vocab: bottom sheet = modal anchored to the bottom with rounded top corners
// Manipulate here: overlay opacity, maxHeight 80%, handle bar 40×4

import React from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, nb, gradients, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: how dark the dimmed backdrop feels (0 = clear, 1 = solid black)
const OVERLAY_DIM_OPACITY = 0.5;
// Manipulate here: sheet never taller than this fraction of the screen
const SHEET_MAX_HEIGHT_FRACTION = '80%';
// Manipulate here: drag-handle pill size (Design Law chrome cue)
const HANDLE_BAR_WIDTH = 40;
const HANDLE_BAR_HEIGHT = 4;
const HANDLE_BAR_RADIUS = 2;
const HANDLE_TOP_EXTRA_PAD = 4;
const SHEET_TITLE_FONT_SIZE = 20;

// ===== HELPER FUNCTIONS =====

/**
 * Centered drag-handle pill at the top of the sheet.
 * Why: tells the user this panel is a sheet, not a full screen.
 */
function SheetDragHandle({ borderColor }) {
  const handleBarStyle = {
    backgroundColor: borderColor,
  };

  return (
    <View style={styles.handle}>
      <View style={[styles.handleBar, handleBarStyle]} />
    </View>
  );
}

/**
 * Centered title under the handle. Only painted when the parent passes a title.
 */
function SheetTitleHeader({ title, inkColor }) {
  const titleStyle = {
    color: inkColor,
  };

  return (
    <View style={styles.header}>
      <Text style={[styles.title, titleStyle]}>{title}</Text>
    </View>
  );
}

/**
 * Scrollable body so long form content does not blow past the 80% max height.
 */
function SheetScrollBody({ children, extraContentStyle }) {
  return (
    <ScrollView style={styles.content}>
      <View style={extraContentStyle}>{children}</View>
    </ScrollView>
  );
}

/**
 * Stack handle → title → body in one fragment so solid and gradient chrome share it.
 */
function buildSheetInnerStack(dragHandle, titleHeader, scrollBody) {
  return (
    <>
      {dragHandle}
      {titleHeader}
      {scrollBody}
    </>
  );
}

/**
 * Solid surface sheet — default when gradient is off.
 */
function paintSolidSheetChrome(sheetBorderColor, surfaceColor, sheetInnerStack) {
  const sheetChromeStyle = {
    backgroundColor: surfaceColor,
    borderColor: sheetBorderColor,
  };

  return (
    <View style={[styles.sheet, sheetChromeStyle]}>
      {sheetInnerStack}
    </View>
  );
}

/**
 * Soft gradient sheet — same 3px border frame, Design Law soft gradient fill.
 * vocab: LinearGradient = expo helper that paints a color blend as the background
 */
function paintGradientSheetChrome(sheetBorderColor, sheetInnerStack) {
  const sheetChromeStyle = {
    borderColor: sheetBorderColor,
  };

  return (
    <LinearGradient
      colors={gradients.soft.colors}
      start={gradients.soft.start}
      end={gradients.soft.end}
      style={[styles.sheet, sheetChromeStyle]}
    >
      {sheetInnerStack}
    </LinearGradient>
  );
}

/**
 * Pick solid vs gradient chrome. Both keep the same inner stack and border widths.
 */
function paintSheetChrome({ useGradient, sheetBorderColor, surfaceColor, sheetInnerStack }) {
  if (useGradient) {
    return paintGradientSheetChrome(sheetBorderColor, sheetInnerStack);
  }
  return paintSolidSheetChrome(sheetBorderColor, surfaceColor, sheetInnerStack);
}

/**
 * Optional title header — null when the parent did not pass a title string.
 */
function buildOptionalTitleHeader(title, inkColor) {
  if (!title) {
    return null;
  }
  return <SheetTitleHeader title={title} inkColor={inkColor} />;
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet modal with neobrutalist styling.
 *
 * @param {object} props
 * @param {boolean} props.visible - modal visibility
 * @param {Function} props.onClose - close handler (backdrop tap + Android back)
 * @param {string} [props.title] - sheet title
 * @param {React.ReactNode} props.children - sheet content
 * @param {boolean} [props.gradient] - apply soft gradient background
 * @param {object} [props.style] - additional content styles
 */
export default function NbSheet({
  visible,
  onClose,
  title,
  children,
  gradient = false,
  style,
}) {
  const { colors } = useTheme();

  // 1. Theme tokens for the 3px border and title ink.
  const sheetBorderColor = colors.nbBorder;
  const titleInkColor = colors.nbInk;
  const surfaceColor = colors.nbSurface;

  // 2. Shared inner stack: drag handle, optional title, scrollable children.
  const dragHandle = <SheetDragHandle borderColor={sheetBorderColor} />;
  const titleHeader = buildOptionalTitleHeader(title, titleInkColor);
  const scrollBody = (
    <SheetScrollBody extraContentStyle={style}>{children}</SheetScrollBody>
  );
  const sheetInnerStack = buildSheetInnerStack(dragHandle, titleHeader, scrollBody);

  // 3. Solid vs gradient surface — same border frame either way.
  const paintedSheet = paintSheetChrome({
    useGradient: gradient,
    sheetBorderColor,
    surfaceColor,
    sheetInnerStack,
  });

  // 4. Modal: dimmed backdrop (tap closes) + sheet anchored to the bottom.
  // vocab: Modal transparent + animationType slide = OS sheet slide from bottom
  // vocab: onRequestClose = Android hardware back button
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        {paintedSheet}
      </View>
    </Modal>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: `rgba(0, 0, 0, ${OVERLAY_DIM_OPACITY})`,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: borderRadius.nbSheet,
    borderTopRightRadius: borderRadius.nbSheet,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    maxHeight: SHEET_MAX_HEIGHT_FRACTION,
    paddingBottom: spacing.lg,
  },
  handle: {
    alignItems: 'center',
    paddingTop: spacing.sm + HANDLE_TOP_EXTRA_PAD,
    paddingBottom: spacing.sm,
  },
  handleBar: {
    width: HANDLE_BAR_WIDTH,
    height: HANDLE_BAR_HEIGHT,
    borderRadius: HANDLE_BAR_RADIUS,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: SHEET_TITLE_FONT_SIZE,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
});
