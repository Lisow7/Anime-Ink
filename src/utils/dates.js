/**
 * Dire quand, en français et sans dépendance.
 *
 * Ces fonctions étaient nées dans « Reprendre » ; le calendrier en avait besoin
 * à l'identique. Un second exemplaire aurait dérivé du premier — c'est
 * exactement la duplication que le nettoyage de la veille cherchait à défaire.
 */

const JOUR_MS = 86_400_000

/** Le nombre de jours qui séparent deux instants, sans tenir compte de l'heure. */
export function joursDEcart(date, depuis = new Date()) {
  const a = new Date(date); a.setHours(0, 0, 0, 0)
  const b = new Date(depuis); b.setHours(0, 0, 0, 0)
  return Math.round((a - b) / JOUR_MS)
}

/**
 * Un repère lisible pour une sortie à venir.
 *
 * « Demain à 17:00 » se lit mieux que « 29 août à 17:00 » quand on ouvre la
 * page justement pour savoir si c'est bientôt. Le calcul porte sur les jours
 * calendaires, non sur les heures écoulées : une diffusion à 23 h ce soir doit
 * se dire « aujourd'hui », pas « demain » parce qu'il reste plus de vingt
 * heures.
 */
export function quand(dateISO, depuis = new Date()) {
  const date = new Date(dateISO)
  if (Number.isNaN(date.getTime())) return null

  const jours = joursDEcart(date, depuis)
  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const jour = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

  if (jours <= 0) return `aujourd’hui à ${heure}`
  if (jours === 1) return `demain à ${heure}`
  if (jours <= 7) return `dans ${jours} jours, le ${jour}`
  return `le ${jour}`
}

/** Le nom du jour, en tête de groupe : « aujourd'hui », « demain », « samedi 30 août ». */
export function nomDuJour(dateISO, depuis = new Date()) {
  const date = new Date(dateISO)
  if (Number.isNaN(date.getTime())) return null

  const jours = joursDEcart(date, depuis)
  if (jours <= 0) return 'Aujourd’hui'
  if (jours === 1) return 'Demain'

  const nom = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return nom.charAt(0).toUpperCase() + nom.slice(1)
}
