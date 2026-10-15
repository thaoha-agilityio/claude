import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import AmountInput from './AmountInput'

function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return <AmountInput aria-label="Amount" value={value} onChange={setValue} />
}

const input = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Amount' })

test('groups thousands as you type', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.type(input(), '1250000')
  expect(input()).toHaveValue('1.250.000')
  expect(input()).toHaveAttribute('inputmode', 'numeric')
})

test('ignores non-digits and leading zeros', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.type(input(), '00a5,0-000')
  expect(input()).toHaveValue('50.000')
})

test('accepts a pasted formatted amount', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(input())
  await user.paste('1.250.000 ₫')
  expect(input()).toHaveValue('1.250.000')
})

test('keeps the caret after the inserted digit when separators shift', async () => {
  const user = userEvent.setup()
  render(<Harness initial="1.234" />)
  // Caret after "1", type 9 → "19.234", caret after the 9.
  await user.type(input(), '9', { initialSelectionStart: 1, initialSelectionEnd: 1 })
  expect(input()).toHaveValue('19.234')
  expect(input().selectionStart).toBe(2)
})

test('keeps the caret in place when deleting regroups', async () => {
  const user = userEvent.setup()
  render(<Harness initial="1.234.567" />)
  // Caret after "4" (index 5); Backspace removes the 4 → "123.567", caret after "3".
  await user.type(input(), '{Backspace}', { initialSelectionStart: 5, initialSelectionEnd: 5 })
  expect(input()).toHaveValue('123.567')
  expect(input().selectionStart).toBe(3)
})
