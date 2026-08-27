import { useEffect, useEffectEvent, useState, useCallback, useRef } from 'react'
import { useModal } from '../context/ModalContext'
import { useFavorites } from '../context/FavoritesContext'
import { useHistory } from '../context/HistoryContext'
import { useWatchlist } from '../context/WatchlistContext'
import { useAgeFilter } from '../context/AgeFilterContext'
import { classifyAdultContent } from '../constants/ageFilter'
import { ATTRIBUTION, getAnimeById, getAnimeRecommendations, getAnimeFranchise } from '../services/anime'
import { translateSynopsis } from '../services/translate'
import { STATUS_LABEL, PLATFORM_COLORS } from '../constants/anime'
import { scoreColor } from '../utils/score'
import { infoItem } from '../utils/anime'
import { posterUrl } from '../utils/images'
import { safeYoutubeEmbed } from '../utils/urls'
import { useAccessibleDialog } from '../hooks/useAccessibleDialog'

export default function AnimeModal() {
  const { animeId, openModal, closeModal } = useModal()
  const { isFavorite, toggle } = useFavorites()
  const { addToHistory } = useHistory()
  const recordHistory = useEffectEvent(addToHistory)
  const { getStatus, setStatus, remove } = useWatchlist()
  const { blurHentai } = useAgeFilter()

  const [localAnimeId, setLocalAnimeId] = useState(null)
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(false)
  const [synopsis, setSynopsis] = useState(null)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  // Le contournement ne vaut que pour la requête déclenchée par le clic : un
  // drapeau persistant désactiverait le cache pour tout le reste de la session.
  const contournerAuProchainAppel = useRef(false)
  const [recommendations, setRecommendations] = useState([])
  const [seriesData, setSeriesData] = useState(null)
  const franchiseLoadedFor = useRef(null)

  const close = useCallback(() => {
    closeModal()
    setAnime(null)
    setLocalAnimeId(null)
    setSeriesData(null)
  }, [closeModal])
  const { dialogRef, titleId } = useAccessibleDialog({ open: Boolean(animeId), onClose: close })

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
    // Une nouvelle fiche repart d'une reprise vierge : sans cela, bypassCache
    // resterait armé et court-circuiterait le cache pour toutes les suivantes.
    setRetryKey(0)
  }, [animeId])

  // Charger l'animé quand localAnimeId change (ouverture ou changement de saison)
  useEffect(() => {
    if (!localAnimeId) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setAnime(null)
    setSynopsis(null)
    setRecommendations([])
    const bypassCache = contournerAuProchainAppel.current
    contournerAuProchainAppel.current = false
    const load = async () => {
      try {
        const data = await getAnimeById(localAnimeId, controller.signal, { bypassCache })
        // Une source peut répondre sans rien avoir à dire : une œuvre connue
        // d'un catalogue et absente de l'autre. Sans cette garde, la modale
        // s'ouvrirait vide et muette, alors qu'un favori enregistré de longue
        // date mérite qu'on lui explique ce qui se passe.
        if (!data) throw new Error('fiche introuvable')
        setAnime(data)
        if (data?.synopsis) {
          setTranslating(true)
          translateSynopsis(data.mal_id, data.synopsis, controller.signal)
            .then(setSynopsis)
            .catch(translationError => {
              if (translationError?.name !== 'AbortError') setSynopsis(data.synopsis)
            })
            .finally(() => { if (!controller.signal.aborted) setTranslating(false) })
        }
        getAnimeRecommendations(localAnimeId, controller.signal)
          .then(setRecommendations)
          .catch(recommendationError => {
            if (recommendationError?.name !== 'AbortError') setRecommendations([])
          })
        if (data && (localAnimeId === animeId || data.type !== 'TV')) recordHistory({
          mal_id: data.mal_id, title: data.title, images: data.images,
          score: data.score, episodes: data.episodes, status: data.status,
          type: data.type, aired: data.aired, genres: data.genres, synopsis: data.synopsis,
        })
      } catch (loadError) {
        if (loadError?.name !== 'AbortError') setError('Impossible de charger cette fiche pour le moment.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [localAnimeId, animeId, retryKey])

  // Charger les données de la franchise une seule fois par ouverture de modal
  useEffect(() => {
    if (!anime || anime.mal_id !== animeId) return
    if (franchiseLoadedFor.current === animeId) return
    franchiseLoadedFor.current = animeId
    const controller = new AbortController()
    getAnimeFranchise(anime, controller.signal).then(data => {
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
    }).catch(franchiseError => {
      if (franchiseError?.name !== 'AbortError') setSeriesData(null)
    })
    return () => controller.abort()
  }, [anime, animeId])

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
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="modal-box relative bg-[var(--bg-base)] border border-[var(--border-color)] rounded-xl sm:rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
      >
        {!anime && <h2 id={titleId} className="sr-only">Fiche de l’animé</h2>}

        {/* Bouton fermer */}
        <div className="sticky top-0 z-10 flex justify-end p-3 bg-[var(--bg-base)]/80 backdrop-blur-sm">
          <button
            onClick={close}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-full w-8 h-8 flex items-center justify-center transition-colors shrink-0"
            aria-label="Fermer la fiche"
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
        ) : error ? (
          <div className="px-6 sm:px-8 pb-10 text-center" role="alert">
            <p className="text-[var(--text-primary)] font-semibold">Fiche temporairement indisponible</p>
            <p className="text-[var(--text-muted)] text-sm mt-2">{error}</p>
            {/* Sans ce bouton, la seule reprise possible serait de fermer et
                rouvrir la modale — que le cache négatif bloquerait 30 secondes. */}
            <button
              type="button"
              onClick={() => { contournerAuProchainAppel.current = true; setRetryKey(k => k + 1) }}
              className="mt-4 px-5 py-2 bg-[#15803d] hover:bg-[#166534] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : anime ? (
          <div className="px-4 sm:px-8 pb-6 sm:pb-8 flex flex-col gap-5 sm:gap-8">

            {/* Hero */}
            <div className="flex flex-col min-[500px]:flex-row gap-4 min-[500px]:gap-6">
              <img
                src={posterUrl(anime.images, { large: true })}
                alt={anime.title}
                className="w-28 min-[500px]:w-36 sm:w-40 shrink-0 rounded-xl object-cover self-start mx-auto min-[500px]:mx-0"
              />
              <div className="flex flex-col gap-3 sm:gap-4 flex-1 min-w-0">
                {/* Titre */}
                <div>
                  <h2 id={titleId} className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] leading-tight">{anime.title}</h2>
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
                        ? 'bg-[var(--bg-surface)] border-[#22c55e] text-[var(--color-accent)]'
                        : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[#22c55e] hover:text-[var(--color-accent)]'
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
                    className={`shrink-0 transition-colors ${fav ? 'text-[var(--color-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--color-accent)]'}`}
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
                          ? 'border-[#22c55e] text-[var(--color-accent)] bg-[#22c55e]/10'
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
                      className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs rounded-lg px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus:border-[#22c55e] cursor-pointer font-medium"
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
                ? [{ label: ATTRIBUTION.nom, color: ATTRIBUTION.couleur, href: anime.url }]
                : []
              const links = [...streaming, ...malLink]
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
                const embedUrl = safeYoutubeEmbed(anime.trailer.embed_url)
                if (!embedUrl) return null
                return (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-[var(--text-primary)] font-semibold">Bande-annonce</h3>
                    <div className="aspect-video rounded-xl overflow-hidden bg-[var(--bg-surface)]">
                      <iframe
                        src={embedUrl}
                        title={`Trailer ${anime.title}`}
                        className="w-full h-full"
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                        sandbox="allow-scripts allow-same-origin allow-presentation"
                        allow="encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  </div>
                )
              } catch { return null }
            })()}

            {/* Recommandations.
                La jaquette de l'animé ouvert, elle, reste nette : on n'arrive
                ici qu'en cliquant une carte déjà floutée et badgée. Ces
                suggestions-ci, personne ne les a choisies — c'est de la
                découverte, comme la grille.

                AniList joint les genres et la mention d'âge à chaque
                suggestion : chacune est donc jugée pour elle-même. Le repli sur
                le registre de la fiche ouverte reste en place pour Jikan, qui
                ne les fournissait pas — c'est la seconde branche. */}
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
                          src={posterUrl(rec.images)}
                          alt={rec.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          style={
                            blurHentai
                              && (classifyAdultContent(rec.genres).adult || classifyAdultContent(anime.genres).adult)
                              ? { filter: 'blur(10px)' }
                              : undefined
                          }
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
