// @vitest-environment node
import { loadData, saveData, STORAGE_KEY } from '../src/storage/storage'
import { SqlKeyValueStorage } from './sqlStorage'
import { testSqlite } from './testSqlite'

test('stores, replaces and removes items', () => {
  const storage = new SqlKeyValueStorage(testSqlite())
  expect(storage.getItem('a')).toBeNull()
  storage.setItem('a', '1')
  storage.setItem('a', '2')
  expect(storage.getItem('a')).toBe('2')
  expect(storage.length).toBe(1)
  storage.removeItem('a')
  expect(storage.getItem('a')).toBeNull()
  expect(storage.length).toBe(0)
})

test('lists keys in sorted order and returns null outside the range', () => {
  const storage = new SqlKeyValueStorage(testSqlite())
  storage.setItem('b', 'x')
  storage.setItem('a', 'y')
  expect([storage.key(0), storage.key(1), storage.key(2), storage.key(-1), storage.key(0.5)]).toEqual(['a', 'b', null, null, null])
  storage.clear()
  expect(storage.length).toBe(0)
})

test('keeps data across instances on the same database, as a restarted Durable Object would', () => {
  const sql = testSqlite()
  saveData({ version: 1, categories: [], expenses: [] }, { storage: new SqlKeyValueStorage(sql) })
  const reloaded = new SqlKeyValueStorage(sql)
  expect(reloaded.getItem(STORAGE_KEY)).toContain('"version":1')
  expect(loadData({ storage: reloaded }).categories).toEqual([])
})

test('backs up unreadable data before resetting, like the other storages', () => {
  const storage = new SqlKeyValueStorage(testSqlite())
  storage.setItem(STORAGE_KEY, '{not json')
  loadData({ storage, now: () => new Date('2026-10-27T00:00:00.000Z') })
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i))
  expect(keys.some((k) => k?.startsWith(`${STORAGE_KEY}:corrupt:`))).toBe(true)
})
