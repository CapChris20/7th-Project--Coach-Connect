/**
 * Log Water Modal
 *
 * Purpose: UI screen or component: Log Water Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: LogWaterModal
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

export default function LogWaterModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const oz = params?.amount_oz ?? params?.amountOz ?? params?.ounces ?? params?.amount ?? '—';

  return (
    <ToolModalBody title="Log water intake?" reasoning={reasoning}>
      <DetailRow label="Amount" value={oz !== '—' ? `${oz} oz` : '—'} />
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Log water" />
    </ToolModalBody>
  );
}
