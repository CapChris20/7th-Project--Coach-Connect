// Week strip on the weekly report: back, previous/next week, and a settings (ellipsis) button.
// Flow: optional back → week label between chevrons → settings. Each tap plays a light selection haptic.
// Used by: WeeklyReportBody for both trainer and client.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const DARK_MODE = 'dark';
const DARK_BAR_FILL = 'rgba(10,10,15,0.6)';
const LIGHT_BAR_FILL = 'rgba(244,244,246,0.6)';
const DARK_BUTTON_FILL = 'rgba(255,255,255,0.06)';
const LIGHT_BUTTON_FILL = 'rgba(0,0,0,0.05)';
const DISABLED_ARROW_OPACITY = 0.35;
const ENABLED_ARROW_OPACITY = 1;
const BLUR_INTENSITY = 40;
const HIT_SLOP = 10;
const EYEBROW_LABEL = 'WEEKLY REPORT';
const BACK_ACCESSIBILITY_LABEL = 'Go back';
const ICON_CHEVRON_BACK = 'chevron-back';
const ICON_CHEVRON_FORWARD = 'chevron-forward';
const ICON_SETTINGS = 'ellipsis-horizontal';

// ===== HELPER FUNCTIONS =====

/**
 * Selection haptic. A missing haptic engine (web / simulator) is ignored on purpose.
 */
function playSelectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

/**
 * @param {string} mode
 * @returns {string}
 */
function barBackground(mode) {
  return mode === DARK_MODE ? DARK_BAR_FILL : LIGHT_BAR_FILL;
}

/**
 * @param {string} mode
 * @returns {string}
 */
function buttonFill(mode) {
  return mode === DARK_MODE ? DARK_BUTTON_FILL : LIGHT_BUTTON_FILL;
}

/**
 * Dim the chevron when that direction has no more weeks.
 * @param {boolean} isEnabled
 * @returns {number}
 */
function arrowOpacity(isEnabled) {
  return isEnabled ? ENABLED_ARROW_OPACITY : DISABLED_ARROW_OPACITY;
}

/**
 * Haptic first so the tap feels instant even if the callback is slow.
 * @param {Function} [onPress]
 */
function pressWithHaptic(onPress) {
  playSelectionHaptic();
  onPress();
}

// ===== MAIN FUNCTION =====

/**
 * Frosted week picker. Disabled chevrons stay visible but faded so the user knows there is a bound.
 * @param {{ label: string, canPrev: boolean, canNext: boolean, onPrev: Function, onNext: Function, onSettings: Function, onBack?: Function }} props
 */
export function WeekPicker({ label, canPrev, canNext, onPrev, onNext, onSettings, onBack }) {
  const { colors, mode } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: barBackground(mode),
          borderBottomColor: colors.border,
        },
      ]}
    >
      <BlurView intensity={BLUR_INTENSITY} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={() => pressWithHaptic(onBack)}
            hitSlop={HIT_SLOP}
            style={[
              styles.backBtn,
              {
                backgroundColor: buttonFill(mode),
              },
            ]}
            accessibilityLabel={BACK_ACCESSIBILITY_LABEL}
          >
            <Ionicons name={ICON_CHEVRON_BACK} size={20} color={colors.textPrimary} />
          </Pressable>
        ) : null}
        <View style={styles.titleBlock}>
          <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{EYEBROW_LABEL}</Text>
          <View style={styles.weekRow}>
            <Pressable
              testID="week-selector-prev"
              hitSlop={HIT_SLOP}
              onPress={() => pressWithHaptic(onPrev)}
              disabled={!canPrev}
              style={[
                styles.arrowBtn,
                {
                  backgroundColor: buttonFill(mode),
                  opacity: arrowOpacity(canPrev),
                },
              ]}
            >
              <Ionicons name={ICON_CHEVRON_BACK} size={18} color={colors.textPrimary} />
            </Pressable>

            <Text style={[styles.weekLabel, { color: colors.textPrimary }]} testID="week-label">
              {label}
            </Text>

            <Pressable
              testID="week-selector-next"
              hitSlop={HIT_SLOP}
              onPress={() => pressWithHaptic(onNext)}
              disabled={!canNext}
              style={[
                styles.arrowBtn,
                {
                  backgroundColor: buttonFill(mode),
                  opacity: arrowOpacity(canNext),
                },
              ]}
            >
              <Ionicons name={ICON_CHEVRON_FORWARD} size={18} color={colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        <Pressable
          testID="settings-btn"
          onPress={() => pressWithHaptic(onSettings)}
          hitSlop={HIT_SLOP}
          style={[
            styles.settingsBtn,
            {
              backgroundColor: buttonFill(mode),
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name={ICON_SETTINGS} size={20} color={colors.textPrimary} />
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
