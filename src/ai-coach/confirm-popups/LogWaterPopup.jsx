// Confirm popup before the coach writes a water amount onto the dashboard.
// Flow: read the ounces off the coach action → show them → confirm or cancel.
// Used by: the coach conversation when a tool wants to log water.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Log water intake?';
const AMOUNT_ROW_LABEL = 'Amount';
const CONFIRM_BUTTON_LABEL = 'Log water';
const MISSING_VALUE = '—';
const OUNCE_SUFFIX = ' oz';
const WATER_OUNCE_KEYS = ['amount_oz', 'amountOz', 'ounces', 'amount'];

// ===== HELPER FUNCTIONS =====

function valueWasProvided(value) {
  if (value === undefined) return false;
  if (value === null) return false;
  return true;
}

/**
 * The coach action has used more than one field name for the same amount.
 * @param {object|undefined} params
 * @returns {string|number}
 */
function readWaterOunces(params) {
  if (!params) return MISSING_VALUE;
  for (let index = 0; index < WATER_OUNCE_KEYS.length; index += 1) {
    const keyName = WATER_OUNCE_KEYS[index];
    const candidate = params[keyName];
    if (valueWasProvided(candidate)) return candidate;
  }
  return MISSING_VALUE;
}

/**
 * @param {string|number} waterOunces
 * @returns {string}
 */
function formatOunceLabel(waterOunces) {
  if (waterOunces === MISSING_VALUE) return MISSING_VALUE;
  return `${waterOunces}${OUNCE_SUFFIX}`;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm logging water intake the coach parsed from chat.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogWaterPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read ounces off the coach action (several field names have been used).
  const waterOunces = readWaterOunces(params);
  const ounceLabel = formatOunceLabel(waterOunces);

  // 2. Confirm writes that amount. onConfirm still gets the original params.
  function handleConfirmLogWater() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoning}>
      <DetailRow label={AMOUNT_ROW_LABEL} value={ounceLabel} />
      <ConfirmCancelRow
        onConfirm={handleConfirmLogWater}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
