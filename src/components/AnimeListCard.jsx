import { useFavorites } from '../context/FavoritesContext'
import { useModal } from '../context/ModalContext'

const statusLabel = {
  'Finished Airing': 'Terminé',
  'Currently Airing': 'En cours',
  'Not yet aired': 'À venir',
}

export default function AnimeListCard({ anime }) {
  const { isFavorite, toggle } = useFavorites()
  const { openModal } = useModal()
  const { mal_id, title, images, score, episodes, status, genres, synopsis } = anime
  const fav = isFavorite(mal_id)

  return (
    <div
      onClick={() => openModal(mal_id)}
      className="relative group cursor-pointer bg-[var(--bg-surface)] rounded-xl overflow-hidden flex gap-4 p-3 hover:ring-1 hover:ring-[#22c55e] transition-all duration-200"
    >
      <div className="shrink-0">
        <img src={images?.jpg?.large_image_url} alt={title} className="w-16 h-24 object-cover rounded-lg" />
      </div>

      <div className="flex-1 flex flex-col gap-1 min-w-0 pr-8">
        <h3 className="text-[var(--text-primary)] text-sm font-semibold line-clamp-1 leading-snug">{title}</h3>

        <div className="flex items-center gap-2 flex-wrap">
          {score && <span className="text-[#22c55e] text-xs font-bold">★ {score}</span>}
          <span className="text-[var(--text-muted)] text-xs">{episodes ? `${episodes} ép.` : '? ép.'}</span>
          {status && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              status === 'Currently Airing' ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[var(--overlay-soft)] text-[var(--text-muted)]'
            }`}>
              {statusLabel[status] ?? status}
            </span>
          )}
        </div>

        {genres?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {genres.slice(0, 3).map(g => (
              <span key={g.mal_id} className="text-[10px] text-[var(--text-muted)] bg-[var(--overlay-soft)] px-2 py-0.5 rounded-full">
                {g.name}
              </span>
            ))}
          </div>
        )}

        {synopsis && (
          <p className="text-[var(--text-muted)] text-xs line-clamp-2 leading-relaxed mt-auto">{synopsis}</p>
        )}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); toggle(anime) }}
        className={`absolute top-3 right-3 transition-colors ${fav ? 'text-[#22c55e]' : 'text-[var(--text-muted)] hover:text-[#22c55e]'}`}
        aria-label={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
