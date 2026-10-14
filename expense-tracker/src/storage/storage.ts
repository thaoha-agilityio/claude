import type { Category, Expense, StoreData } from '../domain/types'

export const STORAGE_KEY = 'expense-tracker:v1'
export const CURRENT_VERSION = 1

export const DEFAULT_CATEGORY_NAMES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Shopping',
  'Health',
  'Entertainment',
  'Other',
] as const

export type StorageDeps = {
  storage?: Storage
  now?: () => Date
  newId?: () => string
}

const resolve = (deps: StorageDeps) => ({
  storage: deps.storage ?? globalThis.localStorage,
  now: deps.now ?? (() => new Date()),
  newId: deps.newId ?? (() => crypto.randomUUID()),
})

export function createSeedData(deps: StorageDeps = {}): StoreData {
  const { now, newId } = resolve(deps)
  const createdAt = now().toISOString()
  return {
    version: CURRENT_VERSION,
    categories: DEFAULT_CATEGORY_NAMES.map((name) => ({ id: newId(), name, createdAt })),
    expenses: [],
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isString = (v: unknown): v is string => typeof v === 'string'

const isCategory = (v: unknown): v is Category =>
  isObject(v) && isString(v.id) && isString(v.name) && isString(v.createdAt)

const isExpense = (v: unknown): v is Expense =>
  isObject(v) &&
  isString(v.id) &&
  Number.isSafeInteger(v.amount) &&
  isString(v.date) &&
  isString(v.categoryId) &&
  isString(v.notes) &&
  isString(v.createdAt) &&
  isString(v.updatedAt)

/**
 * Upgrades parsed storage JSON to the current StoreData shape.
 * Returns null when it is unrecognised: wrong shape, or a version this build does not know (e.g. newer).
 * Future versions add a `case` per old version that converts it one step forward.
 */
export function migrate(raw: unknown): StoreData | null {
  if (!isObject(raw)) return null
  switch (raw.version) {
    case 1:
      if (
        Array.isArray(raw.categories) &&
        raw.categories.every(isCategory) &&
        Array.isArray(raw.expenses) &&
        raw.expenses.every(isExpense)
      ) {
        return { version: 1, categories: raw.categories, expenses: raw.expenses }
      }
      return null
    default:
      return null
  }
}

/**
 * Loads app data. With nothing stored, returns seeded defaults.
 * Unreadable or unrecognised data is copied to a backup key, a warning is logged, and seeded defaults
 * are returned, so the next save cannot silently destroy the only copy.
 */
export function loadData(deps: StorageDeps = {}): StoreData {
  const { storage, now } = resolve(deps)

  let text: string | null
  try {
    text = storage.getItem(STORAGE_KEY)
  } catch (err) {
    console.warn('[storage] Could not read saved data; starting with defaults.', err)
    return createSeedData(deps)
  }
  if (text === null) return createSeedData(deps)

  let data: StoreData | null = null
  try {
    data = migrate(JSON.parse(text))
  } catch {
    // Invalid JSON: handled below like any unrecognised data.
  }
  if (data) return data

  const backupKey = `${STORAGE_KEY}:corrupt:${now().toISOString()}`
  try {
    storage.setItem(backupKey, text)
  } catch {
    // Best effort; the warning below still reports the problem.
  }
  console.warn(`[storage] Saved data was unreadable; backed up to "${backupKey}" and reset to defaults.`)
  return createSeedData(deps)
}

/** Persists app data. Throws if storage is unavailable or full, so callers can tell the user. */
export function saveData(data: StoreData, deps: StorageDeps = {}): void {
  resolve(deps).storage.setItem(STORAGE_KEY, JSON.stringify(data))
}
