import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ValidationError } from '../storage/repository'
import CategoryForm from './CategoryForm'
import { SAVE_FAILED } from './errors'

test('submits the name and clears the input', async () => {
  const user = userEvent.setup()
  const onAdd = vi.fn()
  render(<CategoryForm onAdd={onAdd} />)

  const input = screen.getByLabelText('New category')
  await user.type(input, 'Pets{Enter}')
  expect(onAdd).toHaveBeenCalledWith('Pets')
  expect(input).toHaveValue('')
})

test('disables the form while saving, so it cannot submit twice or lose typed text', async () => {
  const user = userEvent.setup()
  let finishSave = () => {}
  const onAdd = vi.fn(() => new Promise<void>((resolve) => (finishSave = resolve)))
  render(<CategoryForm onAdd={onAdd} />)

  const input = screen.getByLabelText('New category')
  await user.type(input, 'Pets{Enter}')
  await user.type(input, '{Enter}Toys')

  expect(onAdd).toHaveBeenCalledTimes(1)
  expect(input).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  expect(input).toHaveValue('Pets')

  await act(async () => finishSave())
  expect(input).toBeEnabled()
  expect(input).toHaveValue('')
  expect(input).toHaveFocus()
})

test('shows a validation error and keeps the input', async () => {
  const user = userEvent.setup()
  const onAdd = vi.fn(() => {
    throw new ValidationError({ name: 'A category with this name already exists' })
  })
  render(<CategoryForm onAdd={onAdd} />)

  const input = screen.getByLabelText('New category')
  await user.type(input, 'Food')
  await user.click(screen.getByRole('button', { name: 'Add' }))

  expect(screen.getByRole('alert')).toHaveTextContent('A category with this name already exists')
  expect(input).toHaveValue('Food')
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveAccessibleDescription('A category with this name already exists')
})

test('shows a generic message when saving fails', async () => {
  const user = userEvent.setup()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <CategoryForm
      onAdd={() => {
        throw new DOMException('full', 'QuotaExceededError')
      }}
    />,
  )
  await user.type(screen.getByLabelText('New category'), 'Pets{Enter}')
  expect(screen.getByRole('alert')).toHaveTextContent(SAVE_FAILED)
})
