import { useState } from 'react';
import { DateRangeFilter } from './DateRangeFilter.jsx';
import { CategoryFilter } from './CategoryFilter.jsx';
import { SearchInput } from './SearchInput.jsx';
import { EMPTY_FILTERS } from './urlFilters.js';

// Date range + category + search. Controlled: onChange(filters) gets the full, combined filters.
// Pair with useUrlFilters() to keep them in the URL.
export function FilterBar({ filters, categories, onChange }) {
  // Remounting the inputs on clear also drops drafts the parent never saw
  // (an invalid date range, a search still waiting on its debounce).
  const [resetKey, setResetKey] = useState(0);
  const update = (patch) => onChange({ ...filters, ...patch });

  function clear() {
    setResetKey((k) => k + 1);
    onChange(EMPTY_FILTERS);
  }

  return (
    <div role="search" aria-label="Filter transactions" key={resetKey}>
      <DateRangeFilter from={filters.from} to={filters.to} onChange={update} />
      <CategoryFilter categories={categories} value={filters.category} onChange={(category) => update({ category })} />
      <SearchInput value={filters.q} onChange={(q) => update({ q })} />
      <button type="button" onClick={clear}>Clear filters</button>
    </div>
  );
}
