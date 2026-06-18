/**
 * T6.13 (web side) — buildTicketHtml renders CARBOPUNTOS block
 * with Antes / Operación / Ahora when sale has carbopuntos data.
 *
 * Scenarios:
 * 1. Sale with carbopuntos (online, confirmed) → block shows Antes/Op/Ahora.
 * 2. Sale with carbopuntos pending → block shows pending message.
 * 3. Sale without carbopuntos → no CARBOPUNTOS section.
 * 4. Sale with carbopuntos but no customerName → block shown without name line.
 */
import { describe, it, expect } from 'vitest';
import { buildTicketHtml } from '@/lib/ticket';
import type { Sale } from '@/types/models';
import type { PrintSettings } from '@/lib/print-settings';

const defaultSettings: PrintSettings = {
  ticketWidthMm: 80,
  paddingTopMm: 3,
  paddingXMm: 2,
  paddingBottomMm: 5,
  fontScale: 1,
  previewBeforePrint: false,
  heightOffsetMm: 0,
  debugMode: false,
};

const baseSale: Sale = {
  id: 1,
  saleNumber: 'SALE-001',
  items: [
    {
      id: 1,
      productId: 1,
      quantity: 2,
      unitPrice: 10,
      subtotal: 20,
      product: {
        id: 1,
        name: 'Pollo a la Brasa',
        price: 10,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        category: { id: 1, name: 'Pollos', createdAt: '', updatedAt: '' },
      },
    },
  ],
  payments: [
    {
      id: 1,
      paymentMethodId: 1,
      amount: 20,
      paymentMethod: {
        id: 1,
        name: 'Efectivo',
        commissionPercentage: 0,
        requiresTransferTime: false,
        isActive: true,
        createdAt: '',
        updatedAt: '',
      },
    },
  ],
  totalAmount: 20,
  subtotal: 20,
  createdAt: '2024-01-01T12:00:00Z',
};

// ---------------------------------------------------------------------------
// T1: confirmed online → block with Antes / Operación / Ahora
// ---------------------------------------------------------------------------

describe('buildTicketHtml — CARBOPUNTOS block', () => {
  it('T1: renders Antes/Operación/Ahora when carbopuntos is confirmed (pending: false)', () => {
    const sale: Sale = {
      ...baseSale,
      carbopuntos: {
        customerName: 'Juan Perez',
        pointsBefore: 100,
        pointsEarned: 10,
        pointsAfter: 110,
        pending: false,
      },
    };

    const html = buildTicketHtml(sale, defaultSettings);

    expect(html).toContain('CARBOPUNTOS');
    expect(html).toContain('Juan Perez');
    expect(html).toContain('100'); // pointsBefore
    expect(html).toContain('+10'); // pointsEarned
    expect(html).toContain('110'); // pointsAfter
    // Should NOT show pending message
    expect(html).not.toContain('reconect');
  });

  it('T1b: renders Antes/Op/Ahora with redemption when pointsRedeemed present', () => {
    const sale: Sale = {
      ...baseSale,
      carbopuntos: {
        customerName: 'Ana Torres',
        pointsBefore: 200,
        pointsEarned: 10,
        pointsRedeemed: 50,
        pointsAfter: 160,
        pending: false,
      },
    };

    const html = buildTicketHtml(sale, defaultSettings);

    expect(html).toContain('CARBOPUNTOS');
    expect(html).toContain('200'); // before
    expect(html).toContain('+10'); // earned
    expect(html).toContain('-50'); // redeemed
    expect(html).toContain('160'); // after
  });

  // -------------------------------------------------------------------------
  // T2: pending → shows pending message
  // -------------------------------------------------------------------------

  it('T2: shows pending message when carbopuntos.pending is true', () => {
    const sale: Sale = {
      ...baseSale,
      carbopuntos: {
        customerName: 'Carlos Gomez',
        pointsEarned: 10,
        pending: true,
      },
    };

    const html = buildTicketHtml(sale, defaultSettings);

    expect(html).toContain('CARBOPUNTOS');
    // Should show that points will be credited on reconnect
    expect(html).toMatch(/reconect|pendiente/i);
    // Should show how many points are pending
    expect(html).toContain('10');
  });

  // -------------------------------------------------------------------------
  // T3: no carbopuntos → no block
  // -------------------------------------------------------------------------

  it('T3: does not render CARBOPUNTOS section when carbopuntos is absent', () => {
    const sale: Sale = { ...baseSale };

    const html = buildTicketHtml(sale, defaultSettings);

    expect(html).not.toContain('CARBOPUNTOS');
  });

  it('T3b: does not render CARBOPUNTOS section when carbopuntos is null', () => {
    const sale: Sale = { ...baseSale, carbopuntos: null };

    const html = buildTicketHtml(sale, defaultSettings);

    expect(html).not.toContain('CARBOPUNTOS');
  });

  // -------------------------------------------------------------------------
  // T4: carbopuntos without customerName → block shown without name line
  // -------------------------------------------------------------------------

  it('T4: renders block without customer name when customerName is absent', () => {
    const sale: Sale = {
      ...baseSale,
      carbopuntos: {
        pointsBefore: 50,
        pointsEarned: 5,
        pointsAfter: 55,
        pending: false,
      },
    };

    const html = buildTicketHtml(sale, defaultSettings);

    expect(html).toContain('CARBOPUNTOS');
    expect(html).toContain('50');
    expect(html).toContain('+5');
    expect(html).toContain('55');
  });
});
