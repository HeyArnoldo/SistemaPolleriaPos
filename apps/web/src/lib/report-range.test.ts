import { describe, it, expect } from 'vitest';
import { formatRangeLabel, dateRangeToParams } from './report-range';

// Tests for report-range helpers.
// Note: the DateRangePicker dialog (cash-report-card.tsx) relies on these
// functions to build the display label and the API params. Mounting the full
// component would require @testing-library/react which is not installed, so we
// cover the logic layer directly — this is where the interesting behaviour lives.

describe('formatRangeLabel', () => {
  it('returns placeholder when range is undefined', () => {
    expect(formatRangeLabel(undefined)).toBe('Seleccionar rango');
  });

  it('returns placeholder when range has no from date', () => {
    expect(formatRangeLabel({ from: undefined, to: undefined })).toBe('Seleccionar rango');
  });

  it('returns a single date when from and to are the same day', () => {
    const date = new Date(2026, 5, 15); // 15 Jun 2026
    const label = formatRangeLabel({ from: date, to: date });
    expect(label).toBe('15/06/2026');
  });

  it('returns a range label when from and to differ', () => {
    const from = new Date(2026, 5, 1);
    const to = new Date(2026, 5, 17);
    const label = formatRangeLabel({ from, to });
    expect(label).toBe('01/06/2026 - 17/06/2026');
  });

  it('returns only the from date when to is missing', () => {
    const from = new Date(2026, 5, 10);
    const label = formatRangeLabel({ from, to: undefined });
    expect(label).toBe('10/06/2026');
  });
});

describe('dateRangeToParams', () => {
  it('returns null when range is undefined', () => {
    expect(dateRangeToParams(undefined)).toBeNull();
  });

  it('returns null when range has no from date', () => {
    expect(dateRangeToParams({ from: undefined, to: undefined })).toBeNull();
  });

  it('uses from as to when to is missing', () => {
    const from = new Date(2026, 5, 1, 12, 0, 0);
    const result = dateRangeToParams({ from, to: undefined });
    expect(result).not.toBeNull();
    expect(result!.startDate).toMatch(/^2026-06-01/);
    expect(result!.endDate).toMatch(/^2026-06-01/);
  });

  it('produces startDate at start-of-day and endDate at end-of-day', () => {
    const from = new Date(2026, 5, 1);
    const to = new Date(2026, 5, 17);
    const result = dateRangeToParams({ from, to });
    expect(result).not.toBeNull();
    // startDate should be at midnight (T00:00:00)
    expect(result!.startDate).toContain('T00:00:00');
    // endDate should be at end of day (T23:59:59)
    expect(result!.endDate).toContain('T23:59:59');
    expect(result!.startDate).toContain('2026-06-01');
    expect(result!.endDate).toContain('2026-06-17');
  });

  it('a valid complete range enables export (from && to both truthy)', () => {
    const from = new Date(2026, 5, 1);
    const to = new Date(2026, 5, 17);
    const result = dateRangeToParams({ from, to });
    // This mirrors the export guard: !customRange?.from || !customRange?.to
    const exportEnabled = result !== null && Boolean(result.startDate) && Boolean(result.endDate);
    expect(exportEnabled).toBe(true);
  });
});
