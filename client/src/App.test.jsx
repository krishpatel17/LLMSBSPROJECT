import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from './App.jsx';

test('renders the page heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
});
