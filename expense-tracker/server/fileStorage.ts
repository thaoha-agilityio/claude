import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SUFFIX = '.json'

/**
 * A Web Storage implementation backed by a directory: one file per key, so the browser's storage code
 * (loadData, saveData, corrupt-data backups) runs on the server unchanged.
 * Writes go to a temp file that is then renamed over the target, so a crash never leaves a half-written file.
 */
export class FileStorage implements Storage {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true })
  }

  private path(key: string): string {
    return join(this.dir, encodeURIComponent(key) + SUFFIX)
  }

  private keys(): string[] {
    return readdirSync(this.dir)
      .filter((name) => name.endsWith(SUFFIX))
      .map((name) => decodeURIComponent(name.slice(0, -SUFFIX.length)))
      .sort()
  }

  get length(): number {
    return this.keys().length
  }

  key(index: number): string | null {
    return this.keys()[index] ?? null
  }

  getItem(key: string): string | null {
    try {
      return readFileSync(this.path(key), 'utf-8')
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw err
    }
  }

  setItem(key: string, value: string): void {
    const target = this.path(key)
    const temp = `${target}.${process.pid}.tmp`
    writeFileSync(temp, String(value), 'utf-8')
    renameSync(temp, target)
  }

  removeItem(key: string): void {
    rmSync(this.path(key), { force: true })
  }

  clear(): void {
    for (const key of this.keys()) this.removeItem(key)
  }
}
