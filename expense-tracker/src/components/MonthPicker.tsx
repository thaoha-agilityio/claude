import { useId } from 'react'
import { shiftMonth } from '../domain/dates'
import styles from './forms.module.css'

type Props = {
  /** "YYYY-MM" */
  value: string
  onChange: (month: string) => void
  label?: string
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

/** Month selector: previous/next buttons around a native month input. */
export default function MonthPicker({ value, onChange, label = 'Month' }: Props) {
  const id = useId()
  return (
    <div className={styles.row}>
      <label htmlFor={id}>{label}</label>
      <button type="button" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Previous month">
        ‹
      </button>
      <input
        id={id}
        type="month"
        value={value}
        // Clearing the input or a partial value is ignored; a month is always selected.
        onChange={(e) => MONTH_RE.test(e.target.value) && onChange(e.target.value)}
        required
      />
      <button type="button" onClick={() => onChange(shiftMonth(value, 1))} aria-label="Next month">
        ›
      </button>
    </div>
  )
}
