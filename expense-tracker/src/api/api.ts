import type { Category, Expense, StoreData } from '../domain/types'
import type { ExpenseInput, Repository } from '../storage/repository'

/**
 * How the app reads and saves data. Every call is async; failures reject with the repository's errors
 * (ValidationError, NotFoundError, CategoryInUseError) so the UI handles them the same way whatever is behind it.
 */
export type Api = {
  getData: () => Promise<StoreData>
  addExpense: (input: ExpenseInput) => Promise<Expense>
  updateExpense: (id: string, input: ExpenseInput) => Promise<Expense>
  deleteExpense: (id: string) => Promise<void>
  addCategory: (name: string) => Promise<Category>
  renameCategory: (id: string, name: string) => Promise<Category>
  deleteCategory: (id: string) => Promise<void>
}

/** An Api over an in-process repository, for tests and for running without the server. */
export function createLocalApi(repo: Repository): Api {
  const run =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    async (...args: A): Promise<R> =>
      fn(...args)
  return {
    getData: run(() => repo.reload()),
    addExpense: run(repo.addExpense),
    updateExpense: run(repo.updateExpense),
    deleteExpense: run(repo.deleteExpense),
    addCategory: run(repo.addCategory),
    renameCategory: run(repo.renameCategory),
    deleteCategory: run(repo.deleteCategory),
  }
}
