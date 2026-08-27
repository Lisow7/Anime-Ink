import { animeDepuisAniList, paginationDepuisAniList } from './anilist/traduction'
import { catalogueDesGenres, nomAniListDepuisIdMal } from './anilist/genres'
import { cleDeRequete, ttlPourCle } from './anilist/requetes'
import { creerReseauAniList, quotaConnu } from './anilist/reseau'
import { createJikanClient, JikanError } from './jikan/client'
import { createRateLimiter } from './jikan/rate-limiter'
import { createCache } from './jikan/cache'

/**
 * L'adaptateur AniList, branché sur les briques déjà éprouvées.
 *
 * Cache, limiteur, déduplication et secours périmé sont **repris tels quels** :
 * ils ont été écrits pour une API, ils servent pour l'autre. Rien n'a été
 * réécrit — la requête GraphQL entre dans le moule du client en encodant son
 * opération et ses variables dans la clé.
 *
 * ## Le débit, mesuré
 *
 * AniList annonce 90 requêtes par minute et en applique **30**, réduction que
 * sa documentation assume. Mesuré le 27 août : une rafale de cinq passe sans
 * refus, le compteur descendant de 29 à 25.
 *
 * D'où une capacité de 5 et un jeton toutes les deux secondes — 30 par minute.
 * Et, ce que Jikan ne permettait pas : `X-RateLimit-Remaining` est lu à chaque
 * réponse, pour ralentir **avant** le refus plutôt que le subir.
 */

const RAFALE = 5
const JETONS_PAR_SECONDE = 0.5

/**
 * Fabrique un adaptateur. Les briques sont injectables — les tests ont besoin
 * d'un limiteur transparent, sans quoi ils subiraient un vrai jeton toutes les
 * deux secondes. C'est ce qui manquait à l'adaptateur historique, dont la suite
 * de conformité dure huit secondes.
 */
export function creerAdaptateurAniList({
  limiter = createRateLimiter({ capacity: RAFALE, refillPerSecond: JETONS_PAR_SECONDE }),
  cache = createCache(),
  fetchImpl = creerReseauAniList(),
  // Injectable pour les tests : sous faux timers, l'attente entre deux
  // tentatives ne s'écoule jamais et le test expire au lieu d'échouer.
  retries,
} = {}) {
  const client = createJikanClient({
    fetchImpl, limiter, cache, ttlFor: ttlPourCle,
    ...(retries === undefined ? {} : { retries }),
  })

  const demander = (operation, variables, options) =>
    client.request(cleDeRequete(operation, variables), options)

  /** Écarte les médias qu'AniList connaît mais que MyAnimeList ne référence pas. */
  const traduireListe = medias => (medias ?? []).map(animeDepuisAniList).filter(Boolean)

  async function getAnimeById(id, signal, options = {}) {
    const data = await demander('media', { idMal: Number(id) }, { signal, ...options })
    return animeDepuisAniList(data?.data?.Media)
  }

  async function searchAnime(query, signal) {
    const data = await demander('recherche', { search: query }, { signal })
    return traduireListe(data?.data?.Page?.media)
  }

  async function getTopAnime(page = 1, signal) {
    const data = await demander('classement', { page: Number(page) || 1 }, { signal })
    return {
      data: traduireListe(data?.data?.Page?.media),
      pagination: paginationDepuisAniList(data?.data?.Page?.pageInfo),
    }
  }

  /**
   * Le catalogue filtré.
   *
   * AniList filtre les genres **par nom**, là où l'application manipule des
   * identifiants MyAnimeList — hérités des URL partagées et des favoris. La
   * table fait le chemin inverse ; un identifiant sans équivalent est ignoré
   * plutôt que de vider la page sans explication.
   */
  async function getAnimeByFilter({ genre, status, type, orderBy, letter, page = 1 } = {}, signal, options = {}) {
    const TRIS = { title: 'TITLE_ROMAJI', score: 'SCORE_DESC', start_date: 'START_DATE_DESC', episodes: 'EPISODES_DESC' }
    const STATUTS = { airing: 'RELEASING', complete: 'FINISHED', upcoming: 'NOT_YET_RELEASED' }
    const FORMATS = { tv: 'TV', movie: 'MOVIE', ova: 'OVA', ona: 'ONA', special: 'SPECIAL' }

    const data = await demander('catalogue', {
      page: Number(page) || 1,
      sort: TRIS[orderBy] ?? 'TITLE_ROMAJI',
      genre: genre ? nomAniListDepuisIdMal(genre) : undefined,
      status: STATUTS[status] ?? undefined,
      format: FORMATS[type] ?? undefined,
      // AniList n'a pas de filtre « commence par » : la lettre passe par la
      // recherche, seule approximation disponible.
      search: letter || undefined,
    }, { signal, ...options })

    return {
      data: traduireListe(data?.data?.Page?.media),
      pagination: paginationDepuisAniList(data?.data?.Page?.pageInfo),
    }
  }

  /**
   * Les genres viennent de la table, pas du réseau.
   *
   * `GenreCollection` ne rend que des noms, sans identifiant : il faudrait de
   * toute façon les rattacher à la table pour respecter le contrat. Une requête
   * qui n'apprendrait rien de plus est une requête de moins sur trente.
   */
  async function getGenres() {
    return catalogueDesGenres()
  }

  /**
   * Les recommandations — et c'est ici qu'AniList change la donne.
   *
   * Ni Jikan ni Tenrai ne joignent les genres à une suggestion, ce qui
   * obligeait à deviner son registre d'après la fiche ouverte. AniList les
   * fournit, avec `isAdult`.
   */
  async function getAnimeRecommendations(id, signal) {
    const data = await demander('recommandations', { idMal: Number(id) }, { signal })
    return traduireListe(
      (data?.data?.Media?.recommendations?.nodes ?? []).map(n => n?.mediaRecommendation),
    )
  }

  async function getRandomAnime() {
    // AniList n'a pas d'endpoint aléatoire : une page au hasard parmi les mieux
    // notées en tient lieu, sans prétendre à l'équivalence.
    const page = 1 + Math.floor(Math.random() * 50)
    const { data } = await getTopAnime(page)
    return data.length > 0 ? data[Math.floor(Math.random() * data.length)] : null
  }

  return {
    getAnimeById,
    searchAnime,
    getTopAnime,
    getAnimeByFilter,
    getGenres,
    getAnimeRecommendations,
    getRandomAnime,
    clearApiCache: () => cache.clear(),
  }
}

/** L'instance que l'application utilisera, une fois la bascule faite. */
const adaptateur = creerAdaptateurAniList()

export const getAnimeById = adaptateur.getAnimeById
export const searchAnime = adaptateur.searchAnime
export const getTopAnime = adaptateur.getTopAnime
export const getAnimeByFilter = adaptateur.getAnimeByFilter
export const getGenres = adaptateur.getGenres
export const getAnimeRecommendations = adaptateur.getAnimeRecommendations
export const getRandomAnime = adaptateur.getRandomAnime
export const clearApiCache = adaptateur.clearApiCache

export { quotaConnu, JikanError }
