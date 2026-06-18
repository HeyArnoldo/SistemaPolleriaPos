import { lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { ProtectedRoute } from '@/components/protected-route';
import { AppLayout } from '@/layouts/app-layout';
import { useMe } from '@/hooks/use-auth';
import { canAccessRoute, type RouteKey } from '@/lib/permissions';

// Auth pages — eager since they are the entry point
import LoginPage from '@/pages/login';

// POS pages — lazy loaded
const VentasPage = lazy(() => import('@/pages/ventas'));
const EgresosPage = lazy(() => import('@/pages/egresos'));
const CajaPage = lazy(() => import('@/pages/caja'));
const DashboardPage = lazy(() => import('@/pages/dashboard'));
const ProductosPage = lazy(() => import('@/pages/productos'));
const UsuariosPage = lazy(() => import('@/pages/usuarios'));
const ConfiguracionPage = lazy(() => import('@/pages/configuracion'));
const HistorialPage = lazy(() => import('@/pages/historial'));
const ClientesPage = lazy(() => import('@/pages/clientes'));

/** Redirects to /ventas if the user lacks access to the given route key. */
function RoleRoute({ route }: { route: RouteKey }) {
  const { data: user } = useMe();
  if (!canAccessRoute(user?.role, route)) {
    return <Navigate to="/ventas" replace />;
  }
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/ventas" replace /> },
          { path: 'ventas', element: <VentasPage /> },
          { path: 'egresos', element: <EgresosPage /> },
          {
            element: <RoleRoute route="caja" />,
            children: [{ path: 'caja', element: <CajaPage /> }],
          },
          {
            element: <RoleRoute route="dashboard" />,
            children: [{ path: 'dashboard', element: <DashboardPage /> }],
          },
          {
            element: <RoleRoute route="productos" />,
            children: [{ path: 'productos', element: <ProductosPage /> }],
          },
          {
            element: <RoleRoute route="usuarios" />,
            children: [{ path: 'usuarios', element: <UsuariosPage /> }],
          },
          {
            element: <RoleRoute route="configuracion" />,
            children: [{ path: 'configuracion', element: <ConfiguracionPage /> }],
          },
          {
            element: <RoleRoute route="historial" />,
            children: [{ path: 'historial', element: <HistorialPage /> }],
          },
          {
            element: <RoleRoute route="clientes" />,
            children: [{ path: 'clientes', element: <ClientesPage /> }],
          },
        ],
      },
    ],
  },
]);
