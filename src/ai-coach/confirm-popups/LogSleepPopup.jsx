// Design Law sleep confirm — big hours + slider + quality chips (screens/ai-coach-popups/05).
// Flow: prefill hours/quality → drag slider / retap quality → Log sleep merges draft.
// Used by: ConfirmActionPopup when the coach tool is logSleep.

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

const BADGE_TEXT = 'Coach wants to log sleep';
const HEADLINE = 'Last night';
const CONFIRM_BUTTON_LABEL = 'Log sleep';

// Manipulate here: sleep slider range (hours)
const SLEEP_HOURS_MIN = 4;
const SLEEP_HOURS_MAX = 12;
const SLEEP_HOURS_WHEN_COACH_OMITS = 8;
const DEFAULT_QUALITY_ID = 'good';

// Manipulate here: quality chip ids must match what carryOutAction / server accept
const QUALITY_CHIP_OPTIONS = [
  { id: 'poor', label: 'Poor' },
  { id: 'fair', label: 'Fair' },
  { id: 'good', label: 'Good' },
];

// Manipulate here: min/max captions under the slider track
const SLIDER_END_LABEL_FONT_SIZE = 11;
const SLIDER_END_LABEL_WEIGHT = '800';

// Manipulate here: which accent gradient paints the sleep track (index 4 in the token sheet)
const SLEEP_SLIDER_GRADIENT_INDEX = 4;

// ===== HELPER FUNCTIONS =====

function clampSleepHoursToSlider(hoursWholeNumber) {
  const roundedHours = Math.round(hoursWholeNumber);
  const notBelowMin = Math.max(SLEEP_HOURS_MIN, roundedHours);
  const notAboveMax = Math.min(SLEEP_HOURS_MAX, notBelowMin);
  return notAboveMax;
}

function rawHoursFromCoachParams(coachParams) {
  if (!coachParams) {
    return null;
  }

  if (coachParams.hours != null) {
    return coachParams.hours;
  }
  if (coachParams.sleepHours != null) {
    return coachParams.sleepHours;
  }

  return null;
}

function startingHoursFromCoachParams(coachParams) {
  const rawHours = rawHoursFromCoachParams(coachParams);
  const hoursNumber = Number(rawHours);

  if (!Number.isFinite(hoursNumber)) {
    return SLEEP_HOURS_WHEN_COACH_OMITS;
  }

  return clampSleepHoursToSlider(hoursNumber);
}

function qualityIdIsKnown(qualityId) {
  for (let index = 0; index < QUALITY_CHIP_OPTIONS.length; index += 1) {
    const option = QUALITY_CHIP_OPTIONS[index];
    if (option.id === qualityId) {
      return true;
    }
  }
  return false;
}

function rawQualityFromCoachParams(coachParams) {
  if (!coachParams) {
    return DEFAULT_QUALITY_ID;
  }

  if (coachParams.quality) {
    return String(coachParams.quality).toLowerCase();
  }
  if (coachParams.sleepQuality) {
    return String(coachParams.sleepQuality).toLowerCase();
  }

  return DEFAULT_QUALITY_ID;
}

function startingQualityFromCoachParams(coachParams) {
  const rawQuality = rawQualityFromCoachParams(coachParams);

  if (qualityIdIsKnown(rawQuality)) {
    return rawQuality;
  }

  return DEFAULT_QUALITY_ID;
}

function baseParamsOrEmptyObject(baseParams) {
  if (baseParams) {
    return baseParams;
  }
  return {};
}

function buildSleepDraftForConfirm(baseParams, sleepHours, qualityId) {
  const safeBaseParams = baseParamsOrEmptyObject(baseParams);

  return {
    ...safeBaseParams,
    hours: sleepHours,
    sleepHours: sleepHours,
    quality: qualityId,
  };
}

function bigHoursCaption(sleepHours) {
  return `${sleepHours} hrs`;
}

// ===== SMALL UI PIECES =====

function SleepSliderEndLabels({ mutedInkColor }) {
  const endLabelStyle = {
    fontSize: SLIDER_END_LABEL_FONT_SIZE,
    fontWeight: SLIDER_END_LABEL_WEIGHT,
    color: mutedInkColor,
  };

  const endsRowStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  };

  return (
    <View style={endsRowStyle}>
      <Text style={endLabelStyle}>{SLEEP_HOURS_MIN} HRS</Text>
      <Text style={endLabelStyle}>{SLEEP_HOURS_MAX} HRS</Text>
    </View>
  );
}

function SleepHoursSliderSection({ sleepHours, onHoursChange, mutedInkColor }) {
  const sliderGradient = accentGradients[SLEEP_SLIDER_GRADIENT_INDEX];

  return (
    <>
      <PopupSlider
        value={sleepHours}
        min={SLEEP_HOURS_MIN}
        max={SLEEP_HOURS_MAX}
        onChange={onHoursChange}
        colors={sliderGradient}
      />
      <SleepSliderEndLabels mutedInkColor={mutedInkColor} />
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Confirm logging sleep the coach proposed (trainee can drag hours + retap quality).
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogSleepPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Theme tokens for the muted slider end captions.
  const popupColors = usePopupColors();

  // 2. Hours slider and quality chips — seeded once from coach tool args.
  const [sleepHours, setSleepHours] = useState(() => startingHoursFromCoachParams(params));
  const [qualityId, setQualityId] = useState(() => startingQualityFromCoachParams(params));

  // 3. Keep confirm payload in sync with slider + chips.
  const draftParams = useMemo(
    () => buildSleepDraftForConfirm(params, sleepHours, qualityId),
    [params, sleepHours, qualityId],
  );

  function handleConfirmLogSleep() {
    onConfirm(draftParams);
  }

  // 4. Big hours display, slider, quality row, and Log sleep.
  const bigValueLabel = bigHoursCaption(sleepHours);
  const mutedInkColor = popupColors.nbMuted;

  return (
    <ToolModalBody title={HEADLINE} badge={BADGE_TEXT} reasoning={reasoning}>
      <BigValueBlock valueLabel={bigValueLabel}>
        <SleepHoursSliderSection
          sleepHours={sleepHours}
          onHoursChange={setSleepHours}
          mutedInkColor={mutedInkColor}
        />
      </BigValueBlock>
      <FillChipRow
        options={QUALITY_CHIP_OPTIONS}
        value={qualityId}
        onChange={setQualityId}
      />
      <ConfirmCancelRow
        onConfirm={handleConfirmLogSleep}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
