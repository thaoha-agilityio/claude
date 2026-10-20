---
name: how-we-write-migrations
description: How we change the shape of the expense tracker's stored data (StoreData, the expense-tracker:v1 document), including the version bump, the migrate() step, backups and tests. Use before adding, removing, renaming or retyping any field of Category, Expense or StoreData, changing what counts as valid stored data, or touching migrate()/loadData() in expense-tracker/src/storage/storage.ts.
---

# How we write migrations

All app data is one JSON document. It is stored under the key `expense-tracker:v1`, which the server keeps in `data/expense-tracker%3Av1.json`, and it has the shape `{ version, categories, expenses }`. `loadData()` in `expense-tracker/src/storage/storage.ts` reads it and passes it through `migrate()`. That function is the only gate between what's on disk and what the app trusts. Real users' data goes through it, so a mistake here is data loss rather than a UI bug.

## When you need a migration

You need one when data saved by the current release would be read differently, or rejected, by the new code. That covers:

- adding a required field, or giving an existing field a default
- removing, renaming or retyping a field
- changing what a value means (units, format, or the set of allowed values)
- tightening validation so that some data stored today would be rejected

You don't need one for an optional field that old data simply lacks and the code treats as absent, or for UI-only changes. If you're unsure, write the migration.

## Rules

1. **Never change the key.** `STORAGE_KEY` stays `'expense-tracker:v1'` forever, even at version 5. `loadData` only reads that key, so renaming it orphans every user's data. The version lives inside the document.
2. **Never edit an old version.** Once released, v1's shape is fixed. Don't change what `case 1` accepts except to drop invalid records, and don't edit old test fixtures.
3. **One step per version.** Each old version gets a pure step function that converts it to exactly the next version (`v1ToV2`, `v2ToV3`, …). `migrate()` validates the input against *its* version, then applies the steps in order up to `CURRENT_VERSION`. Don't write shortcuts from v1 straight to v3.
4. **Steps are pure and deterministic.** No `Date.now()`, `crypto.randomUUID()` or storage access inside a step. If a new field needs a value, derive it from existing data (for example `updatedAt` from `createdAt`) or use a constant. Steps run again on every load until the upgraded data is saved, so they must give the same result each time.
5. **Unknown means null.** A version this build doesn't know (newer, missing or not a number) returns `null`. `loadData` then backs the data up and resets. Never guess at a future version's shape.
6. **Back up before the first upgraded save.** When `migrate()` returns data at a higher version than it read, `loadData` copies the original text to a backup key, then saves the upgraded data. That way the conversion happens once and a rollback can restore the old text. This follows the pattern of the existing "dropped invalid expenses" path, which calls `backUp()` and then `saveData()` and logs a warning. The first migration has to add this to `loadData`. Generalise `backUp()` with a label (for example `expense-tracker:v1:pre-v2:<timestamp>`) and keep the `:corrupt:` key unchanged, because CLAUDE.md and the README promise it.
7. **Value rules are applied at the end.** After the last step, the current-version checks still run (`isValidExpense`: a valid date and an amount between `MIN_AMOUNT` and `MAX_AMOUNT`). Invalid expenses are dropped. Invalid categories reject the whole document, as they do today.
8. **Old builds can't read new data.** A release before the bump treats v2 as unknown. It backs v2 up and resets to seed data. Say this in the MR, because rolling back a release after it ran means restoring that backup by hand.

## Steps

1. **Types** (`src/domain/types.ts`): change `Category`/`Expense`, and change `StoreData['version']` to the new literal (`version: 2`). Keep the old shapes as local `V1…` types inside `storage.ts`, since only the migration needs them. Don't export them from `domain/`.
2. **Version:** bump `CURRENT_VERSION` in `storage.ts`. `createSeedData()` uses it, so seed data is written at the new version.
3. **Validators:** add `isCategoryV2`/`isExpenseV2` (or update the current ones) for the new shape. Rename the existing ones to `…V1` and leave them unchanged.
4. **Step:** write `v1ToV2(data: StoreDataV1): StoreDataV2` with a JSDoc that explains *why* the data changed and how values are derived.
5. **`migrate()`:** add a `case 1` that validates v1, applies `v1ToV2`, and continues into the current-version checks. Make the current version's `case` the last one before `default`. Update the JSDoc.
6. **`loadData()`:** add rule 6 (back up, save, warn) the first time a migration exists. After that it applies to every version.
7. **Callers:** search for every field you changed across `src/`, `server/` and `e2e/`. Watch especially `server/app.ts` body checks, `src/domain/validation.ts`, `src/storage/repository.ts` (it copies only known input fields, so add new ones) and `api/http.ts`.
8. **Docs:** update the README "Storage" section. If the API body shape changed, also update the README API table and the `server/app.ts` route comment.

## Tests (`src/storage/storage.test.ts`)

Keep a frozen fixture literal for each old version (`sampleV1`, …) next to `sample`, which is always the current version. Add these tests:

- `migrate(sampleV1)` equals the expected current data, with every field spelled out. Don't build the expected value with the step function itself.
- When there are several versions, the oldest fixture migrates all the way to current.
- Current-version data passes through `migrate()` unchanged. Run it twice to check it's idempotent.
- Invalid v1 data is still `null` (wrong shape, or invalid categories), and invalid v1 expenses are dropped and not converted.
- Unknown and future versions (`CURRENT_VERSION + 1`, a string version, a missing version) give `null`.
- `loadData` with v1 text stored: it returns current data, writes exactly one backup holding the original text, saves the upgraded data, and a second load writes no new backup. Pin `now`/`newId` through `StorageDeps` and don't mock globals.
- `server/fileStorage.test.ts`: a v1 file on disk is upgraded and its backup is written as its own file.
- Update the tests that assert `version: 1` (for example `server/app.test.ts`).

Then run `npm test`, `npm run typecheck` and `npm run lint` from `expense-tracker/`. Also run `npm run build` and `npm run test:e2e`, since every page reads this data.

## Commit and MR

- Make the migration and its tests a single commit, for example `feat: Store expense currency (data v2)`, with `(#N)` if it fixes an issue. Keep unrelated refactors out of it.
- In the MR's Type of Change, tick "Breaking change" for the stored format. Under Additional Information, give the old and new versions, what the step does, the backup key, and the rollback note from rule 8.
- `/release-checklist` checks this again at release time (the "Storage shape" item).
