import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { TransactionList } from './TransactionList.jsx';
import { EMPTY_FILTERS } from '../filters/urlFilters.js';

const coffee = { id: 1, date: '2026-01-05', amount: -450, description: 'Latte', merchant: 'Blue Bottle', categoryId: 1, category: 'Food' };
const refund = { id: 2, date: '2026-01-03', amount: 12000, description: 'Refund', merchant: 'Delta', categoryId: null, category: null };

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function page(data, { page = 1, limit = 25, total = data.length } = {}) {
  return jsonResponse({ data, page, limit, total });
}

// A fetch whose responses the test resolves by hand, in any order.
function controlledFetch() {
  const calls = [];
  const fetch = vi.fn((url, { signal } = {}) => new Promise((resolve, reject) => {
    const call = { url: new URL(url, 'http://localhost'), signal, resolve, reject };
    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    calls.push(call);
  }));
  return { fetch, calls };
}

beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(page([coffee, refund])))));
afterEach(() => vi.unstubAllGlobals());

describe('TransactionList states', () => {
  test('shows a loading state while the request is in flight', () => {
    const { fetch } = controlledFetch();
    vi.stubGlobal('fetch', fetch);
    render(<TransactionList filters={EMPTY_FILTERS} />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
  });

  test('requests GET /api/transactions with the current filters', () => {
    render(<TransactionList filters={{ from: '2026-01-01', to: '2026-01-31', category: '2', q: 'flight' }} />);
    const url = new URL(fetch.mock.calls[0][0], 'http://localhost');
    expect(url.pathname).toBe('/api/transactions');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ from: '2026-01-01', to: '2026-01-31', category: '2', q: 'flight' });
  });

  test('omits empty filters from the request', () => {
    render(<TransactionList filters={EMPTY_FILTERS} />);
    const url = new URL(fetch.mock.calls[0][0], 'http://localhost');
    for (const key of ['from', 'to', 'category', 'q']) expect(url.searchParams.has(key)).toBe(false);
  });

  test('renders a row per transaction with formatted date and amount', async () => {
    render(<TransactionList filters={EMPTY_FILTERS} />);
    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2
    expect(rows[1]).toHaveTextContent('Jan 5, 2026');
    expect(rows[1]).toHaveTextContent('Latte');
    expect(rows[1]).toHaveTextContent('Blue Bottle');
    expect(rows[1]).toHaveTextContent('Food');
    expect(rows[1]).toHaveTextContent('-$4.50');
    expect(rows[2]).toHaveTextContent('$120.00');
    expect(rows[2]).toHaveTextContent('Uncategorized');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('shows the empty message when no transactions match', async () => {
    fetch.mockImplementation(() => Promise.resolve(page([])));
    render(<TransactionList filters={{ ...EMPTY_FILTERS, q: 'nothing' }} />);
    expect(await screen.findByText('No transactions match your filters')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  test('shows an error (not the empty message) when the API fails', async () => {
    fetch.mockImplementation(() => Promise.resolve(jsonResponse({ error: "'from' must be on or before 'to'" }, 400)));
    render(<TransactionList filters={EMPTY_FILTERS} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load transactions/i);
    expect(screen.queryByText('No transactions match your filters')).not.toBeInTheDocument();
  });

  test('shows an error when the network request rejects', async () => {
    fetch.mockImplementation(() => Promise.reject(new TypeError('Failed to fetch')));
    render(<TransactionList filters={EMPTY_FILTERS} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load transactions/i);
  });

  test('refetches when filters change', async () => {
    const { rerender } = render(<TransactionList filters={EMPTY_FILTERS} />);
    await screen.findAllByRole('row');
    fetch.mockImplementation(() => Promise.resolve(page([])));
    rerender(<TransactionList filters={{ ...EMPTY_FILTERS, category: '1' }} />);
    expect(await screen.findByText('No transactions match your filters')).toBeInTheDocument();
    expect(new URL(fetch.mock.calls.at(-1)[0], 'http://localhost').searchParams.get('category')).toBe('1');
  });
});

describe('TransactionList stale responses', () => {
  test('aborts the previous request when filters change', () => {
    const { fetch, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetch);
    const { rerender } = render(<TransactionList filters={{ ...EMPTY_FILTERS, q: 'c' }} />);
    rerender(<TransactionList filters={{ ...EMPTY_FILTERS, q: 'coffee' }} />);
    expect(calls).toHaveLength(2);
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].signal.aborted).toBe(false);
  });

  test('a slow response for old filters never replaces the newer results', async () => {
    // Ignores the abort signal, like a server that answers anyway.
    const pending = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => pending.push(resolve))));
    const { rerender } = render(<TransactionList filters={{ ...EMPTY_FILTERS, q: 'c' }} />);
    rerender(<TransactionList filters={{ ...EMPTY_FILTERS, q: 'coffee' }} />);

    await act(async () => pending[1](page([coffee])));
    expect(screen.getByText('Latte')).toBeInTheDocument();

    await act(async () => pending[0](page([refund])));
    expect(screen.getByText('Latte')).toBeInTheDocument();
    expect(screen.queryByText('Refund')).not.toBeInTheDocument();
  });

  test('an aborted request does not show the error state', async () => {
    const { fetch, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetch);
    const { rerender } = render(<TransactionList filters={{ ...EMPTY_FILTERS, q: 'c' }} />);
    rerender(<TransactionList filters={{ ...EMPTY_FILTERS, q: 'coffee' }} />);
    await act(async () => calls[1].resolve(page([coffee])));
    expect(screen.getByText('Latte')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('aborts the in-flight request on unmount', () => {
    const { fetch, calls } = controlledFetch();
    vi.stubGlobal('fetch', fetch);
    const { unmount } = render(<TransactionList filters={EMPTY_FILTERS} />);
    unmount();
    expect(calls[0].signal.aborted).toBe(true);
  });
});
