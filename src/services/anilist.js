import { animeDepuisAniList, paginationDepuisAniList } from './anilist/traduction'
import { catalogueDesGenres, nomAniListDepuisIdMal } from './anilist/genres'
import { JikanError } from './jikan/client'

/**
 * L'adaptateur AniList : mêmes signatures que l'adaptateur en place, même
 * contrat en sortie.
 *
 * Il est autonome à ce stade — ni cache, ni limiteur, ni déduplication. C'est
 * délibéré : la phase 2 du plan ne répond que d'une chose, produire la forme
 * attendue. Y brancher les briques existantes est la phase 3, et les mêler ici
 * rendrait impossible de savoir laquelle échoue.
 *
 * `JikanError` est réutilisée telle quelle. Le nom vieillira, mais les
 * composants la reconnaissent par son `status` : en introduire une seconde
 * obligerait à toucher chaque `catch`, pour aucun gain de cette phase.
 */

const ENDPOINT = 'https://graphql.anilist.co'
const DELAI_MS = 8000

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

/**
 * Une requête GraphQL, avec délai de garde.
 *
 * AniList répond `200` même sur une erreur GraphQL — le corps porte alors un
 * tableau `errors`. S'en remettre au seul code HTTP laisserait passer une
 * requête refusée pour une réponse vide.
 */
async function interroger(query, variables, signal) {
  const controller = new AbortController()
  let expire = false
  const minuterie = setTimeout(() => { expire = true; controller.abort() }, DELAI_MS)

  const relayer = () => controller.abort()
  signal?.addEventListener('abort', relayer, { once: true })

  try {
    const reponse = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    })

    if (!reponse.ok) {
      throw new JikanError(`AniList a répondu avec le statut ${reponse.status}`, {
        status: reponse.status,
        retryAfter: reponse.headers?.get?.('Retry-After') ?? null,
      })
    }

    const corps = await reponse.json()
    if (Array.isArray(corps?.errors) && corps.errors.length > 0) {
      throw new JikanError(corps.errors[0]?.message ?? 'Requête AniList refusée', { status: 400 })
    }

    return corps?.data ?? {}
  } catch (erreur) {
    if (signal?.aborted) throw erreur
    if (expire) throw new JikanError('AniList n’a pas répondu à temps', { cause: erreur })
    throw erreur
  } finally {
    clearTimeout(minuterie)
    signal?.removeEventListener('abort', relayer)
  }
}

/** Écarte les médias qu'AniList connaît mais que MyAnimeList ne référence pas. */
function traduireListe(medias) {
  return (medias ?? []).map(animeDepuisAniList).filter(Boolean)
}

export async function getAnimeById(id, signal) {
  const data = await interroger(
    `query ($idMal: Int) { Media(idMal: $idMal, type: ANIME) { ${CHAMPS_MEDIA} } }`,
    { idMal: Number(id) },
    signal,
  )
  return animeDepuisAniList(data?.Media)
}

export async function searchAnime(query, signal) {
  const data = await interroger(
    `query ($search: String) {
      Page(page: 1, perPage: 20) { media(search: $search, type: ANIME, sort: SEARCH_MATCH) { ${CHAMPS_MEDIA} } }
    }`,
    { search: query },
    signal,
  )
  return traduireListe(data?.Page?.media)
}

export async function getTopAnime(page = 1, signal) {
  const data = await interroger(
    `query ($page: Int) {
      Page(page: $page, perPage: 24) {
        pageInfo { currentPage lastPage hasNextPage total }
        media(sort: SCORE_DESC, type: ANIME) { ${CHAMPS_MEDIA} }
      }
    }`,
    { page: Number(page) || 1 },
    signal,
  )
  return {
    data: traduireListe(data?.Page?.media),
    pagination: paginationDepuisAniList(data?.Page?.pageInfo),
  }
}

/**
 * Le catalogue, filtré.
 *
 * AniList filtre les genres **par nom**, là où l'application manipule des
 * identifiants MyAnimeList — hérités des URL partagées et des favoris. La table
 * de correspondance fait le chemin inverse ; un identifiant sans équivalent est
 * ignoré plutôt que de vider la page sans explication.
 */
export async function getAnimeByFilter({ genre, status, type, orderBy, letter, page = 1 } = {}, signal) {
  const TRIS = {
    title: 'TITLE_ROMAJI',
    score: 'SCORE_DESC',
    start_date: 'START_DATE_DESC',
    episodes: 'EPISODES_DESC',
  }
  const STATUTS = {
    airing: 'RELEASING',
    complete: 'FINISHED',
    upcoming: 'NOT_YET_RELEASED',
  }
  const FORMATS = { tv: 'TV', movie: 'MOVIE', ova: 'OVA', ona: 'ONA', special: 'SPECIAL' }

  const variables = {
    page: Number(page) || 1,
    sort: TRIS[orderBy] ?? 'TITLE_ROMAJI',
    genre: genre ? nomAniListDepuisIdMal(genre) ?? undefined : undefined,
    status: STATUTS[status] ?? undefined,
    format: FORMATS[type] ?? undefined,
    // AniList n'a pas de filtre « commence par » : la lettre passe par la
    // recherche, seule approximation disponible.
    search: letter || undefined,
  }

  const data = await interroger(
    `query ($page: Int, $sort: [MediaSort], $genre: String, $status: MediaStatus, $format: MediaFormat, $search: String) {
      Page(page: $page, perPage: 24) {
        pageInfo { currentPage lastPage hasNextPage total }
        media(type: ANIME, sort: $sort, genre: $genre, status: $status, format: $format, search: $search) { ${CHAMPS_MEDIA} }
      }
    }`,
    variables,
    signal,
  )

  return {
    data: traduireListe(data?.Page?.media),
    pagination: paginationDepuisAniList(data?.Page?.pageInfo),
  }
}

/**
 * Les genres viennent de la table, pas du réseau.
 *
 * `GenreCollection` ne rend que des noms, sans identifiant : il faudrait de
 * toute façon les rattacher à la table pour respecter le contrat. Une requête
 * qui n'apprendrait rien de plus est une requête de moins sur un budget de
 * trente par minute.
 */
export async function getGenres() {
  return catalogueDesGenres()
}

/**
 * Les recommandations — et c'est ici qu'AniList change la donne.
 *
 * Ni Jikan ni Tenrai ne joignent les genres à une suggestion, ce qui obligeait
 * à deviner son registre d'après la fiche ouverte. AniList les fournit, avec
 * `isAdult` : le floutage cessera de reposer sur une approximation.
 */
export async function getAnimeRecommendations(id, signal) {
  const data = await interroger(
    `query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) {
        recommendations(perPage: 6, sort: RATING_DESC) {
          nodes { mediaRecommendation { ${CHAMPS_MEDIA} } }
        }
      }
    }`,
    { idMal: Number(id) },
    signal,
  )

  return traduireListe(
    (data?.Media?.recommendations?.nodes ?? []).map(n => n?.mediaRecommendation),
  )
}

export async function getRandomAnime() {
  // AniList n'a pas d'endpoint aléatoire : une page au hasard parmi les mieux
  // notées en tient lieu, sans prétendre à l'équivalence.
  const page = 1 + Math.floor(Math.random() * 50)
  const { data } = await getTopAnime(page)
  return data.length > 0 ? data[Math.floor(Math.random() * data.length)] : null
}

export { JikanError }
