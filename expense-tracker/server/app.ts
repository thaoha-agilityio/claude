import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { Repository } from '../src/storage/repository'
import { createApiHandler, type ApiError } from './api'

export { MAX_BODY_BYTES, type ApiError } from './api'

/** Node `http` adapter for createApiHandler, used by server/main.ts and the e2e and API tests. */
export function createApp(repo: Repository) {
  const handle = createApiHandler(repo)
  return async function nodeHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let request: Request
    try {
      const headers = new Headers()
      for (const [name, value] of Object.entries(req.headers)) {
        if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
      }
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
      request = new Request(new URL(req.url ?? '/', 'http://localhost'), {
        method: req.method,
        headers,
        body: hasBody ? (Readable.toWeb(req) as unknown as BodyInit) : undefined,
        duplex: 'half',
      } as RequestInit)
    } catch {
      // e.g. a method the Fetch API forbids, such as TRACE
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
      res.end(JSON.stringify({ error: 'bad_request', message: 'Unsupported request' } satisfies ApiError))
      return
    }
    const response = await handle(request)
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined)
  }
}
