// Confirm popup before the coach writes an energy rating onto the dashboard.
// Flow: read the rating and optional notes → show them as a score out of 10 → confirm or cancel.
// Used by: the coach conversation when a tool wants to log energy.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Log energy level?';
const ENERGY_ROW_LABEL = 'Energy';
const NOTES_ROW_LABEL = 'Notes';
const CONFIRM_BUTTON_LABEL = 'Log energy';
const MISSING_VALUE = '—';
const ENERGY_SCALE_MAX = 10;

// ===== HELPER FUNCTIONS =====

function valueWasProvided(value) {
  if (value === undefined) return false;
  if (value === null) return false;
  return true;
}

/**
 * @param {object|undefined} params
 * @returns {string|number}
 */
function readEnergyRating(params) {
  if (!params) return MISSING_VALUE;
  if (valueWasProvided(params.rating)) return params.rating;
  if (valueWasProvided(params.energy)) return params.energy;
  return MISSING_VALUE;
}

/**
 * @param {object|undefined} params
 * @returns {string|undefined}
 */
function readOptionalNotes(params) {
  if (!params) return undefined;
  if (params.notes) return String(params.notes);
  if (params.note) return String(params.note);
  return undefined;
}

/**
 * @param {string|number} energyRating
 * @returns {string}
 */
function formatEnergyScoreLabel(energyRating) {
  if (energyRating === MISSING_VALUE) return MISSING_VALUE;
  return `${energyRating}/${ENERGY_SCALE_MAX}`;
}

function NotesRow({ notesText }) {
  if (!notesText) return null;
  return <DetailRow label={NOTES_ROW_LABEL} value={notesText} />;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm logging an energy score on the dashboard.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function RateEnergyPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read the energy rating and optional notes.
  const energyRating = readEnergyRating(params);
  const notesText = readOptionalNotes(params);
  const energyLabel = formatEnergyScoreLabel(energyRating);

  // 2. Confirm logs energy. onConfirm still gets the original params.
  function handleConfirmLogEnergy() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoning}>
      <DetailRow label={ENERGY_ROW_LABEL} value={energyLabel} />
      <NotesRow notesText={notesText} />
      <ConfirmCancelRow
        onConfirm={handleConfirmLogEnergy}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
