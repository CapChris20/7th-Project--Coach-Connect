// Recent card payments for one client, read from the Firestore payments collection.
// Flow: query this client's payments → map each document → sort newest first → keep ten rows.
// Used by Settings when it shows the trainee's payment history.

import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

// The query is not ordered in Firestore. We pull a short page, sort on the phone, and show the newest ten.
// Manipulate here: the fetch cap and the number of rows the settings list keeps.
const PAYMENTS_FETCH_LIMIT = 20;
const PAYMENTS_SHOWN_LIMIT = 10;

const MISSING_DATE_LABEL = '—';
const DEFAULT_TRAINER_NAME = 'Coach';
const COMPLETED_LABEL = 'Completed';
const PENDING_LABEL = 'Pending';
const FAILED_LABEL = 'Failed';

// ===== HELPER FUNCTIONS =====

// vocab: toDate = Firestore Timestamp method. A plain string or number falls through to Date.
function formatHistoryDate(value) {
  if (!value) return MISSING_DATE_LABEL;
  const parsedDate = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(parsedDate.getTime())) return MISSING_DATE_LABEL;
  return parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function createdAtMilliseconds(createdAt) {
  if (typeof createdAt?.toDate === 'function') {
    return createdAt.toDate().getTime();
  }
  return Date.parse(createdAt) || 0;
}

function statusLabel(rawStatus) {
  const statusText = String(rawStatus || '').toLowerCase();
  if (statusText === 'succeeded' || statusText === 'completed') return COMPLETED_LABEL;
  if (statusText === 'pending') return PENDING_LABEL;
  if (statusText === 'failed') return FAILED_LABEL;
  if (rawStatus) return String(rawStatus);
  return COMPLETED_LABEL;
}

function paymentRowFromDocument(docSnap, trainerName) {
  const data = docSnap.data() || {};
  return {
    id: docSnap.id,
    date: formatHistoryDate(data.created_at),
    createdAtMs: createdAtMilliseconds(data.created_at),
    coach: trainerName,
    amount: Number(data.amount) || 0,
    status: statusLabel(data.status),
  };
}

async function loadPaymentRows(clientId, trainerName) {
  // vocab: query + where + limit = a capped Firestore read, not the whole payments collection.
  const paymentsQuery = query(
    collection(db, 'payments'),
    where('client_id', '==', clientId),
    limit(PAYMENTS_FETCH_LIMIT),
  );
  const snapshot = await getDocs(paymentsQuery);
  const mappedRows = snapshot.docs.map((docSnap) => paymentRowFromDocument(docSnap, trainerName));
  mappedRows.sort((leftRow, rightRow) => rightRow.createdAtMs - leftRow.createdAtMs);
  return mappedRows.slice(0, PAYMENTS_SHOWN_LIMIT);
}

// ===== MAIN FUNCTION =====

/**
 * Load this client's recent payments and keep them newest-first while the screen is open.
 * @param {string} clientId Firestore id stored on each payment as client_id.
 * @param {string} [trainerName] Name shown in the coach column.
 * @returns {{ rows: Array<object>, loading: boolean }}
 */
export function traineePaymentHistory(clientId, trainerName = DEFAULT_TRAINER_NAME) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // vocab: useEffect cleanup sets isCancelled so a slow read cannot setState after the client changes.
  useEffect(() => {
    let isCancelled = false;
    if (!clientId || !db) {
      setRows([]);
      setLoading(false);
      return undefined;
    }

    (async () => {
      setLoading(true);
      try {
        const mappedRows = await loadPaymentRows(clientId, trainerName);
        if (isCancelled) return;
        setRows(mappedRows);
      } catch (loadError) {
        console.warn('Client payment history load failed:', loadError?.message || loadError);
        if (!isCancelled) setRows([]);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [clientId, trainerName]);

  return { rows, loading };
}
