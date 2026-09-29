export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Real calendar date in YYYY-MM-DD (rejects 2026-02-30, 2026-13-01).
function isValidDate(s) {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parsePositiveInt(s) {
  const n = /^[1-9]\d*$/.test(s) ? Number(s) : NaN;
  return Number.isSafeInteger(n) ? n : null;
}

// Validates raw query params. Returns { filters } or { error }.
export function parseFilters(query = {}) {
  const { from, to, category, q } = query;
  const filters = { page: 1, limit: DEFAULT_LIMIT };

  for (const [name, value] of Object.entries({ from, to, category, q, page: query.page, limit: query.limit })) {
    if (value !== undefined && typeof value !== 'string') return { error: `'${name}' must be a single value` };
  }

  if (from !== undefined) {
    if (!isValidDate(from)) return { error: "'from' must be a valid date (YYYY-MM-DD)" };
    filters.from = from;
  }
  if (to !== undefined) {
    if (!isValidDate(to)) return { error: "'to' must be a valid date (YYYY-MM-DD)" };
    filters.to = to;
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    return { error: "'from' must be on or before 'to'" };
  }
  if (category !== undefined) {
    filters.category = parsePositiveInt(category);
    if (filters.category === null) return { error: "'category' must be a positive integer id" };
  }
  if (q !== undefined && q.trim() !== '') filters.q = q.trim();

  if (query.page !== undefined) {
    filters.page = parsePositiveInt(query.page);
    if (filters.page === null) return { error: "'page' must be a positive integer" };
  }
  if (query.limit !== undefined) {
    filters.limit = parsePositiveInt(query.limit);
    if (filters.limit === null || filters.limit > MAX_LIMIT) {
      return { error: `'limit' must be an integer from 1 to ${MAX_LIMIT}` };
    }
  }
  // Offset must stay a safe integer (also within SQLite's int64).
  if ((filters.page - 1) * filters.limit > Number.MAX_SAFE_INTEGER) {
    return { error: "'page' is too large" };
  }
  return { filters };
}

// Escape LIKE wildcards so user text matches literally.
function escapeLike(s) {
  return s.replace(/[\\%_]/g, '\\$&');
}

// Builds the WHERE clause; always scoped to userId. Values go in params, never in SQL text.
export function buildWhere(userId, filters) {
  const clauses = ['t.user_id = ?'];
  const params = [userId];
  if (filters.from) { clauses.push('t.date >= ?'); params.push(filters.from); }
  if (filters.to) { clauses.push('t.date <= ?'); params.push(filters.to); }
  if (filters.category) { clauses.push('t.category_id = ?'); params.push(filters.category); }
  if (filters.q) {
    const like = `%${escapeLike(filters.q)}%`;
    // SQLite LIKE is case-insensitive for ASCII.
    clauses.push("(t.description LIKE ? ESCAPE '\\' OR t.merchant LIKE ? ESCAPE '\\')");
    params.push(like, like);
  }
  return { where: clauses.join(' AND '), params };
}
