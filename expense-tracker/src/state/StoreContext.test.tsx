import { render, renderHook, act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { CategoryInUseError, ValidationError } from '../storage/repository'
import { STORAGE_KEY } from '../storage/storage'
import { StoreProvider } from './StoreContext'
import { useStore } from './store'

const wrapper = ({ children }: { children: ReactNode }) => <StoreProvider>{children}</StoreProvider>

function AddCategory() {
  const { data, addCategory } = useStore()
  return (
    <>
      <button onClick={() => addCategory('Pets')}>add</button>
      <ul>
        {data.categories.map((c) => (
          <li key={c.id}>{c.name}</li>
        ))}
      </ul>
    </>
  )
}

test('starts with seeded categories and no expenses', () => {
  const { result } = renderHook(useStore, { wrapper })
  expect(result.current.data.categories.map((c) => c.name)).toContain('Food')
  expect(result.current.data.expenses).toEqual([])
})

test('a change re-renders consumers and persists after remount', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<AddCategory />, { wrapper })

  await user.click(screen.getByRole('button', { name: 'add' }))
  expect(screen.getByText('Pets')).toBeInTheDocument()
  expect(localStorage.getItem(STORAGE_KEY)).toContain('Pets')

  unmount()
  render(<AddCategory />, { wrapper })
  expect(screen.getByText('Pets')).toBeInTheDocument()
})

test('expense actions update data', () => {
  const { result } = renderHook(useStore, { wrapper })
  const categoryId = result.current.data.categories[0].id

  let id = ''
  act(() => {
    id = result.current.addExpense({ amount: 50000, date: '2026-10-15', categoryId, notes: '' }).id
  })
  expect(result.current.data.expenses).toHaveLength(1)

  act(() => {
    result.current.updateExpense(id, { amount: 70000, date: '2026-10-15', categoryId, notes: 'x' })
  })
  expect(result.current.data.expenses[0].amount).toBe(70000)

  act(() => result.current.deleteExpense(id))
  expect(result.current.data.expenses).toEqual([])
})

test('errors reach the caller and leave data unchanged', () => {
  const { result } = renderHook(useStore, { wrapper })
  const before = result.current.data
  const categoryId = before.categories[0].id

  expect(() => act(() => result.current.addCategory('  '))).toThrow(ValidationError)
  expect(result.current.data).toBe(before)

  act(() => {
    result.current.addExpense({ amount: 1000, date: '2026-10-15', categoryId, notes: '' })
  })
  expect(() => act(() => result.current.deleteCategory(categoryId))).toThrow(CategoryInUseError)
})

test('useStore throws outside the provider', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => renderHook(useStore)).toThrow(/StoreProvider/)
})
