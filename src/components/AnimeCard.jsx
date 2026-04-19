import { useFavorites } from '../context/FavoritesContext'
import { useModal } from '../context/ModalContext'
import { useHistory } from '../context/HistoryContext'

const statusLabel = {
  'Finished Airing': 'Terminé',
  'Currently Airing': 'En cours',
  'Not yet aired': 'À venir',
}

function scoreColor(score) {
  if (score >= 7.5) return 'text-[#22c55e]'
  if (score >= 6) return 'text-[#f59e0b]'
  return 'text-[#e63946]'
}

export default function AnimeCard({ anime }) {
  const { isFavorite, toggle } = useFavorites()
  const { openModal } = useModal()
  const { history } = useHistory()
  const { mal_id, title, images, score, episodes, status, trailer } = anime
  const fav = isFavorite(mal_id)
  const seen = history.some(a => a.mal_id === mal_id)
  const youtubeId = trailer?.youtube_id
  const thumbUrl = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    : null

  return (
    <div className="relative group h-full">
      <div
        onClick={() => openModal(mal_id)}
        className="cursor-pointer bg-[var(--bg-surface)] rounded-xl overflow-hidden flex flex-col hover:ring-1 hover:ring-[#22c55e] transition-all duration-200 h-full"
      >
        <div className="relative aspect-[2/3] overflow-hidden">
          <img
            src={images?.jpg?.large_image_url}
            alt={title}
            loading="lazy"
            className={`w-full h-full object-cover transition-all duration-300 ${
              thumbUrl ? 'group-hover:opacity-0' : 'group-hover:scale-105'
            }`}
          />

          {thumbUrl && (
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <img src={thumbUrl} alt={`Trailer ${title}`} className="w-full h-full object-cover" />
              <a
                href={`https://www.youtube.com/watch?v=${youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 flex items-center justify-center"
                aria-label="Voir la bande-annonce sur YouTube"
              >
                <span className="bg-red-600 hover:bg-red-500 transition-colors rounded-full w-12 h-12 flex items-center justify-center shadow-lg">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white fill-current ml-0.5">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </a>
            </div>
          )}

          {score && (
            <span className={`absolute top-2 left-2 bg-black/70 text-xs font-semibold px-2 py-1 rounded-md ${scoreColor(score)}`}>
              ★ {score}
            </span>
          )}

          {seen && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-[#6b7280] text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Vu
            </span>
          )}
        </div>

        <div className="p-3 flex flex-col gap-1 flex-1">
          <h3 className="text-[var(--text-primary)] text-sm font-medium line-clamp-2 leading-snug">{title}</h3>
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="text-[var(--text-muted)] text-xs">
              {episodes ? `${episodes} ép.` : '? ép.'}
            </span>
            {status && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                status === 'Currently Airing'
                  ? 'bg-[#22c55e]/20 text-[#22c55e]'
                  : 'bg-[var(--overlay-soft)] text-[var(--text-muted)]'
              }`}>
                {statusLabel[status] ?? status}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); toggle(anime) }}
        className={`absolute top-2 right-2 transition-colors bg-black/50 rounded-full p-1 ${fav ? 'text-[#22c55e]' : 'text-[#6b7280] hover:text-[#22c55e]'}`}
        aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
