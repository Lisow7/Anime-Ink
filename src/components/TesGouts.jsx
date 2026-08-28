import { useFavorites } from '../context/FavoritesContext'
import { useWatchlist } from '../context/WatchlistContext'
import { decenniesPreferees, genresPreferes } from '../utils/gouts'

/**
 * Ce que tes choix disent de tes goûts.
 *
 * Le profil comptait déjà — combien de favoris, combien d'heures. Des totaux,
 * jamais un portrait. Tout ce qu'il faut pour en dresser un est pourtant déjà
 * sur l'appareil : les genres et les dates sont enregistrés avec chaque favori.
 *
 * **Aucune requête, aucun envoi.** Ces chiffres se calculent dans le navigateur
 * et n'en sortent pas — c'est la même promesse que le reste du site.
 */

/** Une barre proportionnelle, plus lisible qu'un nombre nu. */
function Barre({ libelle, nombre, part }) {
  return (
    <li className="flex items-center gap-3">
      <span className="text-[var(--text-primary)] text-xs w-24 shrink-0 truncate">{libelle}</span>
      <span className="flex-1 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
        {/* Décoratif : le nombre à droite porte déjà l'information, et une
            barre annoncée en plus ferait doublon pour un lecteur d'écran. */}
        <span
          aria-hidden="true"
          className="block h-full bg-[var(--color-accent)] rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(part * 100, 4)}%` }}
        />
      </span>
      <span className="text-[var(--text-muted)] text-xs tabular-nums w-6 text-right shrink-0">{nombre}</span>
    </li>
  )
}

export default function TesGouts() {
  const { favorites } = useFavorites()
  const { watchlist } = useWatchlist()

  const genres = genresPreferes(favorites, watchlist)
  const decennies = decenniesPreferees(favorites, watchlist)

  // Rien à raconter tant que rien n'a été choisi : une section de barres vides
  // n'apprendrait rien et occuperait la place d'un écran encore à remplir.
  if (genres.length === 0 && decennies.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[var(--text-primary)] font-semibold text-lg">Tes goûts</h2>
        <span className="text-[var(--text-muted)] text-xs">d’après tes favoris et ta liste</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {genres.length > 0 && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-[var(--text-muted)] text-xs uppercase tracking-wider">Genres</h3>
            <ul className="flex flex-col gap-2">
              {genres.map(g => <Barre key={g.nom} libelle={g.nom} nombre={g.nombre} part={g.part} />)}
            </ul>
          </div>
        )}

        {decennies.length > 0 && (
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 flex flex-col gap-3">
            <h3 className="text-[var(--text-muted)] text-xs uppercase tracking-wider">Époques</h3>
            <ul className="flex flex-col gap-2">
              {decennies.map(d => (
                <Barre key={d.decennie} libelle={`Années ${String(d.decennie).slice(2)}`} nombre={d.nombre} part={d.part} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}
