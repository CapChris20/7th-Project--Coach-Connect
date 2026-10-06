// The trainer's recent card charges, newest first.
// Flow: read the payments collection for this trainer → turn each document into a row → keep the newest 20.
// Used by: the trainer payout history list.

import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const PAYMENTS_COLLECTION = 'payments';
const TRAINER_ID_FIELD = 'trainer_id';
const HISTORY_QUERY_LIMIT = 30;
const HISTORY_ROW_LIMIT = 20;
const MISSING_DATE_LABEL = '—';
const COMPLETED_LABEL = 'Completed';

// ===== HELPER FUNCTIONS =====

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatHistoryDate(value) {
  if (!value) return MISSING_DATE_LABEL;
  // vocab: Firestore timestamps expose toDate(); a plain string or number does not.
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return MISSING_DATE_LABEL;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * @param {unknown} rawStatus
 * @returns {string}
 */
function statusLabel(rawStatus) {
  const statusText = String(rawStatus || '').toLowerCase();
  if (statusText === 'succeeded' || statusText === 'completed') return COMPLETED_LABEL;
  if (statusText === 'pending') return 'Pending';
  if (statusText === 'failed') return 'Failed';
  if (statusText === 'refunded') return 'Refunded';
  return rawStatus ? String(rawStatus) : COMPLETED_LABEL;
}

/**
 * @param {unknown} createdAt
 * @returns {number}
 */
function createdAtMillis(createdAt) {
  if (typeof createdAt?.toDate === 'function') return createdAt.toDate().getTime();
  return Date.parse(createdAt) || 0;
}

/**
 * @param {import('firebase/firestore').QueryDocumentSnapshot} paymentDoc
 * @returns {object}
 */
function paymentDocToRow(paymentDoc) {
  const paymentData = paymentDoc.data() || {};
  return {
    id: paymentDoc.id,
    date: formatHistoryDate(paymentData.created_at),
    createdAtMs: createdAtMillis(paymentData.created_at),
    amount: Number(paymentData.amount) || 0,
    net: Number(paymentData.trainer_payout) || 0,
    fee: Number(paymentData.commission) || 0,
    status: statusLabel(paymentData.status),
    clientId: paymentData.client_id || null,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Hooks stay in this order: rows, loading, then the effect that loads them.
 * @param {string} trainerId
 * @returns {{ rows: object[], loading: boolean }}
 */
export function trainerPaymentHistory(trainerId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    if (!trainerId || !db) {
      setRows([]);
      setLoading(false);
      return undefined;
    }

    const loadPaymentRows = async () => {
      setLoading(true);
      try {
        const paymentQuery = query(
          collection(db, PAYMENTS_COLLECTION),
          where(TRAINER_ID_FIELD, '==', trainerId),
          limit(HISTORY_QUERY_LIMIT),
        );
        const paymentSnapshot = await getDocs(paymentQuery);
        if (isCancelled) return;
        const paymentRows = paymentSnapshot.docs.map(paymentDocToRow);
        paymentRows.sort((leftRow, rightRow) => rightRow.createdAtMs - leftRow.createdAtMs);
        setRows(paymentRows.slice(0, HISTORY_ROW_LIMIT));
      } catch (loadError) {
        console.warn('Trainer payment history load failed:', loadError?.message || loadError);
        if (!isCancelled) setRows([]);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadPaymentRows();

    return () => {
      isCancelled = true;
    };
  }, [trainerId]);

  return { rows, loading };
}
