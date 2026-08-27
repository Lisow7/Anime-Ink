import { repondre, repondreAniList } from './a11y-fixtures.mjs'

/**
 * Ce que les scripts de vérification doivent savoir de la source interrogée.
 *
 * Les parcours et le garde-fou d'accessibilité connaissaient `api.jikan.moe` :
 * l'URL à intercepter, celle à compter, la clé sous laquelle une réponse est
 * mise en réserve. Autant de détails qui ne survivent pas à un changement de
 * source — et qui auraient fait échouer les parcours sur AniList pour des
 * raisons étrangères au code vérifié.
 *
 * Tout est rassemblé ici, avec une implémentation par source. Les scripts
 * décrivent des intentions — « une requête de catalogue », « la réserve du
 * catalogue » — et ignorent comment elles se traduisent.
 *
 * La source suit celle du build : `VITE_SOURCE_DONNEES=jikan` bascule les deux
 * ensemble. C'est ce qui permet de passer les mêmes parcours sur les deux et de
 * conclure — un écart accuse alors le contrat, pas le décor.
 */

/** GraphQL passe tout par une URL unique : l'opération se lit dans le corps. */
function operationDe(request) {
  try {
    const corps = JSON.parse(request.postData() ?? '{}')
    // La requête porte son nom d'opération nulle part ailleurs que dans sa
    // forme : on le retrouve par les champs racine que le document interroge.
    const query = corps.query ?? ''
    // Avant les autres : cette requête porte aussi `Page(` et serait prise
    // pour un catalogue, qui rendrait des fiches sans date de diffusion.
    if (/idMal_in/.test(query)) return 'prochainsEpisodes'
    if (/recommendations\s*\(/.test(query)) return 'recommandations'
    if (/relations\s*\{/.test(query)) return 'relations'
    if (/Media\s*\(/.test(query)) return 'media'
    return 'catalogue'
  } catch {
    return 'catalogue'
  }
}

const ANILIST = {
  nom: 'anilist',
  motifRoute: '**/graphql.anilist.co/**',
  estRequete: url => url.includes('graphql.anilist.co'),
  /** Le catalogue et le classement passent par une page de résultats. */
  estRequeteCatalogue: request =>
    ANILIST.estRequete(request.url()) && ['catalogue'].includes(operationDe(request)),
  /** Sous quelle clé le catalogue met sa réponse en réserve. */
  cleReserveCatalogue: 'anime-ink-cache:catalogue:',
  corps: request => repondreAniList(operationDe(request), JSON.parse(request.postData() ?? '{}').variables ?? {}),
}

const JIKAN = {
  nom: 'jikan',
  motifRoute: '**/api.jikan.moe/**',
  estRequete: url => url.includes('api.jikan.moe'),
  estRequeteCatalogue: request => /\/anime\?/.test(request.url()),
  cleReserveCatalogue: 'anime-ink-cache:/anime?',
  corps: request => repondre(request.url()),
}

export const SOURCE = process.env.VITE_SOURCE_DONNEES === 'jikan' ? JIKAN : ANILIST

/**
 * Installe le faux réseau sur la page.
 *
 * @param {object} page              la page Playwright
 * @param {boolean} [enPanne]        répondre par une panne plutôt que par des données
 * @param {Array}  [genresImposes]   remplace les genres, pour éprouver la censure
 */
export function servirSource(page, { enPanne = false, genresImposes = null } = {}) {
  return page.route(SOURCE.motifRoute, route => {
    if (enPanne) {
      return route.fulfill({
        status: 504,
        contentType: 'application/json',
        body: JSON.stringify({ status: 504, message: 'panne simulée' }),
      })
    }

    const corps = SOURCE.corps(route.request())
    const impose = genresImposes ? imposerGenres(corps, genresImposes) : corps
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(impose) })
  })
}

export function cesserDeServir(page) {
  return page.unroute(SOURCE.motifRoute)
}

/**
 * Remplace les genres de chaque fiche de la réponse.
 *
 * Les deux formats diffèrent jusque dans leur façon de dire l'âge : Jikan le
 * déduit d'un genre, AniList porte un booléen. Imposer « Hentai » sans lever ce
 * booléen laisserait le floutage inerte sur AniList, et le parcours conclurait
 * à tort que la censure a échoué.
 */
function imposerGenres(corps, genres) {
  const noms = genres.map(g => g.name)
  const adulte = noms.some(n => n === 'Hentai' || n === 'Erotica')

  if (SOURCE.nom === 'jikan') {
    if (!corps?.data) return corps
    const marquer = a => ({ ...a, genres })
    return { ...corps, data: Array.isArray(corps.data) ? corps.data.map(marquer) : marquer(corps.data) }
  }

  const marquer = m => (m ? { ...m, genres: noms, isAdult: adulte } : m)
  const page = corps?.data?.Page
  if (page) return { data: { Page: { ...page, media: (page.media ?? []).map(marquer) } } }

  const media = corps?.data?.Media
  if (!media) return corps
  if (media.recommendations) {
    return { data: { Media: { recommendations: {
      nodes: (media.recommendations.nodes ?? []).map(n => ({ mediaRecommendation: marquer(n.mediaRecommendation) })),
    } } } }
  }
  return { data: { Media: marquer(media) } }
}
