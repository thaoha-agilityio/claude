// The Worker's main module may export only handlers and Durable Object classes, so other values live in store.ts.
import { STORE_NAME } from './store'

export { ExpenseStore } from './store'

// Only the parts of the Workers runtime this file uses, so the shared src/ code keeps its DOM types.
type Fetcher = { fetch(req: Request): Promise<Response> }

export type Env = {
  /** The ExpenseStore Durable Object namespace (wrangler.jsonc). */
  EXPENSES: { idFromName(name: string): unknown; get(id: unknown): Fetcher }
  /** The built app in dist/ (wrangler.jsonc `assets`). */
  ASSETS: Fetcher
}

export default {
  /** /api/* goes to the Durable Object; everything else is the built app (wrangler.jsonc routes /api/* here first). */
  fetch(req: Request, env: Env): Promise<Response> {
    if (new URL(req.url).pathname.startsWith('/api/')) {
      return env.EXPENSES.get(env.EXPENSES.idFromName(STORE_NAME)).fetch(req)
    }
    return env.ASSETS.fetch(req)
  },
}
