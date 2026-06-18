/**
 * Unit tests de entidades TypeORM del hub carbopuntos.
 * No requieren Postgres: solo verifican metadatos de columnas y relaciones.
 */
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';

import { Customer } from '../src/customers/entities/customer.entity';
import { PointsBalance } from '../src/points/entities/points-balance.entity';
import { PointsMovement } from '../src/points/entities/points-movement.entity';
import { AdminAudit } from '../src/audit/entities/admin-audit.entity';
import { SedeCredential } from '../src/auth/entities/sede-credential.entity';

describe('Entidades TypeORM del hub carbopuntos', () => {
  const storage = getMetadataArgsStorage();

  function tableNameOf(target: abstract new (...args: unknown[]) => unknown): string | undefined {
    return storage.tables.find((t) => t.target === target)?.name;
  }

  function columnsOf(target: abstract new (...args: unknown[]) => unknown): string[] {
    return storage.columns.filter((c) => c.target === target).map((c) => String(c.propertyName));
  }

  function uniquesOf(target: abstract new (...args: unknown[]) => unknown): string[][] {
    return storage.uniques.filter((u) => u.target === target).map((u) => u.columns as string[]);
  }

  // ── Customer ─────────────────────────────────────────────────────────────

  describe('Customer', () => {
    it('debe mapear a la tabla "customers"', () => {
      expect(tableNameOf(Customer)).toBe('customers');
    });

    it('debe tener todas las columnas requeridas', () => {
      const cols = columnsOf(Customer);
      expect(cols).toEqual(
        expect.arrayContaining([
          'id',
          'dni',
          'firstName',
          'lastName',
          'fullName',
          'phone',
          'consentAt',
          'isActive',
          'createdAt',
        ]),
      );
    });

    it('dni debe ser unique', () => {
      const uniques = uniquesOf(Customer);
      const flat = uniques.flat();
      expect(flat).toContain('dni');
    });
  });

  // ── PointsBalance ─────────────────────────────────────────────────────────

  describe('PointsBalance', () => {
    it('debe mapear a la tabla "points_balances"', () => {
      expect(tableNameOf(PointsBalance)).toBe('points_balances');
    });

    it('debe tener columna version para optimistic locking', () => {
      const cols = columnsOf(PointsBalance);
      expect(cols).toContain('version');
    });

    it('debe tener columna balance', () => {
      expect(columnsOf(PointsBalance)).toContain('balance');
    });

    it('customerId debe ser unique', () => {
      const uniques = uniquesOf(PointsBalance);
      const flat = uniques.flat();
      expect(flat).toContain('customerId');
    });
  });

  // ── PointsMovement ────────────────────────────────────────────────────────

  describe('PointsMovement', () => {
    it('debe mapear a la tabla "points_movements"', () => {
      expect(tableNameOf(PointsMovement)).toBe('points_movements');
    });

    it('debe tener todas las columnas del diseño', () => {
      const cols = columnsOf(PointsMovement);
      expect(cols).toEqual(
        expect.arrayContaining([
          'id',
          'customerId',
          'type',
          'points',
          'balanceBefore',
          'balanceAfter',
          'sede',
          'userRef',
          'saleRef',
          'detail',
          'idempotencyKey',
          'isVoided',
          'voidedBy',
          'voidedAt',
          'voidReason',
          'createdAt',
        ]),
      );
    });

    it('idempotencyKey debe ser unique', () => {
      const uniques = uniquesOf(PointsMovement);
      const flat = uniques.flat();
      expect(flat).toContain('idempotencyKey');
    });
  });

  // ── AdminAudit ────────────────────────────────────────────────────────────

  describe('AdminAudit', () => {
    it('debe mapear a la tabla "admin_audits"', () => {
      expect(tableNameOf(AdminAudit)).toBe('admin_audits');
    });

    it('debe tener todas las columnas del diseño', () => {
      const cols = columnsOf(AdminAudit);
      expect(cols).toEqual(
        expect.arrayContaining([
          'id',
          'action',
          'actorRef',
          'sede',
          'customerId',
          'movementId',
          'balanceBefore',
          'balanceAfter',
          'reason',
          'createdAt',
        ]),
      );
    });
  });

  // ── SedeCredential ────────────────────────────────────────────────────────

  describe('SedeCredential', () => {
    it('debe mapear a la tabla "sede_credentials"', () => {
      expect(tableNameOf(SedeCredential)).toBe('sede_credentials');
    });

    it('debe tener columnas id, sede, serviceKeyHash, isActive', () => {
      const cols = columnsOf(SedeCredential);
      expect(cols).toEqual(expect.arrayContaining(['id', 'sede', 'serviceKeyHash', 'isActive']));
    });

    it('sede debe ser unique', () => {
      const uniques = uniquesOf(SedeCredential);
      const flat = uniques.flat();
      expect(flat).toContain('sede');
    });
  });
});
