import { memo } from 'react'
import { useFavorites } from '../context/FavoritesContext'
import { useModal } from '../context/ModalContext'
import { useHistory } from '../context/HistoryContext'
import { useAgeFilter } from '../context/AgeFilterContext'
import { STATUS_LABEL } from '../constants/anime'
import { HENTAI_GENRES, ECCHI_GENRES } from '../constants/ageFilter'
import { scoreColor } from '../utils/score'

function AnimeCard({ anime }) {
  const { isFavorite, toggle } = useFavorites()
  const { openModal } = useModal()
  const { history } = useHistory()
  const { blurHentai } = useAgeFilter()
  const { mal_id, title, images, score, episodes, airing, status, trailer, genres } = anime
  const isHentai = genres?.some(g => HENTAI_GENRES.includes(g.name))
  const isEcchi = genres?.some(g => ECCHI_GENRES.includes(g.name))
  const blurred = blurHentai && (isHentai || isEcchi)
  const ageBadge = isHentai ? '-18' : '-16'
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
            src={images?.jpg?.image_url ?? images?.jpg?.large_image_url}
            alt={title}
            loading="lazy"
            width={225}
            height={338}
            className={`w-full h-full object-cover transition-all duration-300 ${
              thumbUrl ? 'group-hover:opacity-0' : 'group-hover:scale-105'
            }`}
            style={blurred ? { filter: 'blur(12px)', transform: 'scale(1.1)' } : undefined}
          />
          {blurred && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center border-2 backdrop-blur-sm select-none"
                style={isHentai
                  ? { borderColor: '#e63946', background: 'rgba(230,57,70,0.18)', boxShadow: '0 0 22px rgba(230,57,70,0.45)' }
                  : { borderColor: '#a855f7', background: 'rgba(168,85,247,0.18)', boxShadow: '0 0 22px rgba(168,85,247,0.45)' }
                }
              >
                <span
                  className="text-sm font-black tracking-tight leading-none"
                  style={{ color: isHentai ? '#e63946' : '#a855f7' }}
                >
                  {ageBadge}
                </span>
              </div>
            </div>
          )}

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
            <span className="absolute top-2 left-2 bg-black/70 text-xs font-semibold px-2 py-1 rounded-md" style={{ color: scoreColor(score) }}>
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
          <p title={title} className="text-[var(--text-primary)] text-sm font-medium line-clamp-1 leading-snug">{title}</p>
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className="text-[var(--text-muted)] text-xs">
              {episodes ? `${episodes} ép.` : airing ? 'En cours' : '? ép.'}
            </span>
            {status && (
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                status === 'Currently Airing'
                  ? 'bg-[var(--badge-airing-bg)] text-[var(--badge-airing-text)]'
                  : 'bg-[var(--overlay-soft)] text-[var(--text-muted)]'
              }`}>
                {STATUS_LABEL[status] ?? status}
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

export default memo(AnimeCard)
