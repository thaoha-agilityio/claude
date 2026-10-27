// Expense dates are calendar dates ("YYYY-MM-DD"), not instants, so they never shift between time zones.
// Only "today" depends on a clock, and it is always computed in Asia/Ho_Chi_Minh.
export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh'

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_RE = /^(\d{4})-(\d{2})$/

const hcmDateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** Today's calendar date in Ho Chi Minh City as "YYYY-MM-DD". Pass `now` to pin the clock in tests. */
export function todayInHcm(now: Date = new Date()): string {
  const parts = Object.fromEntries(hcmDateParts.formatToParts(now).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** True for a strictly formatted "YYYY-MM-DD" that exists on the calendar (rejects 2026-02-30). */
export function isValidDate(value: string): boolean {
  const m = DATE_RE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1 || mo < 1 || mo > 12 || d < 1) return false
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return d <= daysInMonth
}

function assertValidDate(date: string): void {
  if (!isValidDate(date)) throw new RangeError(`Invalid date: ${JSON.stringify(date)}`)
}

/** "2026-10-14" → "2026-10" */
export function monthKey(date: string): string {
  assertValidDate(date)
  return date.slice(0, 7)
}

/** "2026-10-14" → "14/10/2026" */
export function formatDate(date: string): string {
  assertValidDate(date)
  const [y, m, d] = date.split('-')
  return `${d}/${m}/${y}`
}

/** Moves a "YYYY-MM" month key by `delta` months: shiftMonth("2026-01", -1) → "2025-12". */
export function shiftMonth(month: string, delta: number): string {
  const m = MONTH_RE.exec(month)
  const mo = m ? Number(m[2]) : 0
  if (!m || mo < 1 || mo > 12 || !Number.isInteger(delta)) {
    throw new RangeError(`Invalid month shift: ${JSON.stringify(month)} by ${delta}`)
  }
  const total = Number(m[1]) * 12 + (mo - 1) + delta
  return `${pad(Math.floor(total / 12), 4)}-${pad((total % 12) + 1)}`
}
