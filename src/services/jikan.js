import { ANIME_ACRONYMS } from '../constants/acronyms'
import { normalizeTitle } from '../utils/groupAnime'
import { readStorage, writeStorage } from '../utils/storage'
import { createJikanClient, JikanError } from './jikan/client'
import { createRateLimiter } from './jikan/rate-limiter'
import { createCache } from './jikan/cache'
import { ttlForPath } from './jikan/ttl'
import { mettreAJourSante, signalerDonneePerimee, statutDepuisReponse } from './sante-api'

export { JikanError }
export { getApiHealth, subscribeApiHealth } from './sante-api'

const BASE_URL = 'https://api.jikan.moe/v4'
const REQUEST_TIMEOUT_MS = 8000

// Paramètres mesurés sur api.jikan.moe le 2026-08-25 : 70 requêtes espacées de
// 400 ms n'en ont vu aboutir que 30 en 28 s, les 429 démarrant dès la 4e. Le
// plafond n'est pas une fenêtre mais un seau à jetons — une rafale d'environ 3
// passe, puis le débit soutenu retombe à environ 1 requête par seconde.
const BURST_CAPACITY = 3
const REFILL_PER_SECOND = 1

const responseCache = createCache()

/**
 * Vide le cache de réponses de l'API. Les données de l'utilisateur — favoris,
 * watchlist, historique — vivent dans localStorage et ne sont pas concernées.
 */
export function clearApiCache() {
  responseCache.clear()
}

/**
 * Le délai de garde appartient à chaque tentative réseau et se combine au
 * signal partagé par le client, sans le remplacer. Un dépassement de délai
 * n'est pas une annulation de l'utilisateur : il devient une JikanError sans
 * statut, que le client a le droit de réessayer.
 */
async function fetchWithTimeout(path, { signal } = {}) {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)

  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })

    mettreAJourSante(statutDepuisReponse(response.status))

    return response
  } catch (error) {
    if (signal?.aborted) throw error
    mettreAJourSante('unavailable')
    if (timedOut) throw new JikanError('Jikan n’a pas répondu à temps', { cause: error })
    throw error
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', onAbort)
  }
}

const client = createJikanClient({
  fetchImpl: fetchWithTimeout,
  limiter: createRateLimiter({ capacity: BURST_CAPACITY, refillPerSecond: REFILL_PER_SECOND }),
  cache: responseCache,
  ttlFor: ttlForPath,
  onStale: signalerDonneePerimee,
})

function requestJson(path, options) {
  return client.request(path, options)
}

function generateAcronym(title) {
  if (!title) return ''
  return title
    .split(/[\s\-:!?.,+×x/]+/)
    .filter(w => /[a-zA-Z\u00C0-\u024F]/.test(w))
    .map(w => w[0].toUpperCase())
    .join('')
}

export async function searchAnime(query, signal) {
  const upperQ = query.trim().toUpperCase()
  const expandedQuery = ANIME_ACRONYMS[upperQ] || query.trim()
  const isAcronym = expandedQuery !== query.trim()

  const data = await requestJson(`/anime?q=${encodeURIComponent(expandedQuery)}&limit=20`, { signal })
  const lower = expandedQuery.toLowerCase()

  return (data.data ?? [])
    .filter((anime) =>
      anime.title?.toLowerCase().includes(lower) ||
      anime.title_english?.toLowerCase().includes(lower) ||
      (isAcronym ? false : generateAcronym(anime.title || '') === upperQ) ||
      (isAcronym ? false : generateAcronym(anime.title_english || '') === upperQ)
    )
    .sort((a, b) => {
      const dateA = a.aired?.from ? new Date(a.aired.from) : new Date(0)
      const dateB = b.aired?.from ? new Date(b.aired.from) : new Date(0)
      return dateA - dateB
    })
}

/**
 * @param {object} [options] L'option `bypassCache` est réservée aux actions
 *   explicites de l'utilisateur : un bouton « Réessayer » doit repartir au
 *   réseau, sans quoi l'échec mémorisé lui répondrait aussitôt et le bouton
 *   paraîtrait mort.
 */
export async function getAnimeById(id, signal, options = {}) {
  const data = await requestJson(`/anime/${id}/full`, { signal, ...options })
  return data.data
}

