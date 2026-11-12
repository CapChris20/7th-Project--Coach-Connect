// Design Law energy confirm — 1–8 slider with named ends (screens/ai-coach-popups energy).
// Flow: prefill rating → drag → optional note → Log energy.
// Used by: ConfirmActionPopup when tool = rateEnergy.

import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  ToolModalBody,
  BigValueBlock,
  PopupSlider,
  FieldLabel,
  PopupTextField,
  ConfirmCancelRow,
  usePopupColors,
} from './sharedPopupParts';
import { accentGradients, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to log energy';
const TITLE = 'Energy right now';
const CONFIRM_LABEL = 'Log energy';
const NOTE_LABEL = 'NOTE (OPTIONAL)';
// Manipulate here: Design Law energy scale is 1–8 (not 1–10)
const ENERGY_MIN = 1;
const ENERGY_MAX = 8;

// ===== HELPERS =====

function readEnergy(params) {
  const raw = params?.rating ?? params?.energy;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5;
  return Math.min(ENERGY_MAX, Math.max(ENERGY_MIN, Math.round(n)));
}

function readNote(params) {
  return String(params?.notes || params?.note || '');
}

// ===== MAIN FUNCTION =====

export default function RateEnergyPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const colors = usePopupColors();
  const [rating, setRating] = useState(() => readEnergy(params));
  const [note, setNote] = useState(() => readNote(params));

  const draftParams = useMemo(
    () => ({
      ...(params || {}),
      rating,
      energy: rating,
      notes: note.trim() || undefined,
      note: note.trim() || undefined,
    }),
    [params, rating, note],
  );

  return (
    <ToolModalBody title={TITLE} badge={BADGE} reasoning={reasoning}>
      <BigValueBlock valueLabel={`${rating} / ${ENERGY_MAX}`}>
        <PopupSlider
          value={rating}
          min={ENERGY_MIN}
          max={ENERGY_MAX}
          onChange={setRating}
          colors={accentGradients[1]}
        />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: spacing.xs,
            marginBottom: spacing.sm,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.nbMuted }}>DRAINED</Text>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.nbMuted }}>WIRED</Text>
        </View>
      </BigValueBlock>
      <FieldLabel label={NOTE_LABEL} />
      <PopupTextField value={note} onChangeText={setNote} placeholder="Optional note…" multiline />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(draftParams)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_LABEL}
      />
    </ToolModalBody>
  );
}
