import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useCookieConsent, hasConsent } from './CookieContext'
import { readStorage, removeStorage, writeStorage } from '../utils/storage'

const KEY = 'anime-ink-history'
const MAX = 20
const dedup = (arr) => arr.filter((a, i, self) => self.findIndex(b => b.mal_id === a.mal_id) === i)
const HistoryContext = createContext(null)

export function HistoryProvider({ children }) {
  const { consent } = useCookieConsent()
  const canStore = consent?.userdata === true

  const [history, setHistory] = useState(() => {
    if (!hasConsent('userdata')) return []
    return dedup(readStorage(KEY, [], Array.isArray))
  })

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (canStore) {
      setHistory(dedup(readStorage(KEY, [], Array.isArray)))
    } else {
      setHistory([])
      removeStorage(KEY)
    }
  }, [canStore])

  const addToHistory = (anime) => {
    if (!canStore) return
    setHistory(prev => {
      const next = [anime, ...prev.filter(a => a.mal_id !== anime.mal_id)].slice(0, MAX)
      writeStorage(KEY, next)
      return next
    })
  }

  const removeFromHistory = (id) => {
    setHistory(prev => {
      const next = prev.filter(a => a.mal_id !== id)
      if (canStore) writeStorage(KEY, next)
      return next
    })
  }

  const clearHistory = () => {
    setHistory([])
    removeStorage(KEY)
  }

  return (
    <HistoryContext.Provider value={{ history, addToHistory, removeFromHistory, clearHistory }}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  return useContext(HistoryContext)
}
