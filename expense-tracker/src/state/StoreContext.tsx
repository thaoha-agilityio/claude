import { useMemo, useState, type ReactNode } from 'react'
import { createRepository, type Repository } from '../storage/repository'
import { StoreContext, type Store, type StoreActions } from './store'

type Props = { children: ReactNode; repository?: Repository }

export function StoreProvider({ children, repository }: Props) {
  const [repo] = useState(() => repository ?? createRepository())
  const [data, setData] = useState(repo.getData)

  // Each action delegates to the repository (which persists), then publishes the new snapshot.
  // If the repository throws, the snapshot is unchanged and the error reaches the caller.
  const actions = useMemo<StoreActions>(() => {
    const sync =
      <A extends unknown[], R>(fn: (...args: A) => R) =>
      (...args: A): R => {
        const result = fn(...args)
        setData(repo.getData())
        return result
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
