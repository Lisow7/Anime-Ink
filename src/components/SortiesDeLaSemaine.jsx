import { useEffect, useState } from 'react'
import { useModal } from '../context/ModalContext'
import { useFavorites } from '../context/FavoritesContext'
import { useWatchlist } from '../context/WatchlistContext'
import { getProchainsEpisodes } from '../services/anime'
import { grouperParJour, JOURS_AFFICHES } from '../utils/semaine'
import { nomDuJour } from '../utils/dates'

/**
 * Ce qui sort cette semaine, parmi ce que le visiteur suit.
 *
 * Un calendrier de tout le catalogue n'aurait pas de sens : **5 000 diffusions
 * sur sept jours**, mesuré le 28 août 2026. Illisible, et sans rapport avec ce
 * que la personne regarde. Le calendrier utile est donc celui de ses propres
 * séries — favoris **et** liste de suivi, car on peut mettre en favori sans
 * suivre.
 *
 * ⚠️ **Une entrée par série.** La source ne donne que le *prochain* épisode de
 * chaque titre : une série diffusée deux fois dans la même semaine n'apparaît
 * qu'une fois. Limite assumée de cette version — la lever demanderait une
 * seconde requête, pour un cas rare.
 */
export default function SortiesDeLaSemaine() {
  const { openModal } = useModal()
  const { favorites } = useFavorites()
  const { watchlist } = useWatchlist()
  const [dates, setDates] = useState(null)

  // Favoris et liste réunis, dédoublonnés : une même série peut figurer dans
  // les deux, et il serait absurde de l'annoncer deux fois.
  const suivis = [...new Map([...favorites, ...watchlist].map(a => [a.mal_id, a])).values()]

  useEffect(() => {
    if (suivis.length === 0) return
    const controller = new AbortController()

    getProchainsEpisodes(suivis.map(a => a.mal_id), controller.signal)
      .then(setDates)
      // Sans dates, la section disparaît — elle n'a rien d'autre à dire. Le
      // reste du profil, lui, ne dépend pas du réseau.
      .catch(() => { if (!controller.signal.aborted) setDates(new Map()) })

    return () => controller.abort()
  }, [suivis.map(a => a.mal_id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!dates || suivis.length === 0) return null

  const groupes = grouperParJour(
    suivis.map(a => ({ ...a, prochain: dates.get(a.mal_id)?.prochain ?? null })),
  )

  if (groupes.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[var(--text-primary)] font-semibold text-lg">Cette semaine</h2>
        <span className="text-[var(--text-muted)] text-xs">
          {JOURS_AFFICHES} prochains jours
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {groupes.map(groupe => (
          <div key={groupe.cle} className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl overflow-hidden">
            <h3 className="text-[var(--text-muted)] text-xs uppercase tracking-wider px-4 py-2 border-b border-[var(--border-color)]">
              {nomDuJour(groupe.dateISO)}
            </h3>
            <ul>
              {groupe.sorties.map(sortie => (
                <li key={sortie.mal_id}>
                  <button
                    onClick={() => openModal(sortie.mal_id)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    <time
                      dateTime={sortie.prochain.dateISO}
                      className="text-[var(--color-accent)] text-xs font-semibold tabular-nums shrink-0 w-12"
                    >
                      {new Date(sortie.prochain.dateISO).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </time>
                    <span className="text-[var(--text-primary)] text-sm truncate">{sortie.title}</span>
                    <span className="text-[var(--text-muted)] text-xs shrink-0 ml-auto">
                      ép. {sortie.prochain.numero}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
