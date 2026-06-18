import { resolveRangeStart, resolveRangeEnd } from './services/cash.service';

/**
 * Regression guard for the expenses list. The web sends a date-only filter
 * (startDate === endDate === 'YYYY-MM-DD'). A naive `new Date('2026-06-17')`
 * is UTC midnight, so a same-day from/to range was zero-width and hid every
 * expense of the day. The resolver must expand date-only bounds to the full
 * GMT-5 (America/Lima) day.
 */
describe('expense date range resolution', () => {
  it('expands a date-only same-day filter to a full GMT-5 day (not zero-width)', () => {
    const start = resolveRangeStart('2026-06-17');
    const end = resolveRangeEnd('2026-06-17');
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    // Lima midnight = 05:00 UTC; end of day = next day 04:59:59.999 UTC.
    expect(start!.toISOString()).toBe('2026-06-17T05:00:00.000Z');
    expect(end!.toISOString()).toBe('2026-06-18T04:59:59.999Z');
    // The range spans ~24h, so an expense created any time that Lima day matches.
    const spanMs = end!.getTime() - start!.getTime();
    expect(spanMs).toBeGreaterThan(23 * 60 * 60 * 1000);
  });

  it('returns null for missing bounds (no filter → return all)', () => {
    expect(resolveRangeStart(undefined)).toBeNull();
    expect(resolveRangeEnd(undefined)).toBeNull();
  });

  it('uses full datetimes as-is', () => {
    const start = resolveRangeStart('2026-06-17T08:30:00.000-05:00');
    expect(start!.toISOString()).toBe('2026-06-17T13:30:00.000Z');
  });

  it('returns null for invalid date strings', () => {
    expect(resolveRangeStart('not-a-date')).toBeNull();
  });
});
