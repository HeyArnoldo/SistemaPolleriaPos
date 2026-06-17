import { useRef } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useConnectivity } from '@/hooks/use-connectivity';
import { useSync } from '@/hooks/use-sync';
import { useOfflineAuth } from '@/contexts/offline-auth-context';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/dashboard/app-sidebar';
import { AppNavbar } from '@/components/dashboard/app-navbar';

export function AppLayout() {
  const navigate = useNavigate();
  const { syncNow, isSyncing, pendingCount } = useSync();
  const { isOfflineMode, exitOfflineMode } = useOfflineAuth();
  const isOfflineModeRef = useRef(isOfflineMode);
  isOfflineModeRef.current = isOfflineMode;

  const { isOnline } = useConnectivity({
    onReconnect: () => {
      syncNow();
      if (isOfflineModeRef.current) {
        exitOfflineMode();
        navigate('/login');
        toast.info('Conexión restaurada — iniciá sesión nuevamente');
      }
    },
  });

  return (
    <div className="bg-linear-to-b from-gray-50 from-30% to-60% to-white min-h-screen">
      <div className="relative flex flex-row z-0">
        <div className="absolute inset-0 -z-10 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] bg-size-[16px_16px]" />
        <SidebarProvider>
          <AppSidebar />
          <div className="w-full overflow-auto">
            <AppNavbar
              isOnline={isOnline}
              isOfflineMode={isOfflineMode}
              pendingCount={pendingCount}
              isSyncing={isSyncing}
              onSyncNow={syncNow}
            />
            <div className="min-h-[calc(100vh-64px)] py-4 px-4">
              <div className="container mx-auto">
                <Outlet />
              </div>
            </div>
          </div>
        </SidebarProvider>
      </div>
    </div>
  );
}
