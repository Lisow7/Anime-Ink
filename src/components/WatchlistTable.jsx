import { useState, useMemo, useEffect, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useWatchlist } from '../context/WatchlistContext'
import { useModal } from '../context/ModalContext'
import { WATCH_STATUS } from '../constants/anime'
import { getAnimeSeasons } from '../services/jikan'

const SORTS = [
  { value: 'added',  label: "Ordre d'ajout" },
  { value: 'title',  label: 'A → Z' },
  { value: 'score',  label: 'Note' },
  { value: 'genre',  label: 'Genre' },
]

function TrackerPill({ children, className = '' }) {
  return (
    <div className={`flex items-center gap-0.5 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-full px-1 py-1 ${className}`}>
      {children}
    </div>
  )
}

function StepBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-4 h-4 flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs leading-none shrink-0"
    >
      {children}
    </button>
  )
}

function EpisodeTracker({ anime, setEpisode, setSeason }) {
  const ep = anime.currentEpisode ?? 0
  const season = anime.currentSeason ?? 1
  const seasonData = anime.seasonData
  const maxSeasons = seasonData?.length
  const episodeMax = seasonData?.[season - 1]?.episodes ?? (season === 1 ? (anime.episodes ?? null) : null)
  const franchiseIndex = seasonData ? seasonData.findIndex(s => s.mal_id === anime.mal_id) : -1
  const isRoot = franchiseIndex === 0
  const canNavigate = isRoot && maxSeasons !== undefined && maxSeasons > 1

  return (
    <div className="flex items-stretch gap-2" onClick={e => e.stopPropagation()}>
      <TrackerPill>
        <StepBtn onClick={() => setSeason(anime.mal_id, season - 1)} disabled={!canNavigate || season <= 1}>−</StepBtn>
        <span className="text-[11px] font-semibold text-[var(--text-primary)] px-1.5 tabular-nums whitespace-nowrap">
          {seasonData === undefined
            ? `Saison ${season}…`
            : canNavigate
              ? `Saison ${season} / ${maxSeasons}`
              : `Saison ${season}`}
        </span>
        <StepBtn onClick={() => setSeason(anime.mal_id, season + 1)} disabled={!canNavigate || season >= maxSeasons}>+</StepBtn>
      </TrackerPill>
      <TrackerPill>
        <StepBtn onClick={() => setEpisode(anime.mal_id, Math.max(0, ep - 1))} disabled={ep <= 0}>−</StepBtn>
        <span className="text-[10px] text-[var(--text-muted)] px-1 shrink-0 whitespace-nowrap">Épisode</span>
        <input
          type="number"
          value={ep}
          min={0}
          max={episodeMax ?? undefined}
          onChange={e => {
            const v = parseInt(e.target.value, 10)
            if (!isNaN(v)) setEpisode(anime.mal_id, Math.max(0, episodeMax ? Math.min(episodeMax, v) : v))
          }}
          className="w-7 text-center text-[11px] font-semibold bg-transparent text-[var(--text-primary)] focus:outline-none tabular-nums shrink-0"
        />
        {episodeMax
          ? <span className="text-[10px] text-[var(--text-muted)] pr-1 tabular-nums shrink-0 whitespace-nowrap">/ {episodeMax}</span>
          : null
        }
        <StepBtn onClick={() => setEpisode(anime.mal_id, Math.min(episodeMax ?? 9999, ep + 1))} disabled={!!episodeMax && ep >= episodeMax}>+</StepBtn>
      </TrackerPill>
    </div>
  )
}

