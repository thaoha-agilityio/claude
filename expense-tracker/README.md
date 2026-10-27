# Expense Tracker

A small expense tracker built with React + TypeScript. Data is saved by a small Node REST server (`server/`) to JSON files on disk.

See [SPEC.md](SPEC.md) for the MVP scope.

## Features (MVP)

- **Expenses** (`/`): add, edit and delete expenses (amount, date, category, notes). The list shows one month at a time, newest first, with the month's total.
- **Categories** (`/categories`): add, rename and delete. A category that is still used by expenses cannot be deleted.
- **Reports** (`/reports`): monthly total and a per-category breakdown (count, amount, share).

Out of scope: budgeting, Excel export, sharing.

## Conventions

- **Currency:** VND, stored as a positive integer (no decimals). Displayed as `1.250.000 ₫`.
- **Dates:** expense dates are calendar strings `YYYY-MM-DD`, so they never shift across time zones. "Today" is computed in `Asia/Ho_Chi_Minh`. `createdAt`/`updatedAt` are UTC ISO timestamps.
- **Storage:** the server keeps one versioned document, `expense-tracker:v1` → `{ version, categories, expenses }`, in `data/expense-tracker%3Av1.json`. Missing or corrupt data falls back to seeded default categories (Food, Transport, Housing, Utilities, Shopping, Health, Entertainment, Other); corrupt data is first copied to a `…:corrupt:<timestamp>` file.
- **Other tabs and devices:** other tabs of the app reload after each change; any tab reloads when its window regains focus.

## Getting started

Requires Node.js and npm.

```bash
npm install
npm run server    # API on http://127.0.0.1:3001/api, data in ./data
npm run dev       # http://localhost:5173, forwards /api to the server
```

Set `PORT` and `DATA_DIR` to change where the server listens and saves. The API has no login, so it
only accepts connections from this machine; set `HOST` (e.g. `HOST=0.0.0.0`) only if you really want
it reachable from the network. Set `API_URL` for `npm run dev` / `npm run preview` if the server runs elsewhere.

## API

All bodies are JSON. Errors are `{ error, message }`, plus `errors` (field → message) for validation failures and `count` for an in-use category.

| Request                      | Success                         | Errors             |
| ---------------------------- | ------------------------------- | ------------------ |
| `GET /api/data`              | 200 `{ version, categories, expenses }` |            |
| `POST /api/expenses`         | 201 expense                     | 400                |
| `PUT /api/expenses/:id`      | 200 expense                     | 400, 404           |
| `DELETE /api/expenses/:id`   | 204                             | 404                |
| `POST /api/categories`       | 201 category                    | 400                |
| `PATCH /api/categories/:id`  | 200 category                    | 400, 404           |
| `DELETE /api/categories/:id` | 204                             | 404, 409 (in use)  |

Expense bodies are `{ amount, date, categoryId, notes? }`; category bodies are `{ name }`. Malformed JSON is 400, a body over 64 KB is 413.

## MCP server

