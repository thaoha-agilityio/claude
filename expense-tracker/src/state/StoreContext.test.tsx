import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { createLocalApi, type Api } from '../api/api'
import type { StoreData } from '../domain/types'
import { CategoryInUseError, createRepository, ValidationError } from '../storage/repository'
import { STORAGE_KEY } from '../storage/storage'
import { localStore } from '../test/store'
import { StoreProvider } from './StoreContext'
import { useStore } from './store'

const wrapper = ({ children }: { children: ReactNode }) => <StoreProvider {...localStore()}>{children}</StoreProvider>

function Categories() {
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

const names = (data: StoreData) => data.categories.map((c) => c.name)

test('starts with the given data', () => {
  const { result } = renderHook(useStore, { wrapper })
  expect(names(result.current.data)).toContain('Food')
  expect(result.current.data.expenses).toEqual([])
})

test('a change re-renders consumers and persists after remount', async () => {
  const user = userEvent.setup()
  const { unmount } = render(<Categories />, { wrapper })

  await user.click(screen.getByRole('button', { name: 'add' }))
  expect(screen.getByText('Pets')).toBeInTheDocument()
  expect(localStorage.getItem(STORAGE_KEY)).toContain('Pets')

  unmount()
  render(<Categories />, { wrapper })
  expect(screen.getByText('Pets')).toBeInTheDocument()
})

test('expense actions update data', async () => {
  const { result } = renderHook(useStore, { wrapper })
  const categoryId = result.current.data.categories[0].id

  let id = ''
  await act(async () => {
    id = (await result.current.addExpense({ amount: 50000, date: '2026-10-15', categoryId, notes: '' })).id
  })
  expect(result.current.data.expenses).toHaveLength(1)

  await act(() => result.current.updateExpense(id, { amount: 70000, date: '2026-10-15', categoryId, notes: 'x' }))
  expect(result.current.data.expenses[0].amount).toBe(70000)

  await act(() => result.current.deleteExpense(id))
  expect(result.current.data.expenses).toEqual([])
})

test('errors reach the caller and leave data unchanged', async () => {
  const { result } = renderHook(useStore, { wrapper })
  const categoryId = result.current.data.categories[0].id

  await act(() => expect(result.current.addCategory('  ')).rejects.toThrow(ValidationError))
  expect(names(result.current.data)).not.toContain('')

  await act(() => result.current.addExpense({ amount: 1000, date: '2026-10-15', categoryId, notes: '' }))
  await act(() => expect(result.current.deleteCategory(categoryId)).rejects.toThrow(CategoryInUseError))
  expect(result.current.data.categories.some((c) => c.id === categoryId)).toBe(true)
})

test('a failed action still shows data saved elsewhere', async () => {
  const { result } = renderHook(useStore, { wrapper })
  createRepository().addCategory('Pets')

  await act(() => expect(result.current.addCategory('pets')).rejects.toThrow(ValidationError))
  expect(names(result.current.data)).toContain('Pets')
})

test('loads the data first when none is given', async () => {
  render(
    <StoreProvider api={createLocalApi(createRepository())}>
      <Categories />
    </StoreProvider>,
  )
  expect(screen.getByRole('status')).toHaveTextContent('Loading')
  expect(await screen.findByText('Food')).toBeInTheDocument()
})

test('offers a retry when loading fails', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const local = createLocalApi(createRepository())
  const getData = vi.fn<Api['getData']>().mockRejectedValueOnce(new Error('offline')).mockImplementation(local.getData)
  const user = userEvent.setup()
  render(
    <StoreProvider api={{ ...local, getData }}>
      <Categories />
    </StoreProvider>,
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your data')
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Food')).toBeInTheDocument()
})

test('reloads when the window regains focus', async () => {
  const { result } = renderHook(useStore, { wrapper })
  createRepository().addCategory('Pets')
  expect(names(result.current.data)).not.toContain('Pets')

  act(() => {
    window.dispatchEvent(new Event('focus'))
  })
  await waitFor(() => expect(names(result.current.data)).toContain('Pets'))
})

test('other tabs reload after a change', async () => {
  const user = userEvent.setup()
  render(
    <>
      <div data-testid="a">
        <StoreProvider {...localStore()}>
          <Categories />
        </StoreProvider>
      </div>
      <div data-testid="b">
        <StoreProvider {...localStore()}>
          <ul aria-label="tab b">
            <Names />
          </ul>
        </StoreProvider>
      </div>
    </>,
  )

  await user.click(screen.getByRole('button', { name: 'add' }))
  await waitFor(() => expect(screen.getByRole('list', { name: 'tab b' })).toHaveTextContent('Pets'))
})

function Names() {
  const { data } = useStore()
  return data.categories.map((c) => <li key={c.id}>{c.name}</li>)
}

test('a slow earlier load does not overwrite a newer one', async () => {
  const local = createLocalApi(createRepository())
  const initialData = await local.getData()
  let releaseSlow: (data: StoreData) => void = () => {}
  const getData = vi
    .fn<Api['getData']>()
    .mockImplementationOnce(() => new Promise((resolve) => (releaseSlow = resolve)))
    .mockImplementation(local.getData)
  const { result } = renderHook(useStore, {
    wrapper: ({ children }) => (
      <StoreProvider api={{ ...local, getData }} initialData={initialData}>
        {children}
      </StoreProvider>
    ),
  })

  act(() => {
    window.dispatchEvent(new Event('focus')) // slow load starts
  })
  await act(() => result.current.addCategory('Pets')) // newer load finishes first
  await act(async () => releaseSlow(initialData))
  expect(names(result.current.data)).toContain('Pets')
})

test('useStore throws outside the provider', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => renderHook(useStore)).toThrow(/StoreProvider/)
})
