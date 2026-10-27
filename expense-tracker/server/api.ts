import type { ExpenseField, ValidationErrors } from '../src/domain/validation'
import {
  CategoryInUseError,
  NotFoundError,
  ValidationError,
  type ExpenseInput,
  type Repository,
} from '../src/storage/repository'

/** Largest request body accepted; an expense or category is a few hundred bytes. */
export const MAX_BODY_BYTES = 64 * 1024

/** Error payload for every non-2xx response. `errors` is set for validation failures, `count` for an in-use category. */
export type ApiError = {
  error:
    | 'bad_request'
    | 'validation'
    | 'not_found'
    | 'method_not_allowed'
    | 'category_in_use'
    | 'too_large'
    | 'unsupported_media_type'
    | 'server'
  message: string
  errors?: ValidationErrors<string>
  count?: number
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError,
    readonly headers: Record<string, string> = {},
  ) {
    super(body.message)
  }
}

const badRequest = (message: string) => new HttpError(400, { error: 'bad_request', message })

function respond(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  if (body === undefined) return new Response(null, { status, headers })
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

/** Reads the body as a stream so an oversized one is rejected without buffering all of it. */
async function readJson(req: Request): Promise<unknown> {
  // Only a JSON content type makes a cross-site request need a preflight, which this API never answers, so
  // another website open in the user's browser can't post data here as text/plain or a form.
  if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) {
    throw new HttpError(415, { error: 'unsupported_media_type', message: 'Send the body as application/json' })
  }
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = req.body?.getReader()
  while (reader) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new HttpError(413, { error: 'too_large', message: `Request body must be at most ${MAX_BODY_BYTES} bytes` })
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw badRequest('Request body must be valid JSON')
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Turns an untrusted JSON body into ExpenseInput. Wrong types become validation errors here, because the
 * shared validation assumes the types the UI always sends (e.g. it trims `notes`). Range and format rules
 * stay in the repository.
 */
function toExpenseInput(body: unknown): ExpenseInput {
  if (!isObject(body)) throw badRequest('Request body must be a JSON object')
  const errors: ValidationErrors<ExpenseField> = {}
  const { amount, date, categoryId, notes = '' } = body
  if (typeof amount !== 'number') errors.amount = 'Amount must be a number of VND'
  if (typeof date !== 'string') errors.date = 'Date must be a "YYYY-MM-DD" string'
  if (typeof categoryId !== 'string') errors.categoryId = 'Category id must be a string'
  if (typeof notes !== 'string') errors.notes = 'Notes must be a string'
  if (Object.keys(errors).length > 0) throw new ValidationError<ExpenseField>(errors)
  return { amount, date, categoryId, notes } as ExpenseInput
}

function toCategoryName(body: unknown): string {
  if (!isObject(body)) throw badRequest('Request body must be a JSON object')
  if (typeof body.name !== 'string') throw new ValidationError<'name'>({ name: 'Name must be a string' })
  return body.name
}

type Handler = (req: Request, id: string) => Promise<[status: number, body?: unknown]>
type Route = { pattern: RegExp; methods: Record<string, Handler> }

/**
 * REST API over a repository:
 *
 *   GET    /api/data              → 200 { version, categories, expenses }
 *   POST   /api/expenses          → 201 Expense       body { amount, date, categoryId, notes? }
 *   PUT    /api/expenses/:id      → 200 Expense       body as POST
 *   DELETE /api/expenses/:id      → 204
 *   POST   /api/categories        → 201 Category      body { name }
 *   PATCH  /api/categories/:id    → 200 Category      body { name }
 *   DELETE /api/categories/:id    → 204, or 409 while expenses still use it
 *
 * Errors are JSON `ApiError`s: 400 bad JSON or validation, 404 unknown id or route, 405, 409, 413, 415 body not
 * sent as application/json, 500.
 * Uses only the web-standard Request/Response (no `node:` imports), so the same handler runs in Node (createApp in
 * app.ts) and in the Cloudflare Worker (worker/index.ts).
 */
export function createApiHandler(repo: Repository): (req: Request) => Promise<Response> {
  const routes: Route[] = [
    {
      pattern: /^\/api\/data$/,
      methods: { GET: async () => [200, repo.getData()] },
    },
    {
      pattern: /^\/api\/expenses$/,
      methods: { POST: async (req) => [201, repo.addExpense(toExpenseInput(await readJson(req)))] },
    },
    {
      pattern: /^\/api\/expenses\/([^/]+)$/,
      methods: {
        PUT: async (req, id) => [200, repo.updateExpense(id, toExpenseInput(await readJson(req)))],
        DELETE: async (_req, id) => {
          repo.deleteExpense(id)
          return [204]
        },
      },
    },
    {
      pattern: /^\/api\/categories$/,
      methods: { POST: async (req) => [201, repo.addCategory(toCategoryName(await readJson(req)))] },
    },
    {
      pattern: /^\/api\/categories\/([^/]+)$/,
      methods: {
        PATCH: async (req, id) => [200, repo.renameCategory(id, toCategoryName(await readJson(req)))],
        DELETE: async (_req, id) => {
          repo.deleteCategory(id)
          return [204]
        },
      },
    },
  ]

  function toHttpError(err: unknown): HttpError {
    if (err instanceof HttpError) return err
    if (err instanceof ValidationError) {
      return new HttpError(400, { error: 'validation', message: err.message, errors: err.errors })
    }
    if (err instanceof NotFoundError) return new HttpError(404, { error: 'not_found', message: err.message })
    if (err instanceof CategoryInUseError) {
      return new HttpError(409, { error: 'category_in_use', message: err.message, count: err.count })
    }
    console.error('[api]', err)
    return new HttpError(500, { error: 'server', message: 'Could not save changes.' })
  }

  return async function handle(req: Request): Promise<Response> {
    try {
      const path = new URL(req.url).pathname
      const route = routes.find((r) => r.pattern.test(path))
      if (!route) throw new HttpError(404, { error: 'not_found', message: `No route for ${path}` })

      const handler = route.methods[req.method]
      if (!handler) {
        const allow = Object.keys(route.methods).join(', ')
        throw new HttpError(405, { error: 'method_not_allowed', message: `Use ${allow}` }, { Allow: allow })
      }

      let id: string
      try {
        id = decodeURIComponent(route.pattern.exec(path)?.[1] ?? '')
      } catch {
        throw badRequest('Malformed id in URL')
      }
      const [status, body] = await handler(req, id)
      return respond(status, body)
    } catch (err) {
      const { status, body, headers } = toHttpError(err)
      return respond(status, body, headers)
    }
  }
}
