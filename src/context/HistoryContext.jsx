import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useCookieConsent, hasConsent } from './CookieContext'

const KEY = 'anime-ink-history'
const MAX = 20
const dedup = (arr) => arr.filter((a, i, self) => self.findIndex(b => b.mal_id === a.mal_id) === i)
const HistoryContext = createContext(null)

export function HistoryProvider({ children }) {
  const { consent } = useCookieConsent()
  const canStore = consent?.userdata === true

  const [history, setHistory] = useState(() => {
    if (!hasConsent('userdata')) return []
    try { return dedup(JSON.parse(localStorage.getItem(KEY)) || []) }
    catch { return [] }
  })

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (canStore) {
      try { setHistory(dedup(JSON.parse(localStorage.getItem(KEY)) || [])) }
      catch { setHistory([]) }
    } else {
      setHistory([])
      localStorage.removeItem(KEY)
    }
  }, [canStore])

  const addToHistory = (anime) => {
    if (!canStore) return
    setHistory(prev => {
      const next = [anime, ...prev.filter(a => a.mal_id !== anime.mal_id)].slice(0, MAX)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  const removeFromHistory = (id) => {
    setHistory(prev => {
      const next = prev.filter(a => a.mal_id !== id)
      if (canStore) localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  const clearHistory = () => {
    setHistory([])
    localStorage.removeItem(KEY)
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
