import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import type { Category } from '../domain/types'
import { ValidationError } from '../storage/repository'
import CategoryList from './CategoryList'

const categories: Category[] = [
  { id: 'c1', name: 'Food', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'c2', name: 'Pets', createdAt: '2026-01-01T00:00:00.000Z' },
]

function setup(overrides: Partial<Parameters<typeof CategoryList>[0]> = {}) {
  const props = { categories, usage: { c1: 2 }, onRename: vi.fn(), onDelete: vi.fn(), ...overrides }
  render(<CategoryList {...props} />)
  return { user: userEvent.setup(), ...props }
}

test('lists categories with expense counts', () => {
  setup()
  const items = within(screen.getByRole('list', { name: 'Categories' })).getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('Food2 expenses')
  expect(items[1]).toHaveTextContent('Pets0 expenses')
})

test('shows an empty state', () => {
  setup({ categories: [] })
  expect(screen.getByText('No categories yet.')).toBeInTheDocument()
})

test('renames inline', async () => {
  const { user, onRename } = setup()
  await user.click(screen.getByRole('button', { name: 'Rename Pets' }))
  const input = screen.getByRole('textbox', { name: 'New name for Pets' })
  expect(input).toHaveFocus()
  await user.clear(input)
  await user.type(input, 'Animals{Enter}')
  expect(onRename).toHaveBeenCalledWith('c2', 'Animals')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
})

test('keeps editing and shows the error when rename fails', async () => {
  const onRename = vi.fn(() => {
    throw new ValidationError({ name: 'A category with this name already exists' })
  })
  const { user } = setup({ onRename })
  await user.click(screen.getByRole('button', { name: 'Rename Pets' }))
  await user.clear(screen.getByRole('textbox'))
  await user.type(screen.getByRole('textbox'), 'food')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(screen.getByRole('alert')).toHaveTextContent('A category with this name already exists')
  expect(screen.getByRole('textbox')).toHaveValue('food')
})

test('Escape cancels rename', async () => {
  const { user, onRename } = setup()
  await user.click(screen.getByRole('button', { name: 'Rename Pets' }))
  await user.type(screen.getByRole('textbox'), 'xyz{Escape}')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.getByText('Pets')).toBeInTheDocument()
  expect(onRename).not.toHaveBeenCalled()
})

test('deletes an unused category after confirmation', async () => {
  const { user, onDelete } = setup()
  await user.click(screen.getByRole('button', { name: 'Delete Pets' }))
  const dialog = screen.getByRole('alertdialog', { name: 'Delete category?' })
  expect(dialog).toHaveTextContent('"Pets" will be deleted.')

  await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
  expect(onDelete).toHaveBeenCalledWith('c2')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('cancelling the dialog does not delete', async () => {
  const { user, onDelete } = setup()
  await user.click(screen.getByRole('button', { name: 'Delete Pets' }))
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onDelete).not.toHaveBeenCalled()
})

test('refuses to delete an in-use category without opening the dialog', async () => {
  const { user, onDelete } = setup()
  await user.click(screen.getByRole('button', { name: 'Delete Food' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Used by 2 expenses — reassign them first.')
  expect(onDelete).not.toHaveBeenCalled()
})

test('returns focus to the Rename button after saving or cancelling', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: 'Rename Pets' }))
  await user.keyboard('{Escape}')
  expect(screen.getByRole('button', { name: 'Rename Pets' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: 'Rename Pets' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByRole('button', { name: 'Rename Pets' })).toHaveFocus()
})

test('moves focus into the list after a deleted row disappears', async () => {
  const user = userEvent.setup()
  function Harness() {
    const [items, setItems] = useState(categories)
    return (
      <CategoryList
        categories={items}
        usage={{}}
        onRename={vi.fn()}
        onDelete={(id) => setItems((xs) => xs.filter((c) => c.id !== id))}
      />
    )
  }
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Delete Pets' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
  expect(screen.queryByText('Pets')).not.toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Categories' }).parentElement).toHaveFocus()
})
