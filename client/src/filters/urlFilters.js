import { useCallback, useState } from 'react';
import { UNCATEGORIZED } from './CategoryFilter.jsx';

// Same names as the GET /api/transactions query params.
export const EMPTY_FILTERS = Object.freeze({ from: '', to: '', category: '', q: '' });
const KEYS = Object.keys(EMPTY_FILTERS);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORY_RE = /^[1-9]\d*$/;

// Real calendar date in YYYY-MM-DD (rejects 2026-02-30).
function isValidDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Reads filters from a query string. Malformed values are dropped rather than sent to the API.
export function readFilters(search) {
  const params = new URLSearchParams(search);
  const get = (key) => params.get(key) ?? '';
  const filters = { ...EMPTY_FILTERS, q: get('q') };
  if (isValidDate(get('from'))) filters.from = get('from');
  if (isValidDate(get('to'))) filters.to = get('to');
  if (filters.from && filters.to && filters.from > filters.to) filters.from = filters.to = '';
  const category = get('category');
  if (CATEGORY_RE.test(category) || category === UNCATEGORIZED) filters.category = category;
  return filters;
}

// Returns `search` with the filter params replaced. Other params are kept, except
// `page`, which resets because the result set changed.
export function writeFilters(search, filters) {
  const params = new URLSearchParams(search);
  for (const key of [...KEYS, 'page']) params.delete(key);
  for (const key of KEYS) if (filters[key]) params.set(key, filters[key]);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

// Filter state backed by the URL, so a refresh or shared link restores it.
// Uses replaceState so each keystroke doesn't add a history entry.
export function useUrlFilters() {
  const [filters, setState] = useState(() => readFilters(window.location.search));
  const setFilters = useCallback((next) => {
    setState(next);
    const { pathname, search, hash } = window.location;
    window.history.replaceState(window.history.state, '', `${pathname}${writeFilters(search, next)}${hash}`);
  }, []);
  return [filters, setFilters];
}
