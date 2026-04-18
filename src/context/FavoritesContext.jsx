import { createContext, useContext, useState } from 'react'

const KEY = 'anime-ink-favorites'
const FavoritesContext = createContext(null)

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || [] }
    catch { return [] }
  })

  const toggle = (anime) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.mal_id === anime.mal_id)
      const next = exists
        ? prev.filter(f => f.mal_id !== anime.mal_id)
        : [...prev, {
            mal_id: anime.mal_id,
            title: anime.title,
            images: anime.images,
            score: anime.score,
            episodes: anime.episodes,
            status: anime.status,
            aired: anime.aired,
            genres: anime.genres,
            synopsis: anime.synopsis,
          }]
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }

  const isFavorite = (id) => favorites.some(f => f.mal_id === id)

  const clearFavorites = () => {
    setFavorites([])
    localStorage.removeItem(KEY)
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
