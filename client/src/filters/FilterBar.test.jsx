import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar.jsx';
import { EMPTY_FILTERS, useUrlFilters } from './urlFilters.js';
import { SEARCH_DEBOUNCE_MS } from './SearchInput.jsx';

const categories = [{ id: 1, name: 'Food' }, { id: 2, name: 'Travel' }];

function renderBar(filters = EMPTY_FILTERS) {
  const onChange = vi.fn();
  render(<FilterBar filters={filters} categories={categories} onChange={onChange} />);
  return onChange;
}

// FilterBar wired to the URL, as the page will use it.
function UrlFilterBar({ onFilters = () => {} }) {
  const [filters, setFilters] = useUrlFilters();
  onFilters(filters);
  return <FilterBar filters={filters} categories={categories} onChange={setFilters} />;
}

describe('FilterBar', () => {
  beforeEach(() => window.history.replaceState(null, '', '/transactions'));

  test('renders labeled date pickers, category dropdown, search input, and clear button', () => {
    renderBar();
    expect(screen.getByRole('search', { name: 'Filter transactions' })).toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toBeInTheDocument();
    expect(screen.getByLabelText('End date')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
  });

  test('selecting a category emits the category param, keeping other filters', async () => {
    const onChange = renderBar({ ...EMPTY_FILTERS, from: '2026-01-01', q: 'coffee' });
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Travel');
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '2026-01-01', to: '', category: '2', q: 'coffee' });
  });

  test('filters combine: date + category + search', () => {
    vi.useFakeTimers();
    try {
      const onChange = renderBar({ ...EMPTY_FILTERS, from: '2026-01-01', category: '1' });
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'coffee' } });
      act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '2026-01-01', to: '', category: '1', q: 'coffee' });
    } finally {
      vi.useRealTimers();
    }
  });

  test('typing in search emits one change after the debounce', () => {
    vi.useFakeTimers();
    try {
      const onChange = renderBar();
      for (const value of ['c', 'co', 'cof', 'coffee']) {
        fireEvent.change(screen.getByLabelText('Search'), { target: { value } });
        act(() => vi.advanceTimersByTime(50));
      }
      act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS));
      expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...EMPTY_FILTERS, q: 'coffee' });
    } finally {
      vi.useRealTimers();
    }
  });

  test('invalid date range shows an error and emits nothing', () => {
    const onChange = renderBar({ ...EMPTY_FILTERS, to: '2026-01-31' });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-01' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  test('clear emits empty filters', async () => {
    const onChange = renderBar({ from: '2026-01-01', to: '2026-01-31', category: '1', q: 'coffee' });
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(EMPTY_FILTERS);
  });

  test('clear resets drafts the parent never received (invalid dates, pending search)', async () => {
    // Filters stay empty (onChange is a mock), so only clearing can reset these inputs.
    const onChange = renderBar();
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-31' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'coff' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onChange).toHaveBeenLastCalledWith(EMPTY_FILTERS);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Start date')).toHaveValue('');
    expect(screen.getByLabelText('End date')).toHaveValue('');
    expect(screen.getByLabelText('Search')).toHaveValue('');
  });

  test('controls are reachable by keyboard in order', async () => {
    renderBar();
    const order = ['Start date', 'End date', 'Category', 'Search'].map((l) => screen.getByLabelText(l));
    order.push(screen.getByRole('button', { name: 'Clear filters' }));
    for (const el of order) {
      await userEvent.tab();
      expect(el).toHaveFocus();
    }
  });

  test('Clear filters works from the keyboard', async () => {
    const onChange = renderBar({ ...EMPTY_FILTERS, q: 'coffee' });
    screen.getByRole('button', { name: 'Clear filters' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(EMPTY_FILTERS);
  });

  describe('with URL params', () => {
    test('page loads with filters pre-filled from the URL', () => {
      window.history.replaceState(null, '', '/transactions?from=2026-01-01&to=2026-01-31&category=2&q=flight');
      render(<UrlFilterBar />);
      expect(screen.getByLabelText('Start date')).toHaveValue('2026-01-01');
      expect(screen.getByLabelText('End date')).toHaveValue('2026-01-31');
      expect(screen.getByLabelText('Category')).toHaveDisplayValue('Travel');
      expect(screen.getByLabelText('Search')).toHaveValue('flight');
    });

    test('changing a filter updates the URL', async () => {
      render(<UrlFilterBar />);
      await userEvent.selectOptions(screen.getByLabelText('Category'), 'Food');
      expect(window.location.search).toBe('?category=1');
    });

    test('clear filters resets inputs and URL params', async () => {
      window.history.replaceState(null, '', '/transactions?from=2026-01-01&category=2&q=flight');
      const onFilters = vi.fn();
      render(<UrlFilterBar onFilters={onFilters} />);
      await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(window.location.search).toBe('');
      expect(onFilters).toHaveBeenLastCalledWith(EMPTY_FILTERS);
      expect(screen.getByLabelText('Start date')).toHaveValue('');
      expect(screen.getByLabelText('Category')).toHaveDisplayValue('All');
      expect(screen.getByLabelText('Search')).toHaveValue('');
    });
  });
});
