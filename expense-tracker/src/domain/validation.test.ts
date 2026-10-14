import type { Category } from './types'
import {
  isValid,
  MAX_AMOUNT,
  validateCategoryName,
  validateExpense,
  type ExpenseDraft,
} from './validation'

const cat = (id: string, name: string): Category => ({ id, name, createdAt: '2026-01-01T00:00:00.000Z' })
const categories = [cat('food', 'Food'), cat('an-uong', 'Ăn uống')]

const draft = (overrides: Partial<ExpenseDraft> = {}): ExpenseDraft => ({
  amount: 50000,
  date: '2026-10-14',
  categoryId: 'food',
  notes: '',
  ...overrides,
})

describe('validateExpense', () => {
  it('accepts a valid draft', () => {
    const errors = validateExpense(draft(), categories)
    expect(errors).toEqual({})
    expect(isValid(errors)).toBe(true)
  })

  it.each([1, MAX_AMOUNT])('accepts boundary amount %d', (amount) => {
    expect(validateExpense(draft({ amount }), categories)).toEqual({})
  })

  it.each([
    [null, /whole VND/],
    [0, /at least 1/],
    [-1, /at least 1/],
    [MAX_AMOUNT + 1, /at most 1\.000\.000\.000\.000/],
    [1.5, /whole number/],
    [Number.NaN, /whole number/],
    [2 ** 53, /whole number/],
  ])('rejects amount %s', (amount, message) => {
    expect(validateExpense(draft({ amount }), categories).amount).toMatch(message)
  })

  it.each([
    ['', 'Date is required'],
    ['2026-02-30', 'Enter a valid date'],
    ['14/10/2026', 'Enter a valid date'],
  ])('rejects date %j', (date, message) => {
    expect(validateExpense(draft({ date }), categories).date).toBe(message)
  })

  it.each([
    ['', 'Choose a category'],
    ['deleted', 'This category no longer exists'],
  ])('rejects categoryId %j', (categoryId, message) => {
    expect(validateExpense(draft({ categoryId }), categories).categoryId).toBe(message)
  })

  it('allows notes up to 500 characters, counting Vietnamese letters once', () => {
    expect(validateExpense(draft({ notes: 'ạ'.repeat(500) }), categories)).toEqual({})
    // Decomposed "ạ" (a + combining dot below) is still one character after NFC.
    expect(validateExpense(draft({ notes: 'ạ'.repeat(500) }), categories)).toEqual({})
    expect(validateExpense(draft({ notes: 'x'.repeat(501) }), categories).notes).toMatch(/at most 500/)
  })

  it('reports every invalid field at once', () => {
    const errors = validateExpense({ amount: null, date: '', categoryId: '', notes: 'x'.repeat(501) }, categories)
    expect(Object.keys(errors).sort()).toEqual(['amount', 'categoryId', 'date', 'notes'])
    expect(isValid(errors)).toBe(false)
  })
})

describe('validateCategoryName', () => {
  it('accepts a new, trimmed name', () => {
    expect(validateCategoryName('  Transport  ', categories)).toEqual({})
  })

  it.each(['', '   '])('requires a name (%j)', (name) => {
    expect(validateCategoryName(name, categories).name).toBe('Name is required')
  })

  it('limits length to 50 characters after trimming', () => {
    expect(validateCategoryName(` ${'Đ'.repeat(50)} `, categories)).toEqual({})
    expect(validateCategoryName('x'.repeat(51), categories).name).toMatch(/at most 50/)
  })

  it.each(['food', 'FOOD', ' Food ', 'ĂN UỐNG', 'Ăn uống'])('rejects duplicate %j', (name) => {
    expect(validateCategoryName(name, categories).name).toBe('A category with this name already exists')
  })

  it('treats different diacritics as different names', () => {
    expect(validateCategoryName('An uong', categories)).toEqual({})
  })

  it('lets a category keep or re-case its own name when renaming', () => {
    expect(validateCategoryName('FOOD', categories, 'food')).toEqual({})
    expect(validateCategoryName('Ăn uống', categories, 'food').name).toMatch(/already exists/)
  })
})
