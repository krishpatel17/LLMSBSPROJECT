import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { readFilters, writeFilters, useUrlFilters, EMPTY_FILTERS } from './urlFilters.js';

describe('readFilters', () => {
  test('empty query gives empty filters', () => {
    expect(readFilters('')).toEqual(EMPTY_FILTERS);
  });

  test('reads all filters', () => {
    expect(readFilters('?from=2026-01-01&to=2026-01-31&category=2&q=coffee+beans')).toEqual({
      from: '2026-01-01', to: '2026-01-31', category: '2', q: 'coffee beans',
    });
  });

  test('accepts uncategorized', () => {
    expect(readFilters('?category=uncategorized').category).toBe('uncategorized');
  });

  test('drops malformed values', () => {
    expect(readFilters('?from=yesterday&to=2026-1-5&category=0&q=')).toEqual(EMPTY_FILTERS);
    expect(readFilters('?category=abc').category).toBe('');
    expect(readFilters('?from=2026-02-30&to=2026-13-01')).toEqual(EMPTY_FILTERS);
  });

  test('drops an inverted date range', () => {
    expect(readFilters('?from=2026-02-01&to=2026-01-01')).toEqual(EMPTY_FILTERS);
  });
});

describe('writeFilters', () => {
  test('writes only non-empty filters', () => {
    expect(writeFilters('', { ...EMPTY_FILTERS, category: '2', q: 'a&b' })).toBe('?category=2&q=a%26b');
  });

  test('empty filters remove all filter params', () => {
    expect(writeFilters('?from=2026-01-01&q=x', EMPTY_FILTERS)).toBe('');
  });

  test('keeps unrelated params and resets page', () => {
    expect(writeFilters('?view=compact&page=3&q=old', { ...EMPTY_FILTERS, q: 'new' })).toBe('?view=compact&q=new');
  });

  test('round-trips through readFilters', () => {
    const filters = { from: '2026-01-01', to: '2026-01-31', category: 'uncategorized', q: '50% off' };
    expect(readFilters(writeFilters('', filters))).toEqual(filters);
  });
});

describe('useUrlFilters', () => {
  beforeEach(() => window.history.replaceState(null, '', '/transactions'));

  test('initial state comes from the URL (restored on refresh)', () => {
    window.history.replaceState(null, '', '/transactions?category=1&q=coffee');
    const { result } = renderHook(() => useUrlFilters());
    expect(result.current[0]).toEqual({ ...EMPTY_FILTERS, category: '1', q: 'coffee' });
  });

  test('setFilters updates state and URL without adding history entries', () => {
    const { result } = renderHook(() => useUrlFilters());
    const before = window.history.length;
    act(() => result.current[1]({ ...EMPTY_FILTERS, from: '2026-01-01' }));
    expect(result.current[0].from).toBe('2026-01-01');
    expect(window.location.pathname).toBe('/transactions');
    expect(window.location.search).toBe('?from=2026-01-01');
    expect(window.history.length).toBe(before);
  });

  test('clearing removes the params from the URL', () => {
    window.history.replaceState(null, '', '/transactions?q=coffee#top');
    const { result } = renderHook(() => useUrlFilters());
    act(() => result.current[1](EMPTY_FILTERS));
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#top');
  });
});
