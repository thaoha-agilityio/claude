import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import type { Api } from '../src/api/api'
import { ApiRequestError } from '../src/api/http'
import { formatDate, todayInHcm } from '../src/domain/dates'
import { formatVnd } from '../src/domain/money'
import { monthlyTotal, totalsByCategory, UNKNOWN_CATEGORY_NAME } from '../src/domain/reports'
import type { Category, Expense, StoreData } from '../src/domain/types'
import { CategoryInUseError, NotFoundError, ValidationError } from '../src/storage/repository'

type Options = {
  /** Shown in errors when the API can't be reached. */
  apiUrl?: string
  /** Pins "today" in tests; defaults to the real clock. */
  now?: () => Date
}

const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use "YYYY-MM"')
  .describe('Month as "YYYY-MM". Defaults to the current month in Ho Chi Minh City.')
const amount = z.number().int().describe('Whole VND, no decimals, e.g. 50000 for 50.000 ₫')
const date = z.string().describe('Calendar date "YYYY-MM-DD"')
const category = z.string().describe('Category id or name (case-insensitive)')

const sameName = (a: string, b: string) =>
  a.trim().normalize('NFC').localeCompare(b.trim().normalize('NFC'), 'vi', { sensitivity: 'accent' }) === 0

/** Finds a category by id or by name, so callers can say "Food" instead of a UUID. */
function findCategory(data: StoreData, idOrName: string): Category {
  const found = data.categories.find((c) => c.id === idOrName) ?? data.categories.find((c) => sameName(c.name, idOrName))
  if (!found) {
    throw new UserError(
      `No category "${idOrName}". Categories: ${data.categories.map((c) => c.name).join(', ') || '(none)'}.`,
    )
  }
  return found
}

/** An error whose message is meant for the model as-is. */
class UserError extends Error {}

const json = (value: unknown): CallToolResult => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] })

function describeExpense(e: Expense, data: StoreData) {
  return {
    id: e.id,
    date: e.date,
    displayDate: formatDate(e.date),
    category: data.categories.find((c) => c.id === e.categoryId)?.name ?? UNKNOWN_CATEGORY_NAME,
    categoryId: e.categoryId,
    amount: e.amount,
    displayAmount: formatVnd(e.amount),
    notes: e.notes,
  }
}

/**
 * MCP server exposing the expense tracker as tools. All reads and writes go through `api` (the REST server in
 * practice), so the server's validation and storage rules apply exactly as they do for the app.
 */
