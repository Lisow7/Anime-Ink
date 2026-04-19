import { useState, useEffect, useRef } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import { useSearchParams } from 'react-router-dom'
import AnimeCard from '../components/AnimeCard'
import AnimeListCard from '../components/AnimeListCard'
import EmptyState from '../components/EmptyState'
import { useFavorites } from '../context/FavoritesContext'
import { useHistory } from '../context/HistoryContext'
import { searchAnime, getAnimeByFilter, getGenres } from '../services/jikan'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const IconGrid = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
)

const IconList = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

export default function Catalogue() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [animes, setAnimes] = useState([])
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const [pagination, setPagination] = useState({ current: 1, last: 1, total: null })
  const [inputValue, setInputValue] = useState('')
  const debouncedInput = useDebounce(inputValue)
  const isMounted = useRef(false)
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'catalogue')

  useEffect(() => {
    setTab(searchParams.get('tab') || 'catalogue')
  }, [searchParams.toString()])
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('anime-ink-view') || 'grid')

  const { favorites, clearFavorites } = useFavorites()
  const { history, clearHistory: clearHistoryBase } = useHistory()
  const switchTab = (tabName) => {
    const next = new URLSearchParams(searchParams)
    if (tabName === 'catalogue') next.delete('tab')
    else next.set('tab', tabName)
    setSearchParams(next)
  }
  const clearHistory = () => { clearHistoryBase(); switchTab('catalogue') }
  const resetAll = () => {
    clearFavorites()
    clearHistoryBase()
    setTab('catalogue')
    setInputValue('')
    setSearchParams(new URLSearchParams())
  }

  const query = searchParams.get('q') || ''
  const genre = searchParams.get('genre') || ''
  const status = searchParams.get('status') || ''
  const type = searchParams.get('type') || ''
  const orderBy = searchParams.get('orderBy') || 'title'
  const letter = searchParams.get('letter') || ''
  const page = parseInt(searchParams.get('page') || '1')

  useEffect(() => { setInputValue(query) }, [query])

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    const next = new URLSearchParams(searchParams)
    if (debouncedInput) next.set('q', debouncedInput)
    else next.delete('q')
    next.delete('page')
    setSearchParams(next)
  }, [debouncedInput])

  useEffect(() => {
    setLoading(true)
    setError(false)
    const run = async () => {
      try {
        if (query) {
          const data = await searchAnime(query)
          setAnimes(data)
          setPagination({ current: 1, last: 1, total: data.length })
        } else {
          const result = await getAnimeByFilter({ genre, status, type, orderBy, letter, page })
          const norm = (t) => t.replace(/^[^a-zA-Z0-9\u00C0-\u024F]+/, '')
          const sorted = (orderBy === 'title' || letter)
            ? [...result.data].sort((a, b) => {
                const cmp = norm(a.title).localeCompare(norm(b.title), undefined, { sensitivity: 'base' })
                if (cmp !== 0) return cmp
                const dateA = a.aired?.from ? new Date(a.aired.from) : new Date(0)
                const dateB = b.aired?.from ? new Date(b.aired.from) : new Date(0)
                return dateA - dateB
              })
            : result.data
          setAnimes(sorted)
          setPagination({
            current: result.pagination?.current_page ?? 1,
            last: result.pagination?.last_visible_page ?? 1,
            total: result.pagination?.items?.total ?? null,
          })
        }
      } catch {
        setError(true)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [query, genre, status, type, orderBy, letter, page, retryKey])

  useEffect(() => {
    getGenres().then(setGenres)
  }, [])

  const updateParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }

  const resetFilters = () => {
    setInputValue('')
    setSearchParams(new URLSearchParams())
  }

  const goToPage = (p) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', p)
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const switchView = (mode) => {
    setViewMode(mode)
    localStorage.setItem('anime-ink-view', mode)
  }

  const displayList = tab === 'favoris' ? favorites : tab === 'recents' ? history : animes
  const isGrid = viewMode === 'grid'
  const total = tab === 'favoris' ? favorites.length : tab === 'recents' ? history.length : (pagination.total ?? animes.length)
  const isEmpty = !loading && displayList.length === 0

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-8">

      {/* Header + onglets */}
      <div className="flex items-center justify-between gap-8">
        <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight shrink-0">
          {tab === 'favoris' ? 'Animés favoris' : tab === 'recents' ? 'Récemment consultés' : 'Catalogue'}
        </h1>
        <div className="flex items-center gap-3">
        {(favorites.length > 0 || history.length > 0) && (
          <button onClick={resetAll} className="text-[var(--text-muted)] text-xs hover:text-red-400 transition-colors shrink-0">
            Tout réinitialiser
          </button>
        )}
        <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg p-1">
          <button
            onClick={() => switchTab('catalogue')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'catalogue' ? 'bg-[#22c55e] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Catalogue
          </button>
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button
            onClick={() => switchTab('favoris')}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${tab === 'favoris' ? 'bg-[#22c55e] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Favoris
            {favorites.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === 'favoris' ? 'bg-white/20' : 'bg-white/10'}`}>
                {favorites.length}
              </span>
            )}
          </button>
          {history.length > 0 && (
            <button
              onClick={() => switchTab('recents')}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${tab === 'recents' ? 'bg-[#22c55e] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
            >
              Récents
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === 'recents' ? 'bg-white/20' : 'bg-white/10'}`}>
                {history.length}
              </span>
            </button>
          )}
        </div>
        </div>
      </div>

      {/* Filtres — uniquement sur l'onglet catalogue */}
      {tab === 'catalogue' && !isEmpty && (
        <div className="flex flex-col gap-4">
          {/* Barre de recherche + toggle vue */}
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={inputValue}
              placeholder="Rechercher..."
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#22c55e] transition-colors flex-1 max-w-sm"
              onChange={(e) => setInputValue(e.target.value)}
            />
            {/* Toggle grille / liste */}
            <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg p-1 ml-auto">
              <button
                onClick={() => switchView('grid')}
                className={`p-1.5 rounded-md transition-colors ${isGrid ? 'text-[#22c55e]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                aria-label="Vue grille"
              >
                <IconGrid />
              </button>
              <button
                onClick={() => switchView('list')}
                className={`p-1.5 rounded-md transition-colors ${!isGrid ? 'text-[#22c55e]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                aria-label="Vue liste"
              >
                <IconList />
              </button>
            </div>
          </div>

          {/* Filtre alphabétique */}
          {!query && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => updateParam('letter', '')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${!letter ? 'bg-[#22c55e] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                Tous
              </button>
              {ALPHABET.map((l) => (
                <button
                  key={l}
                  onClick={() => updateParam('letter', letter === l ? '' : l)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${letter === l ? 'bg-[#22c55e] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Filtres dropdowns */}
          <div className="flex flex-wrap gap-3">
            <select value={genre} onChange={(e) => updateParam('genre', e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#22c55e] cursor-pointer">
              <option value="">Tous les genres</option>
              {genres.map((g) => <option key={g.mal_id} value={g.mal_id}>{g.name}</option>)}
            </select>

            <select value={type} onChange={(e) => updateParam('type', e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#22c55e] cursor-pointer">
              <option value="">Tous les types</option>
              <option value="tv">Série TV</option>
              <option value="movie">Film</option>
              <option value="ova">OVA</option>
              <option value="ona">ONA</option>
              <option value="special">Spécial</option>
            </select>

            <select value={status} onChange={(e) => updateParam('status', e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#22c55e] cursor-pointer">
              <option value="">Tous les statuts</option>
              <option value="airing">En cours</option>
              <option value="complete">Terminé</option>
              <option value="upcoming">À venir</option>
            </select>

            <select value={orderBy} onChange={(e) => updateParam('orderBy', e.target.value)}
              className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#22c55e] cursor-pointer">
              <option value="score">Meilleure note</option>
              <option value="title">Alphabétique</option>
              <option value="start_date">Date de sortie</option>
              <option value="episodes">Nombre d'épisodes</option>
            </select>
          </div>

          {/* Compteur */}
          {!loading && animes.length > 0 && (
            <p className="text-[var(--text-muted)] text-xs">
              {total} animé{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Compteur favoris */}
      {tab === 'favoris' && favorites.length > 0 && !isEmpty && (
        <p className="text-[var(--text-muted)] text-xs -mt-4">
          {favorites.length} favori{favorites.length > 1 ? 's' : ''}
        </p>
      )}

      {/* Compteur + effacer récents */}
      {tab === 'recents' && history.length > 0 && !isEmpty && (
        <div className="flex items-center justify-between -mt-4">
          <p className="text-[var(--text-muted)] text-xs">
            {history.length} animé{history.length > 1 ? 's' : ''} consulté{history.length > 1 ? 's' : ''}
          </p>
          <button
            onClick={clearHistory}
            className="text-[var(--text-muted)] text-xs hover:text-[var(--text-primary)] transition-colors"
          >
            Effacer l'historique
          </button>
        </div>
      )}

      {/* Erreur API */}
      {tab === 'catalogue' && error && !loading && (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="text-5xl">⚠️</span>
          <p className="text-[var(--text-primary)] font-semibold text-lg">Impossible de charger les animés</p>
          <p className="text-[var(--text-muted)] text-sm">L'API Jikan est momentanément indisponible. Réessaie dans quelques instants.</p>
          <button
            onClick={() => { setError(false); setRetryKey(k => k + 1) }}
            className="mt-2 px-5 py-2 bg-[#22c55e] text-black text-sm font-semibold rounded-lg hover:bg-[#16a34a] transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Résultats */}
      {!error && tab === 'catalogue' && loading ? (
        isGrid ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="bg-[var(--bg-surface)] rounded-xl aspect-[2/3] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-[var(--bg-surface)] rounded-xl h-28 animate-pulse" />
            ))}
          </div>
        )
      ) : !error && displayList.length === 0 ? (
        tab === 'favoris'
          ? <EmptyState query="" onReset={() => switchTab('catalogue')} emptyFavoris />
          : tab === 'recents'
          ? <EmptyState query="" onReset={() => switchTab('catalogue')} emptyRecents />
          : <EmptyState query={query} onReset={resetFilters} />
      ) : !error && isGrid ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {displayList.map((anime) => (
            <AnimeCard key={anime.mal_id} anime={anime} />
          ))}
        </div>
      ) : !error ? (
        <div className="flex flex-col gap-3">
          {displayList.map((anime) => (
            <AnimeListCard key={anime.mal_id} anime={anime} />
          ))}
        </div>
      ) : null}

      {/* Pagination */}
      {tab === 'catalogue' && !query && pagination.last > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => goToPage(pagination.current - 1)}
            disabled={pagination.current <= 1}
            className="px-4 py-2 bg-[var(--bg-surface)] text-[var(--text-muted)] rounded-lg text-sm disabled:opacity-30 hover:text-[var(--text-primary)] transition-colors"
          >
            ← Précédent
          </button>
          <span className="px-4 py-2 text-[var(--text-muted)] text-sm">
            {pagination.current} / {pagination.last}
          </span>
          <button
            onClick={() => goToPage(pagination.current + 1)}
            disabled={pagination.current >= pagination.last}
            className="px-4 py-2 bg-[var(--bg-surface)] text-[var(--text-muted)] rounded-lg text-sm disabled:opacity-30 hover:text-[var(--text-primary)] transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}
    </main>
  )
}
