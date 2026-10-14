import type { StoreData } from '../domain/types'
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
    ['bad expense', JSON.stringify({ ...sample, expenses: [{ ...sample.expenses[0], amount: '1000' }] })],
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

describe('migrate', () => {
  it('accepts current-version data and drops unknown top-level fields', () => {
    expect(migrate({ ...sample, extra: true })).toEqual(sample)
  })

  it.each([undefined, 42, 'x', [], { version: '1', categories: [], expenses: [] }])('rejects %j', (raw) => {
    expect(migrate(raw)).toBeNull()
  })
})
