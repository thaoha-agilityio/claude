import { useLayoutEffect, useRef, type ChangeEvent, type ComponentProps } from 'react'
import { formatVndInput } from '../domain/money'

type Props = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type' | 'ref'> & {
  /** Display text, e.g. "1.250.000". Parse it with parseVnd. */
  value: string
  onChange: (text: string) => void
}

/** Caret index in `text` just after its `digits`-th digit. */
function caretAfterDigits(text: string, digits: number): number {
  if (digits <= 0) return 0
  let seen = 0
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i]) && ++seen === digits) return i + 1
  }
  return text.length
}

/**
 * Text input for whole VND that regroups thousands as you type ("1250000" → "1.250.000").
 * Keeps the caret next to the same digit when separators are inserted or removed.
 */
export default function AmountInput({ value, onChange, ...rest }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingCaret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const input = inputRef.current
    if (pendingCaret.current === null || !input || document.activeElement !== input) return
    input.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  })

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    const caret = e.target.selectionStart ?? raw.length
    const rawDigits = raw.replace(/\D/g, '')
    const leadingZeros = rawDigits.length - rawDigits.replace(/^0+(?=\d)/, '').length
    const digitsBefore = raw.slice(0, caret).replace(/\D/g, '').length - leadingZeros

    const next = formatVndInput(raw)
    pendingCaret.current = caretAfterDigits(next, digitsBefore)
    onChange(next)
  }

  return (
    <input
      {...rest}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={handleChange}
    />
  )
}
