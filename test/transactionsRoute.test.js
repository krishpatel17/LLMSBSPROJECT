import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

let server, base;

before(async () => {
  const db = openDb();
  db.exec(`
    INSERT INTO categories (id, name) VALUES (1, 'Food'), (2, 'Travel');
    INSERT INTO transactions (user_id, date, amount, description, merchant, category_id) VALUES
      (1, '2026-01-05', -450,  'Morning coffee',   'Blue Bottle', 1),
      (1, '2026-01-20', -12000,'Flight to NYC',    'Delta',       2),
      (1, '2026-01-31', -2300, 'Groceries',        'Trader Joes', 1),
      (1, '2026-02-01', -800,  '50% off lunch',    'Chipotle',    1),
      (1, '2026-02-10', -600,  'COFFEE beans',     'Target',      NULL),
      (2, '2026-01-10', -999,  'Other user coffee','Starbucks',   1);
  `);
  // Test auth: X-Test-User header stands in for a real session.
  const authenticate = (req, _res, next) => {
    const id = Number(req.get('X-Test-User'));
    if (id) req.user = { id };
    next();
  };
  server = createApp({ db, authenticate }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/transactions`;
});

after(() => server.close());

async function get(qs = '', user = 1) {
  const res = await fetch(`${base}${qs}`, { headers: user ? { 'X-Test-User': String(user) } : {} });
  return { status: res.status, body: await res.json() };
}
const descs = (body) => body.data.map((t) => t.description);

test('requires authentication', async () => {
  assert.equal((await get('', null)).status, 401);
});

test('no filters: only own transactions, newest first', async () => {
  const { status, body } = await get();
  assert.equal(status, 200);
  assert.equal(body.total, 5);
  assert.deepEqual(descs(body), ['COFFEE beans', '50% off lunch', 'Groceries', 'Flight to NYC', 'Morning coffee']);
  assert.ok(!descs(body).includes('Other user coffee'));
});

test('date range is inclusive', async () => {
  const { body } = await get('?from=2026-01-05&to=2026-01-31');
  assert.deepEqual(descs(body), ['Groceries', 'Flight to NYC', 'Morning coffee']);
});

test('category filter', async () => {
  const { body } = await get('?category=2');
  assert.deepEqual(descs(body), ['Flight to NYC']);
  assert.equal(body.data[0].category, 'Travel');
});

test('search is case-insensitive across description and merchant', async () => {
  assert.deepEqual(descs((await get('?q=coffee')).body), ['COFFEE beans', 'Morning coffee']);
  assert.deepEqual(descs((await get('?q=delta')).body), ['Flight to NYC']);
});

test('search treats % and _ literally', async () => {
  assert.deepEqual(descs((await get('?q=50%25')).body), ['50% off lunch']);
  assert.equal((await get('?q=_')).body.total, 0);
});

test('filters combine with AND', async () => {
  const { body } = await get('?from=2026-01-01&to=2026-01-31&category=1&q=coffee');
  assert.deepEqual(descs(body), ['Morning coffee']);
});

test('no matches returns 200 with empty list', async () => {
  const { status, body } = await get('?q=nothing-matches');
  assert.equal(status, 200);
  assert.deepEqual(body, { data: [], page: 1, limit: 25, total: 0 });
});

test('pagination', async () => {
  const p1 = (await get('?limit=2&page=1')).body;
  const p3 = (await get('?limit=2&page=3')).body;
  assert.deepEqual(descs(p1), ['COFFEE beans', '50% off lunch']);
  assert.deepEqual(descs(p3), ['Morning coffee']);
  assert.equal(p3.total, 5);
});

test('invalid input returns 400', async () => {
  for (const qs of ['?from=2026-02-01&to=2026-01-01', '?from=bad', '?category=abc', '?category=99', '?limit=500', '?page=0']) {
    const { status, body } = await get(qs);
    assert.equal(status, 400, qs);
    assert.ok(body.error, qs);
  }
});

test('SQL injection attempt is harmless', async () => {
  const { status, body } = await get(`?q=${encodeURIComponent("' OR 1=1 --")}`);
  assert.equal(status, 200);
  assert.equal(body.total, 0);
});
