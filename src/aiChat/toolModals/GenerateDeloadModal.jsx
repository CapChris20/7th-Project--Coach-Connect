/**
 * Generate Deload Modal
 *
 * Purpose: UI screen or component: Generate Deload Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: GenerateDeloadModal
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

export default function GenerateDeloadModal({ params, reasoning, onConfirm, onCancel, loading }) {
  return (
    <ToolModalBody title="Create deload week?" reasoning={reasoning}>
      <DetailRow label="Plan" value="Recovery week at ~60% volume" />
      <DetailRow label="Reason" value={params?.reason} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Create"
      />
    </ToolModalBody>
  );
}
