import { isValidDate } from './dates'
import { formatVnd } from './money'
import type { Category, Expense } from './types'

export const MIN_AMOUNT = 1
export const MAX_AMOUNT = 1_000_000_000_000
export const MAX_NOTES_LENGTH = 500
export const MAX_CATEGORY_NAME_LENGTH = 50

/** Field name → error message. An empty map means the input is valid. */
export type ValidationErrors<F extends string> = Partial<Record<F, string>>

/** Expense fields as entered; `amount` is already parsed (null when the text was not a valid VND amount). */
export type ExpenseDraft = Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'amount'> & {
  amount: number | null
}

export type ExpenseField = 'amount' | 'date' | 'categoryId' | 'notes'

export function isValid(errors: ValidationErrors<string>): boolean {
  return Object.keys(errors).length === 0
}

// Count code points, not UTF-16 units, and compare NFC so composed/decomposed Vietnamese text counts the same.
const charLength = (s: string) => [...s.normalize('NFC')].length

export function validateExpense(
  draft: ExpenseDraft,
  categories: readonly Category[],
): ValidationErrors<ExpenseField> {
  const errors: ValidationErrors<ExpenseField> = {}
  const { amount, date, categoryId, notes } = draft

  if (amount === null) errors.amount = 'Enter an amount in whole VND, e.g. 50.000'
  else if (!Number.isSafeInteger(amount)) errors.amount = 'Amount must be a whole number of VND'
  else if (amount < MIN_AMOUNT) errors.amount = `Amount must be at least ${formatVnd(MIN_AMOUNT)}`
  else if (amount > MAX_AMOUNT) errors.amount = `Amount must be at most ${formatVnd(MAX_AMOUNT)}`

  if (date === '') errors.date = 'Date is required'
  else if (!isValidDate(date)) errors.date = 'Enter a valid date'

  if (categoryId === '') errors.categoryId = 'Choose a category'
  else if (!categories.some((c) => c.id === categoryId)) errors.categoryId = 'This category no longer exists'

  if (charLength(notes) > MAX_NOTES_LENGTH) {
    errors.notes = `Notes must be at most ${MAX_NOTES_LENGTH} characters`
  }

  return errors
}

const sameName = (a: string, b: string) =>
  a.normalize('NFC').localeCompare(b.normalize('NFC'), 'vi', { sensitivity: 'accent' }) === 0

/**
 * Checks a category name after trimming. Uniqueness ignores case but not diacritics ("Ăn" ≠ "An").
 * Pass `ignoreId` when renaming so a category does not clash with itself.
 */
export function validateCategoryName(
  name: string,
  categories: readonly Category[],
  ignoreId?: string,
): ValidationErrors<'name'> {
  const trimmed = name.trim()
  if (trimmed === '') return { name: 'Name is required' }
  if (charLength(trimmed) > MAX_CATEGORY_NAME_LENGTH) {
    return { name: `Name must be at most ${MAX_CATEGORY_NAME_LENGTH} characters` }
  }
  if (categories.some((c) => c.id !== ignoreId && sameName(c.name.trim(), trimmed))) {
    return { name: 'A category with this name already exists' }
  }
  return {}
}
