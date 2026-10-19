import type { StoreData } from '../domain/types'
import type { ValidationErrors } from '../domain/validation'
import { CategoryInUseError, NotFoundError, ValidationError } from '../storage/repository'
import type { Api } from './api'

/** A failed request the UI can't explain field by field: network down, server error, unexpected response. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

type ErrorBody = { error?: string; message?: string; errors?: ValidationErrors<string>; count?: number }

/** Rebuilds the repository error the server reported, so callers can't tell the API from a local repository. */
function toError(status: number, body: ErrorBody, kind: 'Expense' | 'Category' | null, id: string): Error {
  if (body.error === 'validation' && body.errors) return new ValidationError(body.errors)
  if (body.error === 'not_found' && kind) return new NotFoundError(kind, id)
  if (body.error === 'category_in_use' && typeof body.count === 'number') return new CategoryInUseError(body.count)
  return new ApiRequestError(body.message ?? `Request failed with status ${status}`, status)
}

/** The Api backed by the REST server (`server/app.ts`), reached at `baseUrl` (proxied to the server in dev). */
export function createHttpApi(baseUrl = '/api', fetchImpl: typeof fetch = (...args) => fetch(...args)): Api {
  async function request<T>(method: string, path: string, body?: unknown, kind: 'Expense' | 'Category' | null = null) {
    let res: Response
    try {
      res = await fetchImpl(baseUrl + path, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (err) {
      throw new ApiRequestError(`Could not reach the server: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (res.status === 204) return undefined as T
    const parsed: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const id = decodeURIComponent(path.split('/')[2] ?? '')
      throw toError(res.status, (parsed ?? {}) as ErrorBody, kind, id)
    }
    if (parsed === null) throw new ApiRequestError('The server sent an unreadable response', res.status)
    return parsed as T
  }

  const at = (collection: string, id: string) => `/${collection}/${encodeURIComponent(id)}`

  return {
    getData: () => request<StoreData>('GET', '/data'),
    addExpense: (input) => request('POST', '/expenses', input),
    updateExpense: (id, input) => request('PUT', at('expenses', id), input, 'Expense'),
    deleteExpense: (id) => request('DELETE', at('expenses', id), undefined, 'Expense'),
    addCategory: (name) => request('POST', '/categories', { name }),
    renameCategory: (id, name) => request('PATCH', at('categories', id), { name }, 'Category'),
    deleteCategory: (id) => request('DELETE', at('categories', id), undefined, 'Category'),
  }
}
