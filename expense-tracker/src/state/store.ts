import { createContext, useContext } from 'react'
import type { StoreData } from '../domain/types'
import type { Repository } from '../storage/repository'

export type StoreActions = Omit<Repository, 'getData' | 'reload'>
export type Store = { data: StoreData } & StoreActions

export const StoreContext = createContext<Store | null>(null)

/** App data plus repository actions. Actions throw on validation/storage errors; callers show them. */
export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}
