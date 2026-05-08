import { useState, useEffect, useCallback } from 'react';
import { getTrainerPendingRequests } from '../services/trainerPendingRequestsService';

/**
 * Hook to fetch and refresh pending client requests for a trainer
 */
export function useTrainerPendingRequests(trainerUid) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!trainerUid) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getTrainerPendingRequests(trainerUid);
      setRequests(data || []);
    } catch (err) {
      if (__DEV__) console.error('useTrainerPendingRequests:', err);
      setError(err.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [trainerUid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { requests, loading, error, refresh };
}
