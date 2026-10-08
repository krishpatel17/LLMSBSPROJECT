import { useEffect, useRef, useState } from 'react';
import { formatCurrency, formatDate } from '../format.js';

export const EMPTY_MESSAGE = 'No transactions match your filters';

// Query string for GET /api/transactions; empty filters are left out.
export function transactionsUrl(filters, page = 1) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (page > 1) params.set('page', String(page));
  const qs = params.toString();
  return `/api/transactions${qs ? `?${qs}` : ''}`;
}

async function fetchPage(filters, page, signal) {
  const res = await fetch(transactionsUrl(filters, page), { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const INITIAL = { status: 'loading', rows: [], page: 0, total: 0, more: 'idle' };

// Transactions matching `filters` (as from useUrlFilters()), refetched whenever they change.
// Loads one page at a time; "Load more" appends the next.
export function TransactionList({ filters }) {
  const [state, setState] = useState(INITIAL);
  // One request in flight at a time: a filter change or "Load more" aborts whatever came before.
  // Results are also dropped if their signal was aborted, in case a response lands anyway.
  const controllerRef = useRef(null);

  function startRequest() {
    controllerRef.current?.abort();
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }

  useEffect(() => {
    const signal = startRequest();
    setState(INITIAL);
    fetchPage(filters, 1, signal).then(
      (body) => !signal.aborted && setState({ ...INITIAL, status: 'ready', rows: body.data, page: 1, total: body.total }),
      () => !signal.aborted && setState({ ...INITIAL, status: 'error' }),
    );
    return () => controllerRef.current.abort();
  }, [filters]);

  function loadMore() {
    if (state.more === 'loading') return;
    const signal = startRequest();
    const next = state.page + 1;
    setState((s) => ({ ...s, more: 'loading' }));
    fetchPage(filters, next, signal).then(
      (body) => !signal.aborted && setState((s) => {
        // Rows shift between pages if transactions are added meanwhile; skip ones already shown.
        const seen = new Set(s.rows.map((t) => t.id));
        return { ...s, rows: [...s.rows, ...body.data.filter((t) => !seen.has(t.id))], page: next, total: body.total, more: 'idle' };
      }),
      () => !signal.aborted && setState((s) => ({ ...s, more: 'error' })),
    );
  }

  if (state.status === 'loading') return <p role="status">Loading transactions…</p>;
  if (state.status === 'error') return <p role="alert">Couldn't load transactions. Please try again.</p>;
  if (state.rows.length === 0) return <p>{EMPTY_MESSAGE}</p>;

  return (
    <>
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Merchant</th>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {state.rows.map((t) => (
            <tr key={t.id}>
              <td>{formatDate(t.date)}</td>
              <td>{t.description}</td>
              <td>{t.merchant}</td>
              <td>{t.category ?? 'Uncategorized'}</td>
              <td>{formatCurrency(t.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {state.more === 'error' && <p role="alert">Couldn't load more transactions. Please try again.</p>}
      {state.rows.length < state.total && (
        <button type="button" onClick={loadMore} disabled={state.more === 'loading'}>
          {state.more === 'loading' ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  );
}
