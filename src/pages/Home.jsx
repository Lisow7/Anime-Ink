import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AnimeCard from '../components/AnimeCard'
import { getTopAnime, getRandomAnime } from '../services/jikan'
import { useModal } from '../context/ModalContext'
import { useAgeFilter } from '../context/AgeFilterContext'
import { HENTAI_GENRES, ECCHI_GENRES } from '../constants/ageFilter'
import { scoreColor } from '../utils/score'

export default function Home() {
  const [query, setQuery] = useState('')
  const [topAnimes, setTopAnimes] = useState([])
  const [topLoading, setTopLoading] = useState(true)
  const [random, setRandom] = useState(null)
  const [randomLoading, setRandomLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const navigate = useNavigate()
  const { openModal } = useModal()
  const { blurHentai } = useAgeFilter()

  useEffect(() => {
    getTopAnime(1).then((data) => {
      setTopAnimes(data.data?.slice(0, 6) ?? [])
      setTopLoading(false)
    })
  }, [])

  const fetchRandom = useCallback((isRefresh = false) => {
    const apply = (data, setDone) => {
      if (!data) { setDone(); return }
      const img = new Image()
      img.src = data.images?.jpg?.large_image_url
      const done = () => { setRandom(data); setDone() }
      img.onload = done
      img.onerror = done
    }

    if (isRefresh) {
      setIsRefreshing(true)
      getRandomAnime()
        .then((data) => apply(data, () => setIsRefreshing(false)))
        .catch(() => setIsRefreshing(false))
    } else {
      setRandomLoading(true)
      getRandomAnime()
        .then((data) => apply(data, () => setRandomLoading(false)))
        .catch(() => setRandomLoading(false))
    }
  }, [])

  useEffect(() => { fetchRandom(false) }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`)
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
            <span className="text-[#22c55e]">des animés</span>
          </h1>
          <p className="text-[var(--text-muted)] text-lg">
            Recherche, explore et découvre des milliers d'animés.
          </p>
        </div>

        <form onSubmit={handleSearch} className="w-full flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un animé..."
            className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] placeholder-[var(--text-muted)] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#22c55e] transition-colors"
          />
          <button
            type="submit"
            className="bg-[#22c55e] hover:bg-[#22c55e]/80 text-white font-medium px-6 py-3 rounded-lg text-sm transition-colors"
          >
            Chercher
          </button>
        </form>
      </section>

      {/* Animé surprise */}
      <section className="w-full flex flex-col gap-4">
        <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">Animé surprise</span>

        {randomLoading ? (
          <div className="relative w-full h-64 rounded-2xl overflow-hidden bg-[var(--bg-surface)] animate-pulse" />
        ) : random ? (
          <div className={`relative w-full h-52 sm:h-64 md:h-72 rounded-2xl overflow-hidden transition-all duration-300 ${isRefreshing ? 'opacity-30 scale-[0.98] blur-[2px]' : 'opacity-100 scale-100 blur-0'}`}>

            {/* Fond flouté */}
            <img
              src={random.images?.jpg?.large_image_url}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-lg opacity-20"
            />

            {/* Gradient gauche */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
            {/* Gradient bas */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

            {/* Bouton refresh */}
            <button
              onClick={() => fetchRandom(true)}
              disabled={isRefreshing}
              aria-label="Nouvelle suggestion"
              className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all backdrop-blur-sm disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 fill-none stroke-current transition-transform duration-500 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth="2">
                <path d="M23 4v6h-6M1 20v-6h6" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {/* Contenu */}
            <div className="absolute inset-0 z-10 flex items-center gap-4 sm:gap-6 px-4 sm:px-6 md:px-8">

              {/* Poster */}
              <div className="relative hidden sm:block shrink-0">
                <img
                  src={random.images?.jpg?.large_image_url}
                  alt={random.title}
                  className="h-44 rounded-xl shadow-2xl object-cover"
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
              </div>

              {/* Texte */}
              <div className="flex flex-col gap-3 min-w-0">
                {random.title_japanese && !randomBlurred && (
                  <p className="text-white/40 text-xs tracking-wide truncate">{random.title_japanese}</p>
                )}
                <h3 className="text-white font-bold text-xl sm:text-2xl leading-tight line-clamp-2">
                  {randomBlurred ? '??? — Contenu adulte' : random.title}
                </h3>

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
                    <span key={g.mal_id} className="text-[10px] px-2.5 py-0.5 rounded-full border border-white/20 text-white/60">
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
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Top animés du moment</h2>
          <a href="/catalogue" className="text-[var(--text-muted)] text-sm hover:text-[#22c55e] transition-colors">
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
            {topAnimes.map((anime) => (
              <AnimeCard key={anime.mal_id} anime={anime} />
            ))}
          </div>
        )}
      </section>

    </main>
  )
}
