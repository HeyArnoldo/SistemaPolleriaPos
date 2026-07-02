/**
 * WU2 — LoginLockoutAlert entity metadata.
 * Verifies table name, PK type, column names, types, nullable contracts,
 * and absence of UpdateDateColumn (append-only evidence log).
 */
import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { LoginLockoutAlert } from './login-lockout-alert.entity';

describe('LoginLockoutAlert entity', () => {
  const storage = getMetadataArgsStorage();

  it('maps to the login_lockout_alert table', () => {
    const table = storage.tables.find((t) => t.target === LoginLockoutAlert);
    expect(table?.name).toBe('login_lockout_alert');
  });

  it('has a uuid primary key (id)', () => {
    const pk = storage.generations.find(
      (g) => g.target === LoginLockoutAlert && g.propertyName === 'id',
    );
    expect(pk?.strategy).toBe('uuid');
  });

  it('has a non-nullable username column (varchar 255)', () => {
    const col = storage.columns.find(
      (c) => c.target === LoginLockoutAlert && c.propertyName === 'username',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBeFalsy();
    expect(col?.options.length).toBe(255);
  });

  it('has a nullable sede column (varchar 50)', () => {
    const col = storage.columns.find(
      (c) => c.target === LoginLockoutAlert && c.propertyName === 'sede',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
    expect(col?.options.length).toBe(50);
  });

  it('has a nullable ipAddress column (varchar 45)', () => {
    const col = storage.columns.find(
      (c) => c.target === LoginLockoutAlert && c.propertyName === 'ipAddress',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBe(true);
    expect(col?.options.length).toBe(45);
  });

  it('has a non-nullable failureCount column (int)', () => {
    const col = storage.columns.find(
      (c) => c.target === LoginLockoutAlert && c.propertyName === 'failureCount',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBeFalsy();
    expect(col?.options.type).toBe('int');
  });

  it('has a non-nullable channel column (varchar 30)', () => {
    const col = storage.columns.find(
      (c) => c.target === LoginLockoutAlert && c.propertyName === 'channel',
    );
    expect(col).toBeDefined();
    expect(col?.options.nullable).toBeFalsy();
    expect(col?.options.length).toBe(30);
  });

  it('has a createdAt column (timestamptz) but NO updatedAt', () => {
    const created = storage.columns.find(
      (c) => c.target === LoginLockoutAlert && c.propertyName === 'createdAt',
    );
    expect(created).toBeDefined();
    expect(created?.options.type).toBe('timestamptz');

    const updated = storage.columns.find(
      (c) => c.target === LoginLockoutAlert && c.propertyName === 'updatedAt',
    );
    expect(updated).toBeUndefined();
  });
});
