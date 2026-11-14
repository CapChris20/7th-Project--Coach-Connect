// Design Law water confirm — cup taps + today/yesterday (screens/ai-coach-popups/09).
// Flow: read ounces from tool → tap cups on a grid → pick day → Log water sends amount_oz.
// Used by: ConfirmActionPopup when tool = logWater.

import React, { useMemo, useState } from 'react';
import { Image, Pressable, Text, View, StyleSheet } from 'react-native';
import {
  ToolModalBody,
  FillChipRow,
  ConfirmCancelRow,
  usePopupColors,
} from './sharedPopupParts';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE_TEXT = 'Coach wants to log water';
const HEADLINE = 'Water today';
const CONFIRM_BUTTON_LABEL = 'Log water';

// Manipulate here: cup goal + oz per cup (Body tab uses the same 8 oz cup)
const WATER_CUP_GOAL = 8;
const OUNCES_PER_CUP = 8;

// Manipulate here: default ounces when the coach tool forgot the amount (two cups)
const OUNCES_WHEN_COACH_OMITS_AMOUNT = 16;

const DAY_CHIP_OPTIONS = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
];

const DAY_YESTERDAY = 'yesterday';
const DAY_TODAY = 'today';

// Coach tool may send ounces under any of these key letters (all frozen).
const OUNCE_PARAM_KEY_OPTIONS = ['amount_oz', 'amountOz', 'ounces', 'amount'];

// Manipulate here: cup cell icon size (matches Design Law water grid)
const CUP_ICON_SIZE = 22;

// vocab: require() inside try = Metro may not have the PNG in every build; null → number fallback
const HANDOFF_WATER_ICON = (() => {
  try {
    return require('../../assets/icons/handoff/hydration.png');
  } catch (_) {
    return null;
  }
})();

// ===== HELPER FUNCTIONS =====

/**
 * Read ounces from the coach tool payload.
 * Tries amount_oz / amountOz / ounces / amount in that order.
 * @param {object|undefined} coachParams
 * @returns {number}
 */
function startingOuncesFromCoachParams(coachParams) {
  if (!coachParams) {
    return OUNCES_WHEN_COACH_OMITS_AMOUNT;
  }

  for (let keyIndex = 0; keyIndex < OUNCE_PARAM_KEY_OPTIONS.length; keyIndex += 1) {
    const keyName = OUNCE_PARAM_KEY_OPTIONS[keyIndex];
    const ouncesFromTool = Number(coachParams[keyName]);
    const ouncesLookValid = Number.isFinite(ouncesFromTool) && ouncesFromTool > 0;
    if (ouncesLookValid) {
      return ouncesFromTool;
    }
  }

  return OUNCES_WHEN_COACH_OMITS_AMOUNT;
}

/**
 * Turn ounces into a cup count clamped to 1…WATER_CUP_GOAL.
 * @param {number} ounces
 * @returns {number}
 */
function ouncesToCupCount(ounces) {
  const cupsRounded = Math.round(Number(ounces) / OUNCES_PER_CUP) || 1;
  const cupsAtLeastOne = Math.max(1, cupsRounded);
  const cupsAtMostGoal = Math.min(WATER_CUP_GOAL, cupsAtLeastOne);
  return cupsAtMostGoal;
}

/**
 * Turn a cup count back into ounces for the server write.
 * @param {number} cupCount
 * @returns {number}
 */
function cupCountToOunces(cupCount) {
  const safeCupCount = Number(cupCount) || 0;
  const ounces = Math.round(safeCupCount) * OUNCES_PER_CUP;
  return Math.max(0, ounces);
}

/**
 * Which day chip should start selected.
 * Only “yesterday” is special — everything else is today.
 * @param {object|undefined} coachParams
 * @returns {'today'|'yesterday'}
 */
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

/**
 * Merge ounces + day into the original tool params.
 * Server keys stay amount_oz / amountOz / ounces / amount / date (letters frozen).
 * @param {object|undefined} originalParams
 * @param {number} amountOz
 * @param {'today'|'yesterday'} whichDay
 * @returns {object}
 */
function buildWaterConfirmPayload(originalParams, amountOz, whichDay) {
  const baseParams = originalParams || {};

  // Only yesterday gets an explicit date field; today omits it (server default).
  let dateFieldForServer;
  if (whichDay === DAY_YESTERDAY) {
    dateFieldForServer = DAY_YESTERDAY;
  }

  return {
    ...baseParams,
    amount_oz: amountOz,
    amountOz: amountOz,
    ounces: amountOz,
    amount: amountOz,
    date: dateFieldForServer,
  };
}

/**
 * Build the 1…goal list of cup slot numbers for the grid.
 * @returns {number[]}
 */
function listCupSlotNumbers() {
  const cupSlotNumbers = [];
  for (let cupIndex = 1; cupIndex <= WATER_CUP_GOAL; cupIndex += 1) {
    cupSlotNumbers.push(cupIndex);
  }
  return cupSlotNumbers;
}

/**
 * Seed cup count once from coach ounces (lazy useState factory).
 * @param {object|undefined} coachParams
 * @returns {number}
 */
function seedCupsFilledFromCoachParams(coachParams) {
  const startingOunces = startingOuncesFromCoachParams(coachParams);
  return ouncesToCupCount(startingOunces);
}

// ===== SMALL UI PIECES =====

/**
 * One tappable cup cell. Filled cups use nbFill; empty cups use nbSurface.
 * Tap sets the filled count to this cup’s number (1-based).
 */
