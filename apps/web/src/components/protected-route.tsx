import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '@/hooks/use-auth';
import { useConnectivity } from '@/hooks/use-connectivity';
import { useOfflineAuth } from '@/contexts/offline-auth-context';
import { getStoredOfflineSession } from '@/lib/offline-pin';
import type { StoredOfflineSession } from '@/lib/db';
import { Skeleton } from '@/components/ui/skeleton';
import { OfflinePinScreen } from '@/components/auth/offline-pin-screen';
import { WifiOff } from 'lucide-react';

export function ProtectedRoute() {
  const { data: user, isLoading } = useMe();
  const { isOnline, hasCheckedHealth } = useConnectivity();
  const { isOfflineMode, enterOfflineMode } = useOfflineAuth();
  const [offlineSession, setOfflineSession] = useState<StoredOfflineSession | null | undefined>(
    undefined,
  );

  useEffect(() => {
    getStoredOfflineSession().then((s) => setOfflineSession(s ?? null));
  }, []);

  if (isOfflineMode) return <Outlet />;

  if (isLoading || offlineSession === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md space-y-3 p-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (user) return <Outlet />;

  // Logged-out: wait for the real health check before deciding login-vs-PIN,
  // so an offline user with a valid PIN isn't bounced to /login on the
  // optimistic navigator.onLine value.
  if (!hasCheckedHealth) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md space-y-3 p-6">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  if (isOnline) return <Navigate to="/login" replace />;

  if (offlineSession) {
    return <OfflinePinScreen session={offlineSession} onSuccess={enterOfflineMode} />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center p-6">
      <WifiOff className="h-12 w-12 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Sin conexión</h2>
      <p className="text-sm text-muted-foreground max-w-xs">
        No hay internet y no tenés un PIN configurado. Configurá tu PIN desde el menú de usuario
        cuando tengas conexión.
      </p>
    </div>
  );
}
