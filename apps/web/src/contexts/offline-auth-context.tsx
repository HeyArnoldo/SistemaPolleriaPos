import { createContext, useContext, useState } from 'react';
import type { StoredOfflineSession } from '@/lib/db';

interface OfflineAuthContextValue {
  isOfflineMode: boolean;
  offlineUser: StoredOfflineSession | null;
  enterOfflineMode: (session: StoredOfflineSession) => void;
  exitOfflineMode: () => void;
}

const OfflineAuthContext = createContext<OfflineAuthContextValue | null>(null);

export function OfflineAuthProvider({ children }: { children: React.ReactNode }) {
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineUser, setOfflineUser] = useState<StoredOfflineSession | null>(null);

  function enterOfflineMode(session: StoredOfflineSession) {
    setOfflineUser(session);
    setIsOfflineMode(true);
  }

  function exitOfflineMode() {
    setOfflineUser(null);
    setIsOfflineMode(false);
  }

  return (
    <OfflineAuthContext.Provider
      value={{ isOfflineMode, offlineUser, enterOfflineMode, exitOfflineMode }}
    >
      {children}
    </OfflineAuthContext.Provider>
  );
}

export function useOfflineAuth(): OfflineAuthContextValue {
  const ctx = useContext(OfflineAuthContext);
  if (!ctx) throw new Error('useOfflineAuth must be used inside OfflineAuthProvider');
  return ctx;
}
