import { useSEO } from '../hooks/useSEO'
import { useFavorites } from '../context/FavoritesContext'
import { useHistory } from '../context/HistoryContext'
import { useWatchlist } from '../context/WatchlistContext'
import { WATCH_STATUS } from '../constants/anime'
import { scoreColor } from '../utils/score'
import { Link } from 'react-router-dom'
import AnimeCard from '../components/AnimeCard'
import { groupAnime } from '../utils/groupAnime'

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-3 sm:p-5 flex flex-col gap-1">
      <span className="text-[var(--text-muted)] text-[10px] sm:text-xs uppercase tracking-wider">{label}</span>
      <span className="text-[var(--text-primary)] text-2xl sm:text-3xl font-bold">{value}</span>
      {sub && <span className="text-[var(--text-muted)] text-[10px] sm:text-xs">{sub}</span>}
    </div>
  )
}

export default function Profil() {
  useSEO({ title: 'Mon profil', description: 'Tes statistiques, favoris, historique et liste de suivi sur Anime-Ink.', robots: 'noindex, follow' })
  const { favorites } = useFavorites()
  const { history } = useHistory()
  const { watchlist } = useWatchlist()

  const avgScore = favorites.length > 0
    ? (favorites.reduce((acc, a) => acc + (a.score || 0), 0) / favorites.filter(a => a.score).length).toFixed(1)
    : null

  const totalEpisodes = favorites.reduce((acc, a) => acc + (a.episodes || 0), 0)
  const watchMinutes = totalEpisodes * 24
  const watchHours = Math.floor(watchMinutes / 60)
  const watchDays = Math.floor(watchHours / 24)

  const genreCount = {}
  favorites.forEach(a => a.genres?.forEach(g => {
    genreCount[g.name] = (genreCount[g.name] || 0) + 1
  }))
  const topGenres = Object.entries(genreCount).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const isEmpty = favorites.length === 0 && history.length === 0 && watchlist.length === 0

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-8 sm:gap-10">
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#22c55e]/20 border border-[#22c55e]/40 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#22c55e] fill-none stroke-current" strokeWidth="1.5">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mon profil</h1>
          <p className="text-[var(--text-muted)] text-sm">Ton activité sur Anime-Ink</p>
        </div>
      </div>

      {isEmpty ? (
        <div className="relative">
          {/* Skeleton flou en arrière-plan */}
          <div className="flex flex-col gap-8 sm:gap-10 opacity-30 pointer-events-none select-none">
          {/* Skeleton stats */}
          <section className="flex flex-col gap-4">
            <div className="h-4 w-28 bg-[var(--bg-surface)] rounded-md" />
            <div className="grid grid-cols-2 min-[540px]:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 sm:p-6 flex flex-col gap-3">
                  <div className="h-3 w-20 bg-[var(--border-color)] rounded" />
                  <div className="h-10 w-14 bg-[var(--border-color)] rounded-md" />
                  <div className="h-2.5 w-24 bg-[var(--border-color)] rounded" />
                </div>
              ))}
            </div>
          </section>

          {/* Skeleton genres */}
          <section className="flex flex-col gap-4">
            <div className="h-4 w-32 bg-[var(--bg-surface)] rounded-md" />
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-28 h-3.5 bg-[var(--bg-surface)] rounded" />
                  <div className="flex-1 bg-[var(--bg-surface)] rounded-full h-2.5">
                    <div className="h-2.5 bg-[var(--border-color)] rounded-full" style={{ width: `${85 - i * 14}%` }} />
                  </div>
                  <div className="w-5 h-3.5 bg-[var(--bg-surface)] rounded" />
                </div>
              ))}
            </div>
          </section>

          {/* Skeleton favoris */}
          <section className="flex flex-col gap-4">
            <div className="h-4 w-28 bg-[var(--bg-surface)] rounded-md" />
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="aspect-[2/3] rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]" />
                  <div className="h-3 bg-[var(--bg-surface)] rounded w-4/5" />
                  <div className="h-2.5 bg-[var(--bg-surface)] rounded w-1/2" />
                </div>
              ))}
            </div>
          </section>

          </div>

          {/* Message flottant par-dessus */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-[var(--text-primary)] font-semibold text-lg">Ton profil t'attend</p>
            <p className="text-[var(--text-muted)] text-sm max-w-xs">Explore le catalogue, ajoute des favoris et suis tes animés pour voir tes stats ici.</p>
            <Link
              to="/catalogue"
              className="mt-1 px-5 py-2 bg-[#15803d] hover:bg-[#166534] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Explorer le catalogue
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <section className="flex flex-col gap-4">
            <h2 className="text-[var(--text-primary)] font-semibold text-lg">Statistiques</h2>
            <div className="grid grid-cols-2 min-[540px]:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              <StatCard label="Favoris" value={favorites.length} sub="animés sauvegardés" />
              <StatCard label="Consultés" value={history.length} sub="animés visités" />
              <StatCard label="Ma liste" value={watchlist.length} sub="animés suivis" />
              {avgScore && <StatCard label="Note moyenne" value={avgScore} sub="sur tes favoris" />}
              <StatCard
                label="Temps estimé"
                value={watchDays > 0 ? `${watchDays}j` : `${watchHours}h`}
                sub={`${totalEpisodes} épisodes · ~24 min/ép.`}
              />
            </div>
          </section>

          {/* Genres préférés */}
          {topGenres.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-[var(--text-primary)] font-semibold text-lg">Genres préférés</h2>
              <div className="flex flex-col gap-2">
                {topGenres.map(([genre, count]) => (
                  <div key={genre} className="flex items-center gap-3">
                    <span className="text-[var(--text-muted)] text-sm w-28 shrink-0">{genre}</span>
                    <div className="flex-1 bg-[var(--bg-surface)] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-2 bg-[#22c55e] rounded-full transition-all duration-500"
                        style={{ width: `${(count / topGenres[0][1]) * 100}%` }}
                      />
                    </div>
                    <span className="text-[var(--text-muted)] text-xs w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Ma liste par statut */}
          {watchlist.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[var(--text-primary)] font-semibold text-lg">Ma liste</h2>
                <Link to="/catalogue?tab=liste" className="text-[var(--text-muted)] text-sm hover:text-[#22c55e] transition-colors">
                  Voir tout →
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {WATCH_STATUS.map(ws => {
                  const count = watchlist.filter(a => a.watchStatus === ws.value).length
                  if (!count) return null
                  return (
                    <div key={ws.value} className="flex items-center justify-between bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ws.color }} />
                        <span className="text-[var(--text-primary)] text-sm">{ws.label}</span>
                      </div>
                      <span className="text-[var(--text-muted)] text-sm font-semibold">{count}</span>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Favoris récents */}
          {favorites.length > 0 && (
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[var(--text-primary)] font-semibold text-lg">Derniers favoris</h2>
                <Link to="/catalogue?tab=favoris" className="text-[var(--text-muted)] text-sm hover:text-[#22c55e] transition-colors">
                  Voir tous →
                </Link>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {favorites.filter((a, i, self) => self.findIndex(b => b.mal_id === a.mal_id) === i).slice(0, 6).map(anime => (
                  <AnimeCard key={anime.mal_id} anime={anime} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
