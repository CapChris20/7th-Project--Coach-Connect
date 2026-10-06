// Bottom sheet of weekly-report settings: theme, PDF export, and a digest row.
// Flow: slide the sheet up when visible → tap a row → haptic, then export or close.
// Used by WeeklyReportBody when the week picker opens settings.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const SHEET_HIDDEN_OFFSET = 400;
// Manipulate here: backdrop fade and the spring that brings the sheet up.
const BACKDROP_FADE_IN_MS = 200;
const BACKDROP_FADE_OUT_MS = 180;
const SHEET_CLOSE_MS = 220;
const SHEET_SPRING_DAMPING = 18;
const SHEET_SPRING_STIFFNESS = 180;
const DARK_MODE = 'dark';

// ===== HELPER FUNCTIONS =====

function isDarkMode(mode) {
  return mode === DARK_MODE;
}

function rowSurfaceColor(mode) {
  if (isDarkMode(mode)) return 'rgba(255,255,255,0.04)';
  return 'rgba(0,0,0,0.03)';
}

function iconSurfaceColor(mode) {
  if (isDarkMode(mode)) return 'rgba(255,255,255,0.06)';
  return 'rgba(0,0,0,0.05)';
}

function sheetBackgroundColor(mode) {
  if (isDarkMode(mode)) return '#16161f';
  return '#ffffff';
}

function playSelectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

// vocab: withTiming / withSpring = Reanimated animations. They write the shared values, not React state.
function animateOptionsSheet(isVisible, translateY, backdropOpacity) {
  if (isVisible) {
    backdropOpacity.value = withTiming(1, { duration: BACKDROP_FADE_IN_MS });
    translateY.value = withSpring(0, { damping: SHEET_SPRING_DAMPING, stiffness: SHEET_SPRING_STIFFNESS });
    return;
  }
  backdropOpacity.value = withTiming(0, { duration: BACKDROP_FADE_OUT_MS });
  translateY.value = withTiming(SHEET_HIDDEN_OFFSET, {
    duration: SHEET_CLOSE_MS,
    easing: Easing.in(Easing.cubic),
  });
}

function SheetRow({ icon, title, subtitle, onPress, colors, mode, testID }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: rowSurfaceColor(mode),
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.rowLeft}>
        <View style={[styles.iconWrap, { backgroundColor: iconSurfaceColor(mode) }]}>
          <Ionicons name={icon} size={18} color={colors.textPrimary} />
        </View>
        <View>
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Report settings sheet.
 * @param {{ visible: boolean, onClose: Function, onExport: Function }} props
 */
export function ReportOptionsPopup({ visible, onClose, onExport }) {
  const { colors, mode, toggle } = useTheme();
  const translateY = useSharedValue(SHEET_HIDDEN_OFFSET);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    animateOptionsSheet(visible, translateY, backdropOpacity);
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const themeLabel = isDarkMode(mode) ? 'Dark mode' : 'Light mode';

  return (
    <Modal transparent visible={visible} statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID="sheet-backdrop" />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              backgroundColor: sheetBackgroundColor(mode),
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.textMuted, opacity: 0.4 }]} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Report Settings</Text>

          <Pressable
            testID="theme-toggle"
            onPress={() => {
              playSelectionHaptic();
              toggle();
            }}
            style={[
              styles.row,
              {
                backgroundColor: rowSurfaceColor(mode),
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, { backgroundColor: iconSurfaceColor(mode) }]}>
                <Ionicons name={isDarkMode(mode) ? 'moon' : 'sunny'} size={18} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Appearance</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>{themeLabel}</Text>
              </View>
            </View>
            <View style={[styles.switchTrack, { backgroundColor: isDarkMode(mode) ? '#3a3a4a' : '#d4d4dc' }]}>
              <View
                style={[
                  styles.switchThumb,
                  { backgroundColor: '#fff', transform: [{ translateX: isDarkMode(mode) ? 20 : 0 }] },
                ]}
              />
            </View>
          </Pressable>

          <SheetRow
            icon="download-outline"
            title="Export PDF"
            subtitle="Save this week's recap"
            colors={colors}
            mode={mode}
            onPress={() => {
              playSelectionHaptic();
              onExport?.();
              onClose();
            }}
            testID="sheet-export"
          />
          <SheetRow
            icon="notifications-outline"
            title="Weekly digest"
            subtitle="Get a Sunday recap"
            colors={colors}
            mode={mode}
            onPress={() => {
              playSelectionHaptic();
              onClose();
            }}
            testID="sheet-digest"
          />

          <Pressable
            testID="sheet-close"
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: iconSurfaceColor(mode) }]}
          >
            <Text style={[styles.closeText, { color: colors.textPrimary }]}>Done</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSubtitle: { fontSize: 12, marginTop: 2 },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: { width: 20, height: 20, borderRadius: 10 },
  closeBtn: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  closeText: { fontSize: 15, fontWeight: '700' },
});
