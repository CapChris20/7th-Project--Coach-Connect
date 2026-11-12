// Design Law full-screen modal listing every file the client's trainer has shared.
// Flow: parent passes visible + files → NbPageHeader + FileGrid → close.
// Used by the client home preview. Presentation-only: no fetching here.
// vocab: NbPageHeader owns status-bar inset (shell SafeArea is left/right only)

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

const DEFAULT_TITLE = 'From your coach';
const DEFAULT_SUBTITLE = 'Everything your coach has shared with you.';
const GRID_BOTTOM_PADDING = 24;
const IOS_KEYBOARD_BEHAVIOR = 'padding';
const MODAL_ANIMATION = 'slide';

// ===== HELPER FUNCTIONS =====

function keyboardAvoidBehavior() {
  // iOS needs 'padding'; Android already resizes the window itself.
  return Platform.OS === 'ios' ? IOS_KEYBOARD_BEHAVIOR : undefined;
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen list of trainer-shared files (same grid chrome as home preview).
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   title?: string,
 *   subtitle?: string,
 *   isDark?: boolean,
 *   files?: Array,
 *   onPressItem: Function,
 * }} props
 */
export default function TrainerSharedFilesPopup({
  visible,
  onClose,
  // Manipulate here: default header copy. Callers override for other collections.
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  isDark: _isDarkIgnored,
  files,
  onPressItem,
}) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  return (
    <Modal visible={visible} animationType={MODAL_ANIMATION} onRequestClose={onClose}>
      <SafeAreaView
        style={[styles.flex, { backgroundColor: colors.nbBackground }]}
        edges={SHELL_SAFE_AREA_EDGES}
      >
        <KeyboardAvoidingView style={styles.flex} behavior={keyboardAvoidBehavior()}>
          <NbPageHeader title={title} subtitle={subtitle} onBack={onClose} />
          <ScrollView
            style={styles.flex}
            contentContainerStyle={{
              paddingHorizontal: nb.screenGutter,
              paddingBottom: GRID_BOTTOM_PADDING + insets.bottom,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FileGrid isDark={isDark} files={files || []} onPressItem={onPressItem} dense />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
