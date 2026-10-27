import { createContext, useContext } from 'react'
import type { Api } from '../api/api'
import type { StoreData } from '../domain/types'

export type StoreActions = Omit<Api, 'getData'>
export type Store = { data: StoreData } & StoreActions

export const StoreContext = createContext<Store | null>(null)

/** App data plus save actions. Actions reject on validation or save errors; callers show them. */
export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside <StoreProvider>')
  return store
}
