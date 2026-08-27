import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useCookieConsent, hasConsent } from './CookieContext'
import { readStorage, removeStorage, writeStorage } from '../utils/storage'
import { fusionner } from '../utils/fusion'

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
    setFavorites(prev => {
      const suivant = fusionner(prev, entrees)
      ajoutes = suivant.length - prev.length
      writeStorage(KEY, suivant)
      return suivant
    })
    return ajoutes
  }

  const clearFavorites = () => {
    setFavorites([])
    removeStorage(KEY)
  }

  return (
    <FavoritesContext.Provider value={{ favorites, toggle, isFavorite, clearFavorites, importer }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() {
  return useContext(FavoritesContext)
}
