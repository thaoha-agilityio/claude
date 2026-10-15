# Expense Tracker

A small client-side expense tracker built with React + TypeScript. Data lives in the browser's `localStorage`; there is no backend.

See [SPEC.md](SPEC.md) for the MVP scope.

## Features (MVP)

- **Expenses** (`/`): add, edit and delete expenses (amount, date, category, notes). The list shows one month at a time, newest first, with the month's total.
- **Categories** (`/categories`): add, rename and delete. A category that is still used by expenses cannot be deleted.
- **Reports** (`/reports`): monthly total and a per-category breakdown (count, amount, share).

Out of scope: budgeting, Excel export, sharing.

## Conventions

- **Currency:** VND, stored as a positive integer (no decimals). Displayed as `1.250.000 ₫`.
- **Dates:** expense dates are calendar strings `YYYY-MM-DD`, so they never shift across time zones. "Today" is computed in `Asia/Ho_Chi_Minh`. `createdAt`/`updatedAt` are UTC ISO timestamps.
- **Storage:** a single versioned key, `expense-tracker:v1` → `{ version, categories, expenses }`. Missing or corrupt data falls back to seeded default categories (Food, Transport, Housing, Utilities, Shopping, Health, Entertainment, Other).

## Getting started

Requires Node.js and npm.

```bash
npm install
npm run dev       # http://localhost:5173
```

## Testing

```bash
npm test             # unit + component tests (Vitest, jsdom)
npm run typecheck
npm run lint
npm run test:e2e     # end-to-end tests (Playwright)
```

Before the first e2e run, download the browser once with `npx playwright install chromium`.
`npm run test:e2e` builds the app, serves it with `vite preview` on port 4173, and runs the specs in `e2e/` in Chromium
with the `Asia/Ho_Chi_Minh` time zone and a fixed clock (15 Oct 2026). Each test starts with empty storage.
Use `npx playwright test --ui` to debug, and `npx playwright show-report` after a failure.

## Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start the dev server               |
| `npm run build`      | Type-check and build to `dist/`    |
| `npm run preview`    | Serve the production build         |
| `npm test`           | Run unit/component tests (Vitest)  |
| `npm run test:watch` | Run tests in watch mode            |
| `npm run test:e2e`   | Run end-to-end tests (Playwright)  |
| `npm run typecheck`  | Type-check without emitting        |
| `npm run lint`       | Lint with ESLint                   |

## Project structure

```
src/
  domain/      pure logic: types, money, dates, validation, reports
  storage/     localStorage persistence and repository (CRUD)
  state/       StoreProvider and useStore() hook
  components/  forms, lists, month picker, confirm dialog, layout
  pages/       Expenses, Categories, Reports
  test/        Vitest setup
  App.tsx      router and providers
e2e/           Playwright specs
```

Unit and component tests sit next to the code they cover (`*.test.ts(x)`).

## Tech stack

React 19, TypeScript, React Router, Vite, CSS modules, Vitest + Testing Library (jsdom), Playwright, ESLint.
