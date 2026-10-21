// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHttpApi } from '../src/api/http'
import type { StoreData } from '../src/domain/types'
import { CategoryInUseError, createRepository, NotFoundError, ValidationError } from '../src/storage/repository'
import { STORAGE_KEY } from '../src/storage/storage'
import { createApp, MAX_BODY_BYTES } from './app'
import { FileStorage } from './fileStorage'

let dir: string
let storage: FileStorage
let server: Server
let base: string
let counter: number

const NOW = new Date('2026-10-19T03:00:00.000Z')

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'expense-api-'))
  storage = new FileStorage(dir)
  counter = 0
  const repo = createRepository({ storage, now: () => NOW, newId: () => `id-${++counter}` })
  server = createServer(createApp(repo))
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  await new Promise((done) => server.close(done))
  rmSync(dir, { recursive: true, force: true })
})

const api = (path: string, method = 'GET', body?: unknown) =>
  fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })

const stored = (): StoreData => JSON.parse(storage.getItem(STORAGE_KEY)!)
const categoryId = (name: string) => stored().categories.find((c) => c.name === name)!.id
const expense = (overrides: Record<string, unknown> = {}) => ({
  amount: 50_000,
  date: '2026-10-19',
  categoryId: categoryId('Food'),
  notes: 'Lunch',
  ...overrides,
})

describe('GET /api/data', () => {
  it('returns the seeded data, which is already saved to disk', async () => {
    const res = await api('/api/data')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/^application\/json/)
    const data = (await res.json()) as StoreData
    expect(data.version).toBe(1)
    expect(data.categories.map((c) => c.name)).toContain('Food')
    expect(data).toEqual(stored())
  })
})

describe('expenses', () => {
  it('creates an expense, ignoring client-sent ids and timestamps, and persists it', async () => {
    const res = await api('/api/expenses', 'POST', expense({ id: 'evil', createdAt: 'x', notes: '  Lunch  ' }))
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created).toEqual({
      ...expense(),
      id: `id-${counter}`,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    })
    expect(stored().expenses).toEqual([created])
  })

  it('defaults missing notes to an empty string', async () => {
    const { amount, date, categoryId } = expense()
    const res = await api('/api/expenses', 'POST', { amount, date, categoryId })
    expect(res.status).toBe(201)
    expect((await res.json()).notes).toBe('')
  })

  it('rejects wrong types field by field without saving', async () => {
    const res = await api('/api/expenses', 'POST', { amount: '50.000', date: 20261019, categoryId: null, notes: 5 })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('validation')
    expect(Object.keys(body.errors).sort()).toEqual(['amount', 'categoryId', 'date', 'notes'])
    expect(stored().expenses).toEqual([])
  })

  it('applies the shared validation rules', async () => {
    const res = await api('/api/expenses', 'POST', expense({ amount: 0, date: '2026-02-30', categoryId: 'nope' }))
    expect(res.status).toBe(400)
    const { errors } = await res.json()
    expect(errors).toEqual({
      amount: expect.stringMatching(/at least/),
      date: 'Enter a valid date',
      categoryId: 'This category no longer exists',
    })
  })

  it('updates and deletes an expense', async () => {
    const created = await (await api('/api/expenses', 'POST', expense())).json()

    const updated = await api(`/api/expenses/${created.id}`, 'PUT', expense({ amount: 75_000 }))
    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({ id: created.id, amount: 75_000, createdAt: created.createdAt })

    const deleted = await api(`/api/expenses/${created.id}`, 'DELETE')
    expect(deleted.status).toBe(204)
    expect(await deleted.text()).toBe('')
    expect(stored().expenses).toEqual([])
  })

  it('returns 404 for an unknown expense', async () => {
    for (const res of [await api('/api/expenses/nope', 'PUT', expense()), await api('/api/expenses/nope', 'DELETE')]) {
      expect(res.status).toBe(404)
      expect((await res.json()).error).toBe('not_found')
    }
  })
})

