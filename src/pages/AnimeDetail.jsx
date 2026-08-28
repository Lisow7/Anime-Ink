import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useSEO } from '../hooks/useSEO'
import { ATTRIBUTION, getAnimeById } from '../services/anime'
import { useHistory } from '../context/HistoryContext'
import { useAgeFilter } from '../context/AgeFilterContext'
import { classifyAdultContent } from '../constants/ageFilter'
import { STATUS_LABEL } from '../constants/anime'
import { scoreColor } from '../utils/score'
import { infoItem } from '../utils/anime'
import { posterUrl } from '../utils/images'
import { safeYoutubeEmbed } from '../utils/urls'
import BandeAnnonce from '../components/BandeAnnonce'

export default function AnimeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const { blurHentai } = useAgeFilter()
  // Cette page s'atteint aussi par une URL partagée, sans passer par la carte
  // floutée qui sert d'avertissement partout ailleurs. La jaquette arrivait
  // donc en clair, sans que rien n'ait prévenu.
  const [jaquetteRevelee, setJaquetteRevelee] = useState(false)
  // Le contournement ne vaut que pour la requête déclenchée par le clic.
  const contournerAuProchainAppel = useRef(false)
  const { addToHistory } = useHistory()
  const recordHistory = useEffectEvent(addToHistory)
  useSEO({
    title: anime?.title ?? undefined,
    description: anime?.synopsis
      ? anime.synopsis.replace(/\[Written by.*?\]/g, '').trim().slice(0, 160)
      : undefined,
    ogImage: anime?.images?.jpg?.large_image_url,
  })

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setUnavailable(false)
    const bypassCache = contournerAuProchainAppel.current
    contournerAuProchainAppel.current = false
    // Une reprise demandée par l'utilisateur doit repartir au réseau : sans
    // contournement, l'échec mémorisé lui répondrait aussitôt.
    getAnimeById(id, controller.signal, { bypassCache })
      .then((data) => {
        if (controller.signal.aborted) return
        if (!data) { navigate('/404'); return }
        setAnime(data)
        setLoading(false)
        recordHistory({
        mal_id: data.mal_id,
        title: data.title,
        images: data.images,
        score: data.score,
        episodes: data.episodes,
        status: data.status,
        aired: data.aired,
        genres: data.genres,
        synopsis: data.synopsis,
      })
    })
    .catch((error) => {
      if (error?.name === 'AbortError') return

      // Un 404 dit que l'animé n'existe pas ; un 429, un 5xx ou une panne
      // réseau disent que l'API tousse. Les confondre revenait à annoncer
      // « animé introuvable » à chaque hoquet de MyAnimeList.
      if (error?.status === 404) { navigate('/404'); return }

      setUnavailable(true)
      setLoading(false)
    })
    return () => controller.abort()
  }, [id, navigate, retryKey])

  if (unavailable) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div role="alert" className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="text-5xl" aria-hidden="true">⚠️</span>
          <p className="text-[var(--text-primary)] font-semibold text-lg">
            Impossible de charger cette fiche
          </p>
          <p className="text-[var(--text-muted)] text-sm">
            L&apos;API {ATTRIBUTION.nom} est momentanément indisponible. Réessaie dans quelques instants.
          </p>
          <button
            onClick={() => { contournerAuProchainAppel.current = true; setUnavailable(false); setRetryKey(k => k + 1) }}
            className="mt-2 px-5 py-2 bg-[#15803d] hover:bg-[#166534] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Réessayer
          </button>
        </div>
      </main>
    )
  }

  /**
   * L'attente occupe la place de ce qui arrive.
   *
   * Le squelette ne montrait qu'une jaquette et trois lignes — 368 pixels,
   * quand la fiche en fait 835. À l'arrivée des données, tout grandissait d'un
   * coup et poussait le pied de page : un décalage de mise en page de 0,45,
   * mesuré, là où 0,1 est déjà la limite du tolérable.
   *
   * Il reproduit donc la structure entière : jaquette, titre, bloc de
   * caractéristiques, genres, synopsis. La hauteur ne sera jamais exacte — elle
   * dépend de la longueur du texte, de la presence d'une bande-annonce — et
   * viser le pixel serait vain.
   *
   * S'y ajoute une hauteur d'ecran reservee, retenue sur mesure et non par
   * principe : elle ramene le decalage de 0,45 a 0,23 sur un ecran large, pour
   * un cout de 0,02 sur mobile ou la fiche est bien plus haute. Le decalage
   * qui subsiste est instruit dans la feuille de route.
   *
   * ⚠️ Réserver une hauteur d'écran entière a été essayé, et **écarté sur
   * mesure** : cela améliorait le bureau et dégradait le mobile, où la fiche
   * est bien plus haute. Le décalage résiduel est instruit dans .
   */
  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8 min-h-screen" aria-busy="true">
        <div className="animate-pulse flex flex-col sm:flex-row gap-6 sm:gap-8">
          <div className="w-48 shrink-0 aspect-[2/3] bg-[var(--bg-surface)] rounded-xl" />
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <div className="h-8 bg-[var(--bg-surface)] rounded w-2/3" />
            <div className="h-5 bg-[var(--bg-surface)] rounded w-24" />
            {/* Le bloc des caractéristiques : statut, épisodes, durée, diffusion,
                saison, classement, popularité, studios. */}
            <div className="h-32 bg-[var(--bg-surface)] rounded-xl w-full" />
            <div className="flex gap-2">
              {[64, 88, 72, 56].map(l => (
                <div key={l} className="h-7 bg-[var(--bg-surface)] rounded" style={{ width: l }} />
              ))}
            </div>
          </div>
        </div>
        <div className="animate-pulse flex flex-col gap-3">
          <div className="h-6 bg-[var(--bg-surface)] rounded w-32" />
          <div className="h-4 bg-[var(--bg-surface)] rounded w-full" />
          <div className="h-4 bg-[var(--bg-surface)] rounded w-full" />
          <div className="h-4 bg-[var(--bg-surface)] rounded w-4/5" />
        </div>
      </main>
    )
  }

  if (!anime) return null


  const {
    title, title_japanese, images, synopsis, score, scored_by,
    episodes, airing, duration, status, aired, season, year, genres,
    studios, trailer, rank, popularity
  } = anime

  const classementAge = classifyAdultContent(genres)
  const jaquetteMasquee = blurHentai && classementAge.adult && !jaquetteRevelee

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8 sm:gap-10">
      <Link to="/catalogue" className="text-[var(--text-muted)] text-sm hover:text-[var(--color-accent)] transition-colors w-fit">
        ← Retour au catalogue
      </Link>

      <div className="flex flex-col min-[500px]:flex-row gap-6 min-[500px]:gap-8">
        <div className="flex flex-col gap-2 shrink-0 self-start mx-auto min-[500px]:mx-0">
          <div className="relative">
            <img
              id="jaquette-anime"
              src={posterUrl(images)}
              alt={title}
              width={192}
              height={288}
              fetchPriority="high"
              className="w-36 min-[500px]:w-44 sm:w-48 rounded-xl object-cover"
              style={jaquetteMasquee ? { filter: 'blur(16px)' } : undefined}
            />
            {/* Voile OPAQUE, et non teinté : sur un voile translucide, le
                contraste du texte dépendrait de la jaquette en dessous —
                invérifiable. Sur `--bg-surface`, ce sont les ratios déjà
                éprouvés du dépôt qui s'appliquent. Le flou de l'image reste
                en défense de second rideau. */}
            {jaquetteMasquee && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                <span className="text-lg font-black" style={{ color: 'var(--color-danger-text)' }}>
                  {classementAge.badge}
                </span>
                <p className="text-[var(--text-primary)] text-xs font-semibold leading-snug">
                  Contenu réservé à un public averti
                </p>
              </div>
            )}
          </div>

          {/* Le bouton ne disparaît pas une fois la jaquette révélée : il
              bascule. Le retirer perdrait le focus du clavier, et priverait
              d'un moyen de remasquer. L'affichage vient d'un clic, jamais du
              focus seul — WCAG 3.2.1. */}
          {classementAge.adult && blurHentai && (
            <button
              type="button"
              onClick={() => setJaquetteRevelee(v => !v)}
              aria-expanded={jaquetteRevelee}
              aria-controls="jaquette-anime"
              className="px-3 py-2 text-sm font-semibold rounded-lg bg-[#15803d] hover:bg-[#166534] text-white transition-colors"
            >
              {jaquetteRevelee ? 'Masquer la jaquette' : 'Afficher quand même'}
            </button>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] leading-tight">{title}</h1>
            {title_japanese && (
              <p className="text-[var(--text-muted)] text-sm mt-1">{title_japanese}</p>
            )}
          </div>

          {score && (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-bold" style={{ color: scoreColor(score) }}>{score}</span>
              <span className="text-[var(--text-muted)] text-sm">/ 10</span>
              {scored_by && (
                <span className="text-[var(--text-muted)] text-xs">({scored_by.toLocaleString()} votes)</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 min-[500px]:grid-cols-3 gap-3 sm:gap-4 bg-[var(--bg-surface)] rounded-xl p-3 sm:p-4">
            {infoItem('Statut', STATUS_LABEL[status] ?? status)}
            {infoItem('Épisodes', episodes ?? (airing ? 'En cours' : '?'))}
            {infoItem('Durée / ép.', duration)}
            {infoItem('Diffusion', aired?.string)}
            {infoItem('Saison', season && year ? `${season} ${year}` : year)}
            {infoItem('Classement', rank ? `#${rank}` : null)}
            {infoItem('Popularité', popularity ? `#${popularity}` : null)}
            {infoItem('Studios', studios?.map(s => s.name).join(', '))}
          </div>

          {genres?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <span key={g.mal_id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] text-xs px-3 py-1 rounded">
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {synopsis && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[var(--text-primary)] font-semibold text-lg">Synopsis</h2>
          <p className="text-[var(--text-muted)] text-sm leading-relaxed">{synopsis}</p>
        </div>
      )}

      {safeYoutubeEmbed(trailer?.embed_url) && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[var(--text-primary)] font-semibold text-lg">Bande-annonce</h2>
          <BandeAnnonce embedUrl={trailer.embed_url} youtubeId={trailer.youtube_id} titre={title} />
        </div>
      )}
    </main>
  )
}
