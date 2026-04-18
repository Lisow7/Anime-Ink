import { createContext, useContext, useState } from 'react'

const KEY = 'anime-ink-history'
const MAX = 20
const HistoryContext = createContext(null)

export function HistoryProvider({ children }) {
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || [] }
    catch { return [] }
  })

  const addToHistory = (anime) => {
    setHistory(prev => {
      const filtered = prev.filter(a => a.mal_id !== anime.mal_id)
      const next = [anime, ...filtered].slice(0, MAX)
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  const removeFromHistory = (id) => {
    setHistory(prev => {
      const next = prev.filter(a => a.mal_id !== id)
      localStorage.setItem(KEY, JSON.stringify(next))
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
