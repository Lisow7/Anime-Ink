import { useEffect, useState } from 'react'
import { useModal } from '../context/ModalContext'
import { useAgeFilter } from '../context/AgeFilterContext'
import { classifyAdultContent } from '../constants/ageFilter'
import { getProchainsEpisodes } from '../services/anime'
import { posterUrl } from '../utils/images'

/**
 * « Où reprendre » — les séries en cours, et quand arrive la suite.
 *
 * Toute la progression vit déjà sur l'appareil : la liste de suivi retient le
 * statut et l'épisode atteint. Ce qui manquait, c'est **la date du prochain
 * épisode**, que la source de données fournit — et une seule requête suffit
 * pour toute la liste.
 *
 * Trois situations coexistent, et les confondre donnerait un écran menteur :
 *   - une date connue : « ép. 8 le 30 août » ;
 *   - une série terminée : pas de date, mais la progression reste utile ;
 *   - une source qui ne sait pas dater : l'écran s'affiche sans dates, plutôt
 *     que de ne pas s'afficher.
 */

/** Formate une date ISO en repère lisible, sans dépendance de plus. */
function quand(dateISO) {
  const date = new Date(dateISO)
  if (Number.isNaN(date.getTime())) return null

  const jours = Math.ceil((date - Date.now()) / 86_400_000)
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const jour = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

  // « Demain à 17:00 » se lit mieux que « 28 août à 17:00 » quand on ouvre la
  // page justement pour savoir si c'est bientôt.
  if (jours <= 0) return `aujourd’hui à ${heure}`
  if (jours === 1) return `demain à ${heure}`
  if (jours <= 7) return `dans ${jours} jours, le ${jour}`
  return `le ${jour}`
}

export default function OuReprendre({ watchlist }) {
  const { openModal } = useModal()
  const { showAdult } = useAgeFilter()
  const [dates, setDates] = useState(null)

  // Ce que l'utilisateur a lui-même déclaré « en cours » — et non ce que le
  // catalogue dit de la diffusion : on lui montre où IL en est, pas où en est
  // la chaîne.
  const enCours = watchlist.filter(a => a.watchStatus === 'watching')

  useEffect(() => {
    if (enCours.length === 0) return
    const controller = new AbortController()

    getProchainsEpisodes(enCours.map(a => a.mal_id), controller.signal)
      .then(setDates)
      // Un échec ne doit pas emporter la section : la progression vient du
      // stockage local et reste juste, seules les dates manquent.
      .catch(() => { if (!controller.signal.aborted) setDates(new Map()) })

    return () => controller.abort()
    // Sur les identifiants, pas sur les objets : cocher un épisode réécrit la
    // liste sans changer QUI la compose, et relancerait une requête pour rien.
  }, [enCours.map(a => a.mal_id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (enCours.length === 0) return null

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[var(--text-primary)] font-semibold text-lg">Reprendre</h2>

      <ul className="flex flex-col gap-2">
        {enCours.map(anime => {
          const info = dates?.get(anime.mal_id)
          const vu = anime.currentEpisode ?? 0
          const total = info?.episodes ?? anime.episodes ?? null
          const prochain = info?.prochain
          const date = prochain ? quand(prochain.dateISO) : null
          const { isAdult } = classifyAdultContent(anime.genres)
          const flouter = isAdult && !showAdult

          return (
            <li key={anime.mal_id}>
              <button
                onClick={() => openModal(anime.mal_id)}
                className="w-full flex items-center gap-3 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-2.5 text-left hover:border-[var(--color-accent)] transition-colors"
              >
                <img
                  src={posterUrl(anime.images)}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="w-10 h-14 rounded-lg object-cover shrink-0"
                  style={flouter ? { filter: 'blur(8px)' } : undefined}
                />
                <span className="flex flex-col min-w-0 gap-0.5">
                  <span className="text-[var(--text-primary)] text-sm font-semibold truncate">{anime.title}</span>
                  <span className="text-[var(--text-muted)] text-xs">
                    Épisode {vu}{total ? ` sur ${total}` : ''}
                  </span>
                  {date && (
                    <span className="text-[var(--color-accent)] text-xs font-medium">
                      Épisode {prochain.numero} {date}
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
