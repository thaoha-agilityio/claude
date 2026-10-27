---
name: release-checklist
description: Walks through releasing the expense tracker. It checks that feat/practice is ready, runs every check including build and e2e, reviews release risks (storage version, server exposure, tracked junk), bumps the version, writes the changelog entry and commits it on a release branch, then hands push, MR into main and tagging to the user. Run as /release-checklist <version>.
disable-model-invocation: true
argument-hint: <version, e.g. 0.1.0>
---

# release-checklist

Version: $ARGUMENTS

Work through the sections in order and keep a checklist as you go. Every item ends up ✅ passed, ❌ failed, or N/A with a reason. A failed item in sections 1–3 stops the release: report it and don't continue to section 4. Don't change code or tests just to make a check pass (see `CLAUDE.md`). A failure is a finding for the user, or a separate `fix/` branch they can choose to open.

Run npm commands from `expense-tracker/`. Run git commands from the repo root.

## 1. Preconditions

- [ ] `$ARGUMENTS` is a semver `X.Y.Z` (no leading `v`) and greater than `version` in `expense-tracker/package.json`. If it's empty, propose the next version from the commit types in section 2 (any `feat` → minor, only `fix` → patch, while below 1.0.0) and ask the user to confirm it.
- [ ] No tag `v$ARGUMENTS` exists yet (`git tag -l`).
- [ ] The current branch is `feat/practice` and the working tree is clean (`git status`). If there are unrelated changes, list them and stop. Don't stash or discard them.
- [ ] `git fetch origin`, then confirm that `feat/practice` is level with `origin/feat/practice` (nothing to push or pull) and contains `origin/main` (`git merge-base --is-ancestor origin/main HEAD`).

## 2. Scope

- Base = the latest `v*` tag, or `origin/main` if there are no tags yet.
- Collect the changes with `git log --no-merges --format='%h %s' <base>..HEAD`. Group them by type (`feat`, `fix`, then the rest), and note any `(#N)` issue references.
- If GitLab tools are available, also list the issues closed since the base. If they aren't, rely on the `(#N)` refs and say so.
- [ ] Every `fix:` commit for an issue has a matching test change in the same commit (`git show --stat <sha>`). CLAUDE.md requires a test with every bug fix.

## 3. Checks

Run all of these and record pass/fail with the failing output:

- [ ] `npm ci` installs cleanly from the lockfile
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test:e2e`. This always runs for a release. If Chromium is missing, ask the user to run `npx playwright install chromium`.
- [ ] `npm audit --omit=dev`. Report what it finds. Only high or critical issues in runtime deps count as ❌.

Release risks (read the diff `<base>..HEAD`):

- [ ] **Storage shape:** if `src/domain/types.ts` or the stored shape in `src/storage/storage.ts` changed, `CURRENT_VERSION` was bumped and `migrate()` has a `case` that upgrades the old version, with a test for it. v1 data must not be silently reinterpreted.
- [ ] **Corrupt-data backup:** `loadData` still copies unreadable data to `expense-tracker:v1:corrupt:<timestamp>` before resetting.
- [ ] **Server exposure:** the server still listens on `127.0.0.1` unless `HOST` is set, and `POST /api/__reset` is only enabled by `API_RESET=1`.
- [ ] **Docs match code:** the README API table matches the routes in `server/app.ts`, and the README scripts table matches `package.json`.
- [ ] **Nothing tracked that shouldn't be:** `git ls-files` lists no `dist/`, `data/`, `node_modules/`, `test-results/`, `playwright-report/` or `.env*` paths.
- [ ] **Scope:** nothing from SPEC.md's out-of-scope list (budgeting, Excel export, sharing) slipped in.

## 4. Prepare the release commit

Only after sections 1–3 have no ❌:

1. Branch off: `git switch -c release/v$ARGUMENTS`.
2. Bump the version without tagging: `npm version $ARGUMENTS --no-git-tag-version` (in `expense-tracker/`). This updates `package.json` and `package-lock.json`.
3. Add an entry at the top of `expense-tracker/CHANGELOG.md`, creating the file with a `# Changelog` heading if needed. Use `## v$ARGUMENTS — <today, YYYY-MM-DD>` followed by `### Features`, `### Fixes` and `### Other`, one line per change in plain words with its `(#N)`. Leave out empty groups and merge commits.
4. Show the user the changelog entry and wait for their OK before committing.
5. Commit only those three files: `chore: Release v$ARGUMENTS`. Use one line, no body, no trailers.

## 5. Hand off (the user does these)

Claude can't push, and the tag must point at the merged commit on `main`. So finish by giving the user these commands, each in its own `bash` block:

1. `git push -u origin release/v$ARGUMENTS`
2. Open an MR from `release/v$ARGUMENTS` into `main`. Draft its description from `.gitlab/merge_request_templates/default.md` with every section kept: the changelog entry under Description, `Closes #N` for the issues it releases, and only the checkboxes that are really true from section 3.
3. After it merges: `git switch main && git pull`, then `git tag -a v$ARGUMENTS -m "v$ARGUMENTS"` and `git push origin v$ARGUMENTS`.
4. Merge `main` back into `feat/practice` so the version bump isn't lost.

## 6. Report

End with the full checklist as a table (item, result, note), the proposed version, and the MR description draft. Keep it short. Don't repeat command output that passed.