export function getTopAnime(page = 1, signal) {
  return requestJson(`/top/anime?page=${page}&limit=24`, { signal })
}

export async function getAnimeByFilter({ genre, status, type, orderBy, letter, page = 1 } = {}, signal, options = {}) {
  const params = new URLSearchParams({ limit: 24, page })
  if (genre) params.set('genres', genre)
  if (status) params.set('status', status)
  if (type) params.set('type', type)
  if (orderBy) params.set('order_by', orderBy)
  if (letter) params.set('letter', letter)
  params.set('sort', orderBy === 'title' ? 'asc' : 'desc')

  return requestJson(`/anime?${params}`, { signal, ...options })
}

/**
 * La fraîcheur des genres est gouvernée par le cache de réponses
 * (`ttlForPath`), et par lui seul : un second cache local avec sa propre durée
 * de vie aurait masqué la première et rendu `clearApiCache()` inopérant.
 *
 * Le stock local ne sert plus de porte d'entrée mais de **filet** : si l'API
 * est injoignable, on ressert la dernière liste connue, y compris d'une session
 * à l'autre. Le prix est d'une requête par session au lieu d'une par jour —
 * négligeable, et la liste est plus à jour.
 */
export async function getGenres() {
  const CACHE_KEY = 'anime-ink-genres'

  const cached = readStorage(CACHE_KEY, null, value =>
    value && Number.isFinite(value.ts) && Array.isArray(value.data)
  )

  try {
    const json = await requestJson('/genres/anime')
    const data = Array.isArray(json.data) ? json.data : []
    if (data.length > 0) {
      writeStorage(CACHE_KEY, { data, ts: Date.now() })
    }
    return data
  } catch {
    return cached?.data ?? []
  }
}

export async function getRandomAnime() {
  const data = await requestJson('/random/anime')
  return data.data
}

export async function getAnimeRecommendations(id, signal) {
  const data = await requestJson(`/anime/${id}/recommendations`, { signal })
  return (data.data ?? []).slice(0, 6).map(r => r.entry)
}

/**
 * @param {object} anime la fiche ouverte. Seul son titre sert ici — Jikan ne
 *   sait retrouver une franchise que par recherche textuelle — mais la
 *   signature prend l'objet entier pour rester celle d'AniList, qui la situe
 *   par son identifiant.
 */
export async function getAnimeFranchise(anime, signal) {
  const animeTitle = anime?.title
  if (!animeTitle) return { seasons: [], others: [] }

  // Filtre qui accepte un titre direct ou un titre inversé "SousTitre: Franchise"
  function matchesBase(a, norm) {
    if (normalizeTitle(a.title || '') === norm) return true
    const ci = (a.title || '').indexOf(': ')
    return ci > 0 && normalizeTitle(a.title.slice(ci + 2)) === norm
  }

  async function fetchRelated(norm) {
    const json = await requestJson(
      `/anime?q=${encodeURIComponent(norm)}&limit=25&order_by=start_date&sort=asc`,
      { signal }
    )
    return (json.data ?? []).filter(a => matchesBase(a, norm))
  }

  try {
    let baseTitle = normalizeTitle(animeTitle)
    if (!baseTitle) return { seasons: [], others: [] }

    let related = await fetchRelated(baseTitle)

    // Cas "SousTitre: FranchiseName" (ex: "Steel Ball Run: JoJo no Kimyou na Bouken")
    // Si la recherche principale donne peu de résultats et que le sous-titre est plus long,
    // on tente le sous-titre comme clé de franchise
    const colonIdx = animeTitle.indexOf(': ')
    if (colonIdx > 0 && related.length <= 2) {
      const subtitleNorm = normalizeTitle(animeTitle.slice(colonIdx + 2))
      if (subtitleNorm && subtitleNorm.length > baseTitle.length) {
        const subtitleRelated = await fetchRelated(subtitleNorm)
        if (subtitleRelated.length > related.length) {
          baseTitle = subtitleNorm
          related = subtitleRelated
        }
      }
    }

    const seasons = related
      .filter(a => a.type === 'TV')
      .map(a => ({ mal_id: a.mal_id, title: a.title, episodes: a.episodes, year: a.year }))

    const seasonIds = new Set(seasons.map(s => s.mal_id))
    const others = related
      .filter(a => a.type !== 'TV' && !seasonIds.has(a.mal_id))
      .map(a => {
        const t = a.title || ''
        const ci = t.indexOf(': ')
        let label
        if (ci > 0) {
          const sub = t.slice(ci + 2)
          // Titre inversé ("Steel Ball Run: JoJo no Kimyou na Bouken") → label = partie avant
          label = normalizeTitle(sub) === baseTitle ? t.slice(0, ci) : sub
        } else {
          const cleaned = t.replace(/\s*\([^)]*\)\s*$/, '').trim()
          label = normalizeTitle(cleaned) === baseTitle ? a.type : cleaned
        }
        return { mal_id: a.mal_id, title: a.title, type: a.type, label }
      })

    return { seasons, others }
  } catch {
    return { seasons: [], others: [] }
  }
}

