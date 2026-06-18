import { describe, it, expect, vi } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import { FINANCIAL_QUERY_ROOTS, invalidateFinancialQueries } from '@/hooks/query-keys';

describe('FINANCIAL_QUERY_ROOTS', () => {
  it('contains all 7 expected financial query root keys', () => {
    const roots = FINANCIAL_QUERY_ROOTS.map((r) => r[0]);
    expect(roots).toContain('sales');
    expect(roots).toContain('expenses');
    expect(roots).toContain('cash-dashboard');
    expect(roots).toContain('bi-summary');
    expect(roots).toContain('bi-detail');
    expect(roots).toContain('bi-commissions');
    expect(roots).toContain('bi-trends');
    expect(FINANCIAL_QUERY_ROOTS).toHaveLength(7);
  });
});

describe('invalidateFinancialQueries', () => {
  it('calls invalidateQueries once per FINANCIAL_QUERY_ROOTS entry', () => {
    const invalidateQueries = vi.fn();
    const fakeQc = { invalidateQueries } as unknown as QueryClient;

    invalidateFinancialQueries(fakeQc);

    expect(invalidateQueries).toHaveBeenCalledTimes(FINANCIAL_QUERY_ROOTS.length);
  });

  it('calls invalidateQueries with the correct queryKey for each root', () => {
    const invalidateQueries = vi.fn();
    const fakeQc = { invalidateQueries } as unknown as QueryClient;

    invalidateFinancialQueries(fakeQc);

    const calledWith = invalidateQueries.mock.calls.map((call) => call[0]);

    expect(calledWith).toContainEqual({ queryKey: ['sales'] });
    expect(calledWith).toContainEqual({ queryKey: ['expenses'] });
    expect(calledWith).toContainEqual({ queryKey: ['cash-dashboard'] });
    expect(calledWith).toContainEqual({ queryKey: ['bi-summary'] });
    expect(calledWith).toContainEqual({ queryKey: ['bi-detail'] });
    expect(calledWith).toContainEqual({ queryKey: ['bi-commissions'] });
    expect(calledWith).toContainEqual({ queryKey: ['bi-trends'] });
  });

  it('does not throw even if invalidateQueries returns a rejected promise', () => {
    const invalidateQueries = vi.fn().mockRejectedValue(new Error('network error'));
    const fakeQc = { invalidateQueries } as unknown as QueryClient;

    expect(() => invalidateFinancialQueries(fakeQc)).not.toThrow();
  });
});
