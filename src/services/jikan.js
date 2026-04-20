import { ANIME_ACRONYMS } from '../constants/acronyms'

const BASE_URL = 'https://api.jikan.moe/v4'

function generateAcronym(title) {
  if (!title) return ''
  return title
    .split(/[\s\-:!?.,+×x\/]+/)
    .filter(w => /[a-zA-Z\u00C0-\u024F]/.test(w))
    .map(w => w[0].toUpperCase())
    .join('')
}

export async function searchAnime(query, signal) {
  const upperQ = query.trim().toUpperCase()
  const expandedQuery = ANIME_ACRONYMS[upperQ] || query.trim()
  const isAcronym = expandedQuery !== query.trim()

  try {
    const res = await fetch(`${BASE_URL}/anime?q=${encodeURIComponent(expandedQuery)}&limit=20`, { signal })
    if (!res.ok) return []
    const data = await res.json()
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
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    return []
  }
}

export async function getAnimeById(id) {
  const res = await fetch(`${BASE_URL}/anime/${id}/full`)
  const data = await res.json()
  return data.data
}

export async function getTopAnime(page = 1) {
  const res = await fetch(`${BASE_URL}/top/anime?page=${page}&limit=24`)
  const data = await res.json()
  return data
}

export async function getAnimeByFilter({ genre, status, type, orderBy, letter, page = 1 } = {}, signal) {
  const params = new URLSearchParams({ limit: 24, page })
  if (genre) params.set('genres', genre)
  if (status) params.set('status', status)
  if (type) params.set('type', type)
  if (orderBy) params.set('order_by', orderBy)
  if (letter) params.set('letter', letter)
  params.set('sort', orderBy === 'title' ? 'asc' : 'desc')

  const res = await fetch(`${BASE_URL}/anime?${params}`, { signal })
  const data = await res.json()
  return data
}

export async function getGenres() {
  const CACHE_KEY = 'anime-ink-genres'
  const CACHE_TTL = 24 * 60 * 60 * 1000

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const { data, ts } = JSON.parse(cached)
      if (Date.now() - ts < CACHE_TTL && Array.isArray(data) && data.length > 0) return data
    }
  } catch {}

  try {
    const res = await fetch(`${BASE_URL}/genres/anime`)
    if (!res.ok) {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data } = JSON.parse(cached)
        return Array.isArray(data) ? data : []
      }
      return []
    }
    const json = await res.json()
    const data = Array.isArray(json.data) ? json.data : []
    if (data.length > 0) {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
    }
    return data
  } catch {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { data } = JSON.parse(cached)
        return Array.isArray(data) ? data : []
      }
    } catch {}
    return []
  }
}

export async function getRandomAnime() {
  const res = await fetch(`${BASE_URL}/random/anime`)
  const data = await res.json()
  return data.data
}

export async function getAnimeRecommendations(id) {
  const res = await fetch(`${BASE_URL}/anime/${id}/recommendations`)
  const data = await res.json()
  return (data.data ?? []).slice(0, 6).map(r => r.entry)
}

export async function getAnimeSeasons(animeId, ownEpisodes) {
  const cache = new Map()

  async function fetchFull(id, immediate = false) {
    if (cache.has(id)) return cache.get(id)
    if (!immediate) await new Promise(r => setTimeout(r, 400))
    try {
      const res = await fetch(`${BASE_URL}/anime/${id}/full`)
      if (!res.ok) return null
      const { data } = await res.json()
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
      const data = await fetchFull(id) // cache si déjà récupéré via prequels
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
