// Full-screen modal listing every file the client's trainer has shared with them.
// Flow: parent passes visible + files → we render a sheet with a close button, titles, and the
// shared FileGrid → tapping an item calls back up to the parent to open it.
// Presentation-only: no fetching here, so the home-screen preview and this modal show one dataset.

/**
 * Full-screen list of trainer-shared files (same grid chrome as home preview).
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
// vocab: useSafeAreaInsets = pixel sizes of the notch / home indicator / status bar, so content
// isn't hidden behind them. A modal draws edge to edge, so it must handle these itself.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import FileGrid from '../../for-both/files-and-notes/viewers/FileGrid';

export default function TrainerSharedFilesPopup({
  visible,
  onClose,
  // Manipulate here: default header copy. Callers override these to reuse the same modal for a
  // different file collection.
  title = 'Trainer shared files',
  subtitle = 'Everything your coach has shared with you.',
  isDark,
  files,
  onPressItem,
}) {
  const insets = useSafeAreaInsets();
  // Theme colors resolved per render since they flip with the app's light/dark setting.
  // Manipulate here: bg is the sheet background, fg the title/icon color, muted the subtitle.
  const bg = isDark ? '#0A0A0F' : '#F7F7FA';
  const fg = isDark ? '#FFFFFF' : '#0B0B12';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.55)';

  return (
    // Manipulate here: 'slide' animates up from the bottom; 'pageSheet' is the iOS card style that
    // leaves the previous screen visible behind it.
    // onRequestClose is what makes the Android hardware back button dismiss the modal — without it
    // back would exit the screen underneath instead.
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {/* KeyboardAvoidingView is here because FileGrid items can open inline rename inputs.
          iOS needs 'padding'; Android already resizes the window itself, so passing undefined lets
          the OS handle it (specifying a behavior there causes double-shifting). */}
      <KeyboardAvoidingView
        style={[styles.flex, { backgroundColor: bg, paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header: close button | centered titles | spacer. The spacer's width matches the close
            button so the titles are optically centered — without it they'd sit slightly left. */}
        <View style={styles.header}>
          {/* Manipulate here: hitSlop 14 expands the tap area beyond the visible icon, which is
              what makes a small X comfortable to hit. accessibilityRole announces it as a button. */}
          <TouchableOpacity onPress={onClose} hitSlop={14} style={styles.backBtn} accessibilityRole="button">
            <Ionicons name="close" size={26} color={fg} />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={[styles.title, { color: fg }]}>{title}</Text>
            <Text style={[styles.subtitle, { color: muted }]}>{subtitle}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={{
            paddingHorizontal: 16,
            // Adding the bottom inset keeps the last row of files clear of the home indicator.
            // Manipulate here: 24 is the base breathing room below the grid.
            paddingBottom: 24 + insets.bottom,
          }}
          // 'handled' lets a tap land on a file even while the keyboard is open, instead of the
          // first tap only being consumed to dismiss the keyboard.
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* The same grid component the home preview uses, so both surfaces look identical.
              `|| []` guards against a null files prop; `dense` selects the tighter tile layout. */}
          <FileGrid isDark={isDark} files={files || []} onPressItem={onPressItem} dense />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    // 40×40 is the visible tap target; hitSlop above extends it further. This width is also what
    // the right-hand spacer mirrors.
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    // flex: 1 takes the space between the button and the spacer, letting the text center inside it.
    flex: 1,
    alignItems: 'center',
  },
  title: {
    // Manipulate here: negative letterSpacing slightly tightens the bold title, matching the rest
    // of the app's heading style.
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    // textAlign center matters for the two-line case — alignItems only centers the block, not the
    // wrapped lines inside it.
    textAlign: 'center',
  },
});
