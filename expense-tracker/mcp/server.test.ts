// @vitest-environment node
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createLocalApi, type Api } from '../src/api/api'
import { createHttpApi } from '../src/api/http'
import { createRepository } from '../src/storage/repository'
import { FileStorage } from '../server/fileStorage'
import { createMcpServer } from './server'

// 10:00 on 15 Oct 2026 in Ho Chi Minh City.
const NOW = new Date('2026-10-15T03:00:00Z')

let dir: string
let client: Client

async function connect(api: Api, apiUrl?: string) {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await createMcpServer(api, { now: () => NOW, apiUrl }).connect(serverSide)
  client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(clientSide)
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'expense-mcp-'))
  await connect(createLocalApi(createRepository({ storage: new FileStorage(dir), now: () => NOW })))
})

afterEach(async () => {
  await client.close()
  rmSync(dir, { recursive: true, force: true })
})

type Text = { type: 'text'; text: string }
async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  const text = (result.content as Text[])[0].text
  return { isError: result.isError === true, text, data: result.isError ? undefined : JSON.parse(text) }
}

test('lists every tool, with read-only and destructive ones marked', async () => {
  const { tools } = await client.listTools()
  expect(tools.map((t) => t.name).sort()).toEqual([
    'add_category',
    'add_expense',
    'delete_category',
    'delete_expense',
    'list_categories',
    'list_expenses',
    'monthly_report',
    'rename_category',
    'update_expense',
  ])
  const byName = Object.fromEntries(tools.map((t) => [t.name, t.annotations]))
  expect(byName.list_expenses?.readOnlyHint).toBe(true)
  expect(byName.delete_expense?.destructiveHint).toBe(true)
})

test('adds expenses by category name and lists the current HCM month, newest first', async () => {
  await call('add_expense', { amount: 50_000, date: '2026-10-14', category: 'food', notes: 'Lunch' })
  await call('add_expense', { amount: 30_000, date: '2026-10-15', category: 'Transport' })
  await call('add_expense', { amount: 99_000, date: '2026-09-30', category: 'Food' })

  const { data } = await call('list_expenses')
  expect(data.month).toBe('2026-10')
  expect(data.displayTotal).toMatch(/^80\.000\s₫$/)
  expect(data.expenses.map((e: { displayDate: string; category: string; notes: string }) => [e.displayDate, e.category, e.notes])).toEqual([
    ['15/10/2026', 'Transport', ''],
    ['14/10/2026', 'Food', 'Lunch'],
  ])
})

test('reports a month by category', async () => {
  await call('add_expense', { amount: 75_000, date: '2026-09-02', category: 'Food' })
  await call('add_expense', { amount: 25_000, date: '2026-09-03', category: 'Health' })

  const { data } = await call('monthly_report', { month: '2026-09' })
  expect(data.total).toBe(100_000)
  expect(data.byCategory).toEqual([
    expect.objectContaining({ category: 'Food', count: 1, total: 75_000, percent: 75 }),
    expect.objectContaining({ category: 'Health', count: 1, total: 25_000, percent: 25 }),
  ])
})

test('updates only the fields given', async () => {
  const added = (await call('add_expense', { amount: 50_000, date: '2026-10-14', category: 'Food', notes: 'Lunch' })).data

  const { data } = await call('update_expense', { id: added.id, amount: 65_000 })
  expect(data).toMatchObject({ id: added.id, amount: 65_000, date: '2026-10-14', category: 'Food', notes: 'Lunch' })
})

test('returns validation and lookup failures as tool errors the model can read', async () => {
  const invalid = await call('add_expense', { amount: 0, date: '2026-02-30', category: 'Food' })
  expect(invalid.isError).toBe(true)
  expect(invalid.text).toMatch(/^Not saved\. amount: .*at least.*; date: Enter a valid date$/)

  const noCategory = await call('add_expense', { amount: 1_000, date: '2026-10-14', category: 'Pets' })
  expect(noCategory).toMatchObject({ isError: true, text: expect.stringMatching(/^No category "Pets"\. Categories: Food, /) })

  const missing = await call('delete_expense', { id: 'nope' })
  expect(missing).toMatchObject({ isError: true, text: 'Expense not found: nope' })
})

test('manages categories and refuses to delete one in use', async () => {
  await call('add_category', { name: 'Pets' })
  await call('rename_category', { category: 'pets', newName: 'Pet care' })
  await call('add_expense', { amount: 120_000, date: '2026-10-10', category: 'Pet care' })

  const inUse = await call('delete_category', { category: 'Pet care' })
  expect(inUse).toMatchObject({ isError: true, text: expect.stringMatching(/^Used by 1 expense/) })

  const { data } = await call('list_categories')
  expect(data).toContainEqual(expect.objectContaining({ name: 'Pet care', expenseCount: 1 }))
})

test('says how to start the API when it is not running', async () => {
  await client.close()
  await connect(createHttpApi('http://127.0.0.1:9/api'), 'http://127.0.0.1:9/api')

  const result = await call('list_categories')
  expect(result.isError).toBe(true)
  expect(result.text).toMatch(/Is the expense API running at http:\/\/127\.0\.0\.1:9\/api\? Start it with `npm run server`/)
})
