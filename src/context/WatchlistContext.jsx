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
        currentEpisode: 0,
        currentSeason: 1,
      }])
    }
  }

  const setEpisode = (id, ep) => save(watchlist.map(a => a.mal_id === id ? { ...a, currentEpisode: ep } : a))

  const setSeason = (id, season) => save(watchlist.map(a => {
    if (a.mal_id !== id) return a
    const seasonEp = a.seasonData?.[season - 1]?.episodes ?? null
    const clampedEp = seasonEp !== null ? Math.min(a.currentEpisode ?? 0, seasonEp) : 0
    return { ...a, currentSeason: season, currentEpisode: clampedEp }
  }))

  const setSeasonData = (id, seasonData) => save(watchlist.map(a => {
    if (a.mal_id !== id) return a
    // Position réelle de cet animé dans la franchise (ex: JJK S2 → saison 2)
    const franchiseIndex = seasonData.findIndex(s => s.mal_id === id)
    const actualSeason = franchiseIndex >= 0 ? franchiseIndex + 1 : Math.min(a.currentSeason ?? 1, seasonData.length)
    const seasonEp = seasonData[actualSeason - 1]?.episodes ?? null
    const correctedEp = seasonEp !== null ? Math.min(a.currentEpisode ?? 0, seasonEp) : (a.currentEpisode ?? 0)
    return { ...a, seasonData, currentSeason: actualSeason, currentEpisode: correctedEp }
  }))

  const remove = (id) => save(watchlist.filter(a => a.mal_id !== id))

  const reorder = (fromIndex, toIndex) => {
    const next = [...watchlist]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    save(next)
  }

  const clearWatchlist = () => {
    setWatchlist([])
    localStorage.removeItem(KEY)
  }

  return (
    <WatchlistContext.Provider value={{ watchlist, getStatus, setStatus, setEpisode, setSeason, setSeasonData, remove, reorder, clearWatchlist }}>
      {children}
    </WatchlistContext.Provider>
  )
}

export function useWatchlist() {
  return useContext(WatchlistContext)
}
