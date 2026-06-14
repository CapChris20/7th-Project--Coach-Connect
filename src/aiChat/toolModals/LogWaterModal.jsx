import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function LogWaterModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const oz = params?.amount_oz ?? params?.amountOz ?? params?.ounces ?? params?.amount ?? '—';

  return (
    <ToolModalBody title="Log water intake?" reasoning={reasoning}>
      <DetailRow label="Amount" value={oz !== '—' ? `${oz} oz` : '—'} />
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Log water" />
    </ToolModalBody>
  );
}