describe('categories', () => {
  it('adds, renames and deletes a category', async () => {
    const added = await api('/api/categories', 'POST', { name: '  Travel ' })
    expect(added.status).toBe(201)
    const travel = await added.json()
    expect(travel).toEqual({ id: `id-${counter}`, name: 'Travel', createdAt: NOW.toISOString() })

    const renamed = await api(`/api/categories/${travel.id}`, 'PATCH', { name: 'Trips' })
    expect(renamed.status).toBe(200)
    expect((await renamed.json()).name).toBe('Trips')

    expect((await api(`/api/categories/${travel.id}`, 'DELETE')).status).toBe(204)
    expect(stored().categories.some((c) => c.id === travel.id)).toBe(false)
  })

  it('rejects a duplicate or non-string name', async () => {
    const duplicate = await api('/api/categories', 'POST', { name: 'food' })
    expect(duplicate.status).toBe(400)
    expect((await duplicate.json()).errors).toEqual({ name: 'A category with this name already exists' })

    const wrongType = await api('/api/categories', 'POST', { name: 42 })
    expect(wrongType.status).toBe(400)
    expect((await wrongType.json()).errors).toEqual({ name: 'Name must be a string' })
  })

  it('refuses to delete a category that expenses still use', async () => {
    await api('/api/expenses', 'POST', expense())
    const res = await api(`/api/categories/${categoryId('Food')}`, 'DELETE')
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'category_in_use', count: 1 })
  })
})

describe('requests the API cannot handle', () => {
  it('returns 400 for malformed JSON or a non-object body', async () => {
    const malformed = await api('/api/categories', 'POST', '{"name":')
    expect(malformed.status).toBe(400)
    expect((await malformed.json()).error).toBe('bad_request')
    expect((await api('/api/expenses', 'POST', [1, 2])).status).toBe(400)
  })

  it('returns 400 for a malformed id in the URL', async () => {
    expect((await api('/api/expenses/%E0%A4%A', 'DELETE')).status).toBe(400)
  })

  it('returns 404 for an unknown route and 405 with Allow for a wrong method', async () => {
    expect((await api('/api/nope')).status).toBe(404)
    const res = await api('/api/expenses', 'GET')
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('POST')
  })

  it('returns 415 for a body not sent as JSON, so other sites cannot post without a preflight', async () => {
    const before = stored()
    for (const type of ['text/plain', 'application/x-www-form-urlencoded']) {
      const res = await fetch(base + '/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': type },
        body: JSON.stringify({ name: 'Hacked' }),
      })
      expect(res.status).toBe(415)
      expect((await res.json()).error).toBe('unsupported_media_type')
    }
    expect(stored()).toEqual(before)
  })

  it('returns 413 for an oversized body', async () => {
    const res = await api('/api/categories', 'POST', { name: 'x'.repeat(MAX_BODY_BYTES) })
    expect(res.status).toBe(413)
  })

  it('returns 500 without details when saving fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('disk full')
    })
    const res = await api('/api/categories', 'POST', { name: 'Travel' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'server', message: 'Could not save changes.' })
  })
})

describe("the app's HTTP client against this server", () => {
  it("saves through the API and gets the repository's errors back", async () => {
    const client = createHttpApi(`${base}/api`)
    const food = (await client.getData()).categories.find((c) => c.name === 'Food')!

    const created = await client.addExpense({ amount: 50_000, date: '2026-10-19', categoryId: food.id, notes: '' })
    expect((await client.getData()).expenses).toEqual([created])

    await expect(client.addCategory('FOOD')).rejects.toThrow(ValidationError)
    await expect(client.deleteCategory(food.id)).rejects.toThrow(new CategoryInUseError(1))
    await expect(client.updateExpense('gone', { ...created })).rejects.toThrow(new NotFoundError('Expense', 'gone'))

    await client.deleteExpense(created.id)
    await client.deleteCategory(food.id)
    expect((await client.getData()).categories.some((c) => c.id === food.id)).toBe(false)
  })
})