function SortableRow({ anime, index, isDragEnabled, setStatus, setEpisode, setSeason, remove, openModal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: anime.mal_id })
  const current = WATCH_STATUS.find(w => w.value === anime.watchStatus)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} className={index > 0 ? 'border-t border-[var(--border-subtle)]' : ''}>

      {/* Layout mobile */}
      <div className="flex min-[825px]:hidden items-start gap-3 px-4 py-3">
        <button onClick={() => openModal(anime.mal_id)} className="shrink-0">
          <img
            src={anime.images?.jpg?.large_image_url}
            alt={anime.title}
            className="w-12 h-[72px] object-cover rounded-lg"
          />
        </button>
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 cursor-pointer" onClick={() => openModal(anime.mal_id)}>
              <p className="text-[var(--text-primary)] text-sm font-semibold line-clamp-1 hover:text-[#22c55e] transition-colors">
                {anime.title}
              </p>
              <p className="text-[var(--text-muted)] text-[10px] mt-0.5 line-clamp-1">
                {anime.genres?.slice(0, 2).map(g => g.name).join(' · ') || '—'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => remove(anime.mal_id)}
                className="w-6 h-6 flex items-center justify-center rounded-full border border-[var(--border-color)] text-[var(--text-muted)] hover:border-[#e63946] hover:text-[#e63946] transition-colors"
                aria-label="Retirer de la liste"
              >
                <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-none stroke-current" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>
          {/* Statuts cliquables mobile */}
          <div className="flex items-center gap-1 flex-wrap">
            {WATCH_STATUS.map(ws => (
              <button
                key={ws.value}
                onClick={() => setStatus(anime, ws.value)}
                className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${
                  anime.watchStatus === ws.value ? 'text-black border-transparent' : 'border-[var(--border-color)] text-[var(--text-muted)]'
                }`}
                style={anime.watchStatus === ws.value ? { backgroundColor: ws.color } : {}}
              >
                {ws.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Layout desktop */}
      <div className="hidden min-[825px]:grid grid-cols-[1.5rem_2rem_5rem_1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--bg-surface)]/50">
        <div
          {...(isDragEnabled ? { ...attributes, ...listeners } : {})}
          className={`flex items-center justify-center ${isDragEnabled ? 'cursor-grab active:cursor-grabbing text-[var(--text-muted)] hover:text-[var(--text-primary)]' : 'text-transparent pointer-events-none'}`}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
        </div>
        <span className="text-[var(--text-muted)] text-xs text-right tabular-nums">{index + 1}</span>
        <button onClick={() => openModal(anime.mal_id)} className="group">
          <img
            src={anime.images?.jpg?.large_image_url}
            alt={anime.title}
            className="w-14 h-20 object-cover rounded-lg group-hover:ring-1 group-hover:ring-[#22c55e] transition-all"
          />
        </button>
        <div className="min-w-0 flex flex-col gap-1.5">
          <div onClick={() => openModal(anime.mal_id)} className="cursor-pointer min-w-0">
            <p className="text-[var(--text-primary)] text-sm font-semibold line-clamp-1 hover:text-[#22c55e] transition-colors">{anime.title}</p>
            <p className="text-[var(--text-muted)] text-[11px] mt-0.5 line-clamp-1">
              {anime.genres?.slice(0, 3).map(g => g.name).join(' · ') || '—'}
            </p>
          </div>
          {anime.watchStatus !== 'completed' && (
            <EpisodeTracker anime={anime} setEpisode={setEpisode} setSeason={setSeason} />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {WATCH_STATUS.map(ws => (
            <button
              key={ws.value}
              onClick={() => setStatus(anime, ws.value)}
              title={ws.label}
              className={`w-[4.5rem] whitespace-nowrap text-center text-xs py-1.5 rounded-full border font-medium transition-colors ${
                anime.watchStatus === ws.value ? 'border-transparent text-black' : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--border-medium)]'
              }`}
              style={anime.watchStatus === ws.value ? { backgroundColor: ws.color } : {}}
            >
              {ws.label}
            </button>
          ))}
          <button
            onClick={() => remove(anime.mal_id)}
            className="w-7 h-7 flex items-center justify-center rounded-full border border-[var(--border-color)] text-[var(--text-muted)] hover:border-[#e63946] hover:text-[#e63946] transition-colors shrink-0"
            aria-label="Retirer de la liste"
          >
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

    </div>
  )
}

export default function WatchlistTable({ list }) {
  const { setStatus, setEpisode, setSeason, setSeasonData, remove, reorder } = useWatchlist()
  const { openModal } = useModal()
  const [filterStatus, setFilterStatus] = useState('all')
  const [sort, setSort] = useState('added')
  const fetchedIds = useRef(new Set())
  const listIds = useMemo(() => list.map(a => a.mal_id).join(','), [list])

  useEffect(() => {
    let active = true
    ;(async () => {
      for (const anime of list) {
        if (!active) break
        if (anime.seasonData !== undefined || fetchedIds.current.has(anime.mal_id)) continue
        fetchedIds.current.add(anime.mal_id)
        const data = await getAnimeSeasons(anime.mal_id, anime.episodes)
        setSeasonData(anime.mal_id, data)
        if (active) await new Promise(r => setTimeout(r, 400))
      }
    })()
    return () => { active = false }
  }, [listIds])

  const isDragEnabled = sort === 'added' && filterStatus === 'all'
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const oldIndex = list.findIndex(a => a.mal_id === active.id)
    const newIndex = list.findIndex(a => a.mal_id === over.id)
    reorder(oldIndex, newIndex)
  }

  return (
    <div className="flex flex-col gap-4">

      {/* Filtres statut — grille 2×N sur mobile */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
          <button
            onClick={() => setFilterStatus('all')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === 'all' ? 'bg-[#22c55e] text-black' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
          >
            Tous · {counts.all}
          </button>
          {WATCH_STATUS.map(ws => (
            <button
              key={ws.value}
              onClick={() => setFilterStatus(ws.value)}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === ws.value ? 'text-black' : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
              style={filterStatus === ws.value ? { backgroundColor: ws.color } : {}}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: filterStatus === ws.value ? 'rgba(0,0,0,0.4)' : ws.color }} />
              {ws.label} · {counts[ws.value] || 0}
            </button>
          ))}
        </div>
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

      {isDragEnabled && (
        <p className="text-[var(--text-muted)] text-[11px] flex items-center gap-1.5 sm:flex hidden">
          <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current shrink-0">
            <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
            <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
            <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
          </svg>
          Glisse les lignes pour réorganiser
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-center text-[var(--text-muted)] text-sm py-12">
          Aucun animé avec ce statut.
        </p>
      ) : (
        <div className="rounded-xl border border-[var(--border-color)] overflow-hidden">
          <div className="flex flex-col">
            <div className="h-[2px] bg-gradient-to-r from-[#22c55e] via-[#22c55e]/40 to-transparent" />

            {/* En-tête desktop uniquement */}
            <div className="hidden min-[825px]:grid grid-cols-[1.5rem_2rem_5rem_1fr_auto] items-center gap-4 px-5 py-4 bg-gradient-to-r from-[var(--bg-surface)] to-[#22c55e]/5 border-b border-[var(--border-color)]">
              <span />
              <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest text-right">#</span>
              <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">Affiche</span>
              <div className="flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="w-3 h-3 fill-none stroke-current text-[#22c55e]/60 shrink-0" strokeWidth="2">
                  <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round"/>
                </svg>
                <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">Titre · Progression</span>
              </div>
              <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest">Statut</span>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filtered.map(a => a.mal_id)} strategy={verticalListSortingStrategy}>
                {filtered.map((anime, index) => (
                  <SortableRow
                    key={anime.mal_id}
                    anime={anime}
                    index={index}
                    isDragEnabled={isDragEnabled}
                    setStatus={setStatus}
                    setEpisode={setEpisode}
                    setSeason={setSeason}
                    remove={remove}
                    openModal={openModal}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  )
}
