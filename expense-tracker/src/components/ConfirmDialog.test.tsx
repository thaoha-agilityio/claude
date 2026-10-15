import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import ConfirmDialog from './ConfirmDialog'

function Harness({ onConfirm = () => {} }: { onConfirm?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>open</button>
      <ConfirmDialog
        open={open}
        title="Delete it?"
        message="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          onConfirm()
          setOpen(false)
        }}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}

test('renders nothing when closed', () => {
  render(<Harness />)
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('opens labelled, focuses Cancel, and confirms', async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  render(<Harness onConfirm={onConfirm} />)

  await user.click(screen.getByRole('button', { name: 'open' }))
  const dialog = screen.getByRole('alertdialog', { name: 'Delete it?' })
  expect(dialog).toHaveAccessibleDescription('This cannot be undone.')
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: 'Delete' }))
  expect(onConfirm).toHaveBeenCalledOnce()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
})

test('Escape cancels and focus returns to the trigger', async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()
  render(<Harness onConfirm={onConfirm} />)

  await user.click(screen.getByRole('button', { name: 'open' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(onConfirm).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'open' })).toHaveFocus()
})

test('Tab stays inside the dialog', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  await user.click(screen.getByRole('button', { name: 'open' }))
  await user.tab()
  expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
  await user.tab()
  expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus()
})

test('focuses the fallback when the opener is gone', async () => {
  const user = userEvent.setup()
  function Removable() {
    const [open, setOpen] = useState(false)
    const [shown, setShown] = useState(true)
    return (
      <>
        <div data-testid="fallback" tabIndex={-1} />
        {shown && <button onClick={() => setOpen(true)}>remove me</button>}
        <ConfirmDialog
          open={open}
          title="Delete?"
          message="Gone."
          onConfirm={() => {
            setShown(false)
            setOpen(false)
          }}
          onCancel={() => setOpen(false)}
          fallbackFocus={() => document.querySelector<HTMLElement>('[data-testid="fallback"]')}
        />
      </>
    )
  }
  render(<Removable />)
  await user.click(screen.getByRole('button', { name: 'remove me' }))
  await user.click(screen.getByRole('button', { name: 'Confirm' }))
  expect(screen.getByTestId('fallback')).toHaveFocus()
})
