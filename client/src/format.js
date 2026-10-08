// Shared display formatting. Reuse these rather than formatting inline, so every view agrees.

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
// API dates are UTC calendar dates, so format in UTC to avoid shifting by a day.
const date = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

// Integer cents → "$1,234.50" / "-$4.50".
export function formatCurrency(cents) {
  return currency.format(cents / 100);
}

// "2026-01-05" → "Jan 5, 2026".
export function formatDate(ymd) {
  return date.format(new Date(`${ymd}T00:00:00Z`));
}
