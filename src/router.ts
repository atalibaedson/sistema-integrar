// Roteador mínimo baseado em hash (#/rota)
import { useSyncExternalStore } from 'react'

export function useRota(): string {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('hashchange', cb)
      return () => window.removeEventListener('hashchange', cb)
    },
    () => window.location.hash.replace(/^#/, '') || '/',
  )
}

export function navegar(rota: string) {
  window.location.hash = rota
}
