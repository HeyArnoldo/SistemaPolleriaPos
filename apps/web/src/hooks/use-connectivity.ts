import { useState, useEffect, useCallback, useRef } from 'react';
import { api, apiBaseUrl } from '@/lib/api';

const POLL_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;

interface UseConnectivityOptions {
  onReconnect?: () => void;
}

export function useConnectivity({ onReconnect }: UseConnectivityOptions = {}) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  // false until the first health check resolves — guards code that must not act
  // on the optimistic navigator.onLine value (e.g. redirecting to /login while
  // a PIN-offline user is actually on an unreachable network).
  const [hasCheckedHealth, setHasCheckedHealth] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only true after a CONFIRMED offline state (failed health check / offline
  // event), so onReconnect never fires spuriously on first mount.
  const wasOfflineRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  const checkHealth = useCallback(async () => {
    try {
      // /health vive fuera del prefijo /api (Docker/Coolify healthcheck),
      // así que sobreescribimos baseURL para no pegarle a /api/health (404).
      await api.get('/health', {
        timeout: REQUEST_TIMEOUT_MS,
        baseURL: apiBaseUrl,
      });
      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        onReconnectRef.current?.();
      }
      setIsOnline(true);
    } catch {
      wasOfflineRef.current = true;
      setIsOnline(false);
    } finally {
      setHasCheckedHealth(true);
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
      wasOfflineRef.current = true;
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkHealth]);

  return { isOnline, hasCheckedHealth };
}
