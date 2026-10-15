import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Category, Expense } from '../domain/types'
import { SAVE_FAILED } from './errors'
import ExpenseList from './ExpenseList'

const categories: Category[] = [{ id: 'food', name: 'Food', createdAt: '2026-01-01T00:00:00.000Z' }]

const make = (id: string, over: Partial<Expense> = {}): Expense => ({
  id,
  amount: 50000,
  date: '2026-10-14',
  categoryId: 'food',
  notes: '',
  createdAt: '2026-10-14T01:00:00.000Z',
  updatedAt: '2026-10-14T01:00:00.000Z',
  ...over,
})

const expenses = [make('e1', { notes: 'Lunch' }), make('e2', { amount: 1250000, date: '2026-10-02', categoryId: 'gone' })]

function setup(overrides: Partial<Parameters<typeof ExpenseList>[0]> = {}) {
  const props = { expenses, categories, onEdit: vi.fn(), onDelete: vi.fn(), ...overrides }
  render(<ExpenseList {...props} />)
  return { user: userEvent.setup(), ...props }
}

test('renders rows in the given order with formatted values', () => {
  setup()
  const rows = within(screen.getByRole('table', { name: 'Expenses' })).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(2)
  const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((c) => c.textContent)
  expect(cells(rows[0]).slice(0, 4)).toEqual(['14/10/2026', 'Food', '50.000 ₫', 'Lunch'])
  expect(cells(rows[1]).slice(0, 4)).toEqual(['02/10/2026', 'Unknown category', '1.250.000 ₫', ''])
})

test('shows the empty message', () => {
  setup({ expenses: [], emptyMessage: 'No expenses this month.' })
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByText('No expenses this month.')).toBeInTheDocument()
})

test('Edit passes the expense', async () => {
  const { user, onEdit } = setup()
  await user.click(screen.getByRole('button', { name: /^Edit Food 50\.000\s₫ on 14\/10\/2026$/ }))
  expect(onEdit).toHaveBeenCalledWith(expenses[0])
})

test('deletes after confirmation', async () => {
  const { user, onDelete } = setup()
  await user.click(screen.getByRole('button', { name: /^Delete Food/ }))
  const dialog = screen.getByRole('alertdialog', { name: 'Delete expense?' })
  expect(dialog).toHaveTextContent(/Food 50\.000\s₫ on 14\/10\/2026 will be deleted\./)

  await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
  expect(onDelete).toHaveBeenCalledWith('e1')
})

test('cancel keeps the expense', async () => {
  const { user, onDelete } = setup()
  await user.click(screen.getByRole('button', { name: /^Delete Food/ }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onDelete).not.toHaveBeenCalled()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('shows an error when delete fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const { user } = setup({
    onDelete: () => {
      throw new DOMException('full', 'QuotaExceededError')
    },
  })
  await user.click(screen.getByRole('button', { name: /^Delete Food/ }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
  expect(screen.getByRole('alert')).toHaveTextContent(SAVE_FAILED)
})
