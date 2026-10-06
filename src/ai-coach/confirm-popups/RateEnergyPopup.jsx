// Confirm popup before the coach writes an energy rating onto the dashboard.
// Flow: read the rating and optional notes → show them as a score out of 10 → confirm or cancel.
// Used by: the coach conversation when a tool wants to log energy.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const MISSING_VALUE = '—';
const ENERGY_SCALE_MAX = 10;

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {string|number}
 */
function readEnergyRating(params) {
  return params?.rating ?? params?.energy ?? MISSING_VALUE;
}

/**
 * @param {object|undefined} params
 * @returns {string|undefined}
 */
function readNotes(params) {
  return params?.notes || params?.note;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function RateEnergyPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const energyRating = readEnergyRating(params);
  const notes = readNotes(params);
  const energyLabel = energyRating !== MISSING_VALUE ? `${energyRating}/${ENERGY_SCALE_MAX}` : MISSING_VALUE;

  return (
    <ToolModalBody title="Log energy level?" reasoning={reasoning}>
      <DetailRow label="Energy" value={energyLabel} />
      {notes ? <DetailRow label="Notes" value={notes} /> : null}
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Log energy" />
    </ToolModalBody>
  );
}
