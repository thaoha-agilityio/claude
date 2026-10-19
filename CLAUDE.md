# CLAUDE.md

Shared guidance for anyone (human or Claude) working in this repo. Keep it team-wide: personal
preferences go in `CLAUDE.local.md` or `~/.claude/CLAUDE.md`, not here.

## Layout

The git root is this directory; the only app is `expense-tracker/`, a React + TypeScript expense
tracker with a small Node REST server that saves to JSON files (`npm run server`, then `npm run dev`).
Run all npm commands from
`expense-tracker/`. Read `expense-tracker/README.md` for features and scripts, and
`expense-tracker/SPEC.md` for MVP scope (budgeting, Excel export and sharing are out of scope).

```
.claude/                   shared Claude Code settings and the git-committer agent
.gitlab/                   MR template (default.md)
expense-tracker/
  src/domain/              pure logic: types, money, dates, validation, reports — no React, no storage
  src/storage/             persistence (storage.ts) and CRUD + errors (repository.ts), run by the server
  src/api/                 Api interface: HTTP client (http.ts) and in-process adapter for tests (api.ts)
  src/state/               StoreProvider (loads and saves through the Api) and useStore()
  src/components/, pages/  UI; CSS modules next to the component
  server/                  REST API (app.ts) over the repository, with file-backed Storage
  e2e/                     Playwright specs and fixtures; they start their own API server
```

## Checks

Run these before committing; all must pass:

```bash
npm test            # Vitest + Testing Library (jsdom)
npm run typecheck
npm run lint
```

Also run `npm run build` and `npm run test:e2e` when a change touches routing, pages or anything a
user would see. E2E needs `npx playwright install chromium` once; it builds the app, serves it on port
4173, and pins the clock to 15 Oct 2026 10:00 in `Asia/Ho_Chi_Minh` (`e2e/fixtures.ts`).

Do not change code or tests just to make a failing check pass without understanding why it fails.

## Domain rules that are easy to get wrong

- **Money** is VND as a positive safe integer — never floats or decimals. Parse with `parseVnd`,
  display with `formatVnd` (`1.250.000 ₫`); `.` is the thousands separator. Range limits live in
  `domain/validation.ts` (`MIN_AMOUNT`, `MAX_AMOUNT`).
- **Dates** are calendar strings `YYYY-MM-DD`, not `Date` objects, so they never shift across time
  zones. Only "today" needs a clock: use `todayInHcm()` (Asia/Ho_Chi_Minh). Don't use
  `new Date().toISOString().slice(0, 10)` — it is UTC and is wrong for 7 hours every day.
  `createdAt`/`updatedAt` are UTC ISO timestamps.
- **Text length** is counted in NFC code points (Vietnamese input may arrive decomposed), and
  validated after trimming.
- **Storage** uses one versioned key, `expense-tracker:v1`. Any change to the stored shape needs a
  version bump and a new `case` in `migrate()` in `storage/storage.ts`; never silently change v1.
  Unreadable data is backed up to `expense-tracker:v1:corrupt:<timestamp>` before being reset — keep
  that guarantee.
- **Repository** (`storage/repository.ts`) is the only writer; the server runs it over `FileStorage`, so
  validation and migration rules are shared. It copies only known input fields (so stray properties can't
  be persisted) and throws `ValidationError` / `NotFoundError` / `CategoryInUseError`. The HTTP client
  (`api/http.ts`) rebuilds those errors from API responses, and the UI turns them into messages with
  `errorMessage()` in `components/errors.ts`. The server checks body types before the repository runs.
- **UI saves are async.** Store actions return promises; forms await them and disable their fields while
  saving. Component and page tests use `localStore()` from `src/test/store.ts` instead of a server.
- Code that needs a clock, id generator or storage takes them as injectable deps (`StorageDeps`,
  `todayInHcm(now)`) so tests can pin them. Follow that pattern rather than mocking globals.

## Code and tests

- Match the surrounding style: no semicolons, single quotes, short JSDoc on exported functions that
  explains the *why* or the edge case.
- Unit and component tests sit next to the code (`foo.ts` → `foo.test.ts`). `localStorage` is cleared
  before each test (`src/test/setup.ts`).
- Query the UI by role and accessible name (`getByRole`, `getByLabel`) in both Vitest and Playwright;
  that doubles as an accessibility check. Reuse helpers in `e2e/fixtures.ts`.
- A bug fix comes with a test that fails without the fix.

## Git and merge requests

Hosted on GitLab (`gitlab.asoft-python.com`, project `thao.ha/claude`).

- `feat/practice` is the integration branch; branch off it and open MRs back into it.
  Name branches `fix/<issue>-<slug>` or `feat/<slug>`.
- Commit messages: English, a single subject line `<type>: <description>` with type one of `feat`,
  `fix`, `refactor`, `test`, `docs`, `chore`, `style`. Add `(#N)` when it fixes issue N. No body, no
  plan step numbers, no `Co-Authored-By` or other attribution trailers.
- One logical change per commit; don't commit `dist/`, `node_modules/`, reports or `.env` files.
- Claude may stage and commit but not push, reset or rebase (see `.claude/settings.json`); a person
  pushes the branch. Don't amend or force-push shared branches.
- Fill in `.gitlab/merge_request_templates/default.md` for every MR, keeping all its sections. Tick
  only checkboxes that are actually true (e.g. "Unit tests pass" only after running `npm test`); write
  "N/A" for sections that don't apply instead of deleting them.
