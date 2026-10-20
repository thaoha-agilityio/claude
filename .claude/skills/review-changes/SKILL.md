---
name: review-changes
description: Reviews a branch, commit range or the uncommitted changes in the expense tracker against this repo's own rules (money, dates, text length, storage versioning, repository input copying, async UI saves, injectable deps, tests, commit and MR conventions) and runs the checks. Reports verified findings with file:line and changes nothing. Run as /review-changes [target].
disable-model-invocation: true
argument-hint: "[branch | A..B | staged | (empty = current branch)]"
---

# review-changes

Target: $ARGUMENTS

This is a read-only review. Don't edit, stage, commit or switch branches. Fix things only if the user asks after seeing the report. For a general bug hunt with no repo rules, the built-in `/code-review` exists. This skill is about what `CLAUDE.md` asks of changes here.

## 1. Work out what's being reviewed

Base is `feat/practice`, the integration branch.

| `$ARGUMENTS` | Diff |
|---|---|
| empty | `git diff feat/practice...HEAD` plus any uncommitted changes (`git diff HEAD`) |
| `staged` | `git diff --cached` |
| `A..B` | `git diff A..B` |
| a branch name | `git diff feat/practice...<branch>` |

Also list the commits (`git log --format='%h %s' feat/practice..<head>`). If the diff is empty, say so and stop. Read `CLAUDE.md`. Then read each changed file in full, not just the hunks, along with the tests next to it.

## 2. Check the changes against the repo's rules

Go through each rule that the diff touches. If a rule doesn't apply, skip it without mentioning it.

**Domain** (`src/domain/`)
- Money is a positive safe integer of VND. It's parsed with `parseVnd`, shown with `formatVnd`, and its range is set by `MIN_AMOUNT`/`MAX_AMOUNT`. Flag any floats, `toFixed`, `parseFloat`, `Number(input)` on user text, or hand-written formatting.
- Dates are `YYYY-MM-DD` strings. "Today" comes from `todayInHcm()`. Flag `new Date().toISOString().slice(0, 10)`, `Date` objects used as expense dates, and `getMonth()`/`getDate()` on local time.
- Text length is counted in NFC code points **after trimming**. Flag `.length` used on user text.

**Storage and repository** (`src/storage/`, `server/`)
- Any change to the stored shape needs a version bump and a `migrate()` step. If one is missing, cite the `how-we-write-migrations` skill.
- `STORAGE_KEY` never changes, and the `expense-tracker:v1:corrupt:<timestamp>` backup must still happen.
- The repository copies only known input fields. Flag spreading caller input (`...input`) into stored records.
- The server checks body types before calling the repository. It listens on `127.0.0.1` unless `HOST` is set, and `/api/__reset` only works with `API_RESET=1`.
- Errors are `ValidationError` / `NotFoundError` / `CategoryInUseError`. The client rebuilds them in `api/http.ts`, and the UI turns them into messages with `errorMessage()` in `components/errors.ts`. Flag new error paths that skip that chain.

**UI** (`src/components/`, `src/pages/`, `src/state/`)
- Store actions return promises. Forms await them and disable their fields while saving. Flag unawaited saves and forms that can be submitted twice.
- CSS modules sit next to their component. Every input has a label.

**Deps and tests**
- Code that needs a clock, id generator or storage takes them as injectable deps (`StorageDeps`, `todayInHcm(now)`). Flag `vi.useFakeTimers`/global mocks where a dep would do.
- Tests sit next to the code (`foo.ts` → `foo.test.ts`). They query by role and accessible name. Component and page tests use `localStore()` from `src/test/store.ts`, not a server. E2E specs reuse `e2e/fixtures.ts`.
- Every `fix:` commit includes a test that fails without the fix. The review is read-only, so don't check out or stash anything to prove it. Read the test and reason about whether it would fail on the parent commit.
- Flag tests that were weakened or deleted to make a check pass.

**Style and git**
- No semicolons, single quotes, and a short JSDoc on exported functions that explains *why*.
- Commit subjects are `<type>: <description>`, with `(#N)` for issue fixes, no body, no trailers or step numbers, and one logical change per commit.
- Flag any tracked `dist/`, `data/`, `test-results/`, `node_modules/` or `.env*` files.
- Scope: nothing from SPEC.md's out-of-scope list (budgeting, Excel export, sharing).

Beyond the rules, also look for plain correctness bugs in the changed code: edge cases, error handling, and stale state after an async save.

## 3. Run the checks

From `expense-tracker/`, run `npm test`, `npm run typecheck` and `npm run lint`. If the diff touches pages, routing or anything a user sees, also run `npm run build` and `npm run test:e2e`. Report each one as pass or fail, with the first relevant lines of any failure. These checks only read the tree, apart from build output, which is gitignored.

## 4. Verify before reporting

For each candidate finding, re-read the code around it and either confirm it with a concrete input or state, or drop it. Don't report style preferences that the repo doesn't state, and don't report "consider adding" ideas without a reason.

## 5. Report

1. One line saying what was reviewed (target, number of commits and files).
2. **Findings**, most severe first. Each one has `[file.ts:line](expense-tracker/src/…:line)` – what's wrong – a concrete failure scenario – which rule it breaks. Severity is **blocker** (data loss, a broken check, a broken rule from CLAUDE.md), **should fix**, or **nit**.
3. **Checks:** a pass/fail table.
4. **MR readiness:** whether the commits and branch name follow the conventions, plus the template checkboxes that would honestly be ticked right now.

If there are no findings, say so plainly. Don't pad the report.
