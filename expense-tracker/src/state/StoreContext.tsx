import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { createRepository, type Repository } from '../storage/repository'
import { STORAGE_KEY } from '../storage/storage'
import { StoreContext, type Store, type StoreActions } from './store'

type Props = { children: ReactNode; repository?: Repository }

export function StoreProvider({ children, repository }: Props) {
  const [repo] = useState(() => repository ?? createRepository())
  const [data, setData] = useState(repo.getData)

  // Another tab saved: show its data. (The event only fires in other tabs, never the one that wrote.)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) setData(repo.reload())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [repo])

  // Each action delegates to the repository (which persists), then publishes the snapshot.
  // Publish even if it throws: the repository may have reloaded another tab's changes first.
  const actions = useMemo<StoreActions>(() => {
    const sync =
      <A extends unknown[], R>(fn: (...args: A) => R) =>
      (...args: A): R => {
        try {
          return fn(...args)
        } finally {
          setData(repo.getData())
        }
      }
    return {
      addExpense: sync(repo.addExpense),
      updateExpense: sync(repo.updateExpense),
      deleteExpense: sync(repo.deleteExpense),
      addCategory: sync(repo.addCategory),
      renameCategory: sync(repo.renameCategory),
      deleteCategory: sync(repo.deleteCategory),
    }
  }, [repo])

  const store = useMemo<Store>(() => ({ data, ...actions }), [data, actions])
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
