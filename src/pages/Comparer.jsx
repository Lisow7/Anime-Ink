import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSEO } from '../hooks/useSEO'
import { useFavorites } from '../context/FavoritesContext'
import { useHistory } from '../context/HistoryContext'
import { useWatchlist } from '../context/WatchlistContext'
import { useAgeFilter } from '../context/AgeFilterContext'
import { classifyAdultContent } from '../constants/ageFilter'
import { comparer, MAX_COMPARES } from '../utils/comparaison'
import { posterUrl } from '../utils/images'

/**
 * Comparer des animés que l'on a déjà rencontrés.
 *
 * Le choix se fait parmi les favoris, la liste et l'historique — **aucune
 * requête**, tout est déjà sur l'appareil. C'est aussi ce qui rend la page
 * utilisable quand la source est en panne.
 *
 * Comparer des titres inconnus supposerait une recherche, donc du réseau, donc
 * un tout autre écran. Ce n'est pas le besoin courant : on hésite entre des
 * séries qu'on a repérées, pas entre des inconnues.
 */
export default function Comparer() {
  useSEO({
    title: 'Comparer',
    description: 'Mets côte à côte les animés que tu as repérés : notes, épisodes, durée et genres communs.',
    robots: 'noindex, follow',
  })

  const { favorites } = useFavorites()
  const { watchlist } = useWatchlist()
  const { history } = useHistory()
  const { showAdult } = useAgeFilter()
  const [choisis, setChoisis] = useState([])

  // Tout ce que la personne a déjà croisé, sans doublon.
  const disponibles = [...new Map(
    [...favorites, ...watchlist, ...history]
      .filter(a => a && Number.isFinite(a.mal_id))
      .map(a => [a.mal_id, a]),
  ).values()]

  const selection = choisis.map(id => disponibles.find(a => a.mal_id === id)).filter(Boolean)
  const { lignes, genresCommuns } = comparer(selection)

  const basculer = (id) => setChoisis(prev => (
    prev.includes(id)
      ? prev.filter(x => x !== id)
      // Au-delà du maximum, le plus ancien choix cède la place : refuser en
      // silence laisserait croire à un clic manqué.
      : [...prev, id].slice(-MAX_COMPARES)
  ))

  if (disponibles.length === 0) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col items-center gap-4 text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Comparer</h1>
        <p className="text-[var(--text-muted)] text-sm max-w-md">
          Rien à comparer pour l&apos;instant. Ajoute des animés à tes favoris ou à ta liste,
          ou ouvre quelques fiches — ils apparaîtront ici.
        </p>
        <Link to="/catalogue" className="px-5 py-2 bg-[#15803d] hover:bg-[#166534] text-white text-sm font-semibold rounded-lg transition-colors">
          Parcourir le catalogue
        </Link>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)]">Comparer</h1>
        <p className="text-[var(--text-muted)] text-sm">
          Choisis jusqu&apos;à {MAX_COMPARES} animés parmi ceux que tu as repérés.
        </p>
      </div>

      <ul className="flex flex-wrap gap-2">
        {disponibles.map(anime => {
          const actif = choisis.includes(anime.mal_id)
          return (
            <li key={anime.mal_id}>
              <button
                onClick={() => basculer(anime.mal_id)}
                aria-pressed={actif}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  actif
                    ? 'bg-[#15803d] text-white border-[#15803d]'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-color)] hover:border-[var(--color-accent)]'
                }`}
              >
                {anime.title}
              </button>
            </li>
          )
        })}
      </ul>

      {selection.length === 0 ? (
        <p role="status" className="text-[var(--text-muted)] text-sm py-8 text-center">
          Sélectionne au moins un animé ci-dessus.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse">
              <caption className="sr-only">
                Comparaison de {selection.length} animé{selection.length > 1 ? 's' : ''}
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="sr-only">Critère</th>
                  {selection.map(anime => {
                    const flouter = classifyAdultContent(anime.genres).adult && !showAdult
                    return (
                      <th key={anime.mal_id} scope="col" className="p-2 align-bottom">
                        <span className="flex flex-col items-center gap-2">
                          <img
                            src={posterUrl(anime.images)}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            className="w-16 h-24 rounded-lg object-cover"
                            style={flouter ? { filter: 'blur(8px)' } : undefined}
                          />
                          <span className="text-[var(--text-primary)] text-xs font-semibold text-center line-clamp-2">
                            {anime.title}
                          </span>
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {lignes.map(l => (
                  <tr key={l.cle} className="border-t border-[var(--border-color)]">
                    <th scope="row" className="text-left text-[var(--text-muted)] text-xs uppercase tracking-wider py-2 pr-3 whitespace-nowrap">
                      {l.libelle}
                    </th>
                    {l.valeurs.map((v, i) => (
                      <td
                        key={selection[i].mal_id}
                        className={`text-center text-sm py-2 px-2 ${
                          v.meilleur ? 'text-[var(--color-accent)] font-semibold' : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {v.texte}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selection.length > 1 && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4">
              <h2 className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-2">Genres communs</h2>
              {genresCommuns.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {genresCommuns.map(g => (
                    <li key={g} className="px-2 py-1 rounded-md bg-[var(--bg-elevated)] text-[var(--text-primary)] text-xs">
                      {g}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[var(--text-muted)] text-sm">
                  Ces animés n&apos;ont aucun genre en commun.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
