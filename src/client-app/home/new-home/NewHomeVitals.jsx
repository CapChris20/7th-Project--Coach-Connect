// Vitals grid: sleep, water, weight and steps as four tap-to-log tiles that share one bottom sheet.
// Flow: each tile shows today's saved value → tapping opens a sheet with one number field → Save writes through useCardState.
// Used by NewHomeLayout. Saved values, cache, Firestore and trainer notice all come from dashboardCardState.

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Droplets, Footprints, Moon, Scale } from 'lucide-react-native';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { NbButton } from '../../../look-and-feel/nb/NbButton';
import { NbField } from '../../../look-and-feel/nb/NbField';
import { NbSheet } from '../../../look-and-feel/nb/NbSheet';
import { NbSurface } from '../../../look-and-feel/nb/NbSurface';
import { NbIconChip } from '../../../look-and-feel/nb/NbAccentPieces';
import {
  NB_RADIUS,
  NB_SPACING,
  NB_TEXT_ON_ACCENT,
  getNbAccent,
  getNbColors,
} from '../../../look-and-feel/nb/nbTokens';
import { useCardState } from '../dashboardCardState';

// ===== NAMED CONSTANTS =====

const ACCENT_STEP = 3;
const ICON_SIZE = 20;
const VALUE_FONT_SIZE = 30;
const TILE_MIN_HEIGHT = 120;

// Each tile saves under the same key the old home cards used, so saved data and trainer alerts are unchanged.
const VITALS = [
  {
    storageKey: 'dashboard_sleep',
    label: 'Sleep',
    unit: 'hours',
    placeholder: 'Hours slept',
    min: 0,
    max: 24,
    Icon: Moon,
    metricName: 'sleepHours',
  },
  {
    storageKey: 'dashboard_water',
    label: 'Water',
    unit: 'oz',
    placeholder: 'Ounces today',
    min: 0,
    max: 300,
    Icon: Droplets,
    metricName: 'waterIntake',
  },
  {
    storageKey: 'dashboard_weight',
    label: 'Weight',
    unit: 'lbs',
    placeholder: 'Current weight',
    min: 0,
    max: 999,
    Icon: Scale,
    metricName: null,
  },
  {
    storageKey: 'dashboard_steps',
    label: 'Steps',
    unit: 'steps',
    placeholder: 'Steps today',
    min: 0,
    max: 99999,
    Icon: Footprints,
    metricName: null,
  },
];

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} text What the person typed.
 * @param {number} min
 * @param {number} max
 * @returns {boolean} True when the text is a number inside the allowed range.
 */
function isNumberInRange(text, min, max) {
  const number = parseFloat(text);
  if (Number.isNaN(number)) return false;
  return number >= min && number <= max;
}

// ===== IN-FILE PIECES =====

/**
 * One tile plus the sheet it opens.
 * @param {object} props
 * @param {object} props.vital One entry from VITALS.
 * @param {number} props.position Where the tile sits, used to pick its accent.
 * @param {Function} [props.onMetricsChange]
 * @returns {JSX.Element}
 */
function VitalTile({ vital, position, onMetricsChange }) {
  // 1. Colors, accent and today's saved value.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);
  const accent = getNbAccent(position * ACCENT_STEP);
  const afterSave = (savedText) => {
    if (!onMetricsChange || !vital.metricName) return;
    const number = parseFloat(savedText);
    if (!Number.isNaN(number)) onMetricsChange({ [vital.metricName]: number });
  };
  const { savedValue, save } = useCardState(vital.storageKey, afterSave);

  // 2. The sheet's own draft text and error flag.
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [hasError, setHasError] = useState(false);

  const openSheet = () => {
    setDraftText(savedValue ? String(savedValue) : '');
    setHasError(false);
    setIsSheetOpen(true);
  };

  const handleSave = () => {
    if (!isNumberInRange(draftText, vital.min, vital.max)) {
      setHasError(true);
      return;
    }
    save(draftText);
    setIsSheetOpen(false);
  };

  // 3. Tile, then sheet.
  const valueText = savedValue ? String(savedValue) : '–';
  return (
    <View style={styles.tileSlot}>
      <Pressable
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={`${vital.label}. ${savedValue ? `${savedValue} ${vital.unit}` : 'Not logged'}. Tap to log.`}
      >
        <NbSurface radius={NB_RADIUS.card} innerStyle={styles.tileInner}>
          <View style={styles.tileTop}>
            <NbIconChip accent={accent}>
              <vital.Icon color={NB_TEXT_ON_ACCENT} size={ICON_SIZE} />
            </NbIconChip>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>{vital.label}</Text>
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tileValue, { color: colors.ink }]}>
            {valueText}
          </Text>
          <Text style={[styles.tileHint, { color: colors.muted }]}>{savedValue ? vital.unit : 'Tap to log'}</Text>
        </NbSurface>
      </Pressable>

      <NbSheet visible={isSheetOpen} title={`Log ${vital.label.toLowerCase()}`} onClose={() => setIsSheetOpen(false)}>
        <NbField
          label={vital.unit}
          placeholder={vital.placeholder}
          keyboardType="decimal-pad"
          value={draftText}
          onChangeText={setDraftText}
          autoFocus
        />
        {hasError ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>
            Enter a number from {vital.min} to {vital.max}.
          </Text>
        ) : null}
        <NbButton label="Save" onPress={handleSave} />
      </NbSheet>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {Function} [props.onMetricsChange] Called with { sleepHours } or { waterIntake } after a save.
 * @returns {JSX.Element}
 */
export function NewHomeVitals({ onMetricsChange }) {
  return (
    <View style={styles.grid}>
      {VITALS.map((vital, position) => (
        <VitalTile key={vital.storageKey} vital={vital} position={position} onMetricsChange={onMetricsChange} />
      ))}
    </View>
  );
}

export default NewHomeVitals;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: NB_SPACING.medium },
  tileSlot: { width: '47.5%' },
  tileInner: { minHeight: TILE_MIN_HEIGHT, padding: NB_SPACING.medium, justifyContent: 'space-between' },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: NB_SPACING.small },
  tileLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  tileValue: { fontSize: VALUE_FONT_SIZE, fontWeight: '800', letterSpacing: -0.5 },
  tileHint: { fontSize: 12, fontWeight: '600' },
  errorText: { fontSize: 13, fontWeight: '700' },
});
