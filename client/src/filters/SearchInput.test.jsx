import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SearchInput, SEARCH_DEBOUNCE_MS } from './SearchInput.jsx';

const input = () => screen.getByLabelText('Search');
const type = (value) => fireEvent.change(input(), { target: { value } });
const wait = (ms) => act(() => vi.advanceTimersByTime(ms));

describe('SearchInput', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('renders a labeled search input with the initial value', () => {
    render(<SearchInput value="coffee" onChange={() => {}} />);
    expect(input()).toHaveAttribute('type', 'search');
    expect(input()).toHaveValue('coffee');
  });

  test('debounces: rapid typing fires onChange once with the final text', () => {
    const onChange = vi.fn();
    render(<SearchInput onChange={onChange} />);
    type('c');
    wait(100);
    type('co');
    wait(100);
    type('cof');
    wait(SEARCH_DEBOUNCE_MS - 1);
    expect(onChange).not.toHaveBeenCalled();
    wait(1);
    expect(onChange).toHaveBeenCalledExactlyOnceWith('cof');
  });

  test('shows typed text immediately, before the debounce', () => {
    render(<SearchInput onChange={() => {}} />);
    type('coffee');
    expect(input()).toHaveValue('coffee');
  });

  test('clearing the text fires onChange with an empty string', () => {
    const onChange = vi.fn();
    render(<SearchInput value="coffee" onChange={onChange} />);
    type('');
    wait(SEARCH_DEBOUNCE_MS);
    expect(onChange).toHaveBeenCalledExactlyOnceWith('');
  });

  test('typing back to the current value does not fire', () => {
    const onChange = vi.fn();
    render(<SearchInput value="coffee" onChange={onChange} />);
    type('coffe');
    type('coffee');
    wait(SEARCH_DEBOUNCE_MS);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('parent value change updates the input, cancels pending search, and does not fire', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SearchInput value="coffee" onChange={onChange} />);
    type('coffee beans');
    rerender(<SearchInput value="" onChange={onChange} />);
    expect(input()).toHaveValue('');
    wait(SEARCH_DEBOUNCE_MS);
    expect(onChange).not.toHaveBeenCalled();
  });

  test('unmounting cancels a pending search', () => {
    const onChange = vi.fn();
    const { unmount } = render(<SearchInput onChange={onChange} />);
    type('coffee');
    unmount();
    wait(SEARCH_DEBOUNCE_MS);
    expect(onChange).not.toHaveBeenCalled();
  });
});
