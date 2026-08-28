import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import { useSEO } from '../hooks/useSEO'
import { useSearchParams } from 'react-router-dom'
import AnimeCard from '../components/AnimeCard'
import AnimeListCard from '../components/AnimeListCard'
import EmptyState from '../components/EmptyState'
import { useFavorites } from '../context/FavoritesContext'
import { useHistory } from '../context/HistoryContext'
import { useWatchlist } from '../context/WatchlistContext'
import { useAgeFilter } from '../context/AgeFilterContext'
import { WATCH_STATUS } from '../constants/anime'
import { ADULT_GENRES } from '../constants/ageFilter'
import { ATTRIBUTION, searchAnime, getAnimeByFilter, getGenres } from '../services/anime'
import { groupAnime } from '../utils/groupAnime'
import { readStorage, writeStorage } from '../utils/storage'

// WatchlistTable est le seul consommateur de @dnd-kit (3 paquets) et n'apparaît
// que sur l'onglet « Ma liste ». Importé statiquement, il pesait sur tous ceux
// qui ne l'ouvrent jamais : les trois quarts du poids du chunk Catalogue.
/**
 * Les années proposées, de la prochaine à 1960.
 *
 * L'année à venir figure au menu : les saisons s'annoncent avant de sortir, et
 * c'est souvent ce qui intéresse le plus. En deçà de 1960, il n'y a plus de
 * catalogue à parcourir.
 */
const ANNEES = Array.from(
  { length: new Date().getFullYear() + 1 - 1960 + 1 },
  (_, i) => new Date().getFullYear() + 1 - i,
)

