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

/** Most digits AmountInput keeps; 15 digits always stays a safe integer, and range errors come from validation. */
export const MAX_INPUT_DIGITS = 15

/**
 * Normalises amount text while typing: keeps digits only, drops leading zeros, caps the length,
 * and regroups with '.', e.g. "1250000" → "1.250.000", "1.250.000 ₫" → "1.250.000". Output always parses with parseVnd.
 */
export function formatVndInput(text: string): string {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_INPUT_DIGITS)
  return digits.replace(/\B(?=(\d{3})+$)/g, '.')
}
