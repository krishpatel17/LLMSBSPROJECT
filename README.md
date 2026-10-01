# LLMSBSPROJECT

Transaction history app. See the [project board](https://github.com/users/krishpatel17/projects/2) for work in progress.

## API

```bash
npm install
npm test
```

`GET /api/transactions?from=&to=&category=&q=&page=&limit=` (see `src/transactionsRoute.js`).

## Client

React app in [`client/`](client/), with its own `package.json`.

```bash
cd client
npm install
npm test        # Vitest + Testing Library
npm run dev     # Vite dev server
```

### Filter bar (`client/src/filters/`)

| Module | Purpose |
|---|---|
| `DateRangeFilter` | Start/end date inputs; end date is inclusive. Start after end shows an inline error and emits no change. |
| `CategoryFilter` | Dropdown: All, the user's categories, Uncategorized. |
| `SearchInput` | Description/merchant search, debounced 300ms. |
| `urlFilters` | `useUrlFilters()` keeps filters in the URL (`from`, `to`, `category`, `q`) so a refresh restores them. |
| `FilterBar` | Combines the above with a "Clear filters" button. |

```jsx
const [filters, setFilters] = useUrlFilters();
<FilterBar filters={filters} categories={categories} onChange={setFilters} />
```

URL params use the same names as the API's query params.

**Known gaps:**
- `category=uncategorized` is not supported by the API yet (it returns 400).
- There is no endpoint that lists a user's categories, so `categories` must be passed in.
