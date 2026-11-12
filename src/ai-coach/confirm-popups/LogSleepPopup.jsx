// Design Law sleep confirm — big hours + slider + quality chips (screens/ai-coach-popups/05).
// Flow: prefill hours/quality → drag slider / retap quality → Log sleep.
// Used by: ConfirmActionPopup when tool = logSleep.

import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  ToolModalBody,
  BigValueBlock,
  PopupSlider,
  FillChipRow,
  ConfirmCancelRow,
  usePopupColors,
} from './sharedPopupParts';
import { accentGradients, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to log sleep';
const TITLE = 'Last night';
const CONFIRM_LABEL = 'Log sleep';
// Manipulate here: sleep slider range (hours)
const SLEEP_MIN = 4;
const SLEEP_MAX = 12;
const QUALITY_OPTIONS = [
  { id: 'poor', label: 'Poor' },
  { id: 'fair', label: 'Fair' },
  { id: 'good', label: 'Good' },
];

// ===== HELPERS =====

function readHours(params) {
  const raw = params?.hours ?? params?.sleepHours;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 8;
  return Math.min(SLEEP_MAX, Math.max(SLEEP_MIN, Math.round(n)));
}

function readQuality(params) {
  const raw = String(params?.quality || params?.sleepQuality || 'good').toLowerCase();
  if (QUALITY_OPTIONS.some((opt) => opt.id === raw)) return raw;
  return 'good';
}

// ===== MAIN FUNCTION =====

export default function LogSleepPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const colors = usePopupColors();
  const [hours, setHours] = useState(() => readHours(params));
  const [quality, setQuality] = useState(() => readQuality(params));

  const draftParams = useMemo(
    () => ({
      ...(params || {}),
      hours,
      sleepHours: hours,
      quality,
    }),
    [params, hours, quality],
  );

  return (
    <ToolModalBody title={TITLE} badge={BADGE} reasoning={reasoning}>
      <BigValueBlock valueLabel={`${hours} hrs`}>
        <PopupSlider
          value={hours}
          min={SLEEP_MIN}
          max={SLEEP_MAX}
          onChange={setHours}
          colors={accentGradients[4]}
        />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: spacing.xs,
            marginBottom: spacing.sm,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.nbMuted }}>
            {SLEEP_MIN} HRS
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.nbMuted }}>
            {SLEEP_MAX} HRS
          </Text>
        </View>
      </BigValueBlock>
      <FillChipRow options={QUALITY_OPTIONS} value={quality} onChange={setQuality} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(draftParams)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_LABEL}
      />
    </ToolModalBody>
  );
}
