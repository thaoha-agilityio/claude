---
name: release-checklist
description: Walks through releasing the expense tracker behind an approval gate. It checks that feat/practice is ready, drafts the CHANGELOG section and proposes the version from the commits since the last v* tag, runs every check including build and e2e, reviews release risks (storage version, server exposure, tracked junk), commits the version bump on release/v<version>, opens the release PR into main on GitHub, and waits until someone other than its author has approved its current head. Then it hands the merge (which deploys to Cloudflare), the tag and the follow-ups to the user. Claude never approves or merges; the hook enforces it. Run as /release-checklist <version>.
disable-model-invocation: true
argument-hint: <version, e.g. 0.1.0>
---

# release-checklist

Version: $ARGUMENTS

Work through the sections in order and keep a checklist as you go. Every item ends up ✅ passed, ❌ failed, or N/A with a reason. A failed item in sections 1–3 stops the release: report it and don't continue to section 4. Don't change code or tests just to make a check pass (see `CLAUDE.md`). A failure is a finding for the user, or a separate `fix/` branch they can choose to open.

Run npm commands from `expense-tracker/`. Run git commands from the repo root. CI and the deploy run on GitHub (`thaoha-agilityio/claude`, the `github` remote): a push to `main` that passes the checks deploys the app, so merging the release PR **is** the release.

## Release managers

None listed yet. While this list is empty, an approving review from anyone other than the PR's author counts. Once GitHub usernames are listed here, the approval must come from one of them, and they're requested as reviewers on the PR.

## 1. Preconditions

- [ ] `$ARGUMENTS` is a semver `X.Y.Z` (no leading `v`) and greater than `version` in `expense-tracker/package.json`. If it's empty, propose the next version in section 2 and ask the user to confirm it.
- [ ] No tag `v$ARGUMENTS` exists yet (`git tag -l`, and `git ls-remote --tags github`).
- [ ] The current branch is `feat/practice` and the working tree is clean (`git status`). If there are unrelated changes, list them and stop. Don't stash or discard them.
- [ ] `git fetch github`, then confirm that `feat/practice` is level with `github/feat/practice` (nothing to push or pull) and contains `github/main` (`git merge-base --is-ancestor github/main HEAD`).

## 2. Scope and drafts

- Base = the latest `v*` tag, or `github/main` if there are no tags yet.
- Collect the changes with `git log --no-merges --format='%h %s' <base>..HEAD`. Group them by type (`feat`, `fix`, then the rest), and note any `(#N)` issue references.
- [ ] Every `fix:` commit for an issue has a matching test change in the same commit (`git show --stat <sha>`). CLAUDE.md requires a test with every bug fix.
- Propose the version from the commit types (any `feat` → minor, only `fix` → patch, while below 1.0.0).
- Draft the `CHANGELOG.md` section: `## v$ARGUMENTS — <today, YYYY-MM-DD>`, then `### Features`, `### Fixes` and `### Other`, one line per change in plain words a user understands, with its `(#N)`. Leave out empty groups and merge commits.
- Show the version and the draft, and **wait for the user to edit or accept the wording** before going on.

## 3. Checks

Run all of these and record pass/fail with the failing output:

- [ ] `npm ci` installs cleanly from the lockfile
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test:e2e`. This always runs for a release. If Chromium is missing, ask the user to run `npx playwright install chromium`.
- [ ] `node --test .claude/hooks/*.test.mjs`
- [ ] `npm audit --omit=dev`. Report what it finds. Only high or critical issues in runtime deps count as ❌.

Release risks (read the diff `<base>..HEAD`):

- [ ] **Storage shape:** if `src/domain/types.ts` or the stored shape in `src/storage/storage.ts` changed, `CURRENT_VERSION` was bumped and `migrate()` has a `case` that upgrades the old version, with a test for it. v1 data must not be silently reinterpreted.
- [ ] **Corrupt-data backup:** `loadData` still copies unreadable data to `expense-tracker:v1:corrupt:<timestamp>` before resetting.
- [ ] **Server exposure:** the server still listens on `127.0.0.1` unless `HOST` is set, and `POST /api/__reset` is only enabled by `API_RESET=1`.
- [ ] **Docs match code:** the README API table matches the routes in `server/api.ts`, and the README scripts table matches `package.json`.
- [ ] **Nothing tracked that shouldn't be:** `git ls-files` lists no `dist/`, `data/`, `node_modules/`, `test-results/`, `playwright-report/` or `.env*` paths.
- [ ] **Scope:** nothing from SPEC.md's out-of-scope list (budgeting, Excel export, sharing) slipped in.

## 4. Release commit

Only after sections 1–3 have no ❌:

1. Branch off: `git switch -c release/v$ARGUMENTS`.
2. Bump the version without tagging: `npm version $ARGUMENTS --no-git-tag-version` (in `expense-tracker/`). This updates `package.json` and `package-lock.json`.
3. Add the accepted section at the top of `expense-tracker/CHANGELOG.md`, creating the file with a `# Changelog` heading if needed.
4. Show the user the diff of those three files with the commit message `chore: Release v$ARGUMENTS`, and wait for their OK.
5. Commit only those three files through the `git-committer` agent, telling it they were approved.

## 5. Release PR

1. Ask the user to push the branch (Claude can't push):

   ```bash
   git push -u github release/v$ARGUMENTS
   ```

2. Draft the PR description from `.gitlab/merge_request_templates/default.md` with every section kept: the changelog section under Description, `Closes #N` for the issues it releases, and only the checkboxes that are really true from section 3.
3. Show the title (`Release v$ARGUMENTS`) and description, and after the user's OK create the PR from `release/v$ARGUMENTS` into `main` with the GitHub tools (`create_pull_request`), requesting the release managers as reviewers when any are listed. Give the user its link.

## 6. Approval gate

Run this when the user says the PR has been reviewed, and again right before section 7. Check it with the GitHub tools (`pull_request_read` with `get`, `get_reviews` and `get_commits`) and git. Every item must be ✅:

- [ ] An `APPROVED` review whose `commit_id` is the PR's current head sha. An approval of an earlier commit doesn't count: a commit pushed after the approval needs a new one.
- [ ] The approver isn't the PR's author, and is a release manager when any are listed.
- [ ] `version` in `expense-tracker/package.json` at the head sha is `$ARGUMENTS`.
- [ ] The local working tree is clean, and the local `release/v$ARGUMENTS` matches the PR's head sha.
- [ ] No `v$ARGUMENTS` tag exists on another commit (local or on `github`).

If anything is ❌, stop. Say which item failed and how to get it fixed, e.g. "ask a reviewer (not the author) to approve the PR's latest commit on GitHub". Never approve the PR or merge it yourself. The hook refuses both, and approving is a person's decision.

## 7. Hand off (the user does these)

1. Merge the PR on GitHub. The push to `main` runs CI, and its `deploy` job ships the app to Cloudflare.
2. When they say it's merged: `git fetch github` and confirm `github/main` contains the approved head sha (`git merge-base --is-ancestor <sha> github/main`). If it doesn't, stop and report it.
3. Give the tag commands for that sha, each in its own `bash` block:

   ```bash
   git tag -a v$ARGUMENTS <approved head sha> -m "v$ARGUMENTS"
   ```

   ```bash
   git push github v$ARGUMENTS
   ```

4. List what a person checks next: the `deploy` job of the CI run on `main` passed, the deployed app loads and shows its data, and `main` is merged back into `feat/practice` so the version bump isn't lost.

## 8. Report

End with the full checklist as a table (item, result, note), the version, the PR link and the approval gate's result (approver, approved sha). Keep it short. Don't repeat command output that passed.