function WaterCupCell({ cupNumber, cupsFilledCount, colors, onPickCupCount }) {
  const cupIsFilled = cupNumber <= cupsFilledCount;

  let cupBackgroundColor = colors.nbSurface;
  let cupLabelColor = colors.nbInk;
  let hydrationIconTint;

  if (cupIsFilled) {
    cupBackgroundColor = colors.nbFill;
    cupLabelColor = colors.nbOnFill;
    hydrationIconTint = colors.nbOnFill;
  }

  function handlePressCup() {
    onPickCupCount(cupNumber);
  }

  const cupCellStyle = [
    styles.cup,
    {
      borderColor: colors.nbBorder,
      backgroundColor: cupBackgroundColor,
      shadowColor: colors.nbShadow,
    },
  ];

  // Prefer the handoff hydration PNG; fall back to the cup number as text.
  let cupContents = (
    <Text style={{ color: cupLabelColor, fontWeight: '900' }}>{cupNumber}</Text>
  );
  if (HANDOFF_WATER_ICON) {
    cupContents = (
      <Image
        source={HANDOFF_WATER_ICON}
        style={{
          width: CUP_ICON_SIZE,
          height: CUP_ICON_SIZE,
          tintColor: hydrationIconTint,
        }}
        resizeMode="contain"
      />
    );
  }

  return (
    <Pressable onPress={handlePressCup} style={cupCellStyle}>
      {cupContents}
    </Pressable>
  );
}

/**
 * Build one Pressable per cup slot (for-loop — no .map in the layout).
 * @returns {Array}
 */
function buildWaterCupCellElements(cupSlotNumbers, cupsFilledCount, colors, onPickCupCount) {
  const cupCells = [];

  for (let slotIndex = 0; slotIndex < cupSlotNumbers.length; slotIndex += 1) {
    const cupNumber = cupSlotNumbers[slotIndex];
    cupCells.push(
      <WaterCupCell
        key={`cup-${cupNumber}`}
        cupNumber={cupNumber}
        cupsFilledCount={cupsFilledCount}
        colors={colors}
        onPickCupCount={onPickCupCount}
      />,
    );
  }

  return cupCells;
}

/**
 * Hero “N of 8 cups” line + the cup grid.
 */
function WaterCupsHeroAndGrid({
  heroBigText,
  heroSuffixText,
  inkColor,
  cupSlotNumbers,
  cupsFilledCount,
  colors,
  onPickCupCount,
}) {
  const heroStyle = [styles.hero, { color: inkColor }];
  const cupCellElements = buildWaterCupCellElements(
    cupSlotNumbers,
    cupsFilledCount,
    colors,
    onPickCupCount,
  );

  return (
    <>
      <Text style={heroStyle}>
        <Text style={styles.heroBig}>{heroBigText}</Text>
        {heroSuffixText}
      </Text>
      <View style={styles.cupGrid}>{cupCellElements}</View>
    </>
  );
}

/**
 * Pure layout — no hooks. Parent owns cup/day state and Confirm.
 */
function LogWaterLayout({
  reasoning,
  heroBigText,
  heroSuffixText,
  inkColor,
  cupSlotNumbers,
  cupsFilledCount,
  colors,
  onPickCupCount,
  whichDay,
  onDayChange,
  onConfirm,
  onCancel,
  loading,
}) {
  return (
    <ToolModalBody title={HEADLINE} badge={BADGE_TEXT} reasoning={reasoning}>
      <WaterCupsHeroAndGrid
        heroBigText={heroBigText}
        heroSuffixText={heroSuffixText}
        inkColor={inkColor}
        cupSlotNumbers={cupSlotNumbers}
        cupsFilledCount={cupsFilledCount}
        colors={colors}
        onPickCupCount={onPickCupCount}
      />
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
 * Confirm logging water after the coach proposes an amount.
 * Flow: 1. theme  2. seed cups/day  3. ounces draft  4. Log water
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogWaterPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Theme tokens for cup borders / filled fill / hero ink.
  const colors = usePopupColors();

  // 2. Seed cup count and day from the coach tool payload (lazy init once).
  const [cupsFilledCount, setCupsFilledCount] = useState(() =>
    seedCupsFilledFromCoachParams(params),
  );
  const [whichDay, setWhichDay] = useState(() => startingDayChipFromCoachParams(params));

  // 3. Server writes ounces — cups are just the tap UI.
  const amountOz = cupCountToOunces(cupsFilledCount);
  const heroBigText = String(cupsFilledCount);
  const heroSuffixText = ` of ${WATER_CUP_GOAL} cups`;
  const cupSlotNumbers = listCupSlotNumbers();
  const payloadForConfirm = useMemo(
    () => buildWaterConfirmPayload(params, amountOz, whichDay),
    [params, amountOz, whichDay],
  );

  function handleConfirmLogWater() {
    onConfirm(payloadForConfirm);
  }

  // 4. Show the Design Law water sheet.
  return (
    <LogWaterLayout
      reasoning={reasoning}
      heroBigText={heroBigText}
      heroSuffixText={heroSuffixText}
      inkColor={colors.nbInk}
      cupSlotNumbers={cupSlotNumbers}
      cupsFilledCount={cupsFilledCount}
      colors={colors}
      onPickCupCount={setCupsFilledCount}
      whichDay={whichDay}
      onDayChange={setWhichDay}
      onConfirm={handleConfirmLogWater}
      onCancel={onCancel}
      loading={loading}
    />
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  hero: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: spacing.md,
  },
  heroBig: {
    fontSize: 40,
    fontWeight: '900',
  },
  cupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: spacing.md,
  },
  cup: {
    width: 52,
    height: 52,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
});
