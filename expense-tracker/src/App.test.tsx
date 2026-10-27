import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { localStore } from './test/store'

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

test('renders the shell with the expenses page by default', () => {
  render(<App {...localStore()} />)
  expect(screen.getByRole('heading', { name: 'Expense Tracker' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Expenses' })).toHaveAttribute('aria-current', 'page')
})

test('navigates between pages from the nav', async () => {
  const user = userEvent.setup()
  render(<App {...localStore()} />)

  await user.click(screen.getByRole('link', { name: 'Categories' }))
  expect(screen.getByRole('heading', { name: 'Categories' })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/categories')

  await user.click(screen.getByRole('link', { name: 'Reports' }))
  expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Expenses' })).not.toHaveAttribute('aria-current')
})

test('redirects unknown paths to expenses', () => {
  window.history.pushState({}, '', '/nope')
  render(<App {...localStore()} />)
  expect(screen.getByRole('heading', { name: 'Expenses' })).toBeInTheDocument()
  expect(window.location.pathname).toBe('/')
})
