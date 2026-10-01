import { useEffect, useId, useRef, useState } from 'react';

export const SEARCH_DEBOUNCE_MS = 300;

// Keyword search over description/merchant. onChange(text) fires once typing pauses for `delay` ms.
export function SearchInput({ value = '', onChange, delay = SEARCH_DEBOUNCE_MS }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Follow the parent when it changes the value (e.g. "Clear filters"), without firing onChange.
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value);
  }

  useEffect(() => {
    if (text === value) return;
    const timer = setTimeout(() => onChangeRef.current(text), delay);
    return () => clearTimeout(timer);
  }, [text, value, delay]);

  return (
    <div>
      <label htmlFor={id}>Search</label>
      <input
        id={id}
        type="search"
        placeholder="Description or merchant"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </div>
  );
}
