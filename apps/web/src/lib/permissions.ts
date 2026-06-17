import { UserRole } from '@app/contracts';

export type RouteKey =
  | 'dashboard'
  | 'ventas'
  | 'caja'
  | 'egresos'
  | 'historial'
  | 'productos'
  | 'usuarios'
  | 'configuracion';

export type ActionKey =
  | 'products:read'
  | 'products:write'
  | 'categories:read'
  | 'categories:write'
  | 'users:read'
  | 'users:write'
  | 'paymentMethods:read'
  | 'paymentMethods:write';

const ROUTE_ACCESS: Record<RouteKey, UserRole[]> = {
  dashboard: [UserRole.Admin],
  ventas: [UserRole.Admin, UserRole.Cashier],
  caja: [UserRole.Admin],
  egresos: [UserRole.Admin, UserRole.Cashier],
  historial: [UserRole.Admin],
  productos: [UserRole.Admin],
  usuarios: [UserRole.Admin],
  configuracion: [UserRole.Admin],
};

const ACTION_ACCESS: Record<ActionKey, UserRole[]> = {
  'products:read': [UserRole.Admin],
  'products:write': [UserRole.Admin],
  'categories:read': [UserRole.Admin],
  'categories:write': [UserRole.Admin],
  'users:read': [UserRole.Admin],
  'users:write': [UserRole.Admin],
  'paymentMethods:read': [UserRole.Admin],
  'paymentMethods:write': [UserRole.Admin],
};

export const canAccessRoute = (role: UserRole | undefined, route: RouteKey): boolean =>
  !!role && ROUTE_ACCESS[route].includes(role);

export const canAccessAction = (role: UserRole | undefined, action: ActionKey): boolean =>
  !!role && ACTION_ACCESS[action].includes(role);
