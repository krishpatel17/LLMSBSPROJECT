import { useEffect, useId, useState } from 'react';

export const DATE_RANGE_ERROR = 'Start date must be on or before end date';

const isInvalid = ({ from, to }) => Boolean(from && to && from > to);

// Start/end date inputs (YYYY-MM-DD; end is inclusive).
// onChange({ from, to }) fires only for valid ranges, so an invalid range never triggers a request.
export function DateRangeFilter({ from = '', to = '', onChange }) {
  const id = useId();
  const [draft, setDraft] = useState({ from, to });

  // Follow the parent when it changes the values (e.g. "Clear filters").
  useEffect(() => setDraft({ from, to }), [from, to]);

  function update(field, value) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    if (!isInvalid(next)) onChange(next);
  }

  const invalid = isInvalid(draft);
  const errorId = `${id}-error`;
  return (
    <fieldset>
      <legend>Date range</legend>
      <label htmlFor={`${id}-from`}>Start date</label>
      <input
        id={`${id}-from`}
        type="date"
        value={draft.from}
        max={draft.to || undefined}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(e) => update('from', e.target.value)}
      />
      <label htmlFor={`${id}-to`}>End date</label>
      <input
        id={`${id}-to`}
        type="date"
        value={draft.to}
        min={draft.from || undefined}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(e) => update('to', e.target.value)}
      />
      {invalid && <p id={errorId} role="alert">{DATE_RANGE_ERROR}</p>}
    </fieldset>
  );
}
