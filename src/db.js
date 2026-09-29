import { DatabaseSync } from 'node:sqlite';

// Minimal schema so the API has something to query.
// Issue #2 owns schema changes (indexes, category migration); coordinate there before editing.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  date        TEXT    NOT NULL, -- UTC calendar date, YYYY-MM-DD
  amount      INTEGER NOT NULL, -- cents
  description TEXT    NOT NULL DEFAULT '',
  merchant    TEXT    NOT NULL DEFAULT '',
  category_id INTEGER REFERENCES categories(id)
);
`;

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}
