import { formatDate, isValidDate, monthKey, shiftMonth, todayInHcm } from './dates'

describe('todayInHcm', () => {
  it.each([
    // HCM is UTC+7 with no DST.
    ['2026-10-14T16:59:59.999Z', '2026-10-14', 'last ms of the HCM day'],
    ['2026-10-14T17:00:00.000Z', '2026-10-15', 'HCM midnight'],
    ['2026-01-31T23:30:00.000Z', '2026-02-01', 'month boundary: still Jan 31 in UTC'],
    ['2025-12-31T17:00:00.000Z', '2026-01-01', 'year boundary'],
    ['2028-02-28T18:00:00.000Z', '2028-02-29', 'leap day'],
    ['2026-10-14T00:00:00.000Z', '2026-10-14', 'UTC midnight is 07:00 in HCM'],
  ])('%s → %s (%s)', (instant, expected) => {
    expect(todayInHcm(new Date(instant))).toBe(expected)
  })

  it('defaults to the current clock', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-31T17:30:00Z'))
    try {
      expect(todayInHcm()).toBe('2026-04-01')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('isValidDate', () => {
  it.each(['2026-10-14', '2028-02-29', '2026-12-31', '2026-01-01', '2000-02-29'])('accepts %s', (d) => {
    expect(isValidDate(d)).toBe(true)
  })

  it.each([
    '',
    '2026-02-29', // not a leap year
    '1900-02-29', // century, not a leap year
    '2026-04-31',
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-1-5',
    '14/10/2026',
    '2026-10-14T00:00:00Z',
    ' 2026-10-14',
    '0000-01-01',
  ])('rejects %j', (d) => {
    expect(isValidDate(d)).toBe(false)
  })
})

describe('monthKey', () => {
  it('takes the YYYY-MM prefix', () => {
    expect(monthKey('2026-10-14')).toBe('2026-10')
  })

  it('throws on an invalid date', () => {
    expect(() => monthKey('2026-02-30')).toThrow(RangeError)
  })
})

describe('formatDate', () => {
  it('formats as dd/MM/yyyy', () => {
    expect(formatDate('2026-01-05')).toBe('05/01/2026')
  })

  it('throws on an invalid date', () => {
    expect(() => formatDate('not-a-date')).toThrow(RangeError)
  })
})

describe('shiftMonth', () => {
  it.each([
    ['2026-10', 1, '2026-11'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-10', 0, '2026-10'],
    ['2026-10', 14, '2027-12'],
    ['2026-10', -22, '2024-12'],
  ])('shiftMonth(%s, %d) → %s', (month, delta, expected) => {
    expect(shiftMonth(month, delta)).toBe(expected)
  })

  it.each([
    ['2026-13', 1],
    ['2026-1', 1],
    ['2026-10-14', 1],
    ['2026-10', 1.5],
  ])('throws for shiftMonth(%j, %d)', (month, delta) => {
    expect(() => shiftMonth(month, delta)).toThrow(RangeError)
  })
})
