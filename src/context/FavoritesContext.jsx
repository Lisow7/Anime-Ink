import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useCookieConsent, hasConsent } from './CookieContext'
import { readStorage, removeStorage, writeStorage } from '../utils/storage'

const KEY = 'anime-ink-favorites'
const dedup = (arr) => arr.filter((a, i, self) => self.findIndex(b => b.mal_id === a.mal_id) === i)
const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const { consent } = useCookieConsent()
  const canStore = consent?.userdata === true

  const [favorites, setFavorites] = useState(() => {
    if (!hasConsent('userdata')) return []
    return dedup(readStorage(KEY, [], Array.isArray))
  })

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (canStore) {
      setFavorites(dedup(readStorage(KEY, [], Array.isArray)))
    } else {
      setFavorites([])
      removeStorage(KEY)
    }
  }, [canStore])

  const toggle = (anime) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.mal_id === anime.mal_id)
      const next = exists
        ? prev.filter(f => f.mal_id !== anime.mal_id)
        : [...prev, {
            mal_id: anime.mal_id, title: anime.title, images: anime.images,
            score: anime.score, episodes: anime.episodes, status: anime.status,
            aired: anime.aired, genres: anime.genres, synopsis: anime.synopsis,
          }]
      if (canStore) writeStorage(KEY, next)
      return next
    })
  }

  const isFavorite = (id) => favorites.some(f => f.mal_id === id)

  const clearFavorites = () => {
    setFavorites([])
    removeStorage(KEY)
  }

  return (
    <FavoritesContext.Provider value={{ favorites, toggle, isFavorite, clearFavorites }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  return useContext(FavoritesContext)
}
