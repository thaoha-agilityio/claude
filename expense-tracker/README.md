# Expense Tracker

A small client-side expense tracker built with React + TypeScript. Data lives in the browser's `localStorage`; there is no backend.

See [SPEC.md](SPEC.md) for the MVP scope.

## Status

Work in progress. The domain and storage layers are done and tested; the UI is still a placeholder shell.

- [x] Money, date and validation utilities
- [x] `localStorage` persistence with seeding and corrupt-data fallback
- [x] Repository (expense and category CRUD)
- [x] Monthly report calculations
- [ ] App state, routing and pages (expenses, categories, reports)
- [ ] End-to-end tests

## Features (MVP)

- Create, edit and delete expenses (amount, date, category, notes)
- Manage categories
- Monthly reports: total and breakdown by category

Out of scope: budgeting, Excel export, sharing.

## Conventions

- **Currency:** VND, stored as a positive integer (no decimals). Displayed as `1.250.000 ₫`.
- **Dates:** expense dates are calendar strings `YYYY-MM-DD`, so they never shift across time zones. "Today" is computed in `Asia/Ho_Chi_Minh`. `createdAt`/`updatedAt` are UTC ISO timestamps.
- **Storage:** a single versioned key, `expense-tracker:v1` → `{ version, categories, expenses }`. Missing or corrupt data falls back to seeded default categories (Food, Transport, Housing, Utilities, Shopping, Health, Entertainment, Other).

## Getting started

Requires Node.js and npm.

```bash
npm install
npm run dev       # start the Vite dev server
```

## Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start the dev server               |
| `npm run build`      | Type-check and build to `dist/`    |
| `npm run preview`    | Serve the production build         |
| `npm test`           | Run unit/component tests (Vitest)  |
| `npm run test:watch` | Run tests in watch mode            |
| `npm run typecheck`  | Type-check without emitting        |
| `npm run lint`       | Lint with ESLint                   |

## Project structure

```
src/
  domain/     pure logic: types, money, dates, validation, reports
  storage/    localStorage persistence and repository (CRUD)
  test/       Vitest setup
  App.tsx     app shell
  main.tsx    entry point
```

Tests sit next to the code they cover (`*.test.ts`).

## Tech stack

React 19, TypeScript, Vite, Vitest + Testing Library (jsdom), ESLint.
