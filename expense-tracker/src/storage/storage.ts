import { isValidDate } from '../domain/dates'
import type { Category, Expense, StoreData } from '../domain/types'
import { MAX_AMOUNT, MIN_AMOUNT } from '../domain/validation'

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

/** Shape check plus the value rules the rest of the app relies on (report functions throw on bad dates). */
const isValidExpense = (v: unknown): v is Expense =>
  isExpense(v) && isValidDate(v.date) && v.amount >= MIN_AMOUNT && v.amount <= MAX_AMOUNT

const expenseCount = (raw: unknown) => (isObject(raw) && Array.isArray(raw.expenses) ? raw.expenses.length : 0)

/**
 * Upgrades parsed storage JSON to the current StoreData shape.
 * Invalid expenses (wrong shape, malformed date, amount out of range) are dropped and the rest kept.
 * Returns null when the data as a whole is unrecognised: wrong shape, invalid categories,
 * or a version this build does not know (e.g. newer).
 * Future versions add a `case` per old version that converts it one step forward.
 */
export function migrate(raw: unknown): StoreData | null {
  if (!isObject(raw)) return null
  switch (raw.version) {
    case 1:
      if (
        Array.isArray(raw.categories) &&
        raw.categories.every(isCategory) &&
        Array.isArray(raw.expenses)
      ) {
        return { version: 1, categories: raw.categories, expenses: raw.expenses.filter(isValidExpense) }
      }
      return null
    default:
      return null
  }
}

/** Copies the raw stored text to a timestamped backup key. Returns the key, or null if the write failed. */
function backUp(text: string, storage: Storage, now: () => Date): string | null {
  const key = `${STORAGE_KEY}:corrupt:${now().toISOString()}`
  try {
    storage.setItem(key, text)
    return key
  } catch {
    return null
  }
}

/**
 * Loads app data. With nothing stored, returns seeded defaults.
 * Unreadable or unrecognised data is copied to a backup key, a warning is logged, and seeded defaults
 * are returned; once the backup has succeeded the defaults are saved, so the backup happens once
 * rather than on every load. If the backup fails, the original is left in place.
 * If only some expenses are invalid, they are dropped: the original is backed up and, once the backup
 * has succeeded, the cleaned data is saved for the same reason.
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

  let raw: unknown
  let data: StoreData | null = null
  try {
    raw = JSON.parse(text)
    data = migrate(raw)
  } catch {
    // Invalid JSON: handled below like any unrecognised data.
  }

  if (data) {
    const dropped = expenseCount(raw) - data.expenses.length
    if (dropped === 0) return data
    const backupKey = backUp(text, storage, now)
    if (backupKey) {
      try {
        saveData(data, deps)
      } catch {
        // Not saved now; the next successful change saves the cleaned data.
      }
    }
    console.warn(
      `[storage] Dropped ${dropped} invalid expense(s); original ${backupKey ? `backed up to "${backupKey}"` : 'could not be backed up'}.`,
    )
    return data
  }

  const backupKey = backUp(text, storage, now)
  const seed = createSeedData(deps)
  if (backupKey) {
    try {
      saveData(seed, deps)
    } catch {
      // Not saved now; the next successful change replaces the unreadable data.
    }
  }
  console.warn(
    `[storage] Saved data was unreadable; ${backupKey ? `backed up to "${backupKey}"` : 'backup failed'} and reset to defaults.`,
  )
  return seed
}

/** The raw stored text, or null when nothing is stored or storage cannot be read. */
export function readStoredText(deps: StorageDeps = {}): string | null {
  try {
    return resolve(deps).storage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Persists app data. Throws if storage is unavailable or full, so callers can tell the user. */
export function saveData(data: StoreData, deps: StorageDeps = {}): void {
  resolve(deps).storage.setItem(STORAGE_KEY, JSON.stringify(data))
}
