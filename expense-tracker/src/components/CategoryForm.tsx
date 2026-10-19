import { useId, useState, type FormEvent } from 'react'
import { errorMessage } from './errors'
import styles from './forms.module.css'

type Props = { onAdd: (name: string) => void | Promise<unknown> }

/** Add-category form. `onAdd` throws or rejects with ValidationError for a bad name; the message is shown under the input. */
export default function CategoryForm({ onAdd }: Props) {
  const inputId = useId()
  const errorId = useId()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await onAdd(name)
      setName('')
      setError(null)
    } catch (err) {
      setError(errorMessage(err, 'name'))
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className={styles.row}>
        <label htmlFor={inputId}>New category</label>
        <input
          id={inputId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit">Add</button>
      </div>
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
