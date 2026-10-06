// Confirm popup before the coach writes a water amount onto the dashboard.
// Flow: read the ounces off the coach action → show them → confirm or cancel.
// Used by: the coach conversation when a tool wants to log water.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const MISSING_VALUE = '—';

// ===== HELPER FUNCTIONS =====

/**
 * The coach action has used more than one field name for the same amount.
 * @param {object|undefined} params
 * @returns {string|number}
 */
function readOunces(params) {
  return params?.amount_oz ?? params?.amountOz ?? params?.ounces ?? params?.amount ?? MISSING_VALUE;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogWaterPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const ounces = readOunces(params);
  const ounceLabel = ounces !== MISSING_VALUE ? `${ounces} oz` : MISSING_VALUE;

  return (
    <ToolModalBody title="Log water intake?" reasoning={reasoning}>
      <DetailRow label="Amount" value={ounceLabel} />
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Log water" />
    </ToolModalBody>
  );
}
