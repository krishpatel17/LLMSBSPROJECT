import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFilters, buildWhere, DEFAULT_LIMIT } from '../src/transactionFilters.js';

test('no params gives defaults', () => {
  assert.deepEqual(parseFilters({}), { filters: { page: 1, limit: DEFAULT_LIMIT } });
});

test('parses all filters', () => {
  const { filters } = parseFilters({ from: '2026-01-01', to: '2026-01-31', category: '3', q: ' Coffee ', page: '2', limit: '10' });
  assert.deepEqual(filters, { from: '2026-01-01', to: '2026-01-31', category: 3, q: 'Coffee', page: 2, limit: 10 });
});

test('from equal to to is allowed', () => {
  assert.ok(parseFilters({ from: '2026-01-01', to: '2026-01-01' }).filters);
});

test('rejects bad input', () => {
  const bad = [
    { from: '2026-02-01', to: '2026-01-01' },
    { from: '01/02/2026' },
    { to: '2026-02-30' },
    { category: 'food' },
    { category: '0' },
    { page: '0' },
    { limit: '101' },
    { limit: '-5' },
    { from: ['2026-01-01', '2026-01-02'] },
  ];
  for (const query of bad) assert.ok(parseFilters(query).error, JSON.stringify(query));
});

test('blank search is ignored', () => {
  assert.equal(parseFilters({ q: '   ' }).filters.q, undefined);
});

test('where clause is always user-scoped and parameterized', () => {
  const { where, params } = buildWhere(7, { from: '2026-01-01', to: '2026-01-31', category: 2, q: "50%_off'" });
  assert.match(where, /^t\.user_id = \?/);
  assert.ok(!where.includes('50%'), 'user text must not be in SQL');
  assert.deepEqual(params, [7, '2026-01-01', '2026-01-31', 2, "%50\\%\\_off'%", "%50\\%\\_off'%"]);
});
