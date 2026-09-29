import { Router } from 'express';
import { parseFilters, buildWhere } from './transactionFilters.js';

// GET /api/transactions?from=&to=&category=&q=&page=&limit=
export function transactionsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });

    const { filters, error } = parseFilters(req.query);
    if (error) return res.status(400).json({ error });

    if (filters.category && !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(filters.category)) {
      return res.status(400).json({ error: `Unknown category ${filters.category}` });
    }

    const { where, params } = buildWhere(req.user.id, filters);
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM transactions t WHERE ${where}`).get(...params);
    const data = db.prepare(`
      SELECT t.id, t.date, t.amount, t.description, t.merchant,
             t.category_id AS categoryId, c.name AS category
      FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      WHERE ${where}
      ORDER BY t.date DESC, t.id DESC
      LIMIT ? OFFSET ?`).all(...params, filters.limit, (filters.page - 1) * filters.limit);

    res.json({ data, page: filters.page, limit: filters.limit, total });
  });

  return router;
}
