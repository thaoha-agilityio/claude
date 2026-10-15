import { useMemo, useState } from 'react'
import MonthPicker from '../components/MonthPicker'
import { isValidDate, todayInHcm } from '../domain/dates'
import { formatVnd } from '../domain/money'
import { monthlyTotal, totalsByCategory } from '../domain/reports'
import { useStore } from '../state/store'
import forms from '../components/forms.module.css'
import styles from './ReportsPage.module.css'

const percentFormat = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 })

export default function ReportsPage() {
  const { data } = useStore()
  const [month, setMonth] = useState(() => todayInHcm().slice(0, 7))

  // Report functions reject malformed dates; skip such stored records rather than crash the page.
  const expenses = useMemo(() => data.expenses.filter((e) => isValidDate(e.date)), [data.expenses])
  const total = useMemo(() => monthlyTotal(expenses, month), [expenses, month])
  const rows = useMemo(() => totalsByCategory(expenses, data.categories, month), [expenses, data.categories, month])
  const count = rows.reduce((n, r) => n + r.count, 0)

  return (
    <>
      <h2>Reports</h2>
      <MonthPicker value={month} onChange={setMonth} />

      <p className={styles.total}>
        Total: <strong>{formatVnd(total)}</strong>
      </p>

      {rows.length === 0 ? (
        <p>No expenses this month.</p>
      ) : (
        <div className={forms.scroll}>
          <table className={styles.table} aria-label="Expenses by category">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className={styles.num}>
                  Count
                </th>
                <th scope="col" className={styles.num}>
                  Amount
                </th>
                <th scope="col" className={styles.num}>
                  %
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.categoryId}>
                  <th scope="row">{r.name}</th>
                  <td className={styles.num}>{r.count}</td>
                  <td className={styles.num}>{formatVnd(r.total)}</td>
                  <td className={styles.num}>{percentFormat.format(r.percent / 100)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td className={styles.num}>{count}</td>
                <td className={styles.num}>{formatVnd(total)}</td>
                <td className={styles.num}>{percentFormat.format(1)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  )
}
