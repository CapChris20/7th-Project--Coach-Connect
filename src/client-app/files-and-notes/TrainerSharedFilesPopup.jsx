// Full-screen modal listing every file the client's trainer has shared (Design Law grid).
// Flow: parent passes visible + files → NbPageHeader + FileGrid → close.
// Used by the client home preview. Presentation-only: no fetching here.

import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FileGrid from '../../for-both/files-and-notes/viewers/FileGrid';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb } from '../../look-and-feel/colorPalette';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';

// ===== NAMED CONSTANTS =====

// Manipulate here: default header copy. Callers override for other collections.
const DEFAULT_TITLE = 'From your coach';
const DEFAULT_SUBTITLE = 'Everything your coach has shared with you.';
const GRID_BOTTOM_PADDING = 24;
const IOS_KEYBOARD_BEHAVIOR = 'padding';
const MODAL_ANIMATION = 'slide';
const EMPTY_FILE_LIST = [];
const PLATFORM_IOS = 'ios';

// ===== HELPER FUNCTIONS =====

function keyboardAvoidBehaviorForPlatform() {
  // iOS needs 'padding'; Android already resizes the window itself.
  if (Platform.OS === PLATFORM_IOS) return IOS_KEYBOARD_BEHAVIOR;
  return undefined;
}

function scrollBottomPadding(insets) {
  return GRID_BOTTOM_PADDING + insets.bottom;
}

function filesOrEmptyList(files) {
  if (Array.isArray(files) && files.length > 0) return files;
  return EMPTY_FILE_LIST;
}

function TrainerSharedGridScroll({ isDark, files, bottomPad, onPressItem }) {
  const sharedFiles = filesOrEmptyList(files);
  const contentContainerStyle = {
    paddingHorizontal: nb.screenGutter,
    paddingBottom: bottomPad,
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={contentContainerStyle}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <FileGrid isDark={isDark} files={sharedFiles} onPressItem={onPressItem} dense />
    </ScrollView>
  );
}

function TrainerSharedFilesPopupLayout({
  visible,
  onClose,
  title,
  subtitle,
  colors,
  isDark,
  files,
  bottomPad,
  keyboardBehavior,
  onPressItem,
}) {
  return (
    <Modal visible={visible} animationType={MODAL_ANIMATION} onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.flex, { backgroundColor: colors.nbBackground }]}
        edges={SHELL_SAFE_AREA_EDGES}
      >
        <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior}>
          <NbPageHeader title={title} subtitle={subtitle} onBack={onClose} />
          <TrainerSharedGridScroll
            isDark={isDark}
            files={files}
            bottomPad={bottomPad}
            onPressItem={onPressItem}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen list of trainer-shared files (same grid chrome as home preview).
 * @param {{ visible: boolean, onClose: Function, title?: string, subtitle?: string, isDark?: boolean, files?: Array, onPressItem?: Function }} props
 */
export default function TrainerSharedFilesPopup({
  visible,
  onClose,
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  isDark: _themeFromParentUnused,
  files,
  onPressItem,
}) {
  // 1. Read safe-area insets so the grid clears the home indicator.
  const insets = useSafeAreaInsets();

  // 2. Theme tokens from the app (parent `isDark` prop is ignored on purpose).
  const { colors, isDark } = useTheme();

  // 3. Build layout numbers, then hand everything to the pure layout.
  const bottomPad = scrollBottomPadding(insets);
  const keyboardBehavior = keyboardAvoidBehaviorForPlatform();

  return (
    <TrainerSharedFilesPopupLayout
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      colors={colors}
      isDark={isDark}
      files={files}
      bottomPad={bottomPad}
      keyboardBehavior={keyboardBehavior}
      onPressItem={onPressItem}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
