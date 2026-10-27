import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Api } from '../api/api'
import { createHttpApi } from '../api/http'
import type { StoreData } from '../domain/types'
import { StoreContext, type Store, type StoreActions } from './store'

type Props = {
  children: ReactNode
  /** Where data is read and saved; defaults to the REST server. */
  api?: Api
  /** Data to show straight away instead of loading it first (e.g. in tests). */
  initialData?: StoreData
}

/** Other tabs of this app listen here and reload after a change, as they did when data lived in localStorage. */
export const CHANGES_CHANNEL = 'expense-tracker:changes'

export function StoreProvider({ children, api: apiProp, initialData }: Props) {
  const [api] = useState(() => apiProp ?? createHttpApi())
  const [data, setData] = useState<StoreData | null>(initialData ?? null)
  const [loadFailed, setLoadFailed] = useState(false)
  // Only the most recently started load may publish, so a slow older response can't overwrite a newer one.
  const latestLoad = useRef(0)

  const load = useCallback(async () => {
    const ticket = ++latestLoad.current
    try {
      const next = await api.getData()
      if (ticket !== latestLoad.current) return
      setData(next)
      setLoadFailed(false)
    } catch (err) {
      console.error('[store] Could not load data.', err)
      if (ticket === latestLoad.current) setLoadFailed(true)
    }
  }, [api])

  const channel = useRef<BroadcastChannel | null>(null)

  // initialData only matters on mount.
  const startedWithData = useRef(initialData !== undefined)
  useEffect(() => {
    if (!startedWithData.current) void load()
  }, [load])

  // Pick up changes from other tabs (broadcast) and other devices (when the window regains focus).
  useEffect(() => {
    const reload = () => void load()
    const tabs = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANGES_CHANNEL)
    channel.current = tabs
    window.addEventListener('focus', reload)
    tabs?.addEventListener('message', reload)
    return () => {
      window.removeEventListener('focus', reload)
      tabs?.close()
      channel.current = null
    }
  }, [load])

  // Each action saves through the API, then reloads, also after a failure: the server may hold changes made elsewhere.
  const actions = useMemo<StoreActions>(() => {
    const sync =
      <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        try {
          const result = await fn(...args)
          channel.current?.postMessage('changed')
          return result
        } finally {
          await load()
        }
      }
    return {
      addExpense: sync(api.addExpense),
      updateExpense: sync(api.updateExpense),
      deleteExpense: sync(api.deleteExpense),
      addCategory: sync(api.addCategory),
      renameCategory: sync(api.renameCategory),
      deleteCategory: sync(api.deleteCategory),
    }
  }, [api, load])

  const store = useMemo<Store | null>(() => (data ? { data, ...actions } : null), [data, actions])

  if (!store) {
    return loadFailed ? (
      <div role="alert">
        <p>Could not load your data. Check that the server is running, then try again.</p>
        <button type="button" onClick={() => void load()}>
          Try again
        </button>
      </div>
    ) : (
      <p role="status">Loading…</p>
    )
  }
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
