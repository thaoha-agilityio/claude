---
name: deploy-setup
description: Sets up or updates CI and the Cloudflare deploy for this repo on GitHub Actions (github.com/thaoha-agilityio/claude, the `github` remote). .github/workflows/ci.yml runs the checks CLAUDE.md requires (unit tests, typecheck, lint, build, hook tests, Playwright e2e) on pull requests and on pushes to feat/practice and main, and a push to main that passes them deploys the app as one Cloudflare Worker (static assets + /api/* in the ExpenseStore Durable Object over SQLite). It verifies the Worker in the real runtime, commits on a branch and hands the push, the secrets and the Cloudflare Access login to the user. Use when someone asks to set up or change CI/CD, the pipeline, the workflow, the deploy, wrangler or Cloudflare for this expense tracker. Not web-dev:deploy-setup, which targets Cloudflare Pages for boilerplate projects.
---

# deploy-setup

Set up or update CI and the Cloudflare deploy for this repo on GitHub Actions. Work through the sections in order.
Every item ends up ✅, ❌ or N/A with a reason. Run npm commands from `expense-tracker/` and git commands from the repo
root. Follow `CLAUDE.md` for commits and PR descriptions.

CI runs on GitHub only. The repo has two remotes: `origin` (GitLab) and `github` (`thaoha-agilityio/claude`). Their
`feat/practice` branches can differ, so branch off **`github/feat/practice`** and open the PR there. No GitLab pipeline
is wanted.

## How it fits together

- **CI** (`.github/workflows/ci.yml`): a `checks` job (unit tests, typecheck, lint, build, hook tests) and an `e2e`
  job (Playwright), on every pull request and on pushes to `feat/practice` and `main`.
- **Deploy**: a `deploy` job runs `npm run deploy` (`npm run build && wrangler deploy`) on a push to `main`, only after
  `checks` and `e2e` pass.
- **One Worker** (`worker/index.ts`, configured in `wrangler.jsonc`): it serves `dist/` as static assets with
  `not_found_handling: "single-page-application"`, so client-side routes like `/reports` get `index.html`.
  `run_worker_first: ["/api/*"]` sends the API to the Worker, which forwards it to one `ExpenseStore` Durable Object
  (`idFromName('default')`), so all requests see one document and run one at a time.
- **ExpenseStore** (`worker/store.ts`) runs the same repository and web-standard REST handler as the Node server
  (`server/api.ts`'s `createApiHandler`) over `SqlKeyValueStorage` (`worker/sqlStorage.ts`): synchronous Web Storage on
  the object's SQLite database. It has to be synchronous because `storage/storage.ts` is, which is why it isn't KV or
  D1. Validation, migrations and corrupt-data backups behave exactly as they do locally; `POST /api/__reset` doesn't
  exist there.
- **Login**: the API has no auth of its own. **Cloudflare Access** in front of the whole Worker is the login, and a
  person sets it up (section 6). The deployed app must not be used before that.

If the request is "deploy it somewhere else" (another host, a database, app-level auth), stop and ask: that changes
the design above and belongs in its own PR.

## 1. Preconditions

- [ ] The working tree is clean, or only has changes the user asked for. Don't stash or discard anything.
- [ ] `git fetch github`, then branch off `github/feat/practice` (`chore/<slug>` for workflow-only changes,
  `feat/<slug>` when the Worker changes). The PreToolUse hook refuses commits on `feat/practice` and `main`.
- [ ] List `.github/workflows/`. The Claude workflows (`claude.yml`, `claude-code-review.yml`) stay as they are. If
  `ci.yml` exists, read it and change only what this skill covers.
- [ ] `expense-tracker/worker/`, `wrangler.jsonc`, `server/api.ts` and the `worker:dev` / `deploy` scripts exist. If
  they don't, the Worker isn't on this branch yet: set up CI only (leave out the `deploy` job) and tell the user the
  deploy needs the Worker first.

## 2. Write `.github/workflows/ci.yml`

Copy [ci.template.yml](ci.template.yml) from this folder to `.github/workflows/ci.yml`. Then check each point against
the repo as it is now:

- [ ] **Node version:** satisfies the `engines` of Vite, Vitest and Wrangler in `package-lock.json`. The template uses 24.
- [ ] **Jobs match the Checks section of `CLAUDE.md`:** `npm test`, `npm run typecheck`, `npm run lint`,
  `npm run build`, `npm run test:e2e` and `node --test .claude/hooks/*.test.mjs`. If CLAUDE.md lists a check that has
  no step, add the step.
- [ ] **E2E keeps the existing config.** `playwright.config.ts` already switches on `CI`: the `github` reporter,
  `forbidOnly`, 2 retries, and fresh servers. GitHub sets `CI=true`, so don't change the config. Only Chromium is
  installed (`npx playwright install --with-deps chromium`).
- [ ] **Failure artifacts:** on failure the e2e job uploads `expense-tracker/test-results/`, kept 7 days. Reports are
  never committed.
- [ ] **No `continue-on-error`, no `|| true`, no skipped tests.** A red check must fail the run, and so block the deploy.
- [ ] **Least privilege:** workflow-level `permissions: contents: read`. Only the `deploy` job sees secrets.
- [ ] **Triggers:** `pull_request`, plus `push` to `feat/practice` and `main`.
- [ ] **Workflow concurrency is main-safe:** `group: ci-${{ github.ref }}` with
  `cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}`. Superseded PR and branch runs are cancelled, but a run
  on `main` is never cut off mid-deploy.
- [ ] **The `deploy` job:**
  - `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, so pull requests and `feat/practice` never deploy;
  - `needs: [checks, e2e]`;
  - `environment: production`, so the secrets live in that environment and reviewers or branch rules can be added there;
  - its own `concurrency: { group: deploy-production, cancel-in-progress: false }`, so two deploys never overlap and
    neither is cancelled;
  - `npm ci`, then `npm run deploy` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from `secrets`. Nothing
    else gets them.
- [ ] **Action versions:** pinned to the major versions the repo already uses (`actions/checkout@v4`,
  `actions/setup-node@v4`, `actions/upload-artifact@v4`).

## 3. Verify locally

GitHub runs the same commands, so run them here first:

- [ ] `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`
- [ ] `node --test .claude/hooks/*.test.mjs` from the repo root
- [ ] `CI=1 npm run test:e2e`. Afterwards, delete any `test-results/` it leaves behind.
- [ ] **Parse the workflow:** `node -e "require('yaml').parse(require('fs').readFileSync('../.github/workflows/ci.yml','utf8'))"`
  from `expense-tracker/`. If `actionlint` is installed, run it too. Otherwise, say that full validation happens on the
  first run.

Don't change code or tests just to make a check pass. A failure is a finding for the user.

## 4. Verify the Worker in the real runtime

Vitest runs the Worker code under Node with a fake SQL layer, so it misses runtime rules. These steps caught real bugs;
run them whenever `worker/`, `wrangler.jsonc`, `server/api.ts` or the storage code changes.

- [ ] **`npm run worker:dev`** (build + `wrangler dev`, port 8787, data in `.wrangler/`, gitignored), run in the
  background. It must start without errors. The Workers runtime only allows the main module (`worker/index.ts`) to
  export handlers and Durable Object classes: exporting any other value (a constant like `STORE_NAME`, a helper) fails
  here even though tests and typecheck pass. Such values belong in `worker/store.ts`.
- [ ] Against `http://localhost:8787`:
  - `/` and a client-side route such as `/reports` return the app's `index.html` (SPA fallback);
  - `GET /api/data` returns JSON, and an unknown `/api/...` path returns the API's JSON 404, not `index.html`;
  - `POST` an expense, then `GET /api/data` shows it.
- [ ] **Persistence across a restart:** stop `wrangler dev`, start it again, and `GET /api/data` still shows the
  expense. That proves the data is in the Durable Object's SQLite storage, not in memory.
- [ ] **`npx wrangler deploy --dry-run`** after `npm run build`: bundles the Worker and checks `wrangler.jsonc` (assets,
  Durable Object binding, migrations) without credentials or uploading anything.
- [ ] **Migrations:** `wrangler.jsonc` keeps `{ "tag": "v1", "new_sqlite_classes": ["ExpenseStore"] }`. A released
  migration is never edited; renaming or adding a Durable Object class means a new tag.
- [ ] Stop `wrangler dev` and delete `.wrangler/` state you created only for this check.

## 5. Update the docs

- [ ] `expense-tracker/README.md` has a "CI" section (what runs and when, where the e2e traces are) and a "Deploy"
  section (the Worker, `npm run worker:dev`, `npm run deploy`, the one-time setup in section 6). Keep them matching the
  workflow.
- [ ] `.claude/loop.md` step 4 reports the latest CI run for the current branch's PR, `feat/practice` and `main`, and,
  for `main`, the `deploy` job's result. Remove any "there is no deploy environment" line.

## 6. Commit and hand off

1. Show the user the final `ci.yml` (and any Worker change).
2. Commit as one change: `chore: Add GitHub Actions CI workflow`, `chore: Deploy to Cloudflare from CI on pushes to
   main`, or whatever fits. One line, no body, no trailers.
3. Hand the push to the user (Claude can't push). Put the command in its own `bash` block:
   `git push -u github <branch>`.
4. After the push, open a PR into `feat/practice` on `thaoha-agilityio/claude`. Write its body from
   `.gitlab/merge_request_templates/default.md`, with every section kept. Tick only what you actually ran.
5. Read the PR's first CI run with the GitHub tools (the PR's check runs, or `gh run view`): each job's result and the
   failing step's log. The `deploy` job shows as skipped on a PR; that's expected. Don't re-run or cancel runs.
6. **One-time setup, done by a person** (Claude doesn't create tokens, set secrets or change Cloudflare settings). List
   these for the user before the first push to `main`:
   1. **API token:** in Cloudflare, an API token from the "Edit Cloudflare Workers" template. In the GitHub repo, a
      `production` environment with the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
   2. **Cloudflare Access (required before anyone uses the app):** in Zero Trust → Access → Applications, a self-hosted
      application for the Worker's hostname (e.g. `expense-tracker.<subdomain>.workers.dev`, or enable "Cloudflare
      Access" for the workers.dev route under Workers → Settings → Domains), with a policy that allows only the
      owner's email via one-time PIN. Until then anyone with the URL can read and change the data. After the first
      deploy, check that opening the URL in a private window asks for the Access login.
   3. The MCP server can't reach the deployed API through Access without a service token; it stays pointed at a local
      API.

## 7. Report

End with a table of every item (item, result, note): the Node version, local results, the runtime checks from
section 4, the first CI run's status, and which one-time setup steps are still the user's to do. If Cloudflare Access
isn't confirmed yet, say so in the last line.
