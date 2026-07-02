/**
 * T1.1 — LoginAudit entity metadata.
 * Verifies table name, PK type, column names, and nullable contracts.
 */
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { LoginAudit } from './login-audit.entity';

describe('LoginAudit entity', () => {
  const storage = getMetadataArgsStorage();

  it('maps to the login_audit table', () => {
    const table = storage.tables.find((t) => t.target === LoginAudit);
    expect(table?.name).toBe('login_audit');
  });

  it('has a uuid primary key (id)', () => {
    const pk = storage.generations.find((g) => g.target === LoginAudit && g.propertyName === 'id');
    expect(pk?.strategy).toBe('uuid');
  });

  it('has a non-nullable username column (varchar 255)', () => {
    const col = storage.columns.find(
      (c) => c.target === LoginAudit && c.propertyName === 'username',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBeFalsy();
    expect(col?.options.length).toBe(255);
  });

  it('has a non-nullable outcome column (varchar 20)', () => {
    const col = storage.columns.find(
      (c) => c.target === LoginAudit && c.propertyName === 'outcome',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBeFalsy();
  });

  it('has a nullable reason column', () => {
    const col = storage.columns.find((c) => c.target === LoginAudit && c.propertyName === 'reason');
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has a nullable userId column (int, not a FK)', () => {
    const col = storage.columns.find((c) => c.target === LoginAudit && c.propertyName === 'userId');
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
    expect(col?.options.type).toBe('int');
    // Must NOT be a relation (no FK)
    const relation = storage.relations.find(
      (r) => r.target === LoginAudit && r.propertyName === 'userId',
    );
    expect(relation).toBeUndefined();
  });

  it('has a nullable ipAddress column', () => {
    const col = storage.columns.find(
      (c) => c.target === LoginAudit && c.propertyName === 'ipAddress',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has a nullable userAgent column', () => {
    const col = storage.columns.find(
      (c) => c.target === LoginAudit && c.propertyName === 'userAgent',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has a nullable sede column', () => {
    const col = storage.columns.find((c) => c.target === LoginAudit && c.propertyName === 'sede');
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
  });

  it('has a createdAt column (timestamptz) but NO updatedAt', () => {
    const created = storage.columns.find(
      (c) => c.target === LoginAudit && c.propertyName === 'createdAt',
    );
    expect(created).toBeDefined();
    expect(created?.options.type).toBe('timestamptz');

    // No UpdateDateColumn
    const updated = storage.columns.find(
      (c) => c.target === LoginAudit && c.propertyName === 'updatedAt',
    );
    expect(updated).toBeUndefined();
  });
});
