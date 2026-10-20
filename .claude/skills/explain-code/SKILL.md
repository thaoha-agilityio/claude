---
name: explain-code
description: Explains how a part of the expense tracker works, whether it's a file, a function, a feature or a question like "what happens when I save an expense?". It traces the path through the layers (page → state → api → server → repository → storage → domain) with clickable file:line references, and covers the domain rules, edge cases and the tests that pin the behaviour. Read-only. Use when someone asks how or why some code in this repo works, or run as /explain-code <file, symbol or question>.
argument-hint: <file, symbol, feature or question>
---

# explain-code

Explain: $ARGUMENTS

This is read-only, so don't change any files. If `$ARGUMENTS` is empty, ask what to explain. Explain the code as it actually is: read it rather than relying on memory or on names, and if the docs and the code disagree, say so.

## 1. Find it

- For a path, read the file. For a symbol, find where it's defined and where it's used. For a feature or question, find where it starts (the page or route that triggers it, or the server endpoint).
- Read `CLAUDE.md` for the layer map and the domain rules.

## 2. Trace the path

Follow the call chain only as far as the question needs. In this app a user action usually goes:

| Layer | Where | What it does |
|---|---|---|
| Page and components | `src/pages/`, `src/components/` | Form state, `parseVnd` on input, disabling fields while saving, `errorMessage()` |
| State | `src/state/StoreContext.tsx`, `store.ts` | `useStore()` actions return promises; reloads data when other tabs change it or the window regains focus |
| API client | `src/api/http.ts` (`api.ts` in tests) | HTTP calls; rebuilds `ValidationError` / `NotFoundError` / `CategoryInUseError` from responses |
| Server | `server/app.ts`, `config.ts`, `fileStorage.ts` | Routes, checks body types and size, `HOST`/`PORT`/`DATA_DIR`, one JSON file per storage key |
| Repository | `src/storage/repository.ts` | The only writer; validates, copies known fields, commits snapshots, notices external changes |
| Storage | `src/storage/storage.ts` | `loadData` / `migrate` / `saveData`, versioning, corrupt-data backups |
| Domain | `src/domain/` | Pure rules: money, dates (`todayInHcm`), validation, reports |

Note the parts that are easy to get wrong in this repo, where the code touches them: VND as an integer, dates as `YYYY-MM-DD` in Asia/Ho_Chi_Minh, NFC length after trimming, the storage version and backups, and async saves.

## 3. Find the tests that pin it

List the unit, component and e2e tests that cover the behaviour (`foo.ts` → `foo.test.ts`, `e2e/*.spec.ts`), and say which edge case each one locks in. If something important has no test, say so.

## 4. Answer

Fit the depth to the question. A "what does this function do" needs a short paragraph. A "how does saving work" gets the full walk-through:

1. **In short:** two or three sentences that answer the question directly.
2. **How it works:** numbered steps along the path, each with a link like [repository.ts:63](expense-tracker/src/storage/repository.ts:63) and a sentence of what happens and why. Quote at most a few lines of code, only where the exact code matters.
3. **Edge cases and rules:** what happens with bad input, failures, other tabs, or old stored data.
4. **Tests:** the tests that prove it.
5. **Gotchas** (optional): anything surprising, or where the docs and the code disagree.

If a diagram would help for a flow that spans three or more layers, add a short ASCII sequence. Write for a teammate who knows TypeScript and React but not this codebase. Don't pad the answer.
