/**
 * Les requêtes GraphQL, et la clé qui les identifie.
 *
 * Le client partagé — cache, limiteur, déduplication, secours périmé — a été
 * écrit pour du REST : il reçoit un chemin, s'en sert comme clé de cache, et le
 * passe à la fonction qui appelle le réseau.
 *
 * Rien n'oblige ce « chemin » à être une URL. En y encodant l'opération et ses
 * variables, GraphQL entre dans le même moule : deux requêtes identiques
 * produisent la même clé, donc le même cache et la même déduplication. C'est ce
 * qui permet de réutiliser ces quatre briques telles quelles plutôt que de les
 * réécrire pour un second protocole.
 */

/** Les champs d'un média, écrits une fois : toutes les requêtes s'en servent. */
const CHAMPS_MEDIA = `
  idMal siteUrl
  title { romaji english native }
  coverImage { extraLarge large medium }
  averageScore popularity
  format episodes duration status
  season seasonYear
  startDate { year month day }
  endDate { year month day }
  genres isAdult description
  studios(isMain: true) { nodes { id name } }
  trailer { id site }
  rankings { rank type allTime }
`

const PAGE_INFO = 'pageInfo { currentPage lastPage hasNextPage total }'

/** Le strict nécessaire pour situer un titre dans sa franchise. */
const CHAMPS_FRANCHISE = 'idMal format episodes seasonYear title { romaji english }'

export const OPERATIONS = {
  media: {
    query: `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { ${CHAMPS_MEDIA} } }`,
  },
  recherche: {
    query: `query ($search: String) {
      Page(page: 1, perPage: 20) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ${CHAMPS_MEDIA} } }
    }`,
  },
  classement: {
    query: `query ($page: Int) {
      Page(page: $page, perPage: 24) { ${PAGE_INFO} media(sort: SCORE_DESC, type: ANIME) { ${CHAMPS_MEDIA} } }
    }`,
  },
  catalogue: {
    query: `query ($page: Int, $sort: [MediaSort], $genre: String, $status: MediaStatus, $format: MediaFormat, $search: String) {
      Page(page: $page, perPage: 24) {
        ${PAGE_INFO}
        media(type: ANIME, sort: $sort, genre: $genre, status: $status, format: $format, search: $search) { ${CHAMPS_MEDIA} }
      }
    }`,
  },
  recommandations: {
    query: `query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        recommendations(perPage: 6, sort: RATING_DESC) { nodes { mediaRecommendation { ${CHAMPS_MEDIA} } } }
      }
    }`,
  },
  /**
   * Les relations d'un titre — de quoi reconstituer une franchise.
   *
   * Volontairement dépourvue de `CHAMPS_MEDIA` : le parcours d'une franchise
   * enchaîne un appel par saison, et n'a besoin que de l'identifiant, du
   * format, du nombre d'épisodes et du titre. Y verser la fiche complète
   * multiplierait le poids de chaque saut sans rien apporter à l'écran.
   *
   * Chaque nœud porte déjà son format : c'est ce qui permet de ne descendre
   * que dans les branches télévisées, là où l'API historique devait demander
   * chaque séquelle pour découvrir de quel type elle était.
   */
  relations: {
    query: `query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        ${CHAMPS_FRANCHISE}
        relations { edges { relationType node { type ${CHAMPS_FRANCHISE} } } }
      }
    }`,
  },
}

/**
 * La clé d'une requête : son opération et ses variables, ordonnées.
 *
 * Les clés sont triées pour que `{page: 1, sort: 'X'}` et `{sort: 'X', page: 1}`
 * n'occupent pas deux entrées de cache — l'ordre d'écriture d'un objet ne dit
 * rien de son contenu.
 */
export function cleDeRequete(operation, variables = {}) {
  const ordonnees = Object.keys(variables)
    .filter(k => variables[k] !== undefined)
    .sort()
    .reduce((acc, k) => ({ ...acc, [k]: variables[k] }), {})
  return `${operation}:${JSON.stringify(ordonnees)}`
}

/** Le chemin inverse, pour la fonction qui appelle le réseau. */
export function lireCle(cle) {
  const separateur = cle.indexOf(':')
  const operation = cle.slice(0, separateur)
  return { operation, variables: JSON.parse(cle.slice(separateur + 1)) }
}

const HEURE = 60 * 60 * 1000
const JOUR = 24 * HEURE

/**
 * Durée de validité par opération.
 *
 * Reprend les durées éprouvées côté Jikan : une fiche bouge peu, une liste
 * davantage. Les genres n'y figurent pas — ils ne passent pas par le réseau.
 */
export function ttlPourCle(cle) {
  const operation = cle.slice(0, cle.indexOf(':'))
  // Une franchise ne gagne une saison que de loin en loin : la mettre de côté
  // pour la journée épargne un appel par saison à chaque ouverture de fiche.
  if (operation === 'media' || operation === 'recommandations' || operation === 'relations') return JOUR
  if (operation === 'recherche' || operation === 'classement' || operation === 'catalogue') return HEURE
  return 0
}
