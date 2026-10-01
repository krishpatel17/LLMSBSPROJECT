import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangeFilter, DATE_RANGE_ERROR } from './DateRangeFilter.jsx';

const start = () => screen.getByLabelText('Start date');
const end = () => screen.getByLabelText('End date');

describe('DateRangeFilter', () => {
  test('renders labeled start and end date inputs with initial values', () => {
    render(<DateRangeFilter from="2026-01-01" to="2026-01-31" onChange={() => {}} />);
    expect(start()).toHaveAttribute('type', 'date');
    expect(start()).toHaveValue('2026-01-01');
    expect(end()).toHaveValue('2026-01-31');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('calls onChange with both dates when one changes', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter to="2026-01-31" onChange={onChange} />);
    fireEvent.change(start(), { target: { value: '2026-01-05' } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '2026-01-05', to: '2026-01-31' });
  });

  test('same start and end date is a valid (inclusive) range', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter from="2026-01-05" onChange={onChange} />);
    fireEvent.change(end(), { target: { value: '2026-01-05' } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '2026-01-05', to: '2026-01-05' });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('start after end shows an inline error and does not call onChange', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter to="2026-01-31" onChange={onChange} />);
    fireEvent.change(start(), { target: { value: '2026-02-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent(DATE_RANGE_ERROR);
    expect(start()).toHaveAttribute('aria-invalid', 'true');
    expect(start()).toHaveAccessibleDescription(DATE_RANGE_ERROR);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('fixing an invalid range clears the error and calls onChange', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter to="2026-01-31" onChange={onChange} />);
    fireEvent.change(start(), { target: { value: '2026-02-01' } });
    fireEvent.change(end(), { target: { value: '2026-02-28' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '2026-02-01', to: '2026-02-28' });
  });

  test('clearing a date is allowed', () => {
    const onChange = vi.fn();
    render(<DateRangeFilter from="2026-01-01" to="2026-01-31" onChange={onChange} />);
    fireEvent.change(start(), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ from: '', to: '2026-01-31' });
  });

  test('resets to new values from the parent, dropping an invalid draft', () => {
    const { rerender } = render(<DateRangeFilter from="2026-01-01" to="2026-01-31" onChange={() => {}} />);
    fireEvent.change(start(), { target: { value: '2026-03-01' } });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    rerender(<DateRangeFilter from="" to="" onChange={() => {}} />);
    expect(start()).toHaveValue('');
    expect(end()).toHaveValue('');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
