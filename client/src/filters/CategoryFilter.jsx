import { useId } from 'react';

export const ALL_CATEGORIES = '';
export const UNCATEGORIZED = 'uncategorized';

// Category dropdown: "All", the user's categories, then "Uncategorized".
// Values are strings: ALL_CATEGORIES, a category id, or UNCATEGORIZED.
export function CategoryFilter({ categories = [], value = ALL_CATEGORIES, onChange }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>Category</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={ALL_CATEGORIES}>All</option>
        {categories.map((c) => (
          <option key={c.id} value={String(c.id)}>{c.name}</option>
        ))}
        <option value={UNCATEGORIZED}>Uncategorized</option>
      </select>
    </div>
  );
}
