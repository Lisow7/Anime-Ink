import { useEffect, useState, useCallback } from 'react'
import { useModal } from '../context/ModalContext'
import { useFavorites } from '../context/FavoritesContext'
import { useHistory } from '../context/HistoryContext'
import { getAnimeById } from '../services/jikan'
import { translateSynopsis } from '../services/translate'

const statusLabel = {
  'Finished Airing': 'Terminé',
  'Currently Airing': 'En cours',
  'Not yet aired': 'À venir',
}

const infoItem = (label, value) => value ? (
  <div className="flex flex-col gap-0.5">
    <span className="text-[#6b7280] text-xs uppercase tracking-wider">{label}</span>
    <span className="text-[#f5f5f5] text-sm">{value}</span>
  </div>
) : null

export default function AnimeModal() {
  const { animeId, closeModal } = useModal()
  const { isFavorite, toggle } = useFavorites()
  const { addToHistory } = useHistory()
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(false)
  const [synopsis, setSynopsis] = useState(null)
  const [translating, setTranslating] = useState(false)

  const close = useCallback(() => {
    closeModal()
    setAnime(null)
  }, [closeModal])

  // Fermer avec Échap
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  // Bloquer le scroll
  useEffect(() => {
    if (animeId) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [animeId])

  // Charger l'animé
  useEffect(() => {
    if (!animeId) return
    setLoading(true)
    setAnime(null)
    setSynopsis(null)
    getAnimeById(animeId).then(async (data) => {
      setAnime(data)
      setLoading(false)
      if (data?.synopsis) {
        setTranslating(true)
        const fr = await translateSynopsis(data.mal_id, data.synopsis)
        setSynopsis(fr)
        setTranslating(false)
      }
      if (data) addToHistory({
        mal_id: data.mal_id, title: data.title, images: data.images,
        score: data.score, episodes: data.episodes, status: data.status,
        aired: data.aired, genres: data.genres, synopsis: data.synopsis,
      })
    })
  }, [animeId])

  if (!animeId) return null

  const fav = anime ? isFavorite(anime.mal_id) : false

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="modal-box relative bg-[#0f0f0f] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Bouton fermer */}
        <button
          onClick={close}
          className="sticky top-4 float-right mr-4 z-10 bg-[#1a1a1a] border border-white/10 text-[#6b7280] hover:text-[#f5f5f5] rounded-full w-8 h-8 flex items-center justify-center transition-colors"
        >
          ✕
        </button>

        {loading ? (
          <div className="p-8 animate-pulse flex flex-col md:flex-row gap-8 clear-both">
            <div className="w-40 shrink-0 aspect-[2/3] bg-[#1a1a1a] rounded-xl" />
            <div className="flex-1 flex flex-col gap-4">
              <div className="h-8 bg-[#1a1a1a] rounded w-2/3" />
              <div className="h-4 bg-[#1a1a1a] rounded w-full" />
              <div className="h-4 bg-[#1a1a1a] rounded w-5/6" />
              <div className="h-4 bg-[#1a1a1a] rounded w-4/6" />
            </div>
          </div>
        ) : anime ? (
          <div className="p-8 flex flex-col gap-8 clear-both">

            {/* Hero */}
            <div className="flex flex-col md:flex-row gap-6">
              <img
                src={anime.images?.jpg?.large_image_url}
                alt={anime.title}
                className="w-40 shrink-0 rounded-xl object-cover self-start"
              />
              <div className="flex flex-col gap-4 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#f5f5f5] leading-tight">{anime.title}</h2>
                    {anime.title_japanese && (
                      <p className="text-[#6b7280] text-sm mt-1">{anime.title_japanese}</p>
                    )}
                  </div>
                  {/* Bouton favori */}
                  <button
                    onClick={() => toggle(anime)}
                    className={`shrink-0 transition-colors ${fav ? 'text-[#22c55e]' : 'text-[#6b7280] hover:text-[#22c55e]'}`}
                    aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                {/* Score */}
                {anime.score && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-[#22c55e] text-4xl font-bold">{anime.score}</span>
                    <span className="text-[#6b7280] text-sm">/ 10</span>
                    {anime.scored_by && (
                      <span className="text-[#6b7280] text-xs">({anime.scored_by.toLocaleString()} votes)</span>
                    )}
                  </div>
                )}

                {/* Infos */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#1a1a1a] rounded-xl p-4">
                  {infoItem('Statut', statusLabel[anime.status] ?? anime.status)}
                  {infoItem('Épisodes', anime.episodes)}
                  {infoItem('Durée / ép.', anime.duration)}
                  {infoItem('Diffusion', anime.aired?.string)}
                  {infoItem('Saison', anime.season && anime.year ? `${anime.season} ${anime.year}` : anime.year)}
                  {infoItem('Classement', anime.rank ? `#${anime.rank}` : null)}
                  {infoItem('Popularité', anime.popularity ? `#${anime.popularity}` : null)}
                  {infoItem('Studios', anime.studios?.map(s => s.name).join(', '))}
                </div>

                {/* Genres */}
                {anime.genres?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {anime.genres.map((g) => (
                      <span key={g.mal_id} className="bg-[#1a1a1a] border border-white/10 text-[#6b7280] text-xs px-3 py-1 rounded-full">
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Liens de visionnage */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[#f5f5f5] font-semibold">Regarder</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Crunchyroll', color: '#f47521', href: `https://www.crunchyroll.com/search?q=${encodeURIComponent(anime.title)}` },
                  { label: 'ADN', color: '#00aaff', href: `https://animationdigitalnetwork.com/search#query=${encodeURIComponent(anime.title)}` },
                  { label: 'Netflix', color: '#e50914', href: `https://www.netflix.com/search?q=${encodeURIComponent(anime.title)}` },
                  { label: 'MyAnimeList', color: '#2e51a2', href: anime.url || `https://myanimelist.net/anime/${anime.mal_id}` },
                ].map(({ label, color, href }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-[#1a1a1a] text-sm text-[#f5f5f5] hover:border-white/30 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    {label}
                  </a>
                ))}
              </div>
              <p className="text-[#6b7280] text-xs">Ces liens redirigent vers la recherche de l'animé sur chaque plateforme.</p>
            </div>

            {/* Synopsis */}
            {anime.synopsis && (
              <div className="flex flex-col gap-3">
                <h3 className="text-[#f5f5f5] font-semibold">Synopsis</h3>
                {translating ? (
                  <div className="flex items-center gap-2 text-[#6b7280] text-sm">
                    <div className="w-3 h-3 border border-[#6b7280] border-t-transparent rounded-full animate-spin" />
                    Traduction en cours…
                  </div>
                ) : (
                  <p className="text-[#6b7280] text-sm leading-relaxed">{synopsis || anime.synopsis}</p>
                )}
              </div>
            )}

            {/* Trailer */}
            {anime.trailer?.embed_url && (
              <div className="flex flex-col gap-3">
                <h3 className="text-[#f5f5f5] font-semibold">Bande-annonce</h3>
                <div className="aspect-video rounded-xl overflow-hidden bg-[#1a1a1a]">
                  <iframe
                    src={anime.trailer.embed_url}
                    title={`Trailer ${anime.title}`}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
