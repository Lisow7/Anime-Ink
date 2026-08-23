import { ANIME_ACRONYMS } from '../constants/acronyms'
import { normalizeTitle } from '../utils/groupAnime'
import { readStorage, writeStorage } from '../utils/storage'

const BASE_URL = 'https://api.jikan.moe/v4'
const REQUEST_TIMEOUT_MS = 8000
const MIN_REQUEST_INTERVAL_MS = 350
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
let nextRequestAt = 0

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
  const wait = Math.max(0, nextRequestAt - now)
  nextRequestAt = Math.max(now, nextRequestAt) + MIN_REQUEST_INTERVAL_MS
  if (wait > 0) await delay(wait, signal)
}

async function requestJson(path, { signal, retries = 2 } = {}) {
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
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw error
  }
}

export async function getAnimeById(id, signal) {
  const data = await requestJson(`/anime/${id}/full`, { signal })
  return data.data
}

export function getTopAnime(page = 1, signal) {
  return requestJson(`/top/anime?page=${page}&limit=24`, { signal })
}

export async function getAnimeByFilter({ genre, status, type, orderBy, letter, page = 1 } = {}, signal) {
  const params = new URLSearchParams({ limit: 24, page })
  if (genre) params.set('genres', genre)
  if (status) params.set('status', status)
  if (type) params.set('type', type)
  if (orderBy) params.set('order_by', orderBy)
  if (letter) params.set('letter', letter)
  params.set('sort', orderBy === 'title' ? 'asc' : 'desc')

  return requestJson(`/anime?${params}`, { signal })
}

export async function getGenres() {
  const CACHE_KEY = 'anime-ink-genres'
  const CACHE_TTL = 24 * 60 * 60 * 1000

  const cached = readStorage(CACHE_KEY, null, value =>
    value && Number.isFinite(value.ts) && Array.isArray(value.data)
  )
  if (cached && Date.now() - cached.ts < CACHE_TTL && cached.data.length > 0) return cached.data

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
