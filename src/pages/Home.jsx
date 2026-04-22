import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDebounce } from '../hooks/useDebounce'
import { useSEO } from '../hooks/useSEO'
import AnimeCard from '../components/AnimeCard'
import { getTopAnime, getRandomAnime, searchAnime } from '../services/jikan'
import { groupAnime } from '../utils/groupAnime'
import { useModal } from '../context/ModalContext'
import { useAgeFilter } from '../context/AgeFilterContext'
import { HENTAI_GENRES, ECCHI_GENRES } from '../constants/ageFilter'
import { scoreColor } from '../utils/score'

export default function Home() {
  useSEO()
  const [query, setQuery] = useState('')
  const [topAnimes, setTopAnimes] = useState([])
  const [topLoading, setTopLoading] = useState(true)
  const [random, setRandom] = useState(null)
  const [randomLoading, setRandomLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshCount, setRefreshCount] = useState(1)
  const [showPopover, setShowPopover] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debouncedQuery = useDebounce(query, 400)
  const searchContainerRef = useRef(null)
  const navigate = useNavigate()
  const { openModal } = useModal()
  const { blurHentai } = useAgeFilter()

  useEffect(() => {
    getTopAnime(1).then((data) => {
      setTopAnimes(data.data?.slice(0, 6) ?? [])
      setTopLoading(false)
    })
  }, [])

  const CACHE_KEY = 'anime-ink-random'
  const CACHE_TTL = 3600 * 1000

  const fetchRandom = useCallback((isRefresh = false) => {
    const apply = (data, setDone) => {
      if (!data) { setDone(); return }
      const img = new Image()
      img.src = data.images?.jpg?.image_url ?? data.images?.jpg?.large_image_url
      const done = () => { setRandom(data); setDone() }
      img.onload = done
      img.onerror = done
    }

    if (isRefresh) {
      setIsRefreshing(true)
      setRefreshCount(c => c + 1)
      getRandomAnime()
        .then((data) => {
          if (data) {
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
          }
          apply(data, () => setIsRefreshing(false))
        })
        .catch(() => setIsRefreshing(false))
    } else {
      try {
        const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
          setRandom(cached.data)
          setRandomLoading(false)
          getRandomAnime().then(data => {
            if (data) {
              try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
              setRandom(data)
            }
          }).catch(() => {})
          return
        }
      } catch {}
      setRandomLoading(true)
      getRandomAnime()
        .then((data) => {
          if (data) {
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })) } catch {}
          }
          apply(data, () => setRandomLoading(false))
        })
        .catch(() => setRandomLoading(false))
    }
  }, [])

  useEffect(() => { fetchRandom(false) }, [])

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q) { setSuggestions([]); setSuggestionsLoading(false); return }
    setSuggestionsLoading(true)
    searchAnime(q)
      .then(results => { setSuggestions(groupAnime(results ?? []).slice(0, 6)); setSuggestionsLoading(false) })
      .catch(() => { setSuggestions([]); setSuggestionsLoading(false) })
  }, [debouncedQuery])

  useEffect(() => {
    const handler = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) { setShowSuggestions(false); navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`) }
  }

  const pickSuggestion = (anime) => {
    setShowSuggestions(false)
    setQuery('')
    setSuggestions([])
    openModal(anime.mal_id)
  }

  const randomIsHentai = random?.genres?.some(g => HENTAI_GENRES.includes(g.name))
  const randomIsEcchi = random?.genres?.some(g => ECCHI_GENRES.includes(g.name))
  const randomBlurred = blurHentai && (randomIsHentai || randomIsEcchi)
  const randomAgeBadge = randomIsHentai ? '-18' : '-16'

  return (
    <main className="flex flex-col items-center px-4 sm:px-6 py-10 sm:py-16 gap-10 sm:gap-16 max-w-6xl mx-auto w-full">

      {/* Hero */}
      <section className="flex flex-col items-center text-center gap-8 max-w-xl w-full">
        <div className="flex flex-col gap-4">
          <h1 className="text-5xl font-bold text-[var(--text-primary)] tracking-tight leading-tight">
            Découvre l'univers<br />
            <span className="text-[var(--color-accent)]">des animés</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg">
            Recherche, explore et découvre des milliers d'animés.
          </p>
        </div>

        <div ref={searchContainerRef} className="w-full relative">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true) }}
              onFocus={() => { if (query.trim()) setShowSuggestions(true) }}
              placeholder="Rechercher un animé..."
              className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
            />
            <button
              type="submit"
              className="bg-[#15803d] hover:bg-[#166534] text-white font-medium px-6 py-3 rounded-lg text-sm transition-colors shrink-0"
            >
              Chercher
            </button>
          </form>

          {/* Dropdown suggestions */}
          {showSuggestions && query.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden z-50">
              {suggestionsLoading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-[var(--text-muted)] text-sm">
                  <div className="w-3.5 h-3.5 border border-[var(--text-muted)] border-t-transparent rounded-full animate-spin shrink-0" />
                  Recherche en cours…
                </div>
              ) : suggestions.length === 0 ? (
                <p className="px-4 py-3 text-[var(--text-muted)] text-sm">
                  Aucun animé trouvé pour «&nbsp;{debouncedQuery}&nbsp;».
                </p>
              ) : (
                <>
                  {suggestions.map(anime => (
                    <button
                      key={anime.mal_id}
                      type="button"
                      onClick={() => pickSuggestion(anime)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-base)] transition-colors text-left border-b border-[var(--border-subtle)] last:border-0"
                    >
                      <img
                        src={anime.images?.jpg?.image_url}
                        alt={anime.title}
                        className="w-8 h-11 object-cover rounded shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[var(--text-primary)] text-sm font-medium truncate">{anime.title}</p>
                        <p className="text-[var(--text-muted)] text-[11px]">
                          {anime.year ?? '—'}{anime.score ? ` · ★ ${anime.score}` : ''}
                        </p>
                      </div>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setShowSuggestions(false); navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`) }}
                    className="w-full px-4 py-2.5 text-[#22c55e] text-xs font-medium hover:bg-[var(--bg-base)] transition-colors text-center"
                  >
                    Voir tous les résultats pour «&nbsp;{query}&nbsp;» →
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Animé surprise */}
      <section className="w-full flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#16a34a] fill-none stroke-current shrink-0" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="4"/>
              <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            </svg>
            <span className="text-sm font-semibold text-[var(--text-primary)] tracking-wide">Animé surprise</span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-[#16a34a]/30 to-transparent" />
        </div>

        {randomLoading ? (
          <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-[var(--bg-surface)] animate-pulse" />
        ) : random ? (
          <div className={`relative w-full h-52 sm:h-64 md:h-72 rounded-2xl overflow-hidden bg-gradient-to-br from-[#0d1f10] to-[#0f0f0f] transition-all duration-300 ${isRefreshing ? 'opacity-30 scale-[0.98] blur-[2px]' : 'opacity-100 scale-100 blur-0'}`}>

            {/* Fond flouté — masqué sur mobile pour que le LCP soit le <h1> (statique) */}
            <div
              aria-hidden
              className="absolute inset-0 w-full h-full scale-110 blur-lg opacity-20 hidden sm:block"
              style={{
                backgroundImage: `url(${random.images?.jpg?.image_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Gradient gauche */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
            {/* Gradient bas */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Bouton refresh + popover */}
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => fetchRandom(true)}
                disabled={isRefreshing}
                onMouseEnter={() => setShowPopover(true)}
                onMouseLeave={() => setShowPopover(false)}
                aria-label="Nouvelle suggestion"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all backdrop-blur-sm disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 fill-none stroke-current transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth="2">
                  <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {showPopover && (
                <div className="absolute top-10 right-0 w-56 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3 shadow-2xl text-left pointer-events-none">
                  <p className="text-[var(--text-primary)] text-xs font-semibold mb-1">Anime aléatoire</p>
                  <p className="text-[var(--text-muted)] text-[11px] leading-relaxed">
                    Chaque suggestion appelle l'API Jikan (MyAnimeList). Limitée à 3 requêtes / seconde.
                  </p>
                  <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-[var(--border-subtle)]">
                    <svg viewBox="0 0 24 24" className="w-3 h-3 text-[#22c55e] fill-none stroke-current shrink-0" strokeWidth="2">
                      <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      <span className="text-[#22c55e] font-semibold">{refreshCount}</span> requête{refreshCount > 1 ? 's' : ''} effectuée{refreshCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Contenu */}
            <div className="absolute inset-0 z-10 flex items-center gap-4 sm:gap-6 px-4 sm:px-6 md:px-8">

              {/* Poster cliquable */}
              <button
                className="relative hidden sm:block shrink-0 group"
                onClick={() => openModal(random.mal_id)}
                aria-label={`Ouvrir ${random.title}`}
              >
                <img
                  src={random.images?.jpg?.image_url ?? random.images?.jpg?.large_image_url}
                  alt={random.title}
                  fetchpriority="high"
                  width={176}
                  height={264}
                  className="h-44 rounded-xl shadow-2xl object-cover transition-transform duration-200 group-hover:scale-105"
                  style={randomBlurred ? { filter: 'blur(10px)', transform: 'scale(1.05)' } : undefined}
                />
                {randomBlurred && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl pointer-events-none">
                    <div
                    className="w-14 h-14 rounded-full flex items-center justify-center border-2 backdrop-blur-sm select-none"
                    style={randomIsHentai
                      ? { borderColor: '#e63946', background: 'rgba(230,57,70,0.18)', boxShadow: '0 0 22px rgba(230,57,70,0.5)' }
                      : { borderColor: '#a855f7', background: 'rgba(168,85,247,0.18)', boxShadow: '0 0 22px rgba(168,85,247,0.5)' }
                    }
                  >
                    <span className="text-sm font-black leading-none" style={{ color: randomIsHentai ? '#e63946' : '#a855f7' }}>
                      {randomAgeBadge}
                    </span>
                  </div>
                  </div>
                )}
              </button>

              {/* Texte */}
              <div className="flex flex-col gap-3 min-w-0">
                {random.title_japanese && !randomBlurred && (
                  <p className="text-white/40 text-xs tracking-wide truncate">{random.title_japanese}</p>
                )}
                <h2
                  className="text-white font-bold text-xl sm:text-2xl leading-tight line-clamp-2 cursor-pointer hover:text-[#22c55e] transition-colors"
                  onClick={() => openModal(random.mal_id)}
                >
                  {randomBlurred ? '??? — Contenu adulte' : random.title}
                </h2>

                {!randomBlurred && (
                  <div className="flex items-center gap-3">
                    {random.score && (
                      <span className="text-lg font-bold" style={{ color: scoreColor(random.score) }}>★ {random.score}</span>
                    )}
                    {random.year && (
                      <span className="text-white/40 text-xs">{random.year}</span>
                    )}
                    {random.episodes && (
                      <span className="text-white/40 text-xs">{random.episodes} ép.</span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {random.genres?.slice(0, 3).map(g => (
                    <span key={g.mal_id} className="text-[10px] px-2.5 py-0.5 rounded border border-white/20 text-white/60">
                      {g.name}
                    </span>
                  ))}
                </div>

                <button
                  onClick={() => openModal(random.mal_id)}
                  className="mt-1 w-fit text-sm font-medium text-[#22c55e] hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  {randomBlurred ? 'Voir quand même' : 'Découvrir'}
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* Top animés */}
      <section className="w-full flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-[#16a34a] fill-none stroke-current shrink-0" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-semibold text-[var(--text-primary)] tracking-wide">Top animés du moment</span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-[#16a34a]/30 to-transparent" />
          <a href="/catalogue" className="shrink-0 text-[var(--text-muted)] text-xs hover:text-[#16a34a] transition-colors">
            Voir tout →
          </a>
        </div>

        {topLoading ? (
          <div className="grid grid-cols-2 min-[540px]:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-[var(--bg-surface)] rounded-xl aspect-[2/3] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 min-[540px]:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {groupAnime(topAnimes).map((anime) => (
              <AnimeCard key={anime.mal_id} anime={anime} />
            ))}
          </div>
        )}
      </section>

    </main>
  )
}
