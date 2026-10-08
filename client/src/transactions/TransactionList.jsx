import { useEffect, useState } from 'react';
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

// Transactions matching `filters` (as from useUrlFilters()), refetched whenever they change.
export function TransactionList({ filters }) {
  const [state, setState] = useState({ status: 'loading', rows: [] });

  useEffect(() => {
    setState({ status: 'loading', rows: [] });
    fetchPage(filters, 1).then(
      (body) => setState({ status: 'ready', rows: body.data }),
      () => setState({ status: 'error', rows: [] }),
    );
  }, [filters]);

  if (state.status === 'loading') return <p role="status">Loading transactions…</p>;
  if (state.status === 'error') return <p role="alert">Couldn't load transactions. Please try again.</p>;
  if (state.rows.length === 0) return <p>{EMPTY_MESSAGE}</p>;

  return (
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
  );
}