export function createMcpServer(api: Api, { apiUrl = 'the API', now = () => new Date() }: Options = {}): McpServer {
  const server = new McpServer({ name: 'expense-tracker', version: '0.1.0' })
  const currentMonth = () => todayInHcm(now()).slice(0, 7)

  /** Runs a tool body and turns failures into readable tool errors instead of protocol errors. */
  const run =
    <A>(fn: (args: A) => Promise<unknown>) =>
    async (args: A): Promise<CallToolResult> => {
      try {
        return json(await fn(args))
      } catch (err) {
        return { isError: true, content: [{ type: 'text', text: explain(err) }] }
      }
    }

  function explain(err: unknown): string {
    if (err instanceof ValidationError) {
      const fields = Object.entries(err.errors as Record<string, string>).map(([field, message]) => `${field}: ${message}`)
      return `Not saved. ${fields.join('; ')}`
    }
    if (err instanceof NotFoundError || err instanceof CategoryInUseError || err instanceof UserError) return err.message
    if (err instanceof ApiRequestError && err.status === undefined) {
      return `${err.message}. Is the expense API running at ${apiUrl}? Start it with \`npm run server\` in expense-tracker/.`
    }
    return err instanceof Error ? err.message : String(err)
  }

  server.registerTool(
    'list_categories',
    {
      title: 'List categories',
      description: 'Lists all expense categories with how many expenses use each.',
      annotations: { readOnlyHint: true },
    },
    run(async () => {
      const data = await api.getData()
      return data.categories.map((c) => ({
        id: c.id,
        name: c.name,
        expenseCount: data.expenses.filter((e) => e.categoryId === c.id).length,
      }))
    }),
  )

  server.registerTool(
    'list_expenses',
    {
      title: 'List expenses',
      description: 'Lists the expenses of one month, newest first, with the month total. Amounts are in VND.',
      inputSchema: { month: month.optional() },
      annotations: { readOnlyHint: true },
    },
    run(async ({ month: m }: { month?: string }) => {
      const data = await api.getData()
      const selected = m ?? currentMonth()
      const expenses = data.expenses
        .filter((e) => e.date.startsWith(`${selected}-`))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      const total = monthlyTotal(data.expenses, selected)
      return {
        month: selected,
        total,
        displayTotal: formatVnd(total),
        expenses: expenses.map((e) => describeExpense(e, data)),
      }
    }),
  )

  server.registerTool(
    'monthly_report',
    {
      title: 'Monthly report',
      description: 'Total spending for a month and the breakdown by category (count, amount, share in percent).',
      inputSchema: { month: month.optional() },
      annotations: { readOnlyHint: true },
    },
    run(async ({ month: m }: { month?: string }) => {
      const data = await api.getData()
      const selected = m ?? currentMonth()
      const total = monthlyTotal(data.expenses, selected)
      return {
        month: selected,
        total,
        displayTotal: formatVnd(total),
        byCategory: totalsByCategory(data.expenses, data.categories, selected).map((r) => ({
          category: r.name,
          count: r.count,
          total: r.total,
          displayTotal: formatVnd(r.total),
          percent: Math.round(r.percent * 10) / 10,
        })),
      }
    }),
  )

  server.registerTool(
    'add_expense',
    {
      title: 'Add expense',
      description: 'Adds an expense. Returns the saved expense.',
      inputSchema: { amount, date, category, notes: z.string().optional().describe('Optional, up to 500 characters') },
    },
    run(async (args: { amount: number; date: string; category: string; notes?: string }) => {
      const data = await api.getData()
      const saved = await api.addExpense({
        amount: args.amount,
        date: args.date,
        categoryId: findCategory(data, args.category).id,
        notes: args.notes ?? '',
      })
      return describeExpense(saved, await api.getData())
    }),
  )

  server.registerTool(
    'update_expense',
    {
      title: 'Update expense',
      description: 'Changes an expense. Only the fields you pass change; the others keep their current values.',
      inputSchema: {
        id: z.string().describe('Expense id, from list_expenses'),
        amount: amount.optional(),
        date: date.optional(),
        category: category.optional(),
        notes: z.string().optional(),
      },
      annotations: { idempotentHint: true },
    },
    run(async (args: { id: string; amount?: number; date?: string; category?: string; notes?: string }) => {
      const data = await api.getData()
      const current = data.expenses.find((e) => e.id === args.id)
      if (!current) throw new NotFoundError('Expense', args.id)
      const saved = await api.updateExpense(args.id, {
        amount: args.amount ?? current.amount,
        date: args.date ?? current.date,
        categoryId: args.category === undefined ? current.categoryId : findCategory(data, args.category).id,
        notes: args.notes ?? current.notes,
      })
      return describeExpense(saved, await api.getData())
    }),
  )

  server.registerTool(
    'delete_expense',
    {
      title: 'Delete expense',
      description: 'Deletes an expense permanently.',
      inputSchema: { id: z.string().describe('Expense id, from list_expenses') },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    run(async ({ id }: { id: string }) => {
      await api.deleteExpense(id)
      return { deleted: id }
    }),
  )

  server.registerTool(
    'add_category',
    {
      title: 'Add category',
      description: 'Adds a category. Names are unique, ignoring case.',
      inputSchema: { name: z.string().describe('1–50 characters') },
    },
    run(async ({ name }: { name: string }) => api.addCategory(name)),
  )

  server.registerTool(
    'rename_category',
    {
      title: 'Rename category',
      description: 'Renames a category. Its expenses keep it.',
      inputSchema: { category, newName: z.string().describe('1–50 characters') },
      annotations: { idempotentHint: true },
    },
    run(async ({ category: c, newName }: { category: string; newName: string }) => {
      const data = await api.getData()
      return api.renameCategory(findCategory(data, c).id, newName)
    }),
  )

  server.registerTool(
    'delete_category',
    {
      title: 'Delete category',
      description: 'Deletes a category. Refused while any expense still uses it.',
      inputSchema: { category },
      annotations: { destructiveHint: true },
    },
    run(async ({ category: c }: { category: string }) => {
      const data = await api.getData()
      const found = findCategory(data, c)
      await api.deleteCategory(found.id)
      return { deleted: found.name }
    }),
  )

  return server
}
