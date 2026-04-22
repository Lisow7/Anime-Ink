import { useEffect, useState, useCallback, useRef } from 'react'
import { useModal } from '../context/ModalContext'
import { useFavorites } from '../context/FavoritesContext'
import { useHistory } from '../context/HistoryContext'
import { useWatchlist } from '../context/WatchlistContext'
import { getAnimeById, getAnimeRecommendations, getAnimeFranchise } from '../services/jikan'
import { translateSynopsis } from '../services/translate'
import { STATUS_LABEL, PLATFORM_COLORS } from '../constants/anime'
import { scoreColor } from '../utils/score'
import { infoItem } from '../utils/anime'

export default function AnimeModal() {
  const { animeId, openModal, closeModal } = useModal()
  const { isFavorite, toggle } = useFavorites()
  const { addToHistory } = useHistory()
  const { getStatus, setStatus, remove } = useWatchlist()

  const [localAnimeId, setLocalAnimeId] = useState(null)
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(false)
  const [synopsis, setSynopsis] = useState(null)
  const [translating, setTranslating] = useState(false)
  const [recommendations, setRecommendations] = useState([])
  const [deadLinks, setDeadLinks] = useState(new Set())
  const [seriesData, setSeriesData] = useState(null)
  const franchiseLoadedFor = useRef(null)

  const close = useCallback(() => {
    closeModal()
    setAnime(null)
    setLocalAnimeId(null)
    setSeriesData(null)
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

  // Synchroniser localAnimeId avec animeId quand le modal s'ouvre, et vider la franchise précédente
  useEffect(() => {
    setLocalAnimeId(animeId)
    setSeriesData(null)
    franchiseLoadedFor.current = null
  }, [animeId])

  // Charger l'animé quand localAnimeId change (ouverture ou changement de saison)
  useEffect(() => {
    if (!localAnimeId) return
    setLoading(true)
    setAnime(null)
    setSynopsis(null)
    setRecommendations([])
    setDeadLinks(new Set())
    getAnimeById(localAnimeId).then(async (data) => {
      setAnime(data)
      setLoading(false)
      if (data?.synopsis) {
        setTranslating(true)
        const fr = await translateSynopsis(data.mal_id, data.synopsis)
        setSynopsis(fr)
        setTranslating(false)
      }
      getAnimeRecommendations(localAnimeId).then(setRecommendations)
      if (data && (localAnimeId === animeId || data.type !== 'TV')) addToHistory({
        mal_id: data.mal_id, title: data.title, images: data.images,
        score: data.score, episodes: data.episodes, status: data.status,
        type: data.type, aired: data.aired, genres: data.genres, synopsis: data.synopsis,
      })
    })
  }, [localAnimeId])

  // Charger les données de la franchise une seule fois par ouverture de modal
  useEffect(() => {
    if (!anime || anime.mal_id !== animeId) return
    if (franchiseLoadedFor.current === animeId) return
    franchiseLoadedFor.current = animeId
    getAnimeFranchise(anime.title).then(data => {
      let seasons = data.seasons
      let others = data.others

      // Toujours injecter l'animé courant s'il est TV et absent (ex: mid-season ou Frieren S1)
      if (anime.type === 'TV' && !seasons.some(s => s.mal_id === anime.mal_id)) {
        seasons = [...seasons, { mal_id: anime.mal_id, title: anime.title, episodes: anime.episodes, year: anime.year }]
          .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))
      }

      // Enrichir avec les relations directes (Yu-Gi-Oh, titres incompatibles)
      const knownIds = new Set([anime.mal_id, ...seasons.map(s => s.mal_id), ...others.map(o => o.mal_id)])
      for (const rel of (anime.relations ?? [])) {
        for (const entry of rel.entry) {
          if (entry.type !== 'anime' || knownIds.has(entry.mal_id)) continue
          knownIds.add(entry.mal_id)
          const r = rel.relation
          if (r === 'Sequel' || r === 'Prequel') {
            // Sequel/Prequel → probablement une saison TV, on l'ajoute au sélecteur de saisons
            seasons = [...seasons, { mal_id: entry.mal_id, title: entry.name, episodes: null, year: null }]
          } else if (r === 'Alternative version' || r === 'Summary' || r === 'Side Story' || r === 'Spin-off') {
            others = [...others, { mal_id: entry.mal_id, title: entry.name, type: r, label: entry.name }]
          }
        }
      }
      // Re-trier les saisons (les ajouts via relations n'ont pas d'année → fin de liste)
      seasons = seasons.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))

      const merged = { seasons, others }
      setSeriesData(merged.seasons.length > 1 || merged.others.length > 0 ? merged : null)
    })
  }, [anime?.mal_id, animeId])

  // Vérifier les liens morts
  useEffect(() => {
    if (!anime) return
    const urls = [
      ...(anime.streaming || []).map(s => s.url),
      anime.url,
    ].filter(Boolean)

    urls.forEach(async (url) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
        if (res.status === 404) setDeadLinks(prev => new Set([...prev, url]))
      } catch {
        try {
          await fetch(url, { mode: 'no-cors', signal: AbortSignal.timeout(5000) })
        } catch {
          setDeadLinks(prev => new Set([...prev, url]))
        }
      }
    })
  }, [anime?.mal_id])

  const switchAnime = useCallback((id) => {
    if (id === localAnimeId) return
    setLocalAnimeId(id)
  }, [localAnimeId])

  if (!animeId) return null

  const fav = anime ? isFavorite(anime.mal_id) : false
  const watchStatus = anime ? getStatus(anime.mal_id) : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="modal-box relative bg-[var(--bg-base)] border border-[var(--border-color)] rounded-xl sm:rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Bouton fermer */}
        <div className="sticky top-0 z-10 flex justify-end p-3 bg-[var(--bg-base)]/80 backdrop-blur-sm">
          <button
            onClick={close}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full w-8 h-8 flex items-center justify-center transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="px-4 sm:px-8 pb-6 sm:pb-8 animate-pulse flex flex-col sm:flex-row gap-6">
            <div className="w-28 sm:w-40 shrink-0 aspect-[2/3] bg-[var(--bg-surface)] rounded-xl mx-auto sm:mx-0" />
            <div className="flex-1 flex flex-col gap-4">
              <div className="h-6 bg-[var(--bg-surface)] rounded w-2/3" />
              <div className="h-4 bg-[var(--bg-surface)] rounded w-full" />
              <div className="h-4 bg-[var(--bg-surface)] rounded w-5/6" />
            </div>
          </div>
        ) : anime ? (
          <div className="px-4 sm:px-8 pb-6 sm:pb-8 flex flex-col gap-5 sm:gap-8">

            {/* Hero */}
            <div className="flex flex-col min-[500px]:flex-row gap-4 min-[500px]:gap-6">
              <img
                src={anime.images?.jpg?.large_image_url}
                alt={anime.title}
                className="w-28 min-[500px]:w-36 sm:w-40 shrink-0 rounded-xl object-cover self-start mx-auto min-[500px]:mx-0"
              />
              <div className="flex flex-col gap-3 sm:gap-4 flex-1 min-w-0">
                {/* Titre */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-tight">{anime.title}</h2>
                  {anime.title_japanese && (
                    <p className="text-[var(--text-muted)] text-sm mt-1 truncate">{anime.title_japanese}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => watchStatus ? remove(anime.mal_id) : setStatus(anime, 'to_watch')}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      watchStatus
                        ? 'bg-[var(--bg-surface)] border-[#22c55e] text-[#22c55e]'
                        : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[#22c55e] hover:text-[#22c55e]'
                    }`}
                    aria-label={watchStatus ? 'Retirer de ma liste' : 'Ajouter à ma liste'}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current shrink-0" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {watchStatus ? 'Dans ma liste' : 'Ma liste'}
                  </button>
                  <button
                    onClick={() => toggle(anime)}
                    className={`shrink-0 transition-colors ${fav ? 'text-[#22c55e]' : 'text-[var(--text-muted)] hover:text-[#22c55e]'}`}
                    aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <svg viewBox="0 0 24 24" className="w-5 h-5 sm:w-6 sm:h-6" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                {/* Score */}
                {anime.score && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-bold" style={{ color: scoreColor(anime.score) }}>{anime.score}</span>
                    <span className="text-[var(--text-muted)] text-sm">/ 10</span>
                    {anime.scored_by && (
                      <span className="text-[var(--text-muted)] text-xs">({anime.scored_by.toLocaleString()} votes)</span>
                    )}
                  </div>
                )}

                {/* Infos */}
                <div className="grid grid-cols-2 min-[500px]:grid-cols-3 gap-3 bg-[var(--bg-surface)] rounded-xl p-3 sm:p-4">
                  {infoItem('Statut', STATUS_LABEL[anime.status] ?? anime.status)}
                  {infoItem('Épisodes', anime.episodes ?? (anime.airing ? 'En cours' : '?'))}
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
                      <span key={g.mal_id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] text-xs px-3 py-1 rounded">
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sélecteur de saisons / franchise */}
            {seriesData && (
              <div className="flex flex-col gap-3">
                <h3 className="text-[var(--text-primary)] font-semibold text-sm">Toute la franchise</h3>

                {/* Saisons TV */}
                {seriesData.seasons.length === 1 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)] text-xs shrink-0">Saisons :</span>
                    <button
                      onClick={() => switchAnime(seriesData.seasons[0].mal_id)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                        localAnimeId === seriesData.seasons[0].mal_id
                          ? 'border-[#22c55e] text-[#22c55e] bg-[#22c55e]/10'
                          : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[#22c55e] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      Saison 1{seriesData.seasons[0].episodes ? ` · ${seriesData.seasons[0].episodes} ép.` : ''}
                    </button>
                  </div>
                ) : seriesData.seasons.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)] text-xs shrink-0">Saisons :</span>
                    <select
                      value={seriesData.seasons.some(s => s.mal_id === localAnimeId) ? localAnimeId : ''}
                      onChange={(e) => e.target.value && switchAnime(Number(e.target.value))}
                      className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#22c55e] cursor-pointer font-medium"
                    >
                      {!seriesData.seasons.some(s => s.mal_id === localAnimeId) && (
                        <option value="" disabled>— Choisir une saison —</option>
                      )}
                      {seriesData.seasons.map((s, i) => (
                        <option key={s.mal_id} value={s.mal_id}>
                          Saison {i + 1}{s.episodes ? ` · ${s.episodes} ép.` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {/* Films, OVAs, ONAs, Spéciaux groupés par type */}
                {seriesData.others.length > 0 && (() => {
                  const TYPE_LABELS = { Movie: 'Films', OVA: 'OVAs', ONA: 'ONAs', Special: 'Spéciaux', 'Alternative version': 'Versions alt.', Summary: 'Récaps', 'Side Story': 'Spin-offs', 'Spin-off': 'Spin-offs' }
                  const typeOrder = ['Movie', 'OVA', 'ONA', 'Special']
                  const extraTypes = [...new Set(seriesData.others.map(o => o.type))].filter(t => !typeOrder.includes(t))
                  return [...typeOrder, ...extraTypes].map(type => {
                    const items = seriesData.others.filter(o => o.type === type)
                    if (!items.length) return null
                    return (
                      <div key={type} className="flex flex-wrap items-center gap-2">
                        <span className="text-[var(--text-muted)] text-xs shrink-0">
                          {TYPE_LABELS[type] ?? type} :
                        </span>
                        {items.map(o => (
                          <button
                            key={o.mal_id}
                            onClick={() => switchAnime(o.mal_id)}
                            title={o.title}
                            className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors whitespace-nowrap ${
                              localAnimeId === o.mal_id
                                ? 'bg-[#15803d] border-[#15803d] text-white'
                                : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[#22c55e] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    )
                  })
                })()}
              </div>
            )}

            {/* Liens de visionnage */}
            {(() => {
              const streaming = (anime.streaming || []).map(s => ({
                label: s.name,
                color: PLATFORM_COLORS[s.name.toLowerCase()] || '#6b7280',
                href: s.url,
              }))
              const malLink = anime.url
                ? [{ label: 'MyAnimeList', color: '#2e51a2', href: anime.url }]
                : []
              const links = [...streaming, ...malLink].filter(l => !deadLinks.has(l.href))
              if (links.length === 0) return null
              return (
                <div className="flex flex-col gap-3">
                  <h3 className="text-[var(--text-primary)] font-semibold">Regarder</h3>
                  <div className="flex flex-wrap gap-2">
                    {links.map(({ label, color, href }) => (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] hover:border-[var(--border-medium)] transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Synopsis */}
            {anime.synopsis && (
              <div className="flex flex-col gap-3">
                <h3 className="text-[var(--text-primary)] font-semibold">Synopsis</h3>
                {translating ? (
                  <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                    <div className="w-3 h-3 border border-[#6b7280] border-t-transparent rounded-full animate-spin" />
                    Traduction en cours…
                  </div>
                ) : (
                  <p className="text-[var(--text-muted)] text-sm leading-relaxed">{synopsis || anime.synopsis}</p>
                )}
              </div>
            )}

            {/* Trailer */}
            {anime.trailer?.embed_url && (() => {
              try {
                const u = new URL(anime.trailer.embed_url)
                u.searchParams.set('autoplay', '0')
                return (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-[var(--text-primary)] font-semibold">Bande-annonce</h3>
                    <div className="aspect-video rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                      <iframe
                        src={u.toString()}
                        title={`Trailer ${anime.title}`}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )
              } catch { return null }
            })()}

            {/* Recommandations */}
            {recommendations.length > 0 && (
              <div className="flex flex-col gap-3">
                <h3 className="text-[var(--text-primary)] font-semibold">Vous aimerez aussi</h3>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {recommendations.map((rec) => (
                    <button
                      key={rec.mal_id}
                      onClick={() => openModal(rec.mal_id)}
                      className="shrink-0 flex flex-col gap-1.5 w-24 text-left group"
                    >
                      <div className="w-24 h-36 rounded-lg overflow-hidden bg-[var(--bg-surface)]">
                        <img
                          src={rec.images?.jpg?.image_url ?? rec.images?.jpg?.large_image_url}
                          alt={rec.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                      <span className="text-[var(--text-muted)] text-[11px] leading-snug line-clamp-2 group-hover:text-[var(--text-primary)] transition-colors">
                        {rec.title}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
