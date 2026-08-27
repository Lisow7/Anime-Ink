import { joursDEcart } from './dates'

/** L'horizon du calendrier : au-delà, on ne prétend plus rien annoncer. */
export const JOURS_AFFICHES = 7

/**
 * Groupe des sorties par jour, dans l'ordre.
 *
 * Fonction pure, et c'est délibéré : le tri, la fenêtre et l'ordre des groupes
 * sont ce qui peut se tromper — les vérifier à travers le rendu reviendrait à
 * tester une page pour prouver un calcul.
 *
 * ⚠️ **Une entrée par série, jamais plus.** La source ne donne que le
 * *prochain* épisode de chaque titre : une série diffusée deux fois dans la
 * même semaine — rattrapage, double épisode — n'apparaîtra qu'une fois. C'est
 * une limite assumée de cette version, pas un défaut de ce groupement.
 *
 * @param {Array<{mal_id: number, title: string, prochain: {numero: number, dateISO: string}|null}>} entrees
 * @returns {Array<{cle: string, dateISO: string, sorties: Array}>}
 */
export function grouperParJour(entrees, depuis = new Date()) {
  const retenues = (entrees ?? []).filter(e => {
    if (!e?.prochain?.dateISO) return false
    const ecart = joursDEcart(e.prochain.dateISO, depuis)
    // Une diffusion passée n'a plus rien à annoncer ; au-delà de l'horizon,
    // elle noierait ce qui arrive vraiment.
    return ecart >= 0 && ecart < JOURS_AFFICHES
  })

  const parJour = new Map()
  for (const entree of retenues) {
    // La clé est le jour **local** : deux diffusions du même soir doivent se
    // retrouver ensemble, même si l'une bascule de jour en temps universel.
    const date = new Date(entree.prochain.dateISO)
    const cle = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
    if (!parJour.has(cle)) parJour.set(cle, [])
    parJour.get(cle).push(entree)
  }

  return [...parJour.entries()]
    .map(([cle, sorties]) => ({
      cle,
      dateISO: sorties[0].prochain.dateISO,
      sorties: sorties.sort((a, b) => new Date(a.prochain.dateISO) - new Date(b.prochain.dateISO)),
    }))
    .sort((a, b) => new Date(a.dateISO) - new Date(b.dateISO))
}
