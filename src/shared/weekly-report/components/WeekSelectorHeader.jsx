import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/WeeklyReportThemeContext';

export function WeekSelectorHeader({ label, canPrev, canNext, onPrev, onNext, onSettings, onBack }) {
  const { colors, mode } = useTheme();

  const haptic = () => Haptics.selectionAsync().catch(() => {});

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: mode === 'dark' ? 'rgba(10,10,15,0.6)' : 'rgba(244,244,246,0.6)',
          borderBottomColor: colors.border,
        },
      ]}
    >
      <BlurView intensity={40} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={() => {
              haptic();
              onBack();
            }}
            hitSlop={10}
            style={[
              styles.backBtn,
              {
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              },
            ]}
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </Pressable>
        ) : null}
        <View style={styles.titleBlock}>
          <Text style={[styles.eyebrow, { color: colors.textMuted }]}>WEEKLY REPORT</Text>
          <View style={styles.weekRow}>
            <Pressable
              testID="week-selector-prev"
              hitSlop={10}
              onPress={() => {
                haptic();
                onPrev();
              }}
              disabled={!canPrev}
              style={[
                styles.arrowBtn,
                {
                  backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  opacity: canPrev ? 1 : 0.35,
                },
              ]}
            >
              <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
            </Pressable>

            <Text style={[styles.weekLabel, { color: colors.textPrimary }]} testID="week-label">
              {label}
            </Text>

            <Pressable
              testID="week-selector-next"
              hitSlop={10}
              onPress={() => {
                haptic();
                onNext();
              }}
              disabled={!canNext}
              style={[
                styles.arrowBtn,
                {
                  backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  opacity: canNext ? 1 : 0.35,
                },
              ]}
            >
              <Ionicons name="chevron-forward" size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <Pressable
          testID="settings-btn"
          onPress={() => {
            haptic();
            onSettings();
          }}
          hitSlop={10}
          style={[
            styles.settingsBtn,
            {
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  arrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabel: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
});