// Une franchise se parcourt de proche en proche : sans borne, une longue série
// consomme des dizaines de requêtes sur un budget d'environ une par seconde, et
// la watchlist reste vide plusieurs dizaines de secondes. Ces deux plafonds
// couvrent largement les franchises réelles.
const MAX_SEASONS = 6
const MAX_SEASON_LOOKUPS = 12

export async function getAnimeSeasons(animeId, ownEpisodes) {
  const seen = new Map()
  let lookups = 0

  // L'espacement des requêtes est assuré par le limiteur de la couche client :
  // en rajouter un ici ne ferait que doubler l'attente.
  async function fetchFull(id) {
    if (seen.has(id)) return seen.get(id)
    if (lookups >= MAX_SEASON_LOOKUPS) return null

    lookups += 1
    try {
      const { data } = await requestJson(`/anime/${id}/full`)
      seen.set(id, data)
      return data
    } catch { return null }
  }

  function tvSequelIds(data, exclude) {
    return (data?.relations ?? [])
      .filter(r => r.relation === 'Sequel')
      .flatMap(r => r.entry.filter(e => e.type === 'anime').map(e => e.mal_id))
      .filter(id => !exclude.has(id))
  }

  // Étape 1 : fetch de l'animé de départ
  const startData = await fetchFull(animeId)
  if (!startData) return [{ mal_id: animeId, episodes: ownEpisodes ?? null }]

  // Étape 2 : remonter les prequels TV pour trouver la vraie saison 1
  let rootId = animeId
  let rootData = startData
  const prequelSeen = new Set([animeId])

  while (true) {
    const prequelIds = (rootData.relations ?? [])
      .filter(r => r.relation === 'Prequel')
      .flatMap(r => r.entry.filter(e => e.type === 'anime').map(e => e.mal_id))
      .filter(id => !prequelSeen.has(id))
    if (!prequelIds.length) break
    const data = await fetchFull(prequelIds[0])
    if (!data || data.type !== 'TV') break
    prequelSeen.add(prequelIds[0])
    rootId = prequelIds[0]
    rootData = data
  }

  // Étape 3 : BFS depuis la racine, séquelles TV uniquement
  const seasons = []
  const bfsSeen = new Set([rootId])

  if (rootData.type === 'TV') {
    seasons.push({
      mal_id: rootId,
      episodes: rootId === animeId ? (ownEpisodes ?? rootData.episodes ?? null) : (rootData.episodes ?? null),
    })
  }

  let queue = tvSequelIds(rootData, bfsSeen)
  queue.forEach(id => bfsSeen.add(id))

  while (queue.length > 0 && seasons.length < MAX_SEASONS) {
    const next = []
    for (const id of queue) {
      if (seasons.length >= MAX_SEASONS) break
      const data = await fetchFull(id)
      if (!data) continue
      if (data.type === 'TV') {
        seasons.push({
          mal_id: id,
          episodes: id === animeId ? (ownEpisodes ?? data.episodes ?? null) : (data.episodes ?? null),
        })
      }
      const newSequels = tvSequelIds(data, bfsSeen)
      newSequels.forEach(id => bfsSeen.add(id))
      next.push(...newSequels)
    }
    queue = next
  }

  return seasons.length > 0 ? seasons : [{ mal_id: animeId, episodes: ownEpisodes ?? null }]
}
