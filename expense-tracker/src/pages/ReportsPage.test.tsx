import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StoreProvider } from '../state/StoreContext'
import { createRepository } from '../storage/repository'
import { STORAGE_KEY } from '../storage/storage'
import ReportsPage from './ReportsPage'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T17:30:00Z')) // 15 Oct in HCM
})
afterEach(() => {
  vi.useRealTimers()
})

function seed() {
  const repo = createRepository()
  const id = (name: string) => repo.getData().categories.find((c) => c.name === name)!.id
  const add = (amount: number, date: string, category: string) =>
    repo.addExpense({ amount, date, categoryId: id(category), notes: '' })
  add(100000, '2026-10-01', 'Food')
  add(50000, '2026-10-15', 'Food')
  add(150000, '2026-10-31', 'Transport')
  add(300000, '2026-09-30', 'Housing')
  return repo
}

function renderPage() {
  render(
    <StoreProvider>
      <ReportsPage />
    </StoreProvider>,
  )
  return userEvent.setup()
}

const table = () => screen.getByRole('table', { name: 'Expenses by category' })
const bodyRows = () =>
  within(table())
    .getAllByRole('row')
    .slice(1, -1)
    .map((r) => [within(r).getByRole('rowheader'), ...within(r).getAllByRole('cell')].map((c) => c.textContent))
const footer = () => {
  const r = within(table()).getAllByRole('row').at(-1)!
  return [within(r).getByRole('rowheader'), ...within(r).getAllByRole('cell')].map((c) => c.textContent)
}

test('shows the current month total and per-category breakdown, largest first', () => {
  seed()
  renderPage()
  expect(screen.getByLabelText('Month')).toHaveValue('2026-10')
  expect(screen.getByText(/^Total:/)).toHaveTextContent(/300\.000\s₫/)
  expect(bodyRows()).toEqual([
    ['Food', '2', '150.000 ₫', '50%'],
    ['Transport', '1', '150.000 ₫', '50%'],
  ])
  expect(footer()).toEqual(['Total', '3', '300.000 ₫', '100%'])
})

test('switching months recomputes the report', async () => {
  seed()
  const user = renderPage()
  await user.click(screen.getByRole('button', { name: 'Previous month' }))
  expect(screen.getByText(/^Total:/)).toHaveTextContent(/300\.000\s₫/)
  expect(bodyRows()).toEqual([['Housing', '1', '300.000 ₫', '100%']])
})

test('rounds percentages to one decimal', () => {
  const repo = createRepository()
  const [a, b] = repo.getData().categories
  repo.addExpense({ amount: 1, date: '2026-10-01', categoryId: a.id, notes: '' })
  repo.addExpense({ amount: 2, date: '2026-10-01', categoryId: b.id, notes: '' })
  renderPage()
  expect(bodyRows().map((r) => r[3])).toEqual(['66,7%', '33,3%'])
})

test('shows an empty state for a month without expenses', async () => {
  seed()
  const user = renderPage()
  await user.click(screen.getByRole('button', { name: 'Next month' }))
  expect(screen.getByText('No expenses this month.')).toBeInTheDocument()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByText(/^Total:/)).toHaveTextContent(/0\s₫/)
})

test('ignores stored expenses with malformed dates instead of crashing', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  seed()
  const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
  raw.expenses.push({ ...raw.expenses[0], id: 'bad', date: '2026-10-5' })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))
  renderPage()
  expect(footer()).toEqual(['Total', '3', '300.000 ₫', '100%'])
})
