import { createContext, useContext, useState } from 'react'

const KEY = 'anime-ink-watchlist'
const WatchlistContext = createContext(null)

export function WatchlistProvider({ children }) {
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || [] }
    catch { return [] }
  })

  const save = (next) => {
    setWatchlist(next)
    localStorage.setItem(KEY, JSON.stringify(next))
  }

  const getEntry = (id) => watchlist.find(a => a.mal_id === id) || null
  const getStatus = (id) => getEntry(id)?.watchStatus || null

  const setStatus = (anime, watchStatus) => {
    const exists = watchlist.some(a => a.mal_id === anime.mal_id)
    if (exists) {
      save(watchlist.map(a => a.mal_id === anime.mal_id ? { ...a, watchStatus } : a))
    } else {
      save([...watchlist, {
        mal_id: anime.mal_id,
        title: anime.title,
        images: anime.images,
        score: anime.score,
        episodes: anime.episodes,
        status: anime.status,
        aired: anime.aired,
        genres: anime.genres,
        synopsis: anime.synopsis,
        watchStatus,
      }])
    }
  }

  const remove = (id) => save(watchlist.filter(a => a.mal_id !== id))

  const clearWatchlist = () => {
    setWatchlist([])
    localStorage.removeItem(KEY)
  }

  return (
    <WatchlistContext.Provider value={{ watchlist, getStatus, setStatus, remove, clearWatchlist }}>
      {children}
    </WatchlistContext.Provider>
  )
}

export function useWatchlist() {
  return useContext(WatchlistContext)
}
