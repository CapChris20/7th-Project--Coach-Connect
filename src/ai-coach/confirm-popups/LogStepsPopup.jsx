// Design Law steps confirm — big count + slider + today/yesterday (screens/ai-coach-popups/07).
// Flow: read coach tool params → user drags slider (hundreds) → picks day → Log steps sends draft.
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

const BADGE_TEXT = 'Coach wants to log steps';
const HEADLINE = 'Steps today';
const CONFIRM_BUTTON_LABEL = 'Log steps';

// Manipulate here: slider units are hundreds of steps (1 tick = 100 steps)
const SLIDER_MIN_HUNDREDS = 0;
const SLIDER_MAX_HUNDREDS = 200;
const STEPS_PER_SLIDER_TICK = 100;

// Manipulate here: default when the coach tool omitted a step count
const STEPS_WHEN_COACH_OMITS_COUNT = 6400;

const DAY_CHIP_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
];

const DAY_YESTERDAY = 'yesterday';
const DAY_TODAY = 'today';

// Manipulate here: accentGradients[0] is the Design Law steps track color pair
const STEPS_SLIDER_GRADIENT_INDEX = 0;

// ===== HELPER FUNCTIONS =====

function firstStepCountRawFromCoachParams(coachParams) {
  if (!coachParams) {
    return null;
  }

  if (coachParams.step_count != null) {
    return coachParams.step_count;
  }
  if (coachParams.steps != null) {
    return coachParams.steps;
  }
  if (coachParams.stepCount != null) {
    return coachParams.stepCount;
  }

  return null;
}

function startingStepCountFromCoachParams(coachParams) {
  const stepCountFromTool = firstStepCountRawFromCoachParams(coachParams);
  const stepCountAsNumber = Number(stepCountFromTool);

  if (!Number.isFinite(stepCountAsNumber)) {
    return STEPS_WHEN_COACH_OMITS_COUNT;
  }
  if (stepCountAsNumber < 0) {
    return STEPS_WHEN_COACH_OMITS_COUNT;
  }

  return Math.round(stepCountAsNumber);
}

function stepCountToSliderHundreds(stepCount) {
  return Math.round(stepCount / STEPS_PER_SLIDER_TICK);
}

function sliderHundredsToStepCount(sliderHundreds) {
  return Math.round(sliderHundreds) * STEPS_PER_SLIDER_TICK;
}

function startingDayChipFromCoachParams(coachParams) {
  let dayWordFromTool = DAY_TODAY;
  if (coachParams && coachParams.date) {
    dayWordFromTool = String(coachParams.date).toLowerCase();
  }

  if (dayWordFromTool === DAY_YESTERDAY) {
    return DAY_YESTERDAY;
  }

  return DAY_TODAY;
}

function dateFieldForDayChip(whichDay) {
  if (whichDay === DAY_YESTERDAY) {
    return DAY_YESTERDAY;
  }
  return undefined;
}

function baseParamsOrEmptyObject(originalParams) {
  if (originalParams) {
    return originalParams;
  }
  return {};
}

function buildStepsConfirmPayload(originalParams, stepCount, whichDay) {
  const dateFieldForServer = dateFieldForDayChip(whichDay);
  const safeBaseParams = baseParamsOrEmptyObject(originalParams);

  return {
    ...safeBaseParams,
    steps: stepCount,
    step_count: stepCount,
    stepCount: stepCount,
    date: dateFieldForServer,
  };
}

function LogStepsLayout({
  reasoning,
  stepCountLabel,
  sliderHundreds,
  onSliderChange,
  whichDay,
  onDayChange,
  onConfirm,
  onCancel,
  loading,
}) {
  const sliderGradient = accentGradients[STEPS_SLIDER_GRADIENT_INDEX];

  return (
    <ToolModalBody title={HEADLINE} badge={BADGE_TEXT} reasoning={reasoning}>
      <BigValueBlock valueLabel={stepCountLabel}>
        <PopupSlider
          value={sliderHundreds}
          min={SLIDER_MIN_HUNDREDS}
          max={SLIDER_MAX_HUNDREDS}
          onChange={onSliderChange}
          colors={sliderGradient}
        />
      </BigValueBlock>
      <FillChipRow options={DAY_CHIP_OPTIONS} value={whichDay} onChange={onDayChange} />
      <ConfirmCancelRow
        onConfirm={onConfirm}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Confirm logging steps after the coach proposes a count.
 * Flow: 1. seed slider/day  2. build draft  3. Log steps hands draft to parent
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogStepsPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Seed slider (in hundreds) and day chips from what the coach tool sent.
  const [sliderHundreds, setSliderHundreds] = useState(() =>
    stepCountToSliderHundreds(startingStepCountFromCoachParams(params)),
  );
  const [whichDay, setWhichDay] = useState(() => startingDayChipFromCoachParams(params));

  // 2. Turn slider position back into a step count for the big number and confirm payload.
  const stepCountShown = sliderHundredsToStepCount(sliderHundreds);
  const stepCountLabel = String(stepCountShown);

  const payloadForConfirm = useMemo(
    () => buildStepsConfirmPayload(params, stepCountShown, whichDay),
    [params, stepCountShown, whichDay],
  );

  // 3. Confirm hands the merged params to the parent (same keys the server already expects).
  function handleConfirmLogSteps() {
    onConfirm(payloadForConfirm);
  }

  // 4. Show the Design Law steps sheet.
  return (
    <LogStepsLayout
      reasoning={reasoning}
      stepCountLabel={stepCountLabel}
      sliderHundreds={sliderHundreds}
      onSliderChange={setSliderHundreds}
      whichDay={whichDay}
      onDayChange={setWhichDay}
      onConfirm={handleConfirmLogSteps}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
