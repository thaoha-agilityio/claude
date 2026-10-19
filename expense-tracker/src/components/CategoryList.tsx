import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Category } from '../domain/types'
import { CategoryInUseError } from '../storage/repository'
import ConfirmDialog from './ConfirmDialog'
import { errorMessage } from './errors'
import styles from './CategoryList.module.css'
import forms from './forms.module.css'

type Props = {
  categories: readonly Category[]
  /** Expense count per category id; missing means 0. */
  usage: Readonly<Record<string, number>>
  onRename: (id: string, name: string) => void | Promise<unknown>
  onDelete: (id: string) => void | Promise<void>
}

const plural = (n: number) => `${n} ${n === 1 ? 'expense' : 'expenses'}`

export default function CategoryList({ categories, usage, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null)
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  // Element id to focus after the next render, e.g. the Rename button once its inline form closes.
  const focusNext = useRef<string | null>(null)
  const renameButtonId = (id: string) => `${listId}-rename-${id}`

  useEffect(() => {
    if (!focusNext.current) return
    document.getElementById(focusNext.current)?.focus()
    focusNext.current = null
  })

  function startEdit(category: Category) {
    setEditingId(category.id)
    setDraft(category.name)
    setRowError(null)
  }

  function cancelEdit() {
    if (editingId) focusNext.current = renameButtonId(editingId)
    setEditingId(null)
    setRowError(null)
  }

  async function saveEdit(id: string) {
    try {
      await onRename(id, draft)
      cancelEdit()
    } catch (err) {
      setRowError({ id, message: errorMessage(err, 'name') })
    }
  }

  // In-use categories are refused up front, so the user is never asked to confirm a delete that will fail.
  function requestDelete(category: Category) {
    const count = usage[category.id] ?? 0
    if (count > 0) setRowError({ id: category.id, message: new CategoryInUseError(count).message })
    else {
      setRowError(null)
      setPendingDelete(category)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const { id } = pendingDelete
    setPendingDelete(null)
    try {
      await onDelete(id)
    } catch (err) {
      setRowError({ id, message: err instanceof CategoryInUseError ? err.message : errorMessage(err) })
    }
  }

  if (categories.length === 0) return <p>No categories yet.</p>

  return (
    <div ref={rootRef} tabIndex={-1}>
      <ul className={styles.list} aria-label="Categories">
        {categories.map((category) => (
          <li key={category.id} className={styles.item}>
            {editingId === category.id ? (
              <RenameForm
                category={category}
                draft={draft}
                error={rowError?.id === category.id ? rowError.message : null}
                onChange={setDraft}
                onSave={() => saveEdit(category.id)}
                onCancel={cancelEdit}
              />
            ) : (
              <>
                <div className={forms.row}>
                  <span className={styles.name}>{category.name}</span>
                  <span className={styles.count}>{plural(usage[category.id] ?? 0)}</span>
                  <button
                    type="button"
                    id={renameButtonId(category.id)}
                    onClick={() => startEdit(category)}
                    aria-label={`Rename ${category.name}`}
                  >
                    Rename
                  </button>
                  <button type="button" onClick={() => requestDelete(category)} aria-label={`Delete ${category.name}`}>
                    Delete
                  </button>
                </div>
                {rowError?.id === category.id && (
                  <p className={forms.error} role="alert">
                    {rowError.message}
                  </p>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete category?"
        message={pendingDelete ? `"${pendingDelete.name}" will be deleted.` : ''}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        fallbackFocus={() => rootRef.current}
      />
    </div>
  )
}

type RenameFormProps = {
  category: Category
  draft: string
  error: string | null
  onChange: (value: string) => void
  onSave: () => void
  onCancel: () => void
}

function RenameForm({ category, draft, error, onChange, onSave, onCancel }: RenameFormProps) {
  const errorId = useId()

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSave()
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel()
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className={forms.row}>
        <input
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={`New name for ${category.name}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoFocus
        />
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && (
        <p id={errorId} className={forms.error} role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
