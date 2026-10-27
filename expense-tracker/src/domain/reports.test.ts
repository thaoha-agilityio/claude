import { monthlyTotal, totalsByCategory, UNKNOWN_CATEGORY_NAME } from './reports'
import type { Category, Expense } from './types'

const categories: Category[] = [
  { id: 'food', name: 'Food', createdAt: '' },
  { id: 'transport', name: 'Transport', createdAt: '' },
  { id: 'health', name: 'Health', createdAt: '' },
]

let n = 0
const exp = (date: string, amount: number, categoryId: string): Expense => ({
  id: `e${++n}`,
  amount,
  date,
  categoryId,
  notes: '',
  createdAt: '',
  updatedAt: '',
})

const expenses = [
  exp('2026-09-30', 999_000, 'food'), // previous month, last day
  exp('2026-10-01', 50_000, 'food'), // first day
  exp('2026-10-14', 30_000, 'transport'),
  exp('2026-10-20', 120_000, 'food'),
  exp('2026-10-31', 30_000, 'health'), // last day
  exp('2026-11-01', 777_000, 'transport'), // next month, first day
  exp('2025-10-15', 5_000_000, 'food'), // same month, other year
]

describe('monthlyTotal', () => {
  it('sums only expenses in the given month', () => {
    expect(monthlyTotal(expenses, '2026-10')).toBe(230_000)
    expect(monthlyTotal(expenses, '2026-09')).toBe(999_000)
  })

  it('is 0 for an empty month', () => {
    expect(monthlyTotal(expenses, '2026-12')).toBe(0)
    expect(monthlyTotal([], '2026-10')).toBe(0)
  })

  it('handles very large amounts exactly', () => {
    const big = [exp('2026-10-01', 1_000_000_000_000, 'food'), exp('2026-10-02', 999_999_999_999, 'food')]
    expect(monthlyTotal(big, '2026-10')).toBe(1_999_999_999_999)
  })
})

describe('totalsByCategory', () => {
  it('groups by category, sorted by total desc then name', () => {
    expect(totalsByCategory(expenses, categories, '2026-10')).toEqual([
      { categoryId: 'food', name: 'Food', total: 170_000, count: 2, percent: (170_000 * 100) / 230_000 },
      { categoryId: 'health', name: 'Health', total: 30_000, count: 1, percent: (30_000 * 100) / 230_000 },
      { categoryId: 'transport', name: 'Transport', total: 30_000, count: 1, percent: (30_000 * 100) / 230_000 },
    ])
  })

  it('has percentages summing to ~100 and totals summing to the monthly total', () => {
    const rows = totalsByCategory(expenses, categories, '2026-10')
    expect(rows.reduce((s, r) => s + r.percent, 0)).toBeCloseTo(100, 10)
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(monthlyTotal(expenses, '2026-10'))
  })

  it('splits thirds without rounding', () => {
    const rows = totalsByCategory(
      [exp('2026-10-01', 1, 'food'), exp('2026-10-01', 1, 'transport'), exp('2026-10-01', 1, 'health')],
      categories,
      '2026-10',
    )
    expect(rows.map((r) => r.percent)).toEqual([100 / 3, 100 / 3, 100 / 3])
  })

  it('returns an empty list for an empty month', () => {
    expect(totalsByCategory(expenses, categories, '2026-12')).toEqual([])
  })

  it('labels expenses whose category is missing', () => {
    const [row] = totalsByCategory([exp('2026-10-01', 10_000, 'gone')], categories, '2026-10')
    expect(row).toMatchObject({ categoryId: 'gone', name: UNKNOWN_CATEGORY_NAME, percent: 100 })
  })
})
