/** The part of a Durable Object's SQL storage (`ctx.storage.sql`) this adapter uses. Synchronous, like Web Storage. */
export type SqlExec = {
  exec(query: string, ...bindings: (string | number)[]): { toArray(): Record<string, unknown>[] }
}

/**
 * Web Storage over a Durable Object's SQLite database, one row per key. Like FileStorage on the Node server, it lets
 * the browser's storage code (loadData, saveData, migrate, corrupt-data backups) run unchanged. It must be
 * synchronous for that, which is why it uses Durable Object SQL rather than Workers KV or D1.
 */
export class SqlKeyValueStorage implements Storage {
  constructor(private readonly sql: SqlExec) {
    sql.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
  }

  private first(query: string, ...bindings: (string | number)[]): Record<string, unknown> | undefined {
    return this.sql.exec(query, ...bindings).toArray()[0]
  }

  get length(): number {
    return Number(this.first('SELECT COUNT(*) AS n FROM kv')?.n ?? 0)
  }

  /** Keys in sorted order, like FileStorage; null outside 0..length-1 as Web Storage requires. */
  key(index: number): string | null {
    if (!Number.isInteger(index) || index < 0) return null
    const row = this.first('SELECT key FROM kv ORDER BY key LIMIT 1 OFFSET ?', index)
    return row ? String(row.key) : null
  }

  getItem(key: string): string | null {
    const row = this.first('SELECT value FROM kv WHERE key = ?', key)
    return row ? String(row.value) : null
  }

  setItem(key: string, value: string): void {
    this.sql.exec(
      'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      String(value),
    )
  }

  removeItem(key: string): void {
    this.sql.exec('DELETE FROM kv WHERE key = ?', key)
  }

  clear(): void {
    this.sql.exec('DELETE FROM kv')
  }
}
