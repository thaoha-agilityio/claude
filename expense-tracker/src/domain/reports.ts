import { monthKey } from './dates'
import type { Category, Expense } from './types'

export type CategoryTotal = {
  categoryId: string
  name: string
  total: number
  count: number
  /** Share of the month's total, 0–100, unrounded (round only for display). */
  percent: number
}

export const UNKNOWN_CATEGORY_NAME = 'Unknown category'

const inMonth = (expenses: readonly Expense[], month: string) => expenses.filter((e) => monthKey(e.date) === month)

/** Sum of all expenses whose date falls in `month` ("YYYY-MM"). */
export function monthlyTotal(expenses: readonly Expense[], month: string): number {
  return inMonth(expenses, month).reduce((sum, e) => sum + e.amount, 0)
}

/**
 * Per-category totals for `month`, only for categories that have expenses that month,
 * sorted by total descending, then by name.
 */
export function totalsByCategory(
  expenses: readonly Expense[],
  categories: readonly Category[],
  month: string,
): CategoryTotal[] {
  const names = new Map(categories.map((c) => [c.id, c.name]))
  const groups = new Map<string, { total: number; count: number }>()
  let monthTotal = 0

  for (const e of inMonth(expenses, month)) {
    const group = groups.get(e.categoryId) ?? { total: 0, count: 0 }
    group.total += e.amount
    group.count += 1
    groups.set(e.categoryId, group)
    monthTotal += e.amount
  }

  return [...groups]
    .map(([categoryId, { total, count }]) => ({
      categoryId,
      name: names.get(categoryId) ?? UNKNOWN_CATEGORY_NAME,
      total,
      count,
      percent: (total * 100) / monthTotal,
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'vi'))
}
