// @vitest-environment node
import worker, { ExpenseStore, type Env } from './index'
import { STORE_NAME } from './store'
import { testSqlite } from './testSqlite'

/** One ExpenseStore per name, like the runtime; assets answer with a marker so routing is visible. */
function env(): Env & { names: unknown[] } {
  const stores = new Map<unknown, ExpenseStore>()
  const names: unknown[] = []
  return {
    names,
    EXPENSES: {
      idFromName: (name) => (names.push(name), name),
      get: (id) => {
        if (!stores.has(id)) stores.set(id, new ExpenseStore({ storage: { sql: testSqlite() } }))
        return stores.get(id)!
      },
    },
    ASSETS: { fetch: async () => new Response('app', { headers: { 'Content-Type': 'text/html' } }) },
  }
}

test('serves the app for non-API paths', async () => {
  const res = await worker.fetch(new Request('https://x.test/reports'), env())
  expect(await res.text()).toBe('app')
})

test('sends /api/* to the one ExpenseStore, which keeps what was saved', async () => {
  const e = env()
  const data = await (await worker.fetch(new Request('https://x.test/api/data'), e)).json()
  const food = data.categories.find((c: { name: string }) => c.name === 'Food')

  const created = await worker.fetch(
    new Request('https://x.test/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 45000, date: '2026-10-27', categoryId: food.id, notes: 'Phở bò' }),
    }),
    e,
  )
  expect(created.status).toBe(201)

  const after = await (await worker.fetch(new Request('https://x.test/api/data'), e)).json()
  expect(after.expenses).toHaveLength(1)
  expect(after.expenses[0]).toMatchObject({ amount: 45000, notes: 'Phở bò' })
  expect(new Set(e.names)).toEqual(new Set([STORE_NAME]))
})

test('has no reset endpoint in production', async () => {
  const res = await worker.fetch(new Request('https://x.test/api/__reset', { method: 'POST' }), env())
  expect(res.status).toBe(404)
})

test('rejects a body not sent as JSON, so other sites cannot post to the deployed API', async () => {
  const e = env()
  const res = await worker.fetch(
    new Request('https://x.test/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ name: 'Hacked' }),
    }),
    e,
  )
  expect(res.status).toBe(415)
  const data = await (await worker.fetch(new Request('https://x.test/api/data'), e)).json()
  expect(data.categories.map((c: { name: string }) => c.name)).not.toContain('Hacked')
})
