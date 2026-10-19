// @vitest-environment node
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadData, STORAGE_KEY } from '../src/storage/storage'
import { FileStorage } from './fileStorage'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'expense-storage-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

test('returns null for a missing key and round-trips a value', () => {
  const storage = new FileStorage(dir)
  expect(storage.getItem(STORAGE_KEY)).toBeNull()
  storage.setItem(STORAGE_KEY, '{"a":1}')
  expect(storage.getItem(STORAGE_KEY)).toBe('{"a":1}')
  expect(new FileStorage(dir).getItem(STORAGE_KEY)).toBe('{"a":1}')
})

test('keeps keys with ":" apart and lists them', () => {
  const storage = new FileStorage(dir)
  storage.setItem('expense-tracker:v1', 'main')
  storage.setItem('expense-tracker:v1:corrupt:2026-10-19T00:00:00.000Z', 'backup')
  expect(storage.length).toBe(2)
  expect([storage.key(0), storage.key(1)]).toEqual([
    'expense-tracker:v1',
    'expense-tracker:v1:corrupt:2026-10-19T00:00:00.000Z',
  ])
  expect(storage.key(2)).toBeNull()
})

test('leaves no temp files behind after writing', () => {
  const storage = new FileStorage(dir)
  storage.setItem('k', 'one')
  storage.setItem('k', 'two')
  expect(readdirSync(dir)).toEqual(['k.json'])
})

test('removes one key or all of them', () => {
  const storage = new FileStorage(dir)
  storage.setItem('a', '1')
  storage.setItem('b', '2')
  storage.removeItem('a')
  storage.removeItem('missing')
  expect(storage.getItem('a')).toBeNull()
  storage.clear()
  expect(storage.length).toBe(0)
})

test('backs up a corrupt data file to its own file and starts from defaults', () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  writeFileSync(join(dir, `${encodeURIComponent(STORAGE_KEY)}.json`), '{"broken"')
  const storage = new FileStorage(dir)
  const data = loadData({ storage, now: () => new Date('2026-10-19T00:00:00.000Z') })
  expect(data.categories).toHaveLength(8)
  expect(storage.getItem(`${STORAGE_KEY}:corrupt:2026-10-19T00:00:00.000Z`)).toBe('{"broken"')
})
