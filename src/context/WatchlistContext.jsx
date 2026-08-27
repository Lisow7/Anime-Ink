import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useCookieConsent, hasConsent } from './CookieContext'
import { readStorage, removeStorage, writeStorage } from '../utils/storage'
import { fusionner } from '../utils/fusion'

const KEY = 'anime-ink-watchlist'
const dedup = (arr) => arr.filter((a, i, self) => self.findIndex(b => b.mal_id === a.mal_id) === i)
const WatchlistContext = createContext(null)

export function WatchlistProvider({ children }) {
  const { consent } = useCookieConsent()
  const canStore = consent?.userdata === true

  const [watchlist, setWatchlist] = useState(() => {
    if (!hasConsent('userdata')) return []
    return dedup(readStorage(KEY, [], Array.isArray))
  })

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return }
    if (canStore) {
      setWatchlist(dedup(readStorage(KEY, [], Array.isArray)))
    } else {
      setWatchlist([])
      removeStorage(KEY)
    }
  }, [canStore])

  const save = (next) => {
    setWatchlist(next)
    if (canStore) writeStorage(KEY, next)
  }

  // Cherche une entrée directe OU la racine de franchise contenant cet id
  const getEntry = (id) =>
    watchlist.find(a => a.mal_id === id) ||
    watchlist.find(a => a.seasonData?.some(s => s.mal_id === id)) ||
    null
  const getStatus = (id) => getEntry(id)?.watchStatus || null

  const setStatus = (anime, watchStatus) => {
    // Si une entrée de la même franchise existe déjà, on met juste à jour son statut
    const parent = watchlist.find(a => a.seasonData?.some(s => s.mal_id === anime.mal_id))
    if (parent) {
      save(watchlist.map(a => a.mal_id === parent.mal_id ? { ...a, watchStatus } : a))
      return
    }
    const exists = watchlist.some(a => a.mal_id === anime.mal_id)
    if (exists) {
      save(watchlist.map(a => a.mal_id === anime.mal_id ? { ...a, watchStatus } : a))
    } else {
      save([...watchlist, {
        mal_id: anime.mal_id, title: anime.title, images: anime.images,
        score: anime.score, episodes: anime.episodes, status: anime.status, type: anime.type,
        aired: anime.aired, genres: anime.genres, synopsis: anime.synopsis,
        watchStatus, currentEpisode: 1, currentSeason: 1,
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

  const setSeasonData = (id, seasonData) => {
    const siblingIds = new Set(seasonData.map(s => s.mal_id))
    // Toutes les entrées de la watchlist appartenant à cette franchise
    const related = watchlist.filter(a => siblingIds.has(a.mal_id))

    if (related.length <= 1) {
      // Cas normal : une seule entrée, mise à jour simple
      save(watchlist.map(a => {
        if (a.mal_id !== id) return a
        const franchiseIndex = seasonData.findIndex(s => s.mal_id === id)
        const actualSeason = franchiseIndex >= 0 ? franchiseIndex + 1 : Math.min(a.currentSeason ?? 1, seasonData.length)
        const seasonEp = seasonData[actualSeason - 1]?.episodes ?? null
        const correctedEp = seasonEp !== null ? Math.min(a.currentEpisode ?? 0, seasonEp) : (a.currentEpisode ?? 0)
        return { ...a, seasonData, currentSeason: actualSeason, currentEpisode: correctedEp }
      }))
      return
    }

    // Plusieurs entrées pour la même franchise : garder la racine (saison 1)
    const rootMalId = seasonData[0]?.mal_id
    const root = related.find(a => a.mal_id === rootMalId) ?? related[0]
    const siblings = related.filter(a => a.mal_id !== root.mal_id)

    // Saison la plus avancée parmi tous les doublons
    let bestSeason = root.currentSeason ?? 1
    for (const s of siblings) {
      const idx = seasonData.findIndex(sd => sd.mal_id === s.mal_id)
      const sNum = idx >= 0 ? idx + 1 : (s.currentSeason ?? 1)
      if (sNum > bestSeason) bestSeason = sNum
    }
    const seasonEp = seasonData[bestSeason - 1]?.episodes ?? null
    const correctedEp = seasonEp !== null ? Math.min(root.currentEpisode ?? 0, seasonEp) : (root.currentEpisode ?? 0)

    save(
      watchlist
        .filter(a => !siblings.some(s => s.mal_id === a.mal_id))
        .map(a => {
          if (a.mal_id !== root.mal_id) return a
          return { ...a, seasonData, currentSeason: bestSeason, currentEpisode: correctedEp }
        })
    )
  }

  // Supprime l'entrée directe OU la racine de franchise si c'est un id de saison dérivée
  const remove = (id) => {
    const parent = watchlist.find(a => a.seasonData?.some(s => s.mal_id === id))
    save(watchlist.filter(a => a.mal_id !== (parent?.mal_id ?? id)))
  }

  const reorder = (fromIndex, toIndex) => {
    const next = [...watchlist]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    save(next)
  }

  /**
   * Ajoute une liste restaurée, sans jamais écraser ce qui est déjà là.
   *
   * L'existant passe devant : le dédoublonnage garde la première occurrence
   * d'un identifiant. Une série suivie jusqu'à l'épisode 12 le reste, même si
   * le fichier restauré la connaît à l'épisode 3.
   */
  const importer = (entrees) => {
    if (!canStore) return 0
    const suivant = fusionner(watchlist, entrees)
    save(suivant)
    return suivant.length - watchlist.length
  }

  const clearWatchlist = () => {
    setWatchlist([])
    removeStorage(KEY)
  }

  return (
    <WatchlistContext.Provider value={{ watchlist, getStatus, setStatus, setEpisode, setSeason, setSeasonData, remove, reorder, clearWatchlist, importer }}>
      {children}
    </WatchlistContext.Provider>
  )
}

export function useWatchlist() {
  return useContext(WatchlistContext)
}
