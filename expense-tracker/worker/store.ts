import { createApiHandler } from '../server/api'
import { createRepository } from '../src/storage/repository'
import { SqlKeyValueStorage, type SqlExec } from './sqlStorage'

type DurableObjectState = { storage: { sql: SqlExec } }

/** All app data lives in one instance, so every request sees the same document and requests run one at a time. */
export const STORE_NAME = 'default'

/**
 * Durable Object holding the expense data. It runs the same repository and REST handler as the Node server, over
 * its SQLite storage, so validation, migrations and backups behave exactly as they do locally.
 */
export class ExpenseStore {
  private readonly handle: (req: Request) => Promise<Response>

  constructor(state: DurableObjectState) {
    this.handle = createApiHandler(createRepository({ storage: new SqlKeyValueStorage(state.storage.sql) }))
  }

  fetch(req: Request): Promise<Response> {
    return this.handle(req)
  }
}
