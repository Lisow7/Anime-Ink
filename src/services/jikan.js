import { ANIME_ACRONYMS } from '../constants/acronyms'
import { normalizeTitle } from '../utils/groupAnime'
import { readStorage, writeStorage } from '../utils/storage'

const BASE_URL = 'https://api.jikan.moe/v4'
const REQUEST_TIMEOUT_MS = 8000
const MIN_REQUEST_INTERVAL_MS = 350
const MAX_REQUESTS_PER_MINUTE = 60
const RATE_WINDOW_MS = 60 * 1000
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
const MAX_MEMORY_CACHE_ENTRIES = 100
const DEFAULT_STALE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_TTL = {
  list: 5 * 60 * 1000,
  search: 10 * 60 * 1000,
  detail: 30 * 60 * 1000,
  related: 30 * 60 * 1000,
  genres: 24 * 60 * 60 * 1000,
}
let nextRequestAt = 0
let recentRequestSlots = []
const responseCache = new Map()
const inFlightRequests = new Map()

let apiHealth = { status: 'unknown', checkedAt: null }
const apiHealthListeners = new Set()

function updateApiHealth(status) {
  apiHealth = { status, checkedAt: Date.now() }
  apiHealthListeners.forEach((listener) => listener(apiHealth))
}

export function getApiHealth() {
  return apiHealth
}

export function subscribeApiHealth(listener) {
  apiHealthListeners.add(listener)
  listener(apiHealth)
  return () => apiHealthListeners.delete(listener)
}

export class JikanError extends Error {
  constructor(message, { status = null, retryAfter = null, cause } = {}) {
    super(message, { cause })
    this.name = 'JikanError'
    this.status = status
    this.retryAfter = retryAfter
  }
}

function abortError() {
  return new DOMException('La requête a été annulée', 'AbortError')
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(abortError())
    }, { once: true })
  })
}

function retryDelay(response, attempt) {
  const retryAfter = response.headers.get('Retry-After')
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 10000)
  const retryDate = retryAfter ? Date.parse(retryAfter) : Number.NaN
  if (Number.isFinite(retryDate)) return Math.min(Math.max(0, retryDate - Date.now()), 10000)
  return 500 * (2 ** attempt) + Math.floor(Math.random() * 250)
}

async function acquireRequestSlot(signal) {
  const now = Date.now()
  let slotAt = Math.max(now, nextRequestAt)
  recentRequestSlots = recentRequestSlots.filter(timestamp => timestamp > slotAt - RATE_WINDOW_MS)
  if (recentRequestSlots.length >= MAX_REQUESTS_PER_MINUTE) {
    slotAt = Math.max(slotAt, recentRequestSlots[recentRequestSlots.length - MAX_REQUESTS_PER_MINUTE] + RATE_WINDOW_MS)
    recentRequestSlots = recentRequestSlots.filter(timestamp => timestamp > slotAt - RATE_WINDOW_MS)
  }
  recentRequestSlots.push(slotAt)
  nextRequestAt = slotAt + MIN_REQUEST_INTERVAL_MS
  const wait = Math.max(0, slotAt - now)
  if (wait > 0) await delay(wait, signal)
}

