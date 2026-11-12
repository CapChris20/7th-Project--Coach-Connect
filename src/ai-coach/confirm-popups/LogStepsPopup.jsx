// Design Law steps confirm — big count + slider + today/yesterday (screens/ai-coach-popups/07).
// Flow: prefill steps → slider in hundreds → Log steps.
// Used by: ConfirmActionPopup when tool = logSteps.

import React, { useMemo, useState } from 'react';
import {
  ToolModalBody,
  BigValueBlock,
  PopupSlider,
  FillChipRow,
  ConfirmCancelRow,
} from './sharedPopupParts';
import { accentGradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to log steps';
const TITLE = 'Steps today';
const CONFIRM_LABEL = 'Log steps';
// Manipulate here: step slider range (slider units = hundreds of steps)
const STEPS_MIN_HUNDREDS = 0;
const STEPS_MAX_HUNDREDS = 200; // 20,000 steps
const DAY_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
];

// ===== HELPERS =====

function readSteps(params) {
  const raw = params?.step_count ?? params?.steps ?? params?.stepCount;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 6400;
  return Math.round(n);
}

function stepsToHundreds(steps) {
  return Math.round(steps / 100);
}

function hundredsToSteps(hundreds) {
  return Math.round(hundreds) * 100;
}

function readDay(params) {
  const raw = String(params?.date || 'today').toLowerCase();
  if (raw === 'yesterday') return 'yesterday';
  return 'today';
}

// ===== MAIN FUNCTION =====

export default function LogStepsPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const [hundreds, setHundreds] = useState(() => stepsToHundreds(readSteps(params)));
  const [day, setDay] = useState(() => readDay(params));
  const steps = hundredsToSteps(hundreds);

  const draftParams = useMemo(
    () => ({
      ...(params || {}),
      steps,
      step_count: steps,
      stepCount: steps,
      date: day === 'yesterday' ? 'yesterday' : undefined,
    }),
    [params, steps, day],
  );

  return (
    <ToolModalBody title={TITLE} badge={BADGE} reasoning={reasoning}>
      <BigValueBlock valueLabel={String(steps)}>
        <PopupSlider
          value={hundreds}
          min={STEPS_MIN_HUNDREDS}
          max={STEPS_MAX_HUNDREDS}
          onChange={setHundreds}
          colors={accentGradients[0]}
        />
      </BigValueBlock>
      <FillChipRow options={DAY_OPTIONS} value={day} onChange={setDay} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(draftParams)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_LABEL}
      />
    </ToolModalBody>
  );
}
