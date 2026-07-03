/**
 * Tests para CarbopuntosInfoCard — verifican que los datos del programa
 * (reglas de puntos, premios y valor del QR) sean correctos y completos.
 *
 * El ambiente de tests es Node (sin DOM), por lo que se testea la lógica
 * de datos exportada por el módulo, no el render del componente React.
 * El componente se verifica visualmente en desarrollo y en los tests e2e.
 */
import { describe, it, expect } from 'vitest';
import {
  CARBOPUNTOS_QR_VALUE,
  POINTS_RULES,
  REWARDS_CATALOG,
} from './carbopuntos-info-card';

// ─── QR value ─────────────────────────────────────────────────────────────────

describe('CARBOPUNTOS_QR_VALUE', () => {
  it('tiene un valor no vacío configurado como contenido del QR', () => {
    expect(CARBOPUNTOS_QR_VALUE).toBeTruthy();
    expect(typeof CARBOPUNTOS_QR_VALUE).toBe('string');
    expect(CARBOPUNTOS_QR_VALUE.length).toBeGreaterThan(0);
  });
});

// ─── Reglas de acumulación ────────────────────────────────────────────────────

describe('POINTS_RULES', () => {
  it('contiene las 4 porciones de pollo con sus puntos correctos', () => {
    expect(POINTS_RULES).toHaveLength(4);
  });

  it('1/8 pollo → 5 puntos', () => {
    const rule = POINTS_RULES.find((r) => r.product === '1/8 pollo');
    expect(rule).toBeDefined();
    expect(rule?.points).toBe(5);
  });

  it('1/4 pollo → 10 puntos', () => {
    const rule = POINTS_RULES.find((r) => r.product === '1/4 pollo');
    expect(rule).toBeDefined();
    expect(rule?.points).toBe(10);
  });

  it('1/2 pollo → 15 puntos', () => {
    const rule = POINTS_RULES.find((r) => r.product === '1/2 pollo');
    expect(rule).toBeDefined();
    expect(rule?.points).toBe(15);
  });

  it('Pollo entero → 20 puntos', () => {
    const rule = POINTS_RULES.find((r) => r.product === 'Pollo entero');
    expect(rule).toBeDefined();
    expect(rule?.points).toBe(20);
  });

  it('todos los puntos son números positivos', () => {
    for (const rule of POINTS_RULES) {
      expect(rule.points).toBeGreaterThan(0);
    }
  });
});

// ─── Catálogo de premios ──────────────────────────────────────────────────────

describe('REWARDS_CATALOG', () => {
  it('contiene los 5 premios del catálogo de arranque', () => {
    expect(REWARDS_CATALOG).toHaveLength(5);
  });

  it('Gaseosa 1 LT → 100 puntos', () => {
    const reward = REWARDS_CATALOG.find((r) => r.name === 'Gaseosa 1 LT');
    expect(reward).toBeDefined();
    expect(reward?.costPoints).toBe(100);
  });

  it('Jarra de limonada → 140 puntos', () => {
    const reward = REWARDS_CATALOG.find((r) => r.name === 'Jarra de limonada');
    expect(reward).toBeDefined();
    expect(reward?.costPoints).toBe(140);
  });

  it('Jarra de chicha → 170 puntos', () => {
    const reward = REWARDS_CATALOG.find((r) => r.name === 'Jarra de chicha');
    expect(reward).toBeDefined();
    expect(reward?.costPoints).toBe(170);
  });

  it('1/8 pollo gratis → 200 puntos', () => {
    const reward = REWARDS_CATALOG.find((r) => r.name === '1/8 pollo gratis');
    expect(reward).toBeDefined();
    expect(reward?.costPoints).toBe(200);
  });

  it('Pollo entero gratis → 400 puntos', () => {
    const reward = REWARDS_CATALOG.find((r) => r.name === 'Pollo entero gratis');
    expect(reward).toBeDefined();
    expect(reward?.costPoints).toBe(400);
  });

  it('todos los costos son números positivos', () => {
    for (const reward of REWARDS_CATALOG) {
      expect(reward.costPoints).toBeGreaterThan(0);
    }
  });

  it('los premios están ordenados de menor a mayor costo', () => {
    const costs = REWARDS_CATALOG.map((r) => r.costPoints);
    const sorted = [...costs].sort((a, b) => a - b);
    expect(costs).toEqual(sorted);
  });
});
