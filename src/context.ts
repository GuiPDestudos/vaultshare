import { createContext, useContext, useEffect, useState } from 'react'

export type DialogRequest = { kind: 'file' } | { kind: 'link'; fileId?: string }

interface AppContextValue {
  revision: number
  refresh: () => void
  notify: (message: string, tone?: 'ok' | 'error') => void
  openDialog: (request: DialogRequest) => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppContext')
  return value
}

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | VaultShare`
  }, [title])
}

export interface DataState<T> {
  data?: T
  error?: boolean
}

// Loads data on mount and again whenever `key` changes or a mutation calls refresh().
// Keeps the previous data on screen while reloading.
export function useData<T>(load: () => Promise<T>, key?: unknown): DataState<T> {
  const { revision } = useApp()
  const [state, setState] = useState<DataState<T>>({})

  useEffect(() => {
    let current = true
    load().then(
      (data) => current && setState({ data }),
      () => current && setState({ error: true }),
    )
    return () => {
      current = false
    }
    // `load` is usually a new inline function on every render, so `key` marks when it really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, key])

  return state
}
