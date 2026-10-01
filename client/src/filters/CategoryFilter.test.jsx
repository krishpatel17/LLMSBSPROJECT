import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CategoryFilter, ALL_CATEGORIES, UNCATEGORIZED } from './CategoryFilter.jsx';

const categories = [{ id: 1, name: 'Food' }, { id: 2, name: 'Travel' }];
const select = () => screen.getByLabelText('Category');

describe('CategoryFilter', () => {
  test('lists All, every category, then Uncategorized', () => {
    render(<CategoryFilter categories={categories} onChange={() => {}} />);
    const options = screen.getAllByRole('option').map((o) => [o.textContent, o.value]);
    expect(options).toEqual([
      ['All', ALL_CATEGORIES],
      ['Food', '1'],
      ['Travel', '2'],
      ['Uncategorized', UNCATEGORIZED],
    ]);
  });

  test('defaults to All', () => {
    render(<CategoryFilter categories={categories} onChange={() => {}} />);
    expect(select()).toHaveDisplayValue('All');
  });

  test('shows the selected value', () => {
    render(<CategoryFilter categories={categories} value="2" onChange={() => {}} />);
    expect(select()).toHaveDisplayValue('Travel');
  });

  test('calls onChange with the category id', async () => {
    const onChange = vi.fn();
    render(<CategoryFilter categories={categories} onChange={onChange} />);
    await userEvent.selectOptions(select(), 'Travel');
    expect(onChange).toHaveBeenCalledExactlyOnceWith('2');
  });

  test('calls onChange with UNCATEGORIZED and back to All', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<CategoryFilter categories={categories} onChange={onChange} />);
    await userEvent.selectOptions(select(), 'Uncategorized');
    expect(onChange).toHaveBeenLastCalledWith(UNCATEGORIZED);
    rerender(<CategoryFilter categories={categories} value={UNCATEGORIZED} onChange={onChange} />);
    await userEvent.selectOptions(select(), 'All');
    expect(onChange).toHaveBeenLastCalledWith(ALL_CATEGORIES);
  });

  test('is keyboard reachable', async () => {
    render(<CategoryFilter categories={categories} onChange={() => {}} />);
    await userEvent.tab();
    expect(select()).toHaveFocus();
  });

  test('works with no categories loaded yet', () => {
    render(<CategoryFilter onChange={() => {}} />);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['All', 'Uncategorized']);
  });
});
