import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAnimeById } from '../services/jikan'
import { useHistory } from '../context/HistoryContext'

export default function AnimeDetail() {
  const { id } = useParams()
  const [anime, setAnime] = useState(null)
  const [loading, setLoading] = useState(true)
  const { addToHistory } = useHistory()

  useEffect(() => {
    setLoading(true)
    getAnimeById(id).then((data) => {
      setAnime(data)
      setLoading(false)
      if (data) addToHistory({
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
  }, [id])

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="animate-pulse flex flex-col md:flex-row gap-8">
          <div className="w-48 shrink-0 aspect-[2/3] bg-[#1a1a1a] rounded-xl" />
          <div className="flex-1 flex flex-col gap-4">
            <div className="h-8 bg-[#1a1a1a] rounded w-2/3" />
            <div className="h-4 bg-[#1a1a1a] rounded w-full" />
            <div className="h-4 bg-[#1a1a1a] rounded w-5/6" />
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

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-10">
      <Link to="/catalogue" className="text-[#6b7280] text-sm hover:text-[#22c55e] transition-colors w-fit">
        ← Retour au catalogue
      </Link>

      {/* Hero */}
      <div className="flex flex-col md:flex-row gap-8">
        <img
          src={images?.jpg?.large_image_url}
          alt={title}
          className="w-48 shrink-0 rounded-xl object-cover self-start"
        />
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#f5f5f5] leading-tight">{title}</h1>
            {title_japanese && (
              <p className="text-[#6b7280] text-sm mt-1">{title_japanese}</p>
            )}
          </div>

          {/* Score */}
          {score && (
            <div className="flex items-baseline gap-2">
              <span className="text-[#22c55e] text-4xl font-bold">{score}</span>
              <span className="text-[#6b7280] text-sm">/ 10</span>
              {scored_by && (
                <span className="text-[#6b7280] text-xs">({scored_by.toLocaleString()} votes)</span>
              )}
            </div>
          )}

          {/* Infos rapides */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-[#1a1a1a] rounded-xl p-4">
            {infoItem('Statut', statusLabel[status] ?? status)}
            {infoItem('Épisodes', episodes)}
            {infoItem('Durée / ép.', duration)}
            {infoItem('Diffusion', aired?.string)}
            {infoItem('Saison', season && year ? `${season} ${year}` : year)}
            {infoItem('Classement', rank ? `#${rank}` : null)}
            {infoItem('Popularité', popularity ? `#${popularity}` : null)}
            {infoItem('Studios', studios?.map(s => s.name).join(', '))}
          </div>

          {/* Genres */}
          {genres?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <span key={g.mal_id} className="bg-[#1a1a1a] border border-white/10 text-[#6b7280] text-xs px-3 py-1 rounded-full">
                  {g.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Synopsis */}
      {synopsis && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[#f5f5f5] font-semibold text-lg">Synopsis</h2>
          <p className="text-[#6b7280] text-sm leading-relaxed">{synopsis}</p>
        </div>
      )}

      {/* Trailer */}
      {trailer?.embed_url && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[#f5f5f5] font-semibold text-lg">Bande-annonce</h2>
          <div className="aspect-video rounded-xl overflow-hidden bg-[#1a1a1a]">
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
