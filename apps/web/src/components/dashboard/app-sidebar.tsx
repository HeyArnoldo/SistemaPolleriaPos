import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut } from 'lucide-react';
import { useLogout, useMe } from '@/hooks/use-auth';
import { useOfflineAuth } from '@/contexts/offline-auth-context';
import { canAccessRoute } from '@/lib/permissions';
import { SetPinDialog } from '@/components/auth/set-pin-dialog';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

const ALL_MENU_ITEMS = [
  { title: 'Ventas', path: '/ventas', icon: '💳', routeKey: 'ventas' as const },
  { title: 'Caja', path: '/caja', icon: '💰', routeKey: 'caja' as const },
  { title: 'Egresos', path: '/egresos', icon: '💵', routeKey: 'egresos' as const },
  { title: 'Productos', path: '/productos', icon: '📦', routeKey: 'productos' as const },
  { title: 'Usuarios', path: '/usuarios', icon: '👥', routeKey: 'usuarios' as const },
  {
    title: 'Configuración',
    path: '/configuracion',
    icon: '⚙️',
    routeKey: 'configuracion' as const,
  },
  { title: 'Historial', path: '/historial', icon: '📊', routeKey: 'historial' as const },
];

const OFFLINE_ALLOWED: string[] = ['/ventas', '/egresos'];

export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: user } = useMe();
  const logout = useLogout();
  const { isOfflineMode } = useOfflineAuth();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login') });
  };

  const userName = user?.profile
    ? `${user.profile.firstName} ${user.profile.lastName}`
    : (user?.username ?? 'Usuario');

  const visibleItems = ALL_MENU_ITEMS.filter((item) => {
    if (isOfflineMode) return OFFLINE_ALLOWED.includes(item.path);
    return canAccessRoute(user?.role, item.routeKey);
  });

  return (
    <>
      <Sidebar className="text-white">
        <SidebarHeader>
          <NavLink to="/dashboard" className="p-4 border-b border-slate-700">
            <h1 className="font-bold text-slate-100 text-lg">POS</h1>
            <p className="text-xs text-slate-400 font-medium">POLLERÍA D' CARBÓN</p>
          </NavLink>
        </SidebarHeader>

        <SidebarContent className="p-2">
          {!isOfflineMode && canAccessRoute(user?.role, 'dashboard') && (
            <NavLink to="/dashboard">
              <SidebarMenuButton
                isActive={pathname === '/dashboard'}
                className="px-5 py-5 text-slate-100"
              >
                🏠
                <span className="ml-2">Inicio</span>
              </SidebarMenuButton>
            </NavLink>
          )}

          {visibleItems.map((item) => (
            <NavLink to={item.path} key={item.path}>
              <SidebarMenuButton
                isActive={pathname === item.path}
                className="px-5 py-5 text-slate-100"
              >
                {item.icon}
                <span className="ml-2">{item.title}</span>
              </SidebarMenuButton>
            </NavLink>
          ))}
        </SidebarContent>

        <SidebarFooter className="gap-3 p-3">
          <div className="border-t border-slate-700" />
          <div className="px-1">
            <p className="text-xs text-slate-400">Usuario</p>
            <p className="truncate text-sm font-semibold text-white">{userName}</p>
          </div>
          {!isOfflineMode && user && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 px-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              onClick={() => setPinDialogOpen(true)}
            >
              <KeyRound className="size-3.5" />
              Configurar PIN sin conexión
            </Button>
          )}
          <Button
            variant="destructive"
            className="h-10 w-full"
            onClick={handleLogout}
            disabled={logout.isPending}
          >
            <LogOut className="mr-2 size-4" />
            {logout.isPending ? 'Cerrando sesión...' : 'Cerrar sesión'}
          </Button>
        </SidebarFooter>
      </Sidebar>

      {user && <SetPinDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} user={user} />}
    </>
  );
}
