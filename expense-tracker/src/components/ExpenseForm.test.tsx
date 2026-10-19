import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Category, Expense } from '../domain/types'
import { ValidationError } from '../storage/repository'
import { SAVE_FAILED } from './errors'
import ExpenseForm from './ExpenseForm'

const categories: Category[] = [
  { id: 'food', name: 'Food', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'transport', name: 'Transport', createdAt: '2026-01-01T00:00:00.000Z' },
]

const expense: Expense = {
  id: 'e1',
  amount: 1250000,
  date: '2026-09-30',
  categoryId: 'transport',
  notes: 'Taxi',
  createdAt: '2026-09-30T01:00:00.000Z',
  updatedAt: '2026-09-30T01:00:00.000Z',
}

const amount = () => screen.getByLabelText('Amount (VND)')
const date = () => screen.getByLabelText('Date')
const category = () => screen.getByLabelText('Category')
const notes = () => screen.getByLabelText('Notes')

function renderForm(props: Partial<Parameters<typeof ExpenseForm>[0]> = {}) {
  const onSubmit = vi.fn()
  render(<ExpenseForm categories={categories} onSubmit={onSubmit} today="2026-10-15" {...props} />)
  return { user: userEvent.setup(), onSubmit }
}

test('starts empty with today as the date', () => {
  renderForm()
  expect(screen.getByRole('form', { name: 'Add expense' })).toBeInTheDocument()
  expect(amount()).toHaveValue('')
  expect(date()).toHaveValue('2026-10-15')
  expect(category()).toHaveValue('')
  expect(notes()).toHaveValue('')
})

test('defaults the date to today in Ho Chi Minh City', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-14T17:30:00Z')) // 00:30 on the 15th in HCM
  try {
    render(<ExpenseForm categories={categories} onSubmit={() => {}} />)
    expect(date()).toHaveValue('2026-10-15')
  } finally {
    vi.useRealTimers()
  }
})

test('submits parsed input, then clears amount and notes but keeps date and category', async () => {
  const { user, onSubmit } = renderForm()
  await user.type(amount(), '50000')
  await user.selectOptions(category(), 'Food')
  await user.type(notes(), 'Lunch')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  expect(onSubmit).toHaveBeenCalledWith({ amount: 50000, date: '2026-10-15', categoryId: 'food', notes: 'Lunch' })
  expect(amount()).toHaveValue('')
  expect(notes()).toHaveValue('')
  expect(category()).toHaveValue('food')
  expect(date()).toHaveValue('2026-10-15')
  expect(amount()).toHaveFocus()
})

test('disables the fields while saving, so nothing typed meanwhile is lost', async () => {
  let finishSave = () => {}
  const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finishSave = resolve)))
  const { user } = renderForm({ onSubmit })
  await user.type(amount(), '50000')
  await user.selectOptions(category(), 'Food')
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  expect(onSubmit).toHaveBeenCalledTimes(1)
  for (const field of [amount(), date(), category(), notes(), screen.getByRole('button', { name: 'Add expense' })]) {
    expect(field).toBeDisabled()
  }

  await act(async () => finishSave())
  expect(amount()).toBeEnabled()
  expect(amount()).toHaveValue('')
  expect(amount()).toHaveFocus()
})

test('shows inline errors, focuses the first invalid field, and does not submit', async () => {
  const { user, onSubmit } = renderForm()
  await user.clear(date())
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  expect(onSubmit).not.toHaveBeenCalled()
  expect(amount()).toHaveAccessibleDescription('Enter an amount in whole VND, e.g. 50.000')
  expect(amount()).toHaveAttribute('aria-invalid', 'true')
  expect(date()).toHaveAccessibleDescription('Date is required')
  expect(category()).toHaveAccessibleDescription('Choose a category')
  expect(notes()).not.toHaveAttribute('aria-invalid')
  expect(amount()).toHaveFocus()
})

test('rejects out-of-range amounts and over-long notes', async () => {
  const { user, onSubmit } = renderForm()
  await user.type(amount(), '0')
  await user.selectOptions(category(), 'Food')
  await user.click(notes())
  await user.paste('x'.repeat(501))
  await user.click(screen.getByRole('button', { name: 'Add expense' }))

  expect(onSubmit).not.toHaveBeenCalled()
  expect(amount()).toHaveAccessibleDescription(/^Amount must be at least 1\s₫$/)
  expect(notes()).toHaveAccessibleDescription('Notes must be at most 500 characters')
})

test("clears a field's error when it changes", async () => {
  const { user } = renderForm()
  await user.click(screen.getByRole('button', { name: 'Add expense' }))
  await user.type(amount(), '5')
  expect(amount()).not.toHaveAttribute('aria-invalid')
  expect(category()).toHaveAttribute('aria-invalid', 'true')
})

test('prefills when editing and submits the changes', async () => {
  const onCancel = vi.fn()
  const { user, onSubmit } = renderForm({ expense, onCancel })
  expect(screen.getByRole('form', { name: 'Edit expense' })).toBeInTheDocument()
  expect(amount()).toHaveValue('1.250.000')
  expect(date()).toHaveValue('2026-09-30')
  expect(category()).toHaveValue('transport')
  expect(notes()).toHaveValue('Taxi')

  await user.clear(notes())
  await user.type(notes(), 'Grab')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(onSubmit).toHaveBeenCalledWith({ amount: 1250000, date: '2026-09-30', categoryId: 'transport', notes: 'Grab' })
  expect(notes()).toHaveValue('Grab')

  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onCancel).toHaveBeenCalledOnce()
})

test('explains when the edited expense category was deleted', async () => {
  const { user, onSubmit } = renderForm({ expense: { ...expense, categoryId: 'gone' } })
  expect(category()).toHaveDisplayValue('(deleted category)')
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(onSubmit).not.toHaveBeenCalled()
  expect(category()).toHaveAccessibleDescription('This category no longer exists')
})

test('shows errors thrown by onSubmit', async () => {
  const onSubmit = vi.fn(() => {
    throw new ValidationError({ categoryId: 'This category no longer exists' })
  })
  const { user } = renderForm({ expense, onSubmit })
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(category()).toHaveAccessibleDescription('This category no longer exists')
  expect(category()).toHaveFocus()
})

test('shows a form-level message when saving fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const onSubmit = vi.fn(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })
  const { user } = renderForm({ expense, onSubmit })
  await user.click(screen.getByRole('button', { name: 'Save changes' }))
  expect(screen.getByRole('alert')).toHaveTextContent(SAVE_FAILED)
  expect(amount()).toHaveValue('1.250.000')
})
