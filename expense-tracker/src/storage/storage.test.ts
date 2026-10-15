import { monthlyTotal } from '../domain/reports'
import type { Expense, StoreData } from '../domain/types'
import { MAX_AMOUNT } from '../domain/validation'
import {
  createSeedData,
  CURRENT_VERSION,
  DEFAULT_CATEGORY_NAMES,
  loadData,
  migrate,
  saveData,
  STORAGE_KEY,
} from './storage'

const NOW = new Date('2026-10-14T03:00:00.000Z')
let counter = 0
const deps = { now: () => NOW, newId: () => `id-${++counter}` }

const sample: StoreData = {
  version: 1,
  categories: [{ id: 'c1', name: 'Food', createdAt: '2026-10-01T00:00:00.000Z' }],
  expenses: [
    {
      id: 'e1',
      amount: 1250000,
      date: '2026-10-14',
      categoryId: 'c1',
      notes: 'Phở',
      createdAt: '2026-10-14T03:00:00.000Z',
      updatedAt: '2026-10-14T03:00:00.000Z',
    },
  ],
}

beforeEach(() => {
  counter = 0
})

describe('createSeedData', () => {
  it('creates the default categories with unique ids and no expenses', () => {
    const data = createSeedData(deps)
    expect(data.version).toBe(CURRENT_VERSION)
    expect(data.categories.map((c) => c.name)).toEqual([...DEFAULT_CATEGORY_NAMES])
    expect(new Set(data.categories.map((c) => c.id)).size).toBe(DEFAULT_CATEGORY_NAMES.length)
    expect(data.categories.every((c) => c.createdAt === NOW.toISOString())).toBe(true)
    expect(data.expenses).toEqual([])
  })

  it('uses crypto.randomUUID by default', () => {
    const ids = createSeedData().categories.map((c) => c.id)
    expect(ids[0]).toMatch(/^[0-9a-f-]{36}$/)
  })
})

describe('loadData / saveData', () => {
  it('seeds defaults on first run without writing', () => {
    const data = loadData(deps)
    expect(data.categories).toHaveLength(DEFAULT_CATEGORY_NAMES.length)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('round-trips saved data', () => {
    saveData(sample)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(sample)
    expect(loadData(deps)).toEqual(sample)
  })

  it.each([
    ['invalid JSON', '{not json'],
    ['wrong shape', JSON.stringify({ version: 1, categories: 'nope', expenses: [] })],
    ['bad category', JSON.stringify({ ...sample, categories: [{ id: 'c1', name: 42 }] })],
    ['unknown future version', JSON.stringify({ ...sample, version: 2 })],
    ['missing version', JSON.stringify({ categories: [], expenses: [] })],
    ['JSON null', 'null'],
  ])('falls back to defaults on %s, backing up the original and warning', (_label, text) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, text)

    const data = loadData(deps)

    expect(data.categories.map((c) => c.name)).toEqual([...DEFAULT_CATEGORY_NAMES])
    expect(data.expenses).toEqual([])
    const backupKey = `${STORAGE_KEY}:corrupt:${NOW.toISOString()}`
    expect(localStorage.getItem(backupKey)).toBe(text)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(text) // untouched until the next save
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(backupKey))
    warn.mockRestore()
  })

  it('falls back to defaults when storage cannot be read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
    } as unknown as Storage

    expect(loadData({ ...deps, storage: broken }).categories).toHaveLength(DEFAULT_CATEGORY_NAMES.length)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('lets save errors (e.g. quota exceeded) reach the caller', () => {
    const full = {
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    } as unknown as Storage
    expect(() => saveData(sample, { storage: full })).toThrow('full')
  })
})

describe('loadData with invalid expenses', () => {
  const bad: Expense = { ...sample.expenses[0], id: 'bad', date: '2026/10/14' }
  const text = JSON.stringify({ ...sample, expenses: [...sample.expenses, bad] })
  const backupKey = `${STORAGE_KEY}:corrupt:${NOW.toISOString()}`

  it('drops them, keeps the rest, backs up the original once and saves the cleaned data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, text)

    expect(loadData(deps)).toEqual(sample)
    expect(localStorage.getItem(backupKey)).toBe(text)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(sample)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/Dropped 1 invalid expense.*corrupt/))

    // The next load is clean: no new backup, no warning.
    warn.mockClear()
    const later = { ...deps, now: () => new Date(NOW.getTime() + 60_000) }
    expect(loadData(later)).toEqual(sample)
    expect(Object.keys(localStorage).filter((k) => k.includes(':corrupt:'))).toEqual([backupKey])
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('does not overwrite the original when the backup fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, text)
    const noWrites = {
      getItem: (k: string) => localStorage.getItem(k),
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    } as unknown as Storage

    expect(loadData({ ...deps, storage: noWrites })).toEqual(sample)
    expect(localStorage.getItem(STORAGE_KEY)).toBe(text)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not be backed up'))
    warn.mockRestore()
  })

  it('makes the monthly report safe to compute (issue #1 repro)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    localStorage.setItem(STORAGE_KEY, text)
    expect(monthlyTotal(loadData(deps).expenses, '2026-10')).toBe(1250000)
  })
})

describe('migrate', () => {
  it('accepts current-version data and drops unknown top-level fields', () => {
    expect(migrate({ ...sample, extra: true })).toEqual(sample)
  })

  it.each([
    ['malformed date', { date: '2026/10/14' }],
    ['dd/MM/yyyy date', { date: '14/10/2026' }],
    ['empty date', { date: '' }],
    ['non-existent date', { date: '2026-02-30' }],
    ['zero amount', { amount: 0 }],
    ['negative amount', { amount: -50000 }],
    ['amount above max', { amount: MAX_AMOUNT + 1 }],
    ['fractional amount', { amount: 1.5 }],
    ['string amount', { amount: '1000' }],
    ['missing notes', { notes: undefined }],
  ])('drops an expense with %s and keeps the others', (_label, patch) => {
    const bad = { ...sample.expenses[0], id: 'bad', ...patch }
    expect(migrate({ ...sample, expenses: [sample.expenses[0], bad] })).toEqual(sample)
  })

  it('keeps boundary amounts', () => {
    const min = { ...sample.expenses[0], id: 'min', amount: 1 }
    const max = { ...sample.expenses[0], id: 'max', amount: MAX_AMOUNT }
    expect(migrate({ ...sample, expenses: [min, max] })?.expenses).toEqual([min, max])
  })

  it.each([undefined, 42, 'x', [], { version: '1', categories: [], expenses: [] }])('rejects %j', (raw) => {
    expect(migrate(raw)).toBeNull()
  })
})
