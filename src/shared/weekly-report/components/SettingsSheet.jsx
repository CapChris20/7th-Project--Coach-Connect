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
import { useTheme } from '../theme/WeeklyReportThemeContext';

function SheetRow({ icon, title, subtitle, onPress, colors, mode, testID }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[
        styles.row,
        {
          backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.rowLeft}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
          ]}
        >
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

export function SettingsSheet({ visible, onClose, onExport }) {
  const { colors, mode, toggle } = useTheme();
  const translateY = useSharedValue(400);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      backdrop.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 180 });
    } else {
      backdrop.value = withTiming(0, { duration: 180 });
      translateY.value = withTiming(400, { duration: 220, easing: Easing.in(Easing.cubic) });
    }
  }, [visible, translateY, backdrop]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  const tap = () => Haptics.selectionAsync().catch(() => {});

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
              backgroundColor: mode === 'dark' ? '#16161f' : '#ffffff',
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.textMuted, opacity: 0.4 }]} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Report Settings</Text>

          <Pressable
            testID="theme-toggle"
            onPress={() => {
              tap();
              toggle();
            }}
            style={[
              styles.row,
              {
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.rowLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
                ]}
              >
                <Ionicons name={mode === 'dark' ? 'moon' : 'sunny'} size={18} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Appearance</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                  {mode === 'dark' ? 'Dark mode' : 'Light mode'}
                </Text>
              </View>
            </View>
            <View style={[styles.switchTrack, { backgroundColor: mode === 'dark' ? '#3a3a4a' : '#d4d4dc' }]}>
              <View
                style={[
                  styles.switchThumb,
                  { backgroundColor: '#fff', transform: [{ translateX: mode === 'dark' ? 20 : 0 }] },
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
              tap();
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
              tap();
              onClose();
            }}
            testID="sheet-digest"
          />

          <Pressable
            testID="sheet-close"
            onPress={onClose}
            style={[
              styles.closeBtn,
              { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
            ]}
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
