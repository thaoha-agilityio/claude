// VND amounts are whole numbers: '.' is the thousands separator and decimals are not allowed.
const GROUPED = /^\d{1,3}(\.\d{3})+$/
const PLAIN = /^\d+$/

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

/**
 * Parses user input such as "1.250.000" or "1250000" into an integer number of VND.
 * Returns null for anything else: decimals, negatives, malformed grouping, or unsafe integers.
 * Range rules (e.g. amount > 0) live in validation.
 */
export function parseVnd(input: string): number | null {
  const s = input.trim()
  if (!PLAIN.test(s) && !GROUPED.test(s)) return null
  const n = Number(s.replaceAll('.', ''))
  return Number.isSafeInteger(n) ? n : null
}

/** Formats an integer VND amount for display, e.g. 1250000 → "1.250.000 ₫". */
export function formatVnd(amount: number): string {
  return vndFormatter.format(amount)
}
