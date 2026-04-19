import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getAnimeById } from '../services/jikan'
import { useHistory } from '../context/HistoryContext'
import { STATUS_LABEL } from '../constants/anime'
import { scoreColor } from '../utils/score'
import { infoItem } from '../utils/anime'

export default function AnimeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(true)
  const { addToHistory } = useHistory()

  useEffect(() => {
    setLoading(true)
    getAnimeById(id)
      .then((data) => {
        if (!data) { navigate('/404'); return }
        setAnime(data)
        setLoading(false)
        addToHistory({
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
    .catch(() => navigate('/404'))
  }, [id])

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="animate-pulse flex flex-col sm:flex-row gap-6 sm:gap-8">
          <div className="w-48 shrink-0 aspect-[2/3] bg-[var(--bg-surface)] rounded-xl" />
          <div className="flex-1 flex flex-col gap-4">
            <div className="h-8 bg-[var(--bg-surface)] rounded w-2/3" />
            <div className="h-4 bg-[var(--bg-surface)] rounded w-full" />
            <div className="h-4 bg-[var(--bg-surface)] rounded w-5/6" />
          </div>
        </div>
      </main>
    )
  }

  if (!anime) return null


  const {
    title, title_japanese, images, synopsis, score, scored_by,
    episodes, duration, status, aired, season, year, genres,
    studios, trailer, rank, popularity
  } = anime

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8 sm:gap-10">
      <Link to="/catalogue" className="text-[var(--text-muted)] text-sm hover:text-[#22c55e] transition-colors w-fit">
        ← Retour au catalogue
      </Link>

      <div className="flex flex-col min-[500px]:flex-row gap-6 min-[500px]:gap-8">
        <img
          src={images?.jpg?.large_image_url}
          alt={title}
          className="w-36 min-[500px]:w-44 sm:w-48 shrink-0 rounded-xl object-cover self-start mx-auto min-[500px]:mx-0"
        />
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
            {infoItem('Épisodes', episodes)}
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
                <span key={g.mal_id} className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-muted)] text-xs px-3 py-1 rounded-full">
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

      {trailer?.embed_url && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[var(--text-primary)] font-semibold text-lg">Bande-annonce</h2>
          <div className="aspect-video rounded-xl overflow-hidden bg-[var(--bg-surface)]">
            <iframe
              src={trailer.embed_url}
              title={`Trailer ${title}`}
              className="w-full h-full"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </main>
  )
}
