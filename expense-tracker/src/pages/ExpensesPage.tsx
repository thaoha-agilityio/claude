import { useMemo, useState } from 'react'
import ExpenseForm from '../components/ExpenseForm'
import ExpenseList from '../components/ExpenseList'
import MonthPicker from '../components/MonthPicker'
import { isValidDate, todayInHcm } from '../domain/dates'
import { formatVnd } from '../domain/money'
import type { Expense } from '../domain/types'
import type { ExpenseInput } from '../storage/repository'
import { useStore } from '../state/store'

const byNewest = (a: Expense, b: Expense) =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)

export default function ExpensesPage() {
  const { data, addExpense, updateExpense, deleteExpense } = useStore()
  const [month, setMonth] = useState(() => todayInHcm().slice(0, 7))
  const [editing, setEditing] = useState<Expense | null>(null)

  // Skips malformed stored dates instead of crashing the page on them.
  const visible = useMemo(
    () => data.expenses.filter((e) => isValidDate(e.date) && e.date.startsWith(`${month}-`)).sort(byNewest),
    [data.expenses, month],
  )
  const total = visible.reduce((sum, e) => sum + e.amount, 0)

  // Show the month the saved expense is in, so it never seems to disappear.
  function handleAdd(input: ExpenseInput) {
    addExpense(input)
    setMonth(input.date.slice(0, 7))
  }

  function handleUpdate(input: ExpenseInput) {
    if (!editing) return
    updateExpense(editing.id, input)
    setEditing(null)
    setMonth(input.date.slice(0, 7))
  }

  function handleDelete(id: string) {
    deleteExpense(id)
    if (editing?.id === id) setEditing(null)
  }

  return (
    <>
      <h2>Expenses</h2>

      <section aria-labelledby="expense-form-heading">
        <h3 id="expense-form-heading">{editing ? 'Edit expense' : 'Add expense'}</h3>
        {editing ? (
          <ExpenseForm
            key={editing.id}
            categories={data.categories}
            expense={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
            autoFocus
          />
        ) : (
          <ExpenseForm categories={data.categories} onSubmit={handleAdd} />
        )}
      </section>

      <section aria-labelledby="expense-list-heading">
        <h3 id="expense-list-heading">Expense list</h3>
        <MonthPicker value={month} onChange={setMonth} />
        <p>
          Total: <strong>{formatVnd(total)}</strong>
        </p>
        <ExpenseList
          expenses={visible}
          categories={data.categories}
          onEdit={setEditing}
          onDelete={handleDelete}
          emptyMessage="No expenses this month."
        />
      </section>
    </>
  )
}
