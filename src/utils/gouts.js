/**
 * Ce que les choix d'une personne disent de ses goûts.
 *
 * Le profil comptait déjà : combien de favoris, combien d'épisodes, combien
 * d'heures. Des totaux, jamais un portrait. Or tout ce qu'il faut pour en
 * dresser un est **déjà sur l'appareil** — les genres et les dates de diffusion
 * sont enregistrés avec chaque favori.
 *
 * Rien n'est calculé ailleurs, rien n'est envoyé nulle part : ces chiffres ne
 * quittent pas le navigateur, et aucune requête n'est faite pour les obtenir.
 *
 * ## Ce qui compte, et ce qui ne compte pas
 *
 * Les favoris et la liste de suivi seulement. L'historique dit ce qu'on a
 * **ouvert**, souvent par curiosité ou par erreur ; le compter reviendrait à
 * prendre un coup d'œil pour un goût.
 */

/** Réunit favoris et liste sans compter deux fois un même titre. */
function choixDeliberes(favoris, liste) {
  return [...new Map([...(favoris ?? []), ...(liste ?? [])].map(a => [a?.mal_id, a])).values()]
    .filter(a => a && Number.isFinite(a.mal_id))
}

/**
 * Les genres les plus représentés, du plus fréquent au moins fréquent.
 *
 * @returns {Array<{nom: string, nombre: number, part: number}>} `part` est une
 *   fraction du total, prête à dessiner une barre.
 */
export function genresPreferes(favoris, liste, combien = 6) {
  const choix = choixDeliberes(favoris, liste)

  const comptes = new Map()
  for (const anime of choix) {
    for (const genre of anime.genres ?? []) {
      const nom = typeof genre === 'string' ? genre : genre?.name
      if (!nom) continue
      comptes.set(nom, (comptes.get(nom) ?? 0) + 1)
    }
  }
  if (comptes.size === 0) return []

  const maximum = Math.max(...comptes.values())
  return [...comptes.entries()]
    // À nombre égal, l'ordre alphabétique : sans lui, deux genres à égalité
    // changeraient de place d'un rendu à l'autre selon l'ordre d'insertion.
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
    .slice(0, combien)
    .map(([nom, nombre]) => ({ nom, nombre, part: nombre / maximum }))
}

/** L'année de diffusion, quelle que soit la forme sous laquelle elle a été gardée. */
function anneeDe(anime) {
  if (Number.isFinite(anime?.year)) return anime.year
  const depuis = anime?.aired?.from
  if (typeof depuis === 'string') {
    const annee = new Date(depuis).getFullYear()
    if (Number.isFinite(annee)) return annee
  }
  // Les entrées les plus anciennes ne portent parfois qu'une chaîne libre.
  const texte = anime?.aired?.string
  const trouve = typeof texte === 'string' ? texte.match(/\b(19|20)\d{2}\b/) : null
  return trouve ? Number(trouve[0]) : null
}

/**
 * La répartition par décennie, de la plus ancienne à la plus récente.
 *
 * Par décennie et non par année : sur une poignée de titres, un découpage
 * annuel ne dessinerait qu'un histogramme de bâtons isolés, sans rien
 * raconter.
 */
export function decenniesPreferees(favoris, liste) {
  const comptes = new Map()
  for (const anime of choixDeliberes(favoris, liste)) {
    const annee = anneeDe(anime)
    if (!annee) continue
    const decennie = Math.floor(annee / 10) * 10
    comptes.set(decennie, (comptes.get(decennie) ?? 0) + 1)
  }
  if (comptes.size === 0) return []

  const maximum = Math.max(...comptes.values())
  return [...comptes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([decennie, nombre]) => ({ decennie, nombre, part: nombre / maximum }))
}
