import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StoreProvider } from '../state/StoreContext'
import { createRepository } from '../storage/repository'
import { STORAGE_KEY } from '../storage/storage'
import CategoriesPage from './CategoriesPage'

function renderPage() {
  const repository = createRepository()
  render(
    <StoreProvider repository={repository}>
      <CategoriesPage />
    </StoreProvider>,
  )
  return { user: userEvent.setup(), repository }
}

const names = () =>
  within(screen.getByRole('list', { name: 'Categories' }))
    .getAllByRole('listitem')
    .map((li) => li.firstElementChild?.firstElementChild?.textContent)

test('lists seeded categories sorted by name', () => {
  renderPage()
  expect(names()).toEqual([
    'Entertainment',
    'Food',
    'Health',
    'Housing',
    'Other',
    'Shopping',
    'Transport',
    'Utilities',
  ])
})

test('adds, renames and deletes a category, persisting each change', async () => {
  const { user } = renderPage()

  await user.type(screen.getByLabelText('New category'), 'Pets{Enter}')
  expect(names()).toContain('Pets')

  await user.click(screen.getByRole('button', { name: 'Rename Pets' }))
  await user.clear(screen.getByRole('textbox', { name: 'New name for Pets' }))
  await user.type(screen.getByRole('textbox', { name: 'New name for Pets' }), 'Animals{Enter}')
  expect(names()).toContain('Animals')
  expect(localStorage.getItem(STORAGE_KEY)).toContain('Animals')

  await user.click(screen.getByRole('button', { name: 'Delete Animals' }))
  await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))
  expect(names()).not.toContain('Animals')
  expect(localStorage.getItem(STORAGE_KEY)).not.toContain('Animals')
})

test('rejects a duplicate name', async () => {
  const { user } = renderPage()
  await user.type(screen.getByLabelText('New category'), ' food {Enter}')
  expect(screen.getByRole('alert')).toHaveTextContent('A category with this name already exists')
})

test('blocks deleting a category that has expenses', async () => {
  // Persist expenses first; the page then loads them from storage.
  const seed = createRepository()
  const food = seed.getData().categories.find((c) => c.name === 'Food')!
  seed.addExpense({ amount: 1000, date: '2026-10-15', categoryId: food.id, notes: '' })
  seed.addExpense({ amount: 2000, date: '2026-10-15', categoryId: food.id, notes: '' })
  const { user } = renderPage()

  await user.click(screen.getByRole('button', { name: 'Delete Food' }))
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(screen.getByRole('alert')).toHaveTextContent('Used by 2 expenses — reassign them first.')
  expect(names()).toContain('Food')
})
