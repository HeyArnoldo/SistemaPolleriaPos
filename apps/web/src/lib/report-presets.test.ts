import { describe, it, expect } from 'vitest';
import { getReportDateParams } from './report-presets';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Regression guard for the cash report. The presets must emit date-only
 * (YYYY-MM-DD) bounds so the API expands them to the full GMT-5 Lima day.
 * Emitting offset-less datetimes (e.g. "...T23:59:59") got read as UTC
 * server-side and cut the report ~5h early, hiding evening sales.
 */
describe('getReportDateParams', () => {
  it('emits date-only bounds (no time component)', () => {
    const { startDate, endDate } = getReportDateParams('today');
    expect(startDate).toMatch(DATE_ONLY);
    expect(endDate).toMatch(DATE_ONLY);
  });

  it('today is a single day (start === end)', () => {
    const { startDate, endDate } = getReportDateParams('today');
    expect(startDate).toBe(endDate);
  });

  it('last7 spans 7 calendar days inclusive', () => {
    const { startDate, endDate } = getReportDateParams('last7');
    expect(startDate).toMatch(DATE_ONLY);
    expect(endDate).toMatch(DATE_ONLY);
    const diffDays =
      (new Date(`${endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) /
      86_400_000;
    expect(diffDays).toBe(6);
    expect(new Date(startDate) <= new Date(endDate)).toBe(true);
  });

  it('custom range uses the picked calendar days as date-only', () => {
    const { startDate, endDate } = getReportDateParams('custom', {
      from: new Date(2026, 5, 1), // 1 Jun 2026 (local)
      to: new Date(2026, 5, 17), // 17 Jun 2026 (local)
    });
    expect(startDate).toBe('2026-06-01');
    expect(endDate).toBe('2026-06-17');
  });
});