async function fetchJsonWithRetry(path, { signal, retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) throw abortError()
    await acquireRequestSlot(signal)

    const timeoutController = new AbortController()
    const timeout = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS)
    const onAbort = () => timeoutController.abort()
    signal?.addEventListener('abort', onAbort, { once: true })

    try {
      const response = await fetch(`${BASE_URL}${path}`, {
        signal: timeoutController.signal,
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        if (RETRYABLE_STATUS.has(response.status) && attempt < retries) {
          await delay(retryDelay(response, attempt), signal)
          continue
        }
        updateApiHealth(response.status === 429 ? 'degraded' : 'unavailable')
        throw new JikanError(`Jikan a répondu avec le statut ${response.status}`, {
          status: response.status,
          retryAfter: response.headers.get('Retry-After'),
        })
      }

      const json = await response.json()
      if (Number(json?.status) >= 400 || (json?.error && !('data' in json))) {
        updateApiHealth('unavailable')
        throw new JikanError(json.message || json.error || 'Jikan a renvoyé une erreur', {
          status: Number(json.status) || response.status,
        })
      }
      updateApiHealth('available')
      return json
    } catch (error) {
      if (signal?.aborted) throw abortError()
      if (error instanceof JikanError) throw error
      if (attempt < retries) {
        await delay(500 * (2 ** attempt) + Math.floor(Math.random() * 250), signal)
        continue
      }
      updateApiHealth('unavailable')
      throw new JikanError('Impossible de joindre Jikan', { cause: error })
    } finally {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  throw new JikanError('Impossible de joindre Jikan')
}

function touchCache(path, entry) {
  responseCache.delete(path)
  responseCache.set(path, entry)
  while (responseCache.size > MAX_MEMORY_CACHE_ENTRIES) {
    responseCache.delete(responseCache.keys().next().value)
  }
}

function abortable(promise, signal, onAbort) {
  if (!signal) return promise
  if (signal.aborted) {
    onAbort()
    return Promise.reject(abortError())
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      onAbort()
      reject(abortError())
    }
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

async function requestJson(path, {
  signal,
  retries = 2,
  cacheTtlMs = 0,
  staleTtlMs = DEFAULT_STALE_TTL_MS,
} = {}) {
  const now = Date.now()
  const cached = responseCache.get(path)
  if (cached && cached.expiresAt > now) {
    touchCache(path, cached)
    return cached.data
  }

  let request = inFlightRequests.get(path)
  if (!request) {
    const controller = new AbortController()
    request = { controller, consumers: 0, settled: false }
    request.promise = fetchJsonWithRetry(path, { signal: controller.signal, retries })
      .then(data => {
        if (cacheTtlMs > 0) {
          touchCache(path, {
            data,
            expiresAt: Date.now() + cacheTtlMs,
            staleUntil: Date.now() + staleTtlMs,
          })
        }
        return data
      })
      .finally(() => {
        request.settled = true
        inFlightRequests.delete(path)
      })
    inFlightRequests.set(path, request)
  }

  request.consumers += 1
  let consumerAborted = false
  try {
    return await abortable(request.promise, signal, () => { consumerAborted = true })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    if (cached && cached.staleUntil > Date.now()) {
      updateApiHealth('degraded')
      touchCache(path, cached)
      return cached.data
    }
    throw error
  } finally {
    request.consumers -= 1
    if (consumerAborted && request.consumers === 0 && !request.settled) request.controller.abort()
  }
}

export function clearJikanMemoryCache() {
  responseCache.clear()
  nextRequestAt = 0
  recentRequestSlots = []
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

  try {
    const data = await requestJson(`/anime?q=${encodeURIComponent(expandedQuery)}&limit=20`, {
      signal,
      cacheTtlMs: CACHE_TTL.search,
    })
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
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw error
  }
}

export async function getAnimeById(id, signal) {
  const data = await requestJson(`/anime/${id}/full`, { signal, cacheTtlMs: CACHE_TTL.detail })
  return data.data
}

export function getTopAnime(page = 1, signal) {
  return requestJson(`/top/anime?page=${page}&limit=24`, { signal, cacheTtlMs: CACHE_TTL.list })
}

export async function getAnimeByFilter({ genre, status, type, orderBy, letter, page = 1 } = {}, signal) {
  const params = new URLSearchParams({ limit: 24, page })
  if (genre) params.set('genres', genre)
  if (status) params.set('status', status)
  if (type) params.set('type', type)
  if (orderBy) params.set('order_by', orderBy)
  if (letter) params.set('letter', letter)
  params.set('sort', orderBy === 'title' ? 'asc' : 'desc')

  return requestJson(`/anime?${params}`, { signal, cacheTtlMs: CACHE_TTL.list })
}

export async function getGenres() {
  const CACHE_KEY = 'anime-ink-genres'
  const CACHE_TTL = 24 * 60 * 60 * 1000

  const cached = readStorage(CACHE_KEY, null, value =>
    value && Number.isFinite(value.ts) && Array.isArray(value.data)
  )
  if (cached && Date.now() - cached.ts < CACHE_TTL && cached.data.length > 0) return cached.data

  try {
    const json = await requestJson('/genres/anime', { cacheTtlMs: CACHE_TTL.genres })
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
  const data = await requestJson(`/anime/${id}/recommendations`, {
    signal,
    cacheTtlMs: CACHE_TTL.related,
  })
  return (data.data ?? []).slice(0, 6).map(r => r.entry)
}

export async function getAnimeFranchise(animeTitle, signal) {
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
      { signal, cacheTtlMs: CACHE_TTL.related }
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

export async function getAnimeSeasons(animeId, ownEpisodes) {
  const cache = new Map()

  async function fetchFull(id, immediate = false) {
    if (cache.has(id)) return cache.get(id)
    if (!immediate) await new Promise(r => setTimeout(r, 400))
    try {
      const { data } = await requestJson(`/anime/${id}/full`)
      cache.set(id, data)
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
  const startData = await fetchFull(animeId, true)
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

  while (queue.length > 0) {
    const next = []
    for (const id of queue) {
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
