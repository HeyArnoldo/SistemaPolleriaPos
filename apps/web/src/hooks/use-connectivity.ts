import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';

const POLL_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;

interface UseConnectivityOptions {
  onReconnect?: () => void;
}

export function useConnectivity({ onReconnect }: UseConnectivityOptions = {}) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOfflineRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);
  onReconnectRef.current = onReconnect;

  const checkHealth = useCallback(async () => {
    try {
      // /health vive fuera del prefijo /api (Docker/Coolify healthcheck),
      // así que sobreescribimos baseURL para no pegarle a /api/health (404).
      await api.get('/health', {
        timeout: REQUEST_TIMEOUT_MS,
        baseURL: import.meta.env.VITE_API_URL ?? '',
      });
      setIsOnline((prev) => {
        if (!prev || wasOfflineRef.current) {
          wasOfflineRef.current = false;
          onReconnectRef.current?.();
        }
        return true;
      });
    } catch {
      wasOfflineRef.current = true;
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

  return { isOnline };
}
