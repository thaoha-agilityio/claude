import { formatVnd, parseVnd } from './money'

describe('parseVnd', () => {
  it.each([
    ['1.250.000', 1250000],
    ['1250000', 1250000],
    ['  50.000  ', 50000],
    ['0', 0],
    ['999', 999],
    ['1.000.000.000.000', 1_000_000_000_000],
  ])('parses %j → %d', (input, expected) => {
    expect(parseVnd(input)).toBe(expected)
  })

  it.each([
    ['', 'empty'],
    ['   ', 'blank'],
    ['-5000', 'negative'],
    ['1,5', 'comma decimal'],
    ['1.250.000,50', 'grouped with decimal'],
    ['1.25', 'dot decimal / bad grouping'],
    ['12.3456', 'bad grouping'],
    ['.500', 'leading separator'],
    ['500.', 'trailing separator'],
    ['1..000', 'double separator'],
    ['1 000', 'space separator'],
    ['1e6', 'exponent'],
    ['abc', 'letters'],
    ['50000đ', 'currency suffix'],
    ['9007199254740993', 'unsafe integer'],
  ])('rejects %j (%s)', (input) => {
    expect(parseVnd(input)).toBeNull()
  })
})

describe('formatVnd', () => {
  // Intl separates the number and symbol with a no-break space.
  it.each([
    [0, '0 ₫'],
    [999, '999 ₫'],
    [1250000, '1.250.000 ₫'],
    [1_000_000_000_000, '1.000.000.000.000 ₫'],
  ])('formats %d → %j', (amount, expected) => {
    expect(formatVnd(amount)).toBe(expected)
  })

  it('round-trips with parseVnd', () => {
    const shown = formatVnd(1250000).replace(/\s₫$/, '')
    expect(parseVnd(shown)).toBe(1250000)
  })
})