`mcp/` is an [MCP](https://modelcontextprotocol.io) server that lets Claude (or any MCP client) read and change the
expense data through the API. It has tools to list categories, list a month's expenses, report a month by category,
add / update / delete expenses, and add / rename / delete categories (categories can be named instead of using ids).

The repo's `.mcp.json` registers it for Claude Code, so it is available when Claude is started from the repo root;
approve it once when Claude asks. The API must be running (`npm run server`); set `EXPENSE_API_URL` if it is not on
`http://127.0.0.1:3001/api`. To run it by hand: `npm run mcp` (it speaks MCP over stdin/stdout).

To try the tools in a browser, run the API (`npm run server`) and then `npm run mcp:inspect`. It starts the
[MCP Inspector](https://github.com/modelcontextprotocol/inspector), opens it, and connects it to this server: pick a
tool under **Tools**, fill in its fields and click **Execute Tool**; the **Protocol** panel shows every MCP message.
The Inspector keeps settings in memory only (`MCP_INSPECTOR_SECRET_STORE=memory`).

## Testing

```bash
npm test             # unit + component tests (Vitest, jsdom)
npm run typecheck
npm run lint
npm run test:e2e     # end-to-end tests (Playwright)
```

Before the first e2e run, download the browser once with `npx playwright install chromium`.
`npm run test:e2e` starts the API on port 4175 (data in a temp directory), builds the app, serves it with `vite preview`
on port 4173, and runs the specs in `e2e/` one at a time in Chromium with the `Asia/Ho_Chi_Minh` time zone and a fixed
clock (15 Oct 2026). Each test starts from freshly seeded data (`POST /api/__reset`, enabled only by `API_RESET=1`).
Use `npx playwright test --ui` to debug, and `npx playwright show-report` after a failure.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every pull request and on pushes to `feat/practice` and `main`:
unit tests, typecheck, lint, build and the Claude hook tests in one job, and the Playwright e2e tests in another.
Failures show up as annotations on the PR; when e2e fails, its traces are uploaded as the `playwright-test-results`
artifact of the run (kept 7 days). A push to `main` that passes both jobs deploys (see Deploy).

## Deploy

The app runs on Cloudflare as one Worker (`worker/`, configured in `wrangler.jsonc`): it serves the built app from
`dist/` (unknown paths get `index.html`, so client-side routes work) and sends `/api/*` to a single Durable Object,
`ExpenseStore`. That object runs the same repository and REST handler as the Node server (`server/api.ts`) over its
built-in SQLite storage (`worker/sqlStorage.ts`), so validation, migrations and corrupt-data backups are unchanged.
`POST /api/__reset` doesn't exist there.

- `npm run worker:dev` builds and runs the Worker locally on port 8787 (data in `.wrangler/`, gitignored).
- `npm run deploy` builds and deploys. CI runs it on every push to `main` after the checks pass.

One-time setup (by a person, in Cloudflare and GitHub):

1. **API token:** in Cloudflare, create an API token from the "Edit Cloudflare Workers" template. In the GitHub repo,
   add it as the `CLOUDFLARE_API_TOKEN` secret, and your account id as `CLOUDFLARE_ACCOUNT_ID`, in an environment
   named `production`.
2. **Login (required before anyone uses it):** the API has no authentication of its own, so put the whole Worker
   behind Cloudflare Access. In Zero Trust → Access → Applications, add a self-hosted application for the Worker's
   hostname (e.g. `expense-tracker.<subdomain>.workers.dev`, or under Workers → Settings → Domains enable
   "Cloudflare Access" for the workers.dev route), with a policy that allows only your email, using one-time PIN login.
   Until this is done, anyone with the URL can read and change the data.

The MCP server can't reach the deployed API through Access without a service token; point it at a local API instead.

## Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start the dev server               |
| `npm run build`      | Type-check and build to `dist/`    |
| `npm run preview`    | Serve the production build         |
| `npm run server`     | Start the API server               |
| `npm run mcp`        | Start the MCP server (stdio)       |
| `npm run mcp:inspect`| Open the MCP server in the Inspector |
| `npm test`           | Run unit/component tests (Vitest)  |
| `npm run test:watch` | Run tests in watch mode            |
| `npm run test:e2e`   | Run end-to-end tests (Playwright)  |
| `npm run typecheck`  | Type-check without emitting        |
| `npm run lint`       | Lint with ESLint                   |

## Project structure

```
src/
  domain/      pure logic: types, money, dates, validation, reports
  storage/     persistence and repository (CRUD), run by the server
  api/         Api interface, HTTP client, in-process adapter for tests
  state/       StoreProvider (loads and saves through the Api) and useStore() hook
  components/  forms, lists, month picker, confirm dialog, layout
  pages/       Expenses, Categories, Reports
  test/        Vitest setup
  App.tsx      router and providers
server/        REST API (node:http) and file-backed storage
mcp/           MCP server: expense tools over the REST API
e2e/           Playwright specs
```

Unit and component tests sit next to the code they cover (`*.test.ts(x)`).

## Tech stack

React 19, TypeScript, React Router, Vite, CSS modules, Node `http` + `tsx` for the server, Vitest + Testing Library (jsdom), Playwright, ESLint.
