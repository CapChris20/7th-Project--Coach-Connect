// Recent card payments for one client, read from the Firestore payments collection.
// Flow: query this client's payments → map each document → sort newest first → keep ten rows.
// Used by Settings when it shows the trainee's payment history.

import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const PAYMENTS_COLLECTION = 'payments';
const CLIENT_ID_FIELD = 'client_id';

// The query is not ordered in Firestore. We pull a short page, sort on the phone, and show the newest ten.
// Manipulate here: the fetch cap and the number of rows the settings list keeps.
const PAYMENTS_FETCH_LIMIT = 20;
const PAYMENTS_SHOWN_LIMIT = 10;

const MISSING_DATE_LABEL = '—';
const DEFAULT_TRAINER_NAME = 'Coach';
const COMPLETED_LABEL = 'Completed';
const PENDING_LABEL = 'Pending';
const FAILED_LABEL = 'Failed';

// Known Stripe/Firestore status strings → what Settings shows in the status column.
const STATUS_LABEL_BY_RAW = {
  succeeded: COMPLETED_LABEL,
  completed: COMPLETED_LABEL,
  pending: PENDING_LABEL,
  failed: FAILED_LABEL,
};

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging date parse, status labels, or the Firestore query

// vocab: toDate = Firestore Timestamp method. A plain string or number falls through to Date.
function formatPaymentHistoryDate(createdAtValue) {
  if (!createdAtValue) {
    return MISSING_DATE_LABEL;
  }

  let parsedDate;
  const hasToDateMethod = typeof createdAtValue.toDate === 'function';
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

function createdAtToMilliseconds(createdAt) {
  const hasToDateMethod = createdAt && typeof createdAt.toDate === 'function';
  if (hasToDateMethod) {
    return createdAt.toDate().getTime();
  }
  return Date.parse(createdAt) || 0;
}

function humanReadablePaymentStatus(rawStatus) {
  const statusText = String(rawStatus || '').toLowerCase();
  const knownLabel = STATUS_LABEL_BY_RAW[statusText];
  if (knownLabel) {
    return knownLabel;
  }
  if (rawStatus) {
    return String(rawStatus);
  }
  return COMPLETED_LABEL;
}

function clientPaymentRowFromFirestoreDoc(docSnap, trainerNameForColumn) {
  const paymentData = docSnap.data() || {};

  return {
    id: docSnap.id,
    date: formatPaymentHistoryDate(paymentData.created_at),
    createdAtMs: createdAtToMilliseconds(paymentData.created_at),
    coach: trainerNameForColumn,
    amount: Number(paymentData.amount) || 0,
    status: humanReadablePaymentStatus(paymentData.status),
  };
}

function sortPaymentRowsNewestFirst(paymentRows) {
  const rowsCopy = paymentRows.slice();
  rowsCopy.sort(function compareNewestFirst(leftRow, rightRow) {
    return rightRow.createdAtMs - leftRow.createdAtMs;
  });
  return rowsCopy;
}

function mapDocsToPaymentRows(docs, trainerName) {
  const mappedRows = [];
  for (let index = 0; index < docs.length; index += 1) {
    mappedRows.push(clientPaymentRowFromFirestoreDoc(docs[index], trainerName));
  }
  return mappedRows;
}

async function fetchClientPaymentRowsFromFirestore(clientId, trainerName) {
  // vocab: query + where + limit = a capped Firestore read, not the whole payments collection.
  const paymentsQuery = query(
    collection(db, PAYMENTS_COLLECTION),
    where(CLIENT_ID_FIELD, '==', clientId),
    limit(PAYMENTS_FETCH_LIMIT),
  );

  const snapshot = await getDocs(paymentsQuery);
  const mappedRows = mapDocsToPaymentRows(snapshot.docs, trainerName);
  const newestFirst = sortPaymentRowsNewestFirst(mappedRows);
  return newestFirst.slice(0, PAYMENTS_SHOWN_LIMIT);
}

async function startLoadingClientPaymentRows(
  clientId,
  trainerName,
  cancelFlag,
  setRows,
  setLoading,
) {
  setLoading(true);

  try {
    const paymentRows = await fetchClientPaymentRowsFromFirestore(clientId, trainerName);
    if (cancelFlag.isCancelled) {
      return;
    }
    setRows(paymentRows);
  } catch (loadError) {
    let errorMessage = loadError;
    if (loadError && loadError.message) {
      errorMessage = loadError.message;
    }
    console.warn('Client payment history load failed:', errorMessage);
    if (!cancelFlag.isCancelled) {
      setRows([]);
    }
  }

  if (!cancelFlag.isCancelled) {
    setLoading(false);
  }
}

// ===== MAIN FUNCTION =====

/**
 * Load this client's recent payments and keep them newest-first while the screen is open.
 * @param {string} clientId Firestore id stored on each payment as client_id.
 * @param {string} [trainerName] Name shown in the coach column.
 * @returns {{ rows: Array<object>, loading: boolean }}
 */
export function traineePaymentHistory(clientId, trainerName = DEFAULT_TRAINER_NAME) {
  // Hook order frozen: rows state → loading state → load effect.
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // vocab: useEffect cleanup sets isCancelled so a slow read cannot setState after the client changes.
  useEffect(() => {
    const cancelFlag = { isCancelled: false };

    // 1. No client or no Firestore → empty list, not a hang.
    if (!clientId || !db) {
      setRows([]);
      setLoading(false);
      return undefined;
    }

    // 2. Load newest-first rows. Ignore the result if the client changed while we were reading.
    startLoadingClientPaymentRows(clientId, trainerName, cancelFlag, setRows, setLoading);

    return () => {
      cancelFlag.isCancelled = true;
    };
  }, [clientId, trainerName]);

  return { rows: rows, loading: loading };
}
