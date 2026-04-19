import { useState, useMemo } from 'react'
import { useWatchlist } from '../context/WatchlistContext'
import { useModal } from '../context/ModalContext'
import { WATCH_STATUS } from '../constants/anime'
import { scoreColor } from '../utils/score'

const SORTS = [
  { value: 'added',  label: "Ordre d'ajout" },
  { value: 'title',  label: 'A → Z' },
  { value: 'score',  label: 'Note' },
  { value: 'genre',  label: 'Genre' },
]

export default function WatchlistTable({ list }) {
  const { setStatus, remove } = useWatchlist()
  const { openModal } = useModal()
  const [filterStatus, setFilterStatus] = useState('all')
  const [sort, setSort] = useState('added')

  const filtered = useMemo(() => {
    let items = filterStatus === 'all' ? list : list.filter(a => a.watchStatus === filterStatus)
    if (sort === 'title') items = [...items].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
    else if (sort === 'score') items = [...items].sort((a, b) => (b.score || 0) - (a.score || 0))
    else if (sort === 'genre') items = [...items].sort((a, b) => {
      const ga = a.genres?.[0]?.name || ''
      const gb = b.genres?.[0]?.name || ''
      return ga.localeCompare(gb, undefined, { sensitivity: 'base' })
    })
    return items
  }, [list, filterStatus, sort])

  const counts = useMemo(() => ({
    all: list.length,
    ...Object.fromEntries(WATCH_STATUS.map(ws => [ws.value, list.filter(a => a.watchStatus === ws.value).length]))
  }), [list])

  return (
    <div className="flex flex-col gap-4">

      {/* Barre de filtres + tri */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filtre statut */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'all' ? 'bg-[#22c55e] text-black' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Tous · {counts.all}
          </button>
          {WATCH_STATUS.map(ws => (
            <button
              key={ws.value}
              onClick={() => setFilterStatus(ws.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === ws.value ? 'text-black' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              style={filterStatus === ws.value ? { backgroundColor: ws.color } : {}}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: filterStatus === ws.value ? 'rgba(0,0,0,0.4)' : ws.color }} />
              {ws.label} · {counts[ws.value] || 0}
            </button>
          ))}
        </div>

        {/* Tri */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[var(--text-muted)] text-xs">Trier par</span>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#22c55e] cursor-pointer"
          >
            {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      {/* Résultat vide après filtre */}
      {filtered.length === 0 ? (
        <p className="text-center text-[var(--text-muted)] text-sm py-12">
          Aucun animé avec ce statut.
        </p>
      ) : (
        <div className="flex flex-col rounded-xl border border-[var(--border-color)] overflow-hidden">

          {/* En-tête du tableau */}
          <div className="grid grid-cols-[2rem_3.5rem_1fr_auto_auto_auto] sm:grid-cols-[2rem_3.5rem_1fr_140px_60px_auto] items-center gap-3 px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border-color)]">
            <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">#</span>
            <span />
            <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider">Titre</span>
            <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider hidden sm:block">Statut</span>
            <span className="text-[var(--text-muted)] text-[10px] uppercase tracking-wider hidden sm:block text-right">Note</span>
            <span />
          </div>

          {/* Lignes */}
          {filtered.map((anime, index) => {
            const current = WATCH_STATUS.find(w => w.value === anime.watchStatus)
            return (
              <div
                key={anime.mal_id}
                className={`grid grid-cols-[2rem_3.5rem_1fr_auto_auto_auto] sm:grid-cols-[2rem_3.5rem_1fr_140px_60px_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface)]/50 ${index !== filtered.length - 1 ? 'border-b border-[var(--border-subtle)]' : ''}`}
              >
                {/* Numéro */}
                <span className="text-[var(--text-muted)] text-xs text-right tabular-nums">{index + 1}</span>

                {/* Thumbnail */}
                <button onClick={() => openModal(anime.mal_id)} className="group">
                  <img
                    src={anime.images?.jpg?.large_image_url}
                    alt={anime.title}
                    className="w-10 h-14 object-cover rounded-lg group-hover:ring-1 group-hover:ring-[#22c55e] transition-all"
                  />
                </button>

                {/* Titre + genres */}
                <button onClick={() => openModal(anime.mal_id)} className="text-left min-w-0">
                  <p className="text-[var(--text-primary)] text-sm font-medium line-clamp-1 hover:text-[#22c55e] transition-colors">
                    {anime.title}
                  </p>
                  <p className="text-[var(--text-muted)] text-[10px] mt-0.5 line-clamp-1">
                    {anime.genres?.slice(0, 2).map(g => g.name).join(' · ') || '—'}
                    {anime.episodes ? ` · ${anime.episodes} ép.` : ''}
                  </p>
                </button>

                {/* Statut — boutons inline */}
                <div className="hidden sm:flex items-center gap-1">
                  {WATCH_STATUS.map(ws => (
                    <button
                      key={ws.value}
                      onClick={() => setStatus(anime, ws.value)}
                      title={ws.label}
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-all ${
                        anime.watchStatus === ws.value
                          ? 'border-transparent text-black scale-105'
                          : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--border-medium)]'
                      }`}
                      style={anime.watchStatus === ws.value ? { backgroundColor: ws.color } : {}}
                    >
                      {ws.label}
                    </button>
                  ))}
                </div>

                {/* Statut mobile — badge seul */}
                <div className="sm:hidden">
                  {current && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium text-black"
                      style={{ backgroundColor: current.color }}
                    >
                      {current.label}
                    </span>
                  )}
                </div>

                {/* Score */}
                <span className={`hidden sm:block text-sm font-bold text-right tabular-nums ${anime.score ? scoreColor(anime.score) : 'text-[var(--text-muted)]'}`}>
                  {anime.score ? `★ ${anime.score}` : '—'}
                </span>

                {/* Supprimer */}
                <button
                  onClick={() => remove(anime.mal_id)}
                  className="text-[var(--text-muted)] hover:text-[#e63946] transition-colors"
                  aria-label="Retirer de la liste"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-current" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
