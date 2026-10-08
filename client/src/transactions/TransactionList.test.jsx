import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('TransactionList load more', () => {
  const rowsFor = (start, n) => Array.from({ length: n }, (_, i) => ({ ...coffee, id: start + i, description: `Txn ${start + i}` }));
  const pageParam = (call) => new URL(call[0], 'http://localhost').searchParams.get('page');

  test('shows "Load more" only while more results remain', async () => {
    fetch.mockImplementationOnce(() => Promise.resolve(page(rowsFor(1, 25), { total: 30 })));
    render(<TransactionList filters={EMPTY_FILTERS} />);
    expect(await screen.findByRole('button', { name: 'Load more' })).toBeInTheDocument();
  });

  test('hides "Load more" when everything is loaded', async () => {
    render(<TransactionList filters={EMPTY_FILTERS} />);
    await screen.findAllByRole('row');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  test('loads the next page with the same filters and appends it', async () => {
    fetch
      .mockImplementationOnce(() => Promise.resolve(page(rowsFor(1, 25), { total: 30 })))
      .mockImplementationOnce(() => Promise.resolve(page(rowsFor(26, 5), { page: 2, total: 30 })));
    render(<TransactionList filters={{ ...EMPTY_FILTERS, q: 'txn' }} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    await screen.findByText('Txn 30');
    expect(screen.getAllByRole('row')).toHaveLength(31); // header + 30
    expect(screen.getByText('Txn 1')).toBeInTheDocument();
    const second = new URL(fetch.mock.calls[1][0], 'http://localhost');
    expect(second.searchParams.get('page')).toBe('2');
    expect(second.searchParams.get('q')).toBe('txn');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  test('keeps rows visible and blocks repeat clicks while the next page loads', async () => {
    const { fetch: slow, calls } = controlledFetch();
    vi.stubGlobal('fetch', slow);
    render(<TransactionList filters={EMPTY_FILTERS} />);
    await act(async () => calls[0].resolve(page(rowsFor(1, 25), { total: 60 })));

    const button = screen.getByRole('button', { name: 'Load more' });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(calls).toHaveLength(2);
    expect(button).toBeDisabled();
    expect(screen.getByText('Txn 1')).toBeInTheDocument();
  });

  test('a failed next page keeps loaded rows and can be retried', async () => {
    fetch
      .mockImplementationOnce(() => Promise.resolve(page(rowsFor(1, 25), { total: 30 })))
      .mockImplementationOnce(() => Promise.resolve(jsonResponse({ error: 'boom' }, 500)))
      .mockImplementationOnce(() => Promise.resolve(page(rowsFor(26, 5), { page: 2, total: 30 })));
    render(<TransactionList filters={EMPTY_FILTERS} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load more/i);
    expect(screen.getByText('Txn 1')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByText('Txn 30');
    expect(pageParam(fetch.mock.calls[2])).toBe('2');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('changing filters during "Load more" aborts it and starts over at page 1', async () => {
    const { fetch: slow, calls } = controlledFetch();
    vi.stubGlobal('fetch', slow);
    const { rerender } = render(<TransactionList filters={EMPTY_FILTERS} />);
    await act(async () => calls[0].resolve(page(rowsFor(1, 25), { total: 60 })));
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    rerender(<TransactionList filters={{ ...EMPTY_FILTERS, q: 'refund' }} />);
    expect(calls[1].signal.aborted).toBe(true);
    expect(calls[2].url.searchParams.has('page')).toBe(false);
    await act(async () => calls[2].resolve(page([refund])));
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Refund')).toBeInTheDocument();
  });

  test('a large result set fetches one page at a time', async () => {
    fetch.mockImplementation(() => Promise.resolve(page(rowsFor(1, 25), { total: 100000 })));
    render(<TransactionList filters={EMPTY_FILTERS} />);
    await screen.findByRole('button', { name: 'Load more' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('row')).toHaveLength(26);
  });
});
