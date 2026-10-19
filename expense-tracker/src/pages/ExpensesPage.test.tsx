import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Expense } from '../domain/types'
import { StoreProvider } from '../state/StoreContext'
import { createRepository } from '../storage/repository'
import { STORAGE_KEY } from '../storage/storage'
import { localStore } from '../test/store'
import ExpensesPage from './ExpensesPage'

// 00:30 on 15 Oct 2026 in Ho Chi Minh City, still 14 Oct in UTC.
const NOW = new Date('2026-10-14T17:30:00Z')

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

/** Persists expenses before the page mounts, then renders it on that storage. */
function renderPage(seed: (repo: ReturnType<typeof createRepository>, food: string, transport: string) => void = () => {}) {
  const repo = createRepository()
  const id = (name: string) => repo.getData().categories.find((c) => c.name === name)!.id
  seed(repo, id('Food'), id('Transport'))
  render(
    <StoreProvider {...localStore()}>
      <ExpensesPage />
    </StoreProvider>,
  )
  return userEvent.setup()
}

const rows = () => within(screen.getByRole('table', { name: 'Expenses' })).getAllByRole('row').slice(1)
const rowText = () => rows().map((r) => within(r).getAllByRole('cell').slice(0, 4).map((c) => c.textContent).join(' | '))
const form = () => screen.getByRole('form', { name: /expense/i })
const stored = (): Expense[] => JSON.parse(localStorage.getItem(STORAGE_KEY)!).expenses

test('defaults to the current HCM month and shows an empty state', () => {
  renderPage()
  expect(screen.getByLabelText('Month')).toHaveValue('2026-10')
  expect(screen.getByText('No expenses this month.')).toBeInTheDocument()
  expect(screen.getByText(/^Total:/)).toHaveTextContent(/Total: 0\s₫/)
})

test('lists only the selected month, newest date first, with the total', async () => {
  const user = renderPage((repo, food, transport) => {
    repo.addExpense({ amount: 30000, date: '2026-10-01', categoryId: food, notes: 'early' })
    repo.addExpense({ amount: 20000, date: '2026-10-14', categoryId: transport, notes: 'late' })
    repo.addExpense({ amount: 99000, date: '2026-09-30', categoryId: food, notes: 'september' })
  })
  expect(rowText()).toEqual([
    '14/10/2026 | Transport | 20.000 ₫ | late',
    '01/10/2026 | Food | 30.000 ₫ | early',
  ])
  expect(screen.getByText(/^Total:/)).toHaveTextContent(/50\.000\s₫/)

  await user.click(screen.getByRole('button', { name: 'Previous month' }))
  expect(rowText()).toEqual(['30/09/2026 | Food | 99.000 ₫ | september'])
})

test('adds an expense and switches to its month', async () => {
  const user = renderPage()
  await user.type(screen.getByLabelText('Amount (VND)'), '45000')
  await user.clear(screen.getByLabelText('Date'))
  await user.type(screen.getByLabelText('Date'), '2026-09-20')
  await user.selectOptions(screen.getByLabelText('Category'), 'Food')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  expect(screen.getByLabelText('Month')).toHaveValue('2026-09')
  expect(rowText()).toEqual(['20/09/2026 | Food | 45.000 ₫ | '])
  expect(stored()).toHaveLength(1)
})

test('edits an expense with the form prefilled', async () => {
  const user = renderPage((repo, food) => {
    repo.addExpense({ amount: 30000, date: '2026-10-01', categoryId: food, notes: 'pho' })
  })
  await user.click(screen.getByRole('button', { name: /^Edit Food/ }))

  expect(form()).toHaveAccessibleName('Edit expense')
  expect(screen.getByLabelText('Amount (VND)')).toHaveValue('30.000')
  expect(screen.getByLabelText('Amount (VND)')).toHaveFocus()
  expect(screen.getByLabelText('Notes')).toHaveValue('pho')

  await user.clear(screen.getByLabelText('Amount (VND)'))
  await user.type(screen.getByLabelText('Amount (VND)'), '35000')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))

  expect(form()).toHaveAccessibleName('Add expense')
  expect(rowText()).toEqual(['01/10/2026 | Food | 35.000 ₫ | pho'])
  expect(stored()[0].amount).toBe(35000)
  expect(screen.getByRole('button', { name: /^Edit Food/ })).toHaveFocus()
})

test('cancelling an edit returns to the add form unchanged', async () => {
  const user = renderPage((repo, food) => {
    repo.addExpense({ amount: 30000, date: '2026-10-01', categoryId: food, notes: '' })
  })
  await user.click(screen.getByRole('button', { name: /^Edit Food/ }))
  await user.type(screen.getByLabelText('Amount (VND)'), '9')
  await user.click(screen.getByRole('button', { name: 'Cancel' }))

  expect(form()).toHaveAccessibleName('Add expense')
  expect(rowText()).toEqual(['01/10/2026 | Food | 30.000 ₫ | '])
  expect(screen.getByRole('button', { name: /^Edit Food/ })).toHaveFocus()
})

test('deletes an expense after confirmation, including one being edited', async () => {
  const user = renderPage((repo, food) => {
    repo.addExpense({ amount: 30000, date: '2026-10-01', categoryId: food, notes: '' })
  })
  await user.click(screen.getByRole('button', { name: /^Edit Food/ }))
  await user.click(screen.getByRole('button', { name: /^Delete Food/ }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

  expect(screen.getByText('No expenses this month.')).toBeInTheDocument()
  expect(form()).toHaveAccessibleName('Add expense')
  expect(stored()).toEqual([])
})

test('ignores stored expenses with malformed dates instead of crashing', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  const repo = createRepository()
  const food = repo.getData().categories[0].id
  repo.addExpense({ amount: 30000, date: '2026-10-01', categoryId: food, notes: '' })
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
  raw.expenses.push({ ...raw.expenses[0], id: 'bad', date: '2026-10-5' })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))

  render(
    <StoreProvider {...localStore()}>
      <ExpensesPage />
    </StoreProvider>,
  )
  expect(rows()).toHaveLength(1)
})
