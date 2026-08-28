/**
 * Comparer plusieurs animés, à partir de ce qui est déjà sur l'appareil.
 *
 * Aucune requête : les favoris, la liste et l'historique gardent déjà la note,
 * le nombre d'épisodes, l'année, le statut et les genres. Comparer ne demande
 * donc rien à personne — et fonctionne même si la source est en panne.
 *
 * ## Ce qu'une comparaison doit faire ressortir
 *
 * Aligner des fiches côte à côte ne compare pas : cela juxtapose. Ce qui aide à
 * choisir, c'est **ce qui rapproche et ce qui sépare** — les genres partagés,
 * celui qui est le mieux noté, le plus court à regarder.
 */

/** Le maximum affichable côte à côte sans rendre les colonnes illisibles. */
export const MAX_COMPARES = 3

/** L'année de diffusion, sous les formes qu'ont prises les entrées au fil du temps. */
function annee(anime) {
  if (Number.isFinite(anime?.year)) return anime.year
  const depuis = anime?.aired?.from
  if (typeof depuis === 'string') {
    const a = new Date(depuis).getFullYear()
    if (Number.isFinite(a)) return a
  }
  const texte = anime?.aired?.string
  const trouve = typeof texte === 'string' ? texte.match(/\b(19|20)\d{2}\b/) : null
  return trouve ? Number(trouve[0]) : null
}

/** Les noms de genres, quelle que soit la forme sous laquelle ils sont gardés. */
function nomsDeGenres(anime) {
  return (anime?.genres ?? [])
    .map(g => (typeof g === 'string' ? g : g?.name))
    .filter(Boolean)
}

/**
 * Compare des animés et dit ce qui les rapproche.
 *
 * @returns {{
 *   lignes: Array<{cle: string, libelle: string, valeurs: Array<{texte: string, meilleur: boolean}>}>,
 *   genresCommuns: string[],
 * }}
 */
export function comparer(animes) {
  const choix = (animes ?? []).filter(a => a && Number.isFinite(a.mal_id)).slice(0, MAX_COMPARES)
  if (choix.length === 0) return { lignes: [], genresCommuns: [] }

  const notes = choix.map(a => (Number.isFinite(a.score) ? a.score : null))
  const episodes = choix.map(a => (Number.isFinite(a.episodes) ? a.episodes : null))
  const annees = choix.map(annee)

  // Un « meilleur » n'a de sens qu'à plusieurs, et seulement s'il est seul à
  // l'être : trois notes identiques ne désignent aucun vainqueur.
  const distingue = (valeurs, mieux) => {
    const connues = valeurs.filter(v => v !== null)
    if (choix.length < 2 || connues.length < 2) return null
    const extremum = mieux(connues)
    return connues.filter(v => v === extremum).length === 1 ? extremum : null
  }

  const meilleureNote = distingue(notes, v => Math.max(...v))
  const moinsDEpisodes = distingue(episodes, v => Math.min(...v))

  const lignes = [
    {
      cle: 'note',
      libelle: 'Note',
      valeurs: notes.map(n => ({
        texte: n === null ? '—' : `${n} / 10`,
        meilleur: n !== null && n === meilleureNote,
      })),
    },
    {
      cle: 'episodes',
      libelle: 'Épisodes',
      valeurs: episodes.map(e => ({
        texte: e === null ? '—' : String(e),
        // Le plus court est mis en avant : c'est ce qu'on cherche quand on
        // hésite entre deux séries et qu'on a peu de temps.
        meilleur: e !== null && e === moinsDEpisodes,
      })),
    },
    {
      cle: 'duree',
      libelle: 'Temps estimé',
      valeurs: episodes.map(e => ({
        texte: e === null ? '—' : `~${Math.round((e * 24) / 60)} h`,
        meilleur: false,
      })),
    },
    {
      cle: 'annee',
      libelle: 'Année',
      valeurs: annees.map(a => ({ texte: a === null ? '—' : String(a), meilleur: false })),
    },
    {
      cle: 'statut',
      libelle: 'Statut',
      valeurs: choix.map(a => ({ texte: a.status || '—', meilleur: false })),
    },
  ]

  // L'apport propre de la comparaison : ce que ces titres ont en commun.
  const parAnime = choix.map(a => new Set(nomsDeGenres(a)))
  const genresCommuns = choix.length < 2
    ? []
    : [...parAnime[0]].filter(g => parAnime.every(set => set.has(g))).sort((a, b) => a.localeCompare(b, 'fr'))

  return { lignes, genresCommuns }
}
