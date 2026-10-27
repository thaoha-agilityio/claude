---
name: deploy-setup
description: Sets up CI for this repo on GitHub Actions (github.com/thaoha-agilityio/claude, the `github` remote). It adds .github/workflows/ci.yml, which runs the checks CLAUDE.md requires (unit tests, typecheck, lint, build, hook tests, Playwright e2e) on pull requests and on pushes to feat/practice and main. It commits on a chore branch and hands the push to the user. Deploying the app is deliberately out of scope until the API has auth and a home for its data. Use when someone asks to set up CI/CD, add a pipeline or workflow, run the tests in CI, or "deploy" this expense tracker. Not web-dev:deploy-setup, which targets Cloudflare for boilerplate projects.
---

# deploy-setup

Set up CI for this repo on GitHub Actions, and say plainly why there is no deploy yet. Work through the sections in order. Every item ends up ✅, ❌ or N/A with a reason. Run npm commands from `expense-tracker/` and git commands from the repo root. Follow `CLAUDE.md` for commits and PR descriptions.

CI runs on GitHub only. The repo has two remotes: `origin` (GitLab) and `github` (`thaoha-agilityio/claude`). Their `feat/practice` branches can differ, so branch off **`github/feat/practice`** and open the PR there. No GitLab pipeline is wanted.

## Why CI only

The app is a Vite SPA plus a Node REST server (`server/`) that saves everything to JSON files under `DATA_DIR`. A deploy needs three things this repo doesn't have yet:

- **Auth:** the API has none. `server/config.ts` binds to `127.0.0.1` unless `HOST` is set, for that reason.
- **Persistent storage:** the data must live on a disk that survives restarts and redeploys.
- **Something to serve `dist/`:** the server serves only `/api`, and `vite preview` is not a production server.

So the workflow proves every change passes the checks, and stops there. If the user asks for a deploy anyway, list these three gaps and stop. Picking a host and an auth scheme is their decision, and it belongs in its own PR.

## 1. Preconditions

- [ ] The working tree is clean, or only has changes the user asked for. Don't stash or discard anything.
- [ ] `git fetch github`, then `git switch -c chore/github-ci github/feat/practice`. The PreToolUse hook refuses commits on `feat/practice` and `main`.
- [ ] List `.github/workflows/`. The Claude workflows (`claude.yml`, `claude-code-review.yml`) stay as they are. If a CI workflow already exists, read it and change only what this skill covers.

## 2. Write `.github/workflows/ci.yml`

Copy [ci.template.yml](ci.template.yml) from this folder to `.github/workflows/ci.yml`. Then check each point against the repo as it is now:

- [ ] **Node version:** the version satisfies Vite's and Vitest's `engines` in `package-lock.json`. The template uses 24.
- [ ] **Jobs match the Checks section of `CLAUDE.md`:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e` and `node --test .claude/hooks/*.test.mjs`. If CLAUDE.md lists a check that has no step, add the step.
- [ ] **E2E keeps the existing config.** `playwright.config.ts` already switches on `CI`: the `github` reporter (annotations on the PR), `forbidOnly`, 2 retries, and fresh servers instead of reused ones. GitHub sets `CI=true`, so don't change the config. Only Chromium is installed (`npx playwright install --with-deps chromium`), because the config has a single Chromium project.
- [ ] **Failure artifacts:** on failure the e2e job uploads `expense-tracker/test-results/`, which holds the traces from retried tests, kept 7 days. Reports are never committed.
- [ ] **No `continue-on-error`, no `|| true`, no skipped tests.** A red check must fail the run.
- [ ] **Least privilege:** `permissions: contents: read`, no secrets. Nothing here needs credentials.
- [ ] **Triggers:** `pull_request`, plus `push` to `feat/practice` and `main`. `concurrency` cancels superseded runs.
- [ ] **Action versions:** pinned to the major versions the repo already uses (`actions/checkout@v4`, as in `claude-code-review.yml`).

## 3. Verify locally

GitHub runs the same commands, so run them here first:

- [ ] `npm ci`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`
- [ ] `node --test .claude/hooks/*.test.mjs` from the repo root
- [ ] `CI=1 npm run test:e2e`. Afterwards, delete any `test-results/` it leaves behind.
- [ ] **Parse the workflow:** `node -e "require('yaml').parse(require('fs').readFileSync('../.github/workflows/ci.yml','utf8'))"` from `expense-tracker/`. If `actionlint` is installed, run it too. Otherwise, say that full validation happens on the first run.

Don't change code or tests just to make a check pass. A failure is a finding for the user.

## 4. Update the docs that say there is no CI

- [ ] `.claude/loop.md` step 4 says there is no pipeline. Rewrite it to report the latest CI run for the current branch's PR, `feat/practice` and `main` on GitHub. Keep the "there is no deploy environment yet" part.
- [ ] Add a short "CI" section to `expense-tracker/README.md`. It says what runs and when, where the e2e traces are on failure (run artifacts, kept 7 days), and that there is no deploy and why (one line linking to this skill).

## 5. Commit and hand off

1. Show the user the final `ci.yml`.
2. Commit everything as one change: `chore: Add GitHub Actions CI workflow`. Use one line, no body, no trailers.
3. Hand the push to the user (Claude can't push). Put this command in its own `bash` block: `git push -u github chore/github-ci`.
4. After the push, open a PR into `feat/practice` on `thaoha-agilityio/claude`. Write its body from `.gitlab/merge_request_templates/default.md` (the team template), with every section kept. Tick only what you actually ran.
5. Read the PR's first CI run with the GitHub tools (the PR's check runs, or `gh run view`): each job's result and the failing step's log. Don't re-run or cancel runs. Report what you saw.

## 6. Report

End with a table of every item (item, result, note): the Node version, local results, and the first run's status. Add one line on what a deploy would still need: auth, persistent storage and serving `dist/`.
