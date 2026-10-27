import { useRef, useState } from 'react'
import { formatDate } from '../domain/dates'
import { formatVnd } from '../domain/money'
import { UNKNOWN_CATEGORY_NAME } from '../domain/reports'
import type { Category, Expense } from '../domain/types'
import ConfirmDialog from './ConfirmDialog'
import { errorMessage } from './errors'
import styles from './ExpenseList.module.css'
import forms from './forms.module.css'
import { editButtonId } from './ids'

type Props = {
  /** Already filtered and sorted for display. */
  expenses: readonly Expense[]
  categories: readonly Category[]
  onEdit: (expense: Expense) => void
  /** May throw or reject (e.g. the server is unreachable); the message is shown above the table. */
  onDelete: (id: string) => void | Promise<void>
  emptyMessage?: string
}

export default function ExpenseList({ expenses, categories, onEdit, onDelete, emptyMessage = 'No expenses.' }: Props) {
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? UNKNOWN_CATEGORY_NAME
  const describe = (e: Expense) => `${categoryName(e.categoryId)} ${formatVnd(e.amount)} on ${formatDate(e.date)}`

  async function confirmDelete() {
    if (!pendingDelete) return
    const { id } = pendingDelete
    setPendingDelete(null)
    try {
      await onDelete(id)
      setError(null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div ref={rootRef} tabIndex={-1}>
      {error && (
        <p className={forms.error} role="alert">
          {error}
        </p>
      )}
      {expenses.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        <div className={forms.scroll}>
          <table className={styles.table} aria-label="Expenses">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Category</th>
                <th scope="col" className={styles.amount}>
                  Amount
                </th>
                <th scope="col">Notes</th>
                <th scope="col">
                  <span className={styles.visuallyHidden}>Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.date)}</td>
                  <td>{categoryName(e.categoryId)}</td>
                  <td className={styles.amount}>{formatVnd(e.amount)}</td>
                  <td className={styles.notes}>{e.notes}</td>
                  <td className={styles.actions}>
                    <button
                      type="button"
                      id={editButtonId(e.id)}
                      onClick={() => onEdit(e)}
                      aria-label={`Edit ${describe(e)}`}
                    >
                      Edit
                    </button>{' '}
                    <button type="button" onClick={() => setPendingDelete(e)} aria-label={`Delete ${describe(e)}`}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete expense?"
        message={pendingDelete ? `${describe(pendingDelete)} will be deleted.` : ''}
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
        fallbackFocus={() => rootRef.current}
      />
    </div>
  )
}
