---
name: deploy-setup
description: Sets up the GitLab CI pipeline for this repo (.gitlab-ci.yml on gitlab.asoft-python.com, project thao.ha/claude). It runs the checks CLAUDE.md requires (unit tests, typecheck, lint, hook tests, build, Playwright e2e), with test reports and failure artifacts, on merge requests and on feat/practice and main. It commits on a chore branch and hands the push to the user. Deploying the app is deliberately out of scope until the API has auth and a home for its data. Use when someone asks to set up CI/CD, add a pipeline, run the tests in CI, or "deploy" this expense tracker. Not web-dev:deploy-setup, which targets GitHub Actions and Cloudflare for boilerplate projects.
---

# deploy-setup

Set up CI for this repo, and say plainly why there is no deploy yet. Work through the sections in order. Every item ends up ✅, ❌ or N/A with a reason. Run npm commands from `expense-tracker/` and git commands from the repo root. Follow `CLAUDE.md` for branches, commits and MRs.

## Why CI only

The app is a Vite SPA plus a Node REST server (`server/`) that saves everything to JSON files under `DATA_DIR`. A deploy needs three things this repo doesn't have yet:

- **Auth:** the API has none. `server/config.ts` binds to `127.0.0.1` unless `HOST` is set, for that reason.
- **Persistent storage:** the data must live on a disk that survives restarts and redeploys.
- **Something to serve `dist/`:** the server serves only `/api`, and `vite preview` is not a production server.

So the pipeline proves every change passes the checks, and stops there. If the user asks for a deploy anyway, list these three gaps and stop. Picking a host and an auth scheme is their decision, and it belongs in its own MR.

## 1. Preconditions

- [ ] The working tree is clean, or only has changes the user asked for. Don't stash or discard anything.
- [ ] `git fetch origin`, then branch off the integration branch: `git switch -c chore/gitlab-ci origin/feat/practice`. The PreToolUse hook refuses commits on `feat/practice` and `main`.
- [ ] No `.gitlab-ci.yml` exists yet. If one does, read it and change only what this skill covers. Keep any jobs the user added.
- [ ] Ask the user whether the project has a GitLab runner with the Docker executor, and whether jobs need runner `tags`. Self-hosted GitLab often has neither by default. With no runner, the pipeline sits in "pending" forever. Record the answer. Continue either way, because the file is still worth committing.

## 2. Make the e2e output readable in GitLab

`expense-tracker/playwright.config.ts` picks `reporter: process.env.CI ? 'github' : 'list'`. GitLab sets `CI=true` too, so in GitLab the `github` reporter prints annotations nothing renders, and there is no HTML report to download.

- [ ] Change the CI branch of that ternary to `[['list'], ['junit', { outputFile: 'test-results/junit.xml' }], ['html', { open: 'never' }]]`. Leave the local `'list'` as it is.
- [ ] Keep the rest of the CI behaviour as it is: `forbidOnly`, `retries: 2`, `reuseExistingServer: false`.
- [ ] `playwright-report/` and `test-results/` are already in `expense-tracker/.gitignore`. Confirm they still are, and never commit reports.

## 3. Write `.gitlab-ci.yml`

Start from [gitlab-ci.template.yml](gitlab-ci.template.yml) in this folder, and copy it to the repo root as `.gitlab-ci.yml`. Then check each point against the repo as it is now, not as it was when the template was written:

- [ ] **Playwright image:** the e2e image tag equals the installed version, `node -p 'require("./package-lock.json").packages["node_modules/@playwright/test"].version'`. A mismatch fails with "Executable doesn't exist" for Chromium.
- [ ] **Node image:** the Node image major version satisfies Vite's and Vitest's `engines` in `package-lock.json`. The template uses `node:24`.
- [ ] **Jobs match the Checks section of `CLAUDE.md`:** `npm test`, `npm run typecheck`, `npm run lint`, `node --test .claude/hooks/*.test.mjs`, `npm run build` and `npm run test:e2e`. If CLAUDE.md lists a check that has no job, add the job.
- [ ] **No `allow_failure`, no `|| true`, no skipped tests.** A red check must fail the pipeline.
- [ ] **No secrets and no CI variables.** Nothing in this pipeline needs credentials.
- [ ] **Runner tags:** if the user named tags in section 1, add them under `default: tags:`.
- [ ] **Workflow rules:** pipelines run for merge requests and for pushes to `feat/practice` and the default branch. A branch with an open MR doesn't get a second, duplicate branch pipeline.

## 4. Verify locally

GitLab runs the same npm commands, so run them here first:

- [ ] `npm ci`
- [ ] `npm test -- --reporter=default --reporter=junit --outputFile.junit=junit.xml`. It must pass and write `junit.xml`. Delete that file afterwards.
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`
- [ ] `node --test .claude/hooks/*.test.mjs` from the repo root
- [ ] `CI=1 npm run test:e2e`. This checks the new reporters write `test-results/junit.xml` and `playwright-report/index.html`. Delete both afterwards.
- [ ] **Validate the YAML.** If the GitLab MCP has a CI lint tool (call `discover_tools` and look in the pipeline category), lint the file against project `thao.ha/claude`. Otherwise parse it locally with `node -e "require('yaml').parse(require('fs').readFileSync('.gitlab-ci.yml','utf8'))"` if `yaml` is installed, and say that full validation happens on the first pipeline.
- [ ] **Optional:** run the e2e job in its real image with `docker run --rm -v "$PWD":/w -w /w/expense-tracker mcr.microsoft.com/playwright:v<version>-noble sh -c 'npm ci && CI=1 npm run test:e2e'`. Ask before pulling, because the image is about 2 GB. Afterwards, check that it didn't leave root-owned files in `node_modules/`.

Don't change code or tests just to make a check pass. A failure is a finding for the user.

## 5. Update the docs that say there is no CI

- [ ] `.claude/loop.md` step 4 says there is no pipeline. Rewrite it to report the latest pipeline status for the current branch's MR, `feat/practice` and `main`. Keep the "there is no deploy environment yet" part.
- [ ] Add a short "CI" section to `expense-tracker/README.md`. It says what runs and when, where to find the e2e report (job artifacts, kept 1 week), and that there is no deploy and why (one line linking to this skill).

## 6. Commit and hand off

1. Show the user the final `.gitlab-ci.yml` and the `playwright.config.ts` diff.
2. Commit on `chore/gitlab-ci` as two commits, one logical change each:
   - `chore: Report Playwright results as JUnit and HTML in CI`
   - `chore: Add GitLab CI pipeline`

   The docs updates go with the pipeline commit. Use one line per message, no body, no trailers.
3. Hand the push to the user (Claude can't push). Put this command in its own `bash` block: `git push -u origin chore/gitlab-ci`.
4. After the push, open the MR into `feat/practice` from `.gitlab/merge_request_templates/default.md`, with every section kept. Tick only what you actually ran. Put the runner answer from section 1 under Additional Information.
5. If GitLab MCP pipeline tools are available, read the MR's first pipeline: each job's status and the failing job's log. Don't retry or cancel jobs. Report what you saw.

## 7. Report

End with a table of every item (item, result, note): the runner answer, the image versions used, local results, and the pipeline status if one ran. Add one line on what a deploy would still need: auth, persistent storage and serving `dist/`.
