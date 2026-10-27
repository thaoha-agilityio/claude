import { DatabaseSync } from 'node:sqlite'
import type { SqlExec } from './sqlStorage'

/** Durable Object SQL's exec() shape over a real in-memory SQLite database (Node's built-in node:sqlite), for tests. */
export function testSqlite(): SqlExec {
  const db = new DatabaseSync(':memory:')
  return {
    exec: (query, ...bindings) => {
      const statement = db.prepare(query)
      const rows = statement.columns().length > 0 ? statement.all(...bindings) : (statement.run(...bindings), [])
      return { toArray: () => rows as Record<string, unknown>[] }
    },
  }
}
