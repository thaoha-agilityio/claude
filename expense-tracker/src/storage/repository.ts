import type { Category, Expense, StoreData } from '../domain/types'
import {
  isValid,
  validateCategoryName,
  validateExpense,
  type ExpenseField,
  type ValidationErrors,
} from '../domain/validation'
import { loadData, readStoredText, saveData, type StorageDeps } from './storage'

export type ExpenseInput = Pick<Expense, 'amount' | 'date' | 'categoryId' | 'notes'>

export class ValidationError<F extends string> extends Error {
  readonly errors: ValidationErrors<F>
  constructor(errors: ValidationErrors<F>) {
    super(Object.values(errors).join('; '))
    this.name = 'ValidationError'
    this.errors = errors
  }
}

export class NotFoundError extends Error {
  constructor(kind: 'Expense' | 'Category', id: string) {
    super(`${kind} not found: ${id}`)
    this.name = 'NotFoundError'
  }
}

export class CategoryInUseError extends Error {
  readonly count: number
  constructor(count: number) {
    super(`Used by ${count} ${count === 1 ? 'expense' : 'expenses'} — reassign them first.`)
    this.name = 'CategoryInUseError'
    this.count = count
  }
}

export type Repository = ReturnType<typeof createRepository>

/**
 * In-memory app data backed by storage. Every successful change produces a new immutable StoreData
 * snapshot and is saved immediately. The snapshot only changes after a successful save, so a failed save leaves it as it was.
 *
 * Other tabs share the same storage, so each change first reloads the snapshot if the stored text has changed
 * since this repository last read or wrote it. Without that, a change would save a stale snapshot over theirs.
 */
export function createRepository(deps: StorageDeps = {}) {
  const now = deps.now ?? (() => new Date())
  const newId = deps.newId ?? (() => crypto.randomUUID())
  let data: StoreData = loadData(deps)
  let seen = readStoredText(deps)

  // Save the seeded defaults on first run so tabs opened later share the same category ids.
  if (seen === null) {
    try {
      commit(data)
    } catch {
      // Storage unavailable: stay in memory; the first change reports the error.
    }
  }

  function commit(next: StoreData): void {
    const text = JSON.stringify(next)
    saveData(next, deps)
    data = next
    seen = text
  }

  /** Reloads the snapshot if another tab has saved since we last read or wrote storage. */
  function refresh(): StoreData {
    const text = readStoredText(deps)
    if (text !== null && text !== seen) {
      data = loadData(deps)
      seen = readStoredText(deps) // loadData may have saved cleaned data
    }
    return data
  }

  /** Runs a change against the latest stored data. */
  const fresh =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      refresh()
      return fn(...args)
    }

  function findIndex<T extends { id: string }>(items: readonly T[], kind: 'Expense' | 'Category', id: string) {
    const index = items.findIndex((item) => item.id === id)
    if (index === -1) throw new NotFoundError(kind, id)
    return index
  }

  function checkExpense(input: ExpenseInput): ExpenseInput {
    const errors = validateExpense(input, data.categories)
    if (!isValid(errors)) throw new ValidationError<ExpenseField>(errors)
    return { ...input, notes: input.notes.trim() }
  }

  function checkCategoryName(name: string, ignoreId?: string): string {
    const errors = validateCategoryName(name, data.categories, ignoreId)
    if (!isValid(errors)) throw new ValidationError<'name'>(errors)
    return name.trim()
  }

  const replaceAt = <T>(items: readonly T[], index: number, item: T) => items.map((x, i) => (i === index ? item : x))

  return {
    getData: (): StoreData => data,

    /** Picks up changes saved by another tab; returns the (possibly unchanged) snapshot. */
    reload: refresh,

    addExpense: fresh((input: ExpenseInput): Expense => {
      const timestamp = now().toISOString()
      const expense: Expense = { id: newId(), ...checkExpense(input), createdAt: timestamp, updatedAt: timestamp }
      commit({ ...data, expenses: [...data.expenses, expense] })
      return expense
    }),

    updateExpense: fresh((id: string, input: ExpenseInput): Expense => {
      const index = findIndex(data.expenses, 'Expense', id)
      const expense: Expense = { ...data.expenses[index], ...checkExpense(input), updatedAt: now().toISOString() }
      commit({ ...data, expenses: replaceAt(data.expenses, index, expense) })
      return expense
    }),

    deleteExpense: fresh((id: string): void => {
      findIndex(data.expenses, 'Expense', id)
      commit({ ...data, expenses: data.expenses.filter((e) => e.id !== id) })
    }),

    addCategory: fresh((name: string): Category => {
      const category: Category = { id: newId(), name: checkCategoryName(name), createdAt: now().toISOString() }
      commit({ ...data, categories: [...data.categories, category] })
      return category
    }),

    renameCategory: fresh((id: string, name: string): Category => {
      const index = findIndex(data.categories, 'Category', id)
      const category: Category = { ...data.categories[index], name: checkCategoryName(name, id) }
      commit({ ...data, categories: replaceAt(data.categories, index, category) })
      return category
    }),

    /** Throws CategoryInUseError while any expense still uses the category. */
    deleteCategory: fresh((id: string): void => {
      findIndex(data.categories, 'Category', id)
      const count = data.expenses.filter((e) => e.categoryId === id).length
      if (count > 0) throw new CategoryInUseError(count)
      commit({ ...data, categories: data.categories.filter((c) => c.id !== id) })
    }),
  }
}
