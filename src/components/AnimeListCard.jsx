import { useFavorites } from '../context/FavoritesContext'
import { useModal } from '../context/ModalContext'
import { useAgeFilter } from '../context/AgeFilterContext'
import { STATUS_LABEL } from '../constants/anime'
import { HENTAI_GENRES, ECCHI_GENRES } from '../constants/ageFilter'
import { scoreColor } from '../utils/score'

export default function AnimeListCard({ anime }) {
  const { isFavorite, toggle } = useFavorites()
  const { openModal } = useModal()
  const { blurHentai } = useAgeFilter()
  const { mal_id, title, images, score, episodes, status, genres, synopsis } = anime
  const fav = isFavorite(mal_id)
  const isHentai = genres?.some(g => HENTAI_GENRES.includes(g.name))
  const isEcchi = genres?.some(g => ECCHI_GENRES.includes(g.name))
  const blurred = blurHentai && (isHentai || isEcchi)
  const ageBadge = isHentai ? '-18' : '-16'

  return (
    <div
      onClick={() => openModal(mal_id)}
      className="relative group cursor-pointer bg-[var(--bg-surface)] rounded-xl overflow-hidden flex gap-4 p-3 hover:ring-1 hover:ring-[#22c55e] transition-all duration-200"
    >
      <div className="shrink-0 relative">
        <img
          src={images?.jpg?.large_image_url}
          alt={title}
          className="w-16 h-24 object-cover rounded-lg"
          style={blurred ? { filter: 'blur(8px)', transform: 'scale(1.05)' } : undefined}
        />
        {blurred && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center border-2 backdrop-blur-sm select-none"
              style={isHentai
                ? { borderColor: '#e63946', background: 'rgba(230,57,70,0.18)', boxShadow: '0 0 14px rgba(230,57,70,0.5)' }
                : { borderColor: '#a855f7', background: 'rgba(168,85,247,0.18)', boxShadow: '0 0 14px rgba(168,85,247,0.5)' }
              }
            >
              <span className="text-[10px] font-black leading-none" style={{ color: isHentai ? '#e63946' : '#a855f7' }}>
                {ageBadge}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col gap-1 min-w-0 pr-8">
        <h3 className="text-[var(--text-primary)] text-sm font-semibold line-clamp-1 leading-snug">{title}</h3>

        <div className="flex items-center gap-2 flex-wrap">
          {score && <span className="text-xs font-bold" style={{ color: scoreColor(score) }}>★ {score}</span>}
          <span className="text-[var(--text-muted)] text-xs">{episodes ? `${episodes} ép.` : '? ép.'}</span>
          {status && (
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
              status === 'Currently Airing' ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[var(--overlay-soft)] text-[var(--text-muted)]'
            }`}>
              {STATUS_LABEL[status] ?? status}
            </span>
          )}
        </div>

        {genres?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {genres.slice(0, 3).map(g => (
              <span key={g.mal_id} className="text-[10px] text-[var(--text-muted)] bg-[var(--overlay-soft)] px-2 py-0.5 rounded">
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
