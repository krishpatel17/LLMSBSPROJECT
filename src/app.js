import express from 'express';
import { transactionsRouter } from './transactionsRoute.js';

// `authenticate` must set req.user = { id } for signed-in users; there is no auth system yet.
export function createApp({ db, authenticate }) {
  const app = express();
  app.use(authenticate);
  app.use('/api/transactions', transactionsRouter(db));
  return app;
}
