import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonthPicker from './MonthPicker'

function setup(value = '2026-01') {
  const onChange = vi.fn()
  render(<MonthPicker value={value} onChange={onChange} />)
  return { user: userEvent.setup(), onChange }
}

test('shows the month in a labelled input', () => {
  setup()
  expect(screen.getByLabelText('Month')).toHaveValue('2026-01')
})

test('steps across year boundaries', async () => {
  const { user, onChange } = setup('2026-01')
  await user.click(screen.getByRole('button', { name: 'Previous month' }))
  expect(onChange).toHaveBeenLastCalledWith('2025-12')

  await user.click(screen.getByRole('button', { name: 'Next month' }))
  expect(onChange).toHaveBeenLastCalledWith('2026-02')
})

test('accepts a picked month and ignores clearing', () => {
  const { onChange } = setup()
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2025-07' } })
  expect(onChange).toHaveBeenCalledWith('2025-07')

  onChange.mockClear()
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '' } })
  expect(onChange).not.toHaveBeenCalled()
})
