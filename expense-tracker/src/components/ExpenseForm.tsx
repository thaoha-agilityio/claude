import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { todayInHcm } from '../domain/dates'
import { formatVndInput, parseVnd } from '../domain/money'
import type { Category, Expense } from '../domain/types'
import { isValid, validateExpense, type ExpenseField, type ValidationErrors } from '../domain/validation'
import { ValidationError, type ExpenseInput } from '../storage/repository'
import AmountInput from './AmountInput'
import { errorMessage } from './errors'
import styles from './forms.module.css'

type Props = {
  categories: readonly Category[]
  /** Expense being edited; omit to create. */
  expense?: Expense
  /** Called with valid input. May throw or reject (ValidationError or a save error); the message is shown in the form. */
  onSubmit: (input: ExpenseInput) => void | Promise<void>
  onCancel?: () => void
  /** Default date for a new expense; defaults to today in Ho Chi Minh City. */
  today?: string
  /** Focus the amount field on mount (e.g. when an edit starts). */
  autoFocus?: boolean
}

type Fields = { amount: string; date: string; categoryId: string; notes: string }

const FIELD_ORDER: ExpenseField[] = ['amount', 'date', 'categoryId', 'notes']

function initialFields(expense: Expense | undefined, today: string): Fields {
  if (!expense) return { amount: '', date: today, categoryId: '', notes: '' }
  return {
    amount: formatVndInput(String(expense.amount)),
    date: expense.date,
    categoryId: expense.categoryId,
    notes: expense.notes,
  }
}

/**
 * Create/edit form. Validates on submit with the same rules as the repository, shows errors next to each field,
 * and focuses the first invalid one. After a successful create it clears amount and notes but keeps
 * date and category, for entering several expenses in a row.
 */
export default function ExpenseForm({ categories, expense, onSubmit, onCancel, today, autoFocus }: Props) {
  const id = useId()
  const [fields, setFields] = useState(() => initialFields(expense, today ?? todayInHcm()))
  const [errors, setErrors] = useState<ValidationErrors<ExpenseField>>({})
  const [formError, setFormError] = useState<string | null>(null)
  // The fields are disabled while saving, so input typed meanwhile can't be cleared or lost when the save finishes.
  const [saving, setSaving] = useState(false)
  // Focus moves after the next render, once the fields are enabled again.
  const focusNext = useRef<ExpenseField | null>(null)

  useEffect(() => {
    if (saving || !focusNext.current) return
    document.getElementById(`${id}-${focusNext.current}`)?.focus()
    focusNext.current = null
  })

  const isEdit = expense !== undefined
  // Keep the edited expense's category selectable even if it no longer exists, so validation can explain it.
  const missingCategory = fields.categoryId !== '' && !categories.some((c) => c.id === fields.categoryId)

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((f) => ({ ...f, [key]: value }))
    setErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setFormError(null)
  }

  function showErrors(next: ValidationErrors<ExpenseField>) {
    setErrors(next)
    focusNext.current = FIELD_ORDER.find((f) => next[f]) ?? null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const draft = { ...fields, amount: parseVnd(fields.amount) }
    const found = validateExpense(draft, categories)
    if (!isValid(found)) return showErrors(found)

    const input: ExpenseInput = { ...draft, amount: draft.amount! }
    setSaving(true)
    try {
      await onSubmit(input)
    } catch (err) {
      if (err instanceof ValidationError) showErrors(err.errors as ValidationErrors<ExpenseField>)
      else setFormError(errorMessage(err))
      return
    } finally {
      setSaving(false)
    }
    setErrors({})
    setFormError(null)
    if (!isEdit) {
      setFields((f) => ({ ...f, amount: '', notes: '' }))
      focusNext.current = 'amount'
    }
  }

  const fieldProps = (field: ExpenseField) => ({
    id: `${id}-${field}`,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${id}-${field}-error` : undefined,
  })

  const fieldError = (field: ExpenseField) =>
    errors[field] && (
      <p id={`${id}-${field}-error`} className={styles.error}>
        {errors[field]}
      </p>
    )

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-label={isEdit ? 'Edit expense' : 'Add expense'}
      aria-busy={saving || undefined}
    >
      <fieldset className={styles.fieldset} disabled={saving}>
        <div className={styles.field}>
          <label htmlFor={`${id}-amount`}>Amount (VND)</label>
          <AmountInput
            {...fieldProps('amount')}
            value={fields.amount}
            onChange={(text) => set('amount', text)}
            placeholder="50.000"
            autoFocus={autoFocus}
          />
          {fieldError('amount')}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-date`}>Date</label>
          <input {...fieldProps('date')} type="date" value={fields.date} onChange={(e) => set('date', e.target.value)} />
          {fieldError('date')}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-categoryId`}>Category</label>
          <select {...fieldProps('categoryId')} value={fields.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">Choose a category…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            {missingCategory && <option value={fields.categoryId}>(deleted category)</option>}
          </select>
          {fieldError('categoryId')}
        </div>

        <div className={styles.field}>
          <label htmlFor={`${id}-notes`}>Notes</label>
          <textarea {...fieldProps('notes')} rows={3} value={fields.notes} onChange={(e) => set('notes', e.target.value)} />
          {fieldError('notes')}
        </div>

        {formError && (
          <p className={styles.error} role="alert">
            {formError}
          </p>
        )}

        <div className={styles.row}>
          <button type="submit">{isEdit ? 'Save changes' : 'Add expense'}</button>
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </fieldset>
    </form>
  )
}
