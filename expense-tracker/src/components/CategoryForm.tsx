import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { errorMessage } from './errors'
import styles from './forms.module.css'

type Props = { onAdd: (name: string) => void | Promise<unknown> }

/** Add-category form. `onAdd` throws or rejects with ValidationError for a bad name; the message is shown under the input. */
export default function CategoryForm({ onAdd }: Props) {
  const inputId = useId()
  const errorId = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  // The form is disabled while saving, so Enter can't add the same name twice and text typed meanwhile isn't cleared.
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Disabling the input drops its focus; give it back after the next render, once it is enabled again.
  const refocus = useRef(false)

  useEffect(() => {
    if (saving || !refocus.current) return
    inputRef.current?.focus()
    refocus.current = false
  })

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    refocus.current = true
    try {
      await onAdd(name)
      setName('')
      setError(null)
    } catch (err) {
      setError(errorMessage(err, 'name'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={saving || undefined}>
      <fieldset className={`${styles.fieldset} ${styles.row}`} disabled={saving}>
        <label htmlFor={inputId}>New category</label>
        <input
          ref={inputRef}
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit">Add</button>
      </fieldset>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
