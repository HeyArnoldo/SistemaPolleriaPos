import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import type { Type } from '@nestjs/common';

import { AuthController } from './auth/auth.controller';
import { InventoryController } from './inventory/inventory.controller';
import { SalesController } from './sales/sales.controller';
import { PaymentMethodController } from './sales/payment-method.controller';
import { CashController } from './cash/cash.controller';
import { BIController } from './cash/bi.controller';
import { SettingsController } from './settings/settings.controller';
import { UsersController } from './users/users.controller';
import { HealthController } from './health/health.controller';

/**
 * Route-contract guard. These assertions lock the HTTP paths the frontend
 * depends on. A missing or wrong @Controller prefix (e.g. an empty
 * @Controller() that resolves routes to the wrong path) or a deleted route
 * makes the deployed app 404/400 — exactly the class of bug that left the POS
 * unusable. This test reads NestJS route metadata via reflection, so it needs
 * no database and runs in the normal unit suite.
 *
 * Paths here are controller-relative (the global '/api' prefix and the
 * '/health' exclusion are applied at app bootstrap, not on the controllers).
 */

const VERB: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
};

function basePath(controller: Type): string {
  const raw = (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ?? '';
  return normalize(raw);
}

function normalize(...segments: string[]): string {
  const parts = segments
    .flatMap((s) => s.split('/'))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '/');
  return '/' + parts.join('/');
}

/** Returns the set of "VERB /full/path" strings a controller registers. */
function routesOf(controller: Type): Set<string> {
  const base = basePath(controller);
  const proto = controller.prototype as Record<string, unknown>;
  const routes = new Set<string>();

  for (const name of Object.getOwnPropertyNames(proto)) {
    if (name === 'constructor') continue;
    const handler = proto[name];
    if (typeof handler !== 'function') continue;
    const methodPath = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
    if (methodPath === undefined) continue; // not a route handler
    const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
    const verb = VERB[method ?? RequestMethod.GET];
    routes.add(`${verb} ${normalize(base, methodPath)}`);
  }
  return routes;
}

describe('API route contract', () => {
  describe('controller base paths', () => {
    const cases: [Type, string][] = [
      [AuthController, '/auth'],
      [InventoryController, '/inventory'],
      [SalesController, '/sales'],
      [PaymentMethodController, '/payment-methods'],
      [CashController, '/cash'],
      [BIController, '/bi'],
      [SettingsController, '/settings'],
      [UsersController, '/users'],
      [HealthController, '/health'],
    ];

    it.each(cases)('%p is mounted at %s', (controller, expected) => {
      expect(basePath(controller)).toBe(expected);
    });
  });

  describe('critical routes the frontend depends on exist', () => {
    const expectations: [Type, string[]][] = [
      [AuthController, ['POST /auth/login', 'GET /auth/me', 'POST /auth/logout']],
      [
        InventoryController,
        [
          'GET /inventory/products',
          'GET /inventory/categories',
          'POST /inventory/products',
          'PATCH /inventory/products/:id',
          'POST /inventory/categories',
        ],
      ],
      [PaymentMethodController, ['GET /payment-methods', 'POST /payment-methods']],
      [
        SalesController,
        [
          'POST /sales',
          'GET /sales',
          'PATCH /sales/:id/cancel',
          'GET /sales/export/cash-report',
          'DELETE /sales/reset/all',
          'DELETE /sales/reset/date/:date',
        ],
      ],
      [
        CashController,
        [
          'GET /cash/expenses',
          'POST /cash/expenses/sync',
          'POST /cash/expenses',
          'GET /cash/dashboard',
          'DELETE /cash/expenses/:id',
        ],
      ],
      [
        BIController,
        ['GET /bi/summary', 'GET /bi/detail', 'GET /bi/commissions', 'GET /bi/trends'],
      ],
      [SettingsController, ['GET /settings', 'PATCH /settings']],
      [UsersController, ['GET /users', 'POST /users', 'PATCH /users/:id']],
      [HealthController, ['GET /health']],
    ];

    it.each(expectations)('%p exposes its expected routes', (controller, expectedRoutes) => {
      const actual = routesOf(controller);
      for (const route of expectedRoutes) {
        expect(actual).toContain(route);
      }
    });
  });
});