const WatchlistTable = lazy(() => import('../components/WatchlistTable'))
// Le survol de l'onglet amorce le téléchargement : sans cela, ouvrir sa liste
// enchaînerait deux chunks l'un après l'autre, soit un aller-retour de plus
// pour exactement les gens qui y tiennent.
const prechargerWatchlist = () => { import('../components/WatchlistTable') }

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
  const { blurHentai } = useAgeFilter()
  const [animes, setAnimes] = useState([])
  const [genres, setGenres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  // Le contournement ne vaut que pour la requête déclenchée par le clic : un
  // drapeau persistant désactiverait le cache pour tout le reste de la session.
  const contournerAuProchainAppel = useRef(false)
  const [pagination, setPagination] = useState({ current: 1, last: 1, total: null })
  const [inputValue, setInputValue] = useState(() => searchParams.get('q') || '')
  const debouncedInput = useDebounce(inputValue)
  const tab = searchParams.get('tab') || 'catalogue'
  const [viewMode, setViewMode] = useState(() =>
    readStorage('anime-ink-view', 'grid', value => value === 'grid' || value === 'list')
  )

  const { favorites, clearFavorites } = useFavorites()
  const { history, clearHistory: clearHistoryBase } = useHistory()
  const { watchlist, clearWatchlist } = useWatchlist()
  const uniqueHistoryCount = useMemo(() => groupAnime(history, { keepNonTV: true }).length, [history])
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
    clearWatchlist()
    setInputValue('')
    setSearchParams(new URLSearchParams())
  }

  const query = searchParams.get('q') || ''
  const genre = searchParams.get('genre') || ''

  const seoTitle = tab === 'favoris' ? 'Mes favoris'
    : tab === 'recents' ? 'Récemment consultés'
    : tab === 'liste' ? 'Ma liste'
    : query ? `Recherche : ${query}`
    : 'Catalogue'
  const seoDesc = tab === 'favoris' ? 'Tes animés favoris sauvegardés sur Anime-Ink.'
    : tab === 'recents' ? 'Les animés que tu as récemment consultés sur Anime-Ink.'
    : tab === 'liste' ? 'Ta liste personnalisée — animés à voir, en cours et terminés.'
    : query ? `Résultats pour "${query}" — explore les animés correspondants sur Anime-Ink.`
    : 'Parcours le catalogue complet des animés, filtre par genre, type, statut et trouve ton prochain coup de cœur.'
  useSEO({ title: seoTitle, description: seoDesc })
  const status = searchParams.get('status') || ''
  const type = searchParams.get('type') || ''
  const orderBy = searchParams.get('orderBy') || 'title'
  const letter = searchParams.get('letter') || ''
  const saison = searchParams.get('saison') || ''
  const annee = searchParams.get('annee') || ''
  const page = parseInt(searchParams.get('page') || '1')

  const [previousQuery, setPreviousQuery] = useState(query)
  if (query !== previousQuery) {
    setPreviousQuery(query)
    setInputValue(query)
  }

  useEffect(() => {
    if (debouncedInput === (searchParams.get('q') || '')) return
    const next = new URLSearchParams(searchParams)
    if (debouncedInput) next.set('q', debouncedInput)
    else next.delete('q')
    next.delete('page')
    setSearchParams(next)
  }, [debouncedInput, searchParams, setSearchParams])

  /**
   * Seul l'onglet « catalogue » interroge l'API. Les trois autres — favoris,
   * récents, liste de suivi — vivent dans le stockage local et n'ont besoin de
   * personne.
   *
   * Ils déclenchaient pourtant cette requête, et son échec les vidait : toutes
   * les branches de rendu sont gardées par `!error`. Une panne de l'API faisait
   * donc disparaître la liste de suivi de son propriétaire, en plus de gaspiller
   * trois requêtes — l'appel et ses deux reprises — sur un budget d'une par
   * seconde.
   */
  useEffect(() => {
    if (tab !== 'catalogue') {
      setLoading(false)
      setError(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    const bypassCache = contournerAuProchainAppel.current
    contournerAuProchainAppel.current = false
    const run = async () => {
      try {
        const dedup = (arr) => arr.filter((a, i, self) => self.findIndex(b => b.mal_id === a.mal_id) === i)

        if (query) {
          const data = dedup(await searchAnime(query, controller.signal))
          if (controller.signal.aborted) return
          setAnimes(data)
          setPagination({ current: 1, last: 1, total: data.length })
        } else {
          // Une reprise demandée par l'utilisateur contourne l'échec mémorisé,
          // sinon le bouton « Réessayer » paraîtrait mort pendant 30 secondes.
          const result = await getAnimeByFilter(
            { genre, status, type, orderBy, letter, saison, annee, page },
            controller.signal,
            { bypassCache },
          )
          if (controller.signal.aborted) return
          const norm = (t) => t.replace(/^[^a-zA-Z0-9\u00C0-\u024F]+/, '')
          const data = dedup(result.data ?? [])
          const sorted = (orderBy === 'title' || letter)
            ? [...data].sort((a, b) => {
                const cmp = norm(a.title ?? '').localeCompare(norm(b.title ?? ''), undefined, { sensitivity: 'base' })
                if (cmp !== 0) return cmp
                const dateA = a.aired?.from ? new Date(a.aired.from) : new Date(0)
                const dateB = b.aired?.from ? new Date(b.aired.from) : new Date(0)
                return dateA - dateB
              })
            : data
          setAnimes(sorted)
          setPagination({
            current: result.pagination?.current_page ?? 1,
            last: result.pagination?.last_visible_page ?? 1,
            total: result.pagination?.items?.total ?? null,
          })
        }
      } catch {
        if (!controller.signal.aborted) setError(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    run()
    return () => controller.abort()
  }, [tab, query, genre, status, type, orderBy, letter, saison, annee, page, retryKey])

  useEffect(() => {
    getGenres().then(data => { if (Array.isArray(data)) setGenres([...data].sort((a, b) => a.name.localeCompare(b.name))) })
  }, [])

  /**
   * Le menu ne propose pas ce que la censure masque. L'API sert bien ses trois
   * genres explicites, mais `/genres/anime?filter=genres` — la voie prévue pour
   * les écarter — répond 504 : le tri se fait donc ici, sans dépendre d'elle.
   */
  const genresProposes = useMemo(
    () => (blurHentai ? genres.filter(g => !ADULT_GENRES.includes(g.name)) : genres),
    [genres, blurHentai],
  )

  // Un filtre explicite déjà posé survivrait à l'activation de la censure :
  // l'option disparaîtrait du menu pendant que le catalogue continuerait de la
  // servir, en silence.
  useEffect(() => {
    if (!blurHentai || !genre) return
    const courant = genres.find(g => String(g.mal_id) === genre)
    if (!courant || !ADULT_GENRES.includes(courant.name)) return
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('genre')
      next.delete('page')
      return next
    })
  }, [blurHentai, genre, genres, setSearchParams])

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

  const clearSearch = () => {
    setInputValue('')
    const next = new URLSearchParams(searchParams)
    next.delete('q')
    setSearchParams(next)
  }

  const goToPage = (p) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', p)
    setSearchParams(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const switchView = (mode) => {
    setViewMode(mode)
    writeStorage('anime-ink-view', mode)
  }

  const displayList = useMemo(() => (
    tab === 'favoris' ? favorites.filter((a, i, self) => self.findIndex(b => b.mal_id === a.mal_id) === i)
      : tab === 'recents' ? groupAnime(history, { keepNonTV: true })
      : tab === 'liste' ? watchlist
      : groupAnime(animes)
  ), [tab, favorites, history, watchlist, animes])
  const isGrid = viewMode === 'grid'
  const total = tab === 'favoris' ? displayList.length
    : tab === 'recents' ? displayList.length
    : tab === 'liste' ? watchlist.length
    : (pagination.total ?? animes.length)
  const isEmpty = !loading && displayList.length === 0
  // Une panne ne concerne que l'onglet qui interroge l'API. Sans cette
  // distinction, les branches de rendu gardées par l'erreur videraient aussi les
  // onglets locaux — le temps d'un rendu au moins, avant que l'effet ne remette
  // le drapeau à zéro.
  const erreurCatalogue = error && tab === 'catalogue'

  return (
    <main className="max-w-6xl px-4 sm:px-6 w-full mx-auto py-6 sm:py-10 flex flex-col gap-6 sm:gap-8 min-w-0">

      {/* Header + onglets */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] tracking-tight shrink-0">
          {tab === 'favoris' ? 'Animés favoris' : tab === 'recents' ? 'Récemment consultés' : tab === 'liste' ? 'Ma liste' : 'Catalogue'}
        </h1>
        {/* Le bloc entier était masqué tant qu'il n'y avait ni historique ni
            liste — si bien qu'un nouveau venu ne pouvait pas savoir que suivre
            une série était possible. « Ma liste » y figure désormais toujours,
            son écran vide expliquant comment s'en servir ; « Récents » reste
            conditionnel, l'historique se remplissant tout seul. */}
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg p-1 flex-1 sm:flex-none min-w-0">
              {history.length > 0 && (
                <button
                  onClick={() => switchTab(tab === 'recents' ? 'catalogue' : 'recents')}
                  className={`flex-1 sm:flex-none sm:px-4 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${tab === 'recents' ? 'bg-[#15803d] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  Récents
                  <span className={`text-[10px] px-1 py-0.5 rounded ${tab === 'recents' ? 'bg-white/20' : 'bg-white/10'}`}>
                    {uniqueHistoryCount}
                  </span>
                </button>
              )}
              {history.length > 0 && (
                <div className="w-px h-4 bg-white/10 shrink-0" />
              )}
              {/* Toujours visible, contrairement aux favoris et aux récents qui
                  se remplissent d'eux-mêmes à l'usage. Suivre une série demande
                  une action délibérée : masquer l'onglet tant que la liste est
                  vide rendait la fonction introuvable pour qui n'en connaissait
                  pas déjà l'existence. */}
              {(
                <button
                  onClick={() => switchTab(tab === 'liste' ? 'catalogue' : 'liste')}
                  onMouseEnter={prechargerWatchlist}
                  onFocus={prechargerWatchlist}
                  className={`flex-1 sm:flex-none sm:px-4 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${tab === 'liste' ? 'bg-[#15803d] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  Ma liste
                  <span className={`text-[10px] px-1 py-0.5 rounded ${tab === 'liste' ? 'bg-white/20' : 'bg-white/10'}`}>
                    {watchlist.length}
                  </span>
                </button>
              )}
            </div>
            {(history.length > 0 || watchlist.length > 0) && (
              <button
                onClick={tab === 'recents' ? clearHistory : resetAll}
                aria-label={tab === 'recents' ? 'Effacer l\'historique' : 'Tout réinitialiser'}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[#e63946]/30 text-[#e63946]/70 hover:border-[#e63946] hover:text-[#e63946] hover:bg-[#e63946]/5 transition-all"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2.5">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
      </div>

      {/* Barre de recherche — toujours visible sur catalogue */}
      {tab === 'catalogue' && (
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={inputValue}
            placeholder="Rechercher un animé..."
            aria-label="Rechercher un animé dans le catalogue"
            className="bg-[var(--bg-surface)] border border-[var(--border-input)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus:border-[#22c55e] transition-colors flex-1 sm:max-w-sm"
            onChange={(e) => setInputValue(e.target.value)}
          />
          {/* Toggle grille / liste */}
          <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg p-1 ml-auto">
            <button
              onClick={() => switchView('grid')}
              aria-pressed={isGrid}
              className={`p-1.5 rounded-md transition-colors ${isGrid ? 'text-[var(--color-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              aria-label="Vue grille"
            >
              <IconGrid />
            </button>
            <button
              onClick={() => switchView('list')}
              aria-pressed={!isGrid}
              className={`p-1.5 rounded-md transition-colors ${!isGrid ? 'text-[var(--color-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              aria-label="Vue liste"
            >
              <IconList />
            </button>
          </div>
        </div>
      )}

      {/* Filtres supplémentaires — uniquement si résultats */}
      {tab === 'catalogue' && !isEmpty && (
        <div className="flex flex-col gap-4">
          {/* Filtre alphabétique */}
          {!query && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => updateParam('letter', '')}
                aria-pressed={!letter}
                className={`min-w-6 min-h-6 inline-flex items-center justify-center px-2 rounded-md text-[10px] sm:text-xs font-medium transition-colors ${!letter ? 'bg-[#15803d] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              >
                Tous
              </button>
              {ALPHABET.map((l) => (
                <button
                  key={l}
                  onClick={() => updateParam('letter', letter === l ? '' : l)}
                  aria-pressed={letter === l}
                  className={`min-w-6 min-h-6 inline-flex items-center justify-center px-2 rounded-md text-[10px] sm:text-xs font-medium transition-colors ${letter === l ? 'bg-[#15803d] text-white' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {/* Filtres dropdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={genre} onChange={(e) => updateParam('genre', e.target.value)}
              aria-label="Filtrer par genre"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus:border-[#22c55e] cursor-pointer">
              <option value="">Tous les genres</option>
              {genresProposes.map((g) => <option key={g.mal_id} value={g.mal_id}>{g.name}</option>)}
            </select>

            <select value={type} onChange={(e) => updateParam('type', e.target.value)}
              aria-label="Filtrer par type"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus:border-[#22c55e] cursor-pointer">
              <option value="">Tous les types</option>
              <option value="tv">Série TV</option>
              <option value="movie">Film</option>
              <option value="ova">OVA</option>
              <option value="ona">ONA</option>
              <option value="special">Spécial</option>
            </select>

            <select value={status} onChange={(e) => updateParam('status', e.target.value)}
              aria-label="Filtrer par statut"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus:border-[#22c55e] cursor-pointer">
              <option value="">Tous les statuts</option>
              <option value="airing">En cours</option>
              <option value="complete">Terminé</option>
              <option value="upcoming">À venir</option>
            </select>

            <select value={saison} onChange={(e) => updateParam('saison', e.target.value)}
              aria-label="Filtrer par saison"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus:border-[#22c55e] cursor-pointer">
              <option value="">Toutes les saisons</option>
              <option value="hiver">Hiver</option>
              <option value="printemps">Printemps</option>
              <option value="ete">Été</option>
              <option value="automne">Automne</option>
            </select>

            <select value={annee} onChange={(e) => updateParam('annee', e.target.value)}
              aria-label="Filtrer par année"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus:border-[#22c55e] cursor-pointer">
              <option value="">Toutes les années</option>
              {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>

            <select value={orderBy} onChange={(e) => updateParam('orderBy', e.target.value)}
              aria-label="Trier par"
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] rounded-lg px-2 sm:px-3 py-2 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus:border-[#22c55e] cursor-pointer">
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

      {/* Compteur Ma liste */}
      {tab === 'liste' && watchlist.length > 0 && !isEmpty && (
        <div className="flex items-center gap-3 -mt-4 flex-wrap">
          {WATCH_STATUS.map(ws => {
            const count = watchlist.filter(a => a.watchStatus === ws.value).length
            if (!count) return null
            return (
              <span key={ws.value} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ws.color }} />
                {ws.label} · {count}
              </span>
            )
          })}
        </div>
      )}

      {/* Compteur favoris */}
      {tab === 'favoris' && favorites.length > 0 && !isEmpty && (
        <p className="text-[var(--text-muted)] text-base font-medium -mt-4">
          {favorites.length} favori{favorites.length > 1 ? 's' : ''}
        </p>
      )}

      {/* Compteur récents */}
      {tab === 'recents' && history.length > 0 && !isEmpty && (
        <p className="text-[var(--text-muted)] text-sm font-medium -mt-4">
          {uniqueHistoryCount} animé{uniqueHistoryCount > 1 ? 's' : ''} consulté{uniqueHistoryCount > 1 ? 's' : ''}
        </p>
      )}

      {/* Erreur API */}
      {erreurCatalogue && !loading && (
        <div role="alert" className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="text-5xl" aria-hidden="true">⚠️</span>
          <p className="text-[var(--text-primary)] font-semibold text-lg">Impossible de charger les animés</p>
          <p className="text-[var(--text-muted)] text-sm">L&apos;API {ATTRIBUTION.nom} est momentanément indisponible. Réessaie dans quelques instants.</p>
          <button
            onClick={() => { contournerAuProchainAppel.current = true; setError(false); setRetryKey(k => k + 1) }}
            className="mt-2 px-5 py-2 bg-[#15803d] hover:bg-[#166534] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Résultats */}
      {!erreurCatalogue && tab === 'catalogue' && loading ? (
        isGrid ? (
          <div className="grid grid-cols-2 min-[540px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
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
      ) : !erreurCatalogue && displayList.length === 0 ? (
        tab === 'favoris'
          ? (
            <div className="relative">
              <div className="grid grid-cols-2 min-[540px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 opacity-30 pointer-events-none select-none">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="aspect-[2/3] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]" />
                    <div className="h-3 bg-[var(--bg-surface)] rounded w-4/5" />
                    <div className="h-2.5 bg-[var(--bg-surface)] rounded w-1/2" />
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
                <p className="text-[var(--text-primary)] font-semibold text-lg">Aucun favori pour l'instant</p>
                <p className="text-[var(--text-muted)] text-sm max-w-xs">Explore le catalogue, ouvre un animé et ajoute-le à tes favoris pour le retrouver ici.</p>
                <button
                  onClick={() => switchTab('catalogue')}
                  className="mt-1 px-5 py-2 bg-[#15803d] hover:bg-[#166534] text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Explorer le catalogue
                </button>
              </div>
            </div>
          )
          : tab === 'recents'
          ? <EmptyState query="" onReset={() => switchTab('catalogue')} emptyRecents />
          : tab === 'liste'
          ? <EmptyState query="" onReset={() => switchTab('catalogue')} emptyListe />
          : <EmptyState query={query} onReset={query ? clearSearch : resetFilters} />
      ) : !erreurCatalogue && tab === 'liste' ? (
        <Suspense fallback={<div className="py-20 text-center text-[var(--text-muted)] text-sm">Chargement de ta liste…</div>}>
          <WatchlistTable list={displayList} />
        </Suspense>
      ) : !erreurCatalogue && isGrid ? (
        <div className="grid grid-cols-2 min-[540px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {displayList.map((anime, index) => (
            <AnimeCard key={anime.mal_id} anime={anime} prioritaire={index < 5} />
          ))}
        </div>
      ) : !erreurCatalogue ? (
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
