/**
 * Client payment history from Firestore `payments` collection.
 */
import { useEffect, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../app-start/config';

function formatHistoryDate(value) {
  if (!value) return '—';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function statusLabel(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'succeeded' || s === 'completed') return 'Completed';
  if (s === 'pending') return 'Pending';
  if (s === 'failed') return 'Failed';
  return raw ? String(raw) : 'Completed';
}

export function useClientPaymentHistory(clientId, trainerName = 'Coach') {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!clientId || !db) {
      setRows([]);
      setLoading(false);
      return undefined;
    }

    (async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'payments'), where('client_id', '==', clientId), limit(20));
        const snap = await getDocs(q);
        if (cancelled) return;
        const mapped = snap.docs.map((docSnap) => {
          const data = docSnap.data() || {};
          return {
            id: docSnap.id,
            date: formatHistoryDate(data.created_at),
            createdAtMs:
              typeof data.created_at?.toDate === 'function'
                ? data.created_at.toDate().getTime()
                : Date.parse(data.created_at) || 0,
            coach: trainerName,
            amount: Number(data.amount) || 0,
            status: statusLabel(data.status),
          };
        });
        mapped.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setRows(mapped.slice(0, 10));
      } catch (e) {
        console.warn('Client payment history load failed:', e?.message || e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, trainerName]);

  return { rows, loading };
}
