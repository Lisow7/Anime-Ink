import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useCookieConsent, hasConsent } from './CookieContext'
import { readStorage, removeStorage, writeStorage } from '../utils/storage'
import { fusionner } from '../utils/fusion'

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


  /**
   * Ajoute une liste restaurée, sans jamais écraser ce qui est déjà là.
   *
   * L'existant passe devant : le dédoublonnage garde la première occurrence
   * d'un identifiant. Une restauration complète donc, elle ne remplace pas —
   * importer une vieille sauvegarde ne peut pas faire reculer ce qui a été
   * fait depuis.
   */
  const importer = (entrees) => {
    if (!canStore) return 0
    let ajoutes = 0
    setHistory(prev => {
      const suivant = fusionner(prev, entrees)
      ajoutes = suivant.length - prev.length
      writeStorage(KEY, suivant)
      return suivant
    })
    return ajoutes
  }

  const clearHistory = () => {
    setHistory([])
    removeStorage(KEY)
  }

  return (
    <HistoryContext.Provider value={{ history, addToHistory, removeFromHistory, clearHistory, importer }}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  return useContext(HistoryContext)
}
