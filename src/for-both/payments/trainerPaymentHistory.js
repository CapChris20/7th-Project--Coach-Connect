// The trainer's recent card charges, newest first.
// Flow: read payments for this trainer → turn each document into a row → keep the newest 20.
// Used by: the trainer earnings / payout history list.
// Read order: constants → helpers → trainerPaymentHistory hook.

import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const PAYMENTS_COLLECTION = 'payments';
const TRAINER_ID_FIELD = 'trainer_id';

// Firestore is not ordered here. We pull a short page, sort on the phone, then keep twenty.
// Manipulate here: fetch cap vs how many rows the earnings list shows.
const HISTORY_QUERY_LIMIT = 30;
const HISTORY_ROW_LIMIT = 20;

const MISSING_DATE_LABEL = '—';
const COMPLETED_LABEL = 'Completed';
const PENDING_LABEL = 'Pending';
const FAILED_LABEL = 'Failed';
const REFUNDED_LABEL = 'Refunded';

const STATUS_SUCCEEDED = 'succeeded';
const STATUS_COMPLETED = 'completed';
const STATUS_PENDING = 'pending';
const STATUS_FAILED = 'failed';
const STATUS_REFUNDED = 'refunded';

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging date parse, status labels, or the Firestore query

// vocab: toDate = Firestore Timestamp method. A plain string or number falls through to Date.
function formatPaymentHistoryDate(createdAtValue) {
  if (!createdAtValue) {
    return MISSING_DATE_LABEL;
  }

  const hasToDateMethod = typeof createdAtValue.toDate === 'function';
  let parsedDate;
  if (hasToDateMethod) {
    parsedDate = createdAtValue.toDate();
  } else {
    parsedDate = new Date(createdAtValue);
  }

  if (Number.isNaN(parsedDate.getTime())) {
    return MISSING_DATE_LABEL;
  }

  return parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function createdAtToMilliseconds(createdAtValue) {
  const hasToDateMethod =
    createdAtValue && typeof createdAtValue.toDate === 'function';
  if (hasToDateMethod) {
    return createdAtValue.toDate().getTime();
  }
  return Date.parse(createdAtValue) || 0;
}

// Map Stripe / backend status words onto the short labels the earnings list shows.
function humanReadablePaymentStatus(rawStatus) {
  const statusText = String(rawStatus || '').toLowerCase();

  if (statusText === STATUS_SUCCEEDED) {
    return COMPLETED_LABEL;
  }
  if (statusText === STATUS_COMPLETED) {
    return COMPLETED_LABEL;
  }
  if (statusText === STATUS_PENDING) {
    return PENDING_LABEL;
  }
  if (statusText === STATUS_FAILED) {
    return FAILED_LABEL;
  }
  if (statusText === STATUS_REFUNDED) {
    return REFUNDED_LABEL;
  }

  if (rawStatus) {
    return String(rawStatus);
  }
  return COMPLETED_LABEL;
}

// Field letters stay: created_at, amount, trainer_payout, commission, status, client_id.
function trainerPaymentRowFromFirestoreDoc(paymentDoc) {
  const paymentData = paymentDoc.data() || {};

  return {
    id: paymentDoc.id,
    date: formatPaymentHistoryDate(paymentData.created_at),
    createdAtMs: createdAtToMilliseconds(paymentData.created_at),
    amount: Number(paymentData.amount) || 0,
    net: Number(paymentData.trainer_payout) || 0,
    fee: Number(paymentData.commission) || 0,
    status: humanReadablePaymentStatus(paymentData.status),
    clientId: paymentData.client_id || null,
  };
}

function sortPaymentRowsNewestFirst(paymentRows) {
  const rowsCopy = paymentRows.slice();
  rowsCopy.sort(function compareNewestFirst(leftRow, rightRow) {
    return rightRow.createdAtMs - leftRow.createdAtMs;
  });
  return rowsCopy;
}

function mapPaymentDocsToRows(paymentDocs) {
  const paymentRows = [];
  for (let index = 0; index < paymentDocs.length; index += 1) {
    paymentRows.push(trainerPaymentRowFromFirestoreDoc(paymentDocs[index]));
  }
  return paymentRows;
}

async function fetchTrainerPaymentRowsFromFirestore(trainerId) {
  // vocab: query + where + limit = a capped Firestore read, not the whole payments collection.
  const paymentQuery = query(
    collection(db, PAYMENTS_COLLECTION),
    where(TRAINER_ID_FIELD, '==', trainerId),
    limit(HISTORY_QUERY_LIMIT),
  );

  const paymentSnapshot = await getDocs(paymentQuery);
  const paymentRows = mapPaymentDocsToRows(paymentSnapshot.docs);
  const newestFirst = sortPaymentRowsNewestFirst(paymentRows);
  return newestFirst.slice(0, HISTORY_ROW_LIMIT);
}

// ===== MAIN FUNCTION =====

/**
 * Live list of this trainer's recent card payments (newest first).
 * Hook order stays: rows → loading → effect that loads them.
 * @param {string} trainerId
 * @returns {{ rows: object[], loading: boolean }}
 */
export function trainerPaymentHistory(trainerId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // vocab: useEffect cleanup flips isCancelled so a slow read cannot setState after the trainer changes.
  useEffect(() => {
    let isCancelled = false;

    // 1. No trainer or no Firestore → empty list, not a hang.
    if (!trainerId || !db) {
      setRows([]);
      setLoading(false);
      return undefined;
    }

    // 2. Load newest-first rows. Ignore the result if the trainer changed mid-read.
    async function loadRowsForThisTrainer() {
      setLoading(true);
      try {
        const paymentRows = await fetchTrainerPaymentRowsFromFirestore(trainerId);
        if (isCancelled) {
          return;
        }
        setRows(paymentRows);
      } catch (loadError) {
        let errorMessage = loadError;
        if (loadError && loadError.message) {
          errorMessage = loadError.message;
        }
        console.warn('Trainer payment history load failed:', errorMessage);
        if (!isCancelled) {
          setRows([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadRowsForThisTrainer();

    return () => {
      isCancelled = true;
    };
  }, [trainerId]);

  return { rows: rows, loading: loading };
}
