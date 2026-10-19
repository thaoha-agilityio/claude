export const DEFAULT_HOST = '127.0.0.1'
export const DEFAULT_PORT = 3001

/**
 * Where the API server listens. The API has no authentication, so it binds to loopback unless `HOST`
 * explicitly asks for another address (e.g. `0.0.0.0` to expose it on the network).
 */
export function listenAddress(env: Record<string, string | undefined>): { host: string; port: number } {
  return {
    host: env.HOST?.trim() || DEFAULT_HOST,
    port: Number(env.PORT ?? DEFAULT_PORT),
  }
}
