import { useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart2,
  CreditCard,
  History,
  KeyRound,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  TrendingDown,
  User as UserIcon,
  Users,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLogout, useMe } from '@/hooks/use-auth';
import { useConnectivity } from '@/hooks/use-connectivity';
import { useSync } from '@/hooks/use-sync';
import { useOfflineAuth } from '@/contexts/offline-auth-context';
import { canAccessRoute } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SyncStatus } from '@/components/ui/sync-status';
import { SetPinDialog } from '@/components/auth/set-pin-dialog';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-primary/10 text-primary'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  ].join(' ');

export function AppLayout() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const { syncNow, isSyncing, pendingCount } = useSync();
  const { isOfflineMode, exitOfflineMode } = useOfflineAuth();
  const isOfflineModeRef = useRef(isOfflineMode);
  isOfflineModeRef.current = isOfflineMode;
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

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

  const isAdmin = canAccessRoute(user?.role, 'dashboard');
  const effectiveIsAdmin = isAdmin && !isOfflineMode;

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login') });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="font-semibold">Pollería Carbón</span>
          <div className="flex items-center gap-2">
            {isOfflineMode && (
              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                <WifiOff className="h-3 w-3" />
                Sin conexión
              </span>
            )}
            <SyncStatus
              isOnline={isOnline}
              pendingCount={pendingCount}
              isSyncing={isSyncing}
              onSyncNow={syncNow}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <UserIcon className="size-4" />
                  {user?.profile?.firstName}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="font-normal text-muted-foreground">
                  {user?.username}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {!isOfflineMode && (
                  <>
                    <DropdownMenuItem onClick={() => setPinDialogOpen(true)}>
                      <KeyRound className="size-4" />
                      Configurar PIN sin conexión
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-5xl gap-6 px-4 py-4">
        <nav className="hidden w-44 shrink-0 flex-col gap-1 sm:flex">
          <NavLink to="/ventas" className={navLinkClass}>
            <ShoppingCart className="size-4" />
            Ventas
          </NavLink>
          <NavLink to="/egresos" className={navLinkClass}>
            <TrendingDown className="size-4" />
            Egresos
          </NavLink>
          {effectiveIsAdmin && (
            <>
              <NavLink to="/caja" className={navLinkClass}>
                <CreditCard className="size-4" />
                Caja
              </NavLink>
              <NavLink to="/dashboard" className={navLinkClass}>
                <BarChart2 className="size-4" />
                Dashboard
              </NavLink>
              <NavLink to="/productos" className={navLinkClass}>
                <Package className="size-4" />
                Productos
              </NavLink>
              <NavLink to="/usuarios" className={navLinkClass}>
                <Users className="size-4" />
                Usuarios
              </NavLink>
              <NavLink to="/historial" className={navLinkClass}>
                <History className="size-4" />
                Historial
              </NavLink>
              <NavLink to="/configuracion" className={navLinkClass}>
                <Settings className="size-4" />
                Configuración
              </NavLink>
            </>
          )}
        </nav>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {user && <SetPinDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} user={user} />}
    </div>
  );
}
