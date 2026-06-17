import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

const POLL_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;

export function useConnectivity() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkHealth = useCallback(async () => {
    try {
      await api.get('/health', { timeout: REQUEST_TIMEOUT_MS });
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    void checkHealth();

    const schedule = () => {
      timerRef.current = setTimeout(() => {
        void checkHealth().finally(schedule);
      }, POLL_INTERVAL_MS);
    };

    schedule();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [checkHealth]);

  useEffect(() => {
    const handleOnline = () => {
      void checkHealth();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkHealth]);

  return { isOnline };
}
