import { ANIME_ACRONYMS } from '../constants/acronyms'
import { normalizeTitle } from '../utils/groupAnime'

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

export async function getAnimeFranchise(animeTitle) {
  if (!animeTitle) return { seasons: [], others: [] }

  // Filtre qui accepte un titre direct ou un titre inversé "SousTitre: Franchise"
  function matchesBase(a, norm) {
    if (normalizeTitle(a.title || '') === norm) return true
    const ci = (a.title || '').indexOf(': ')
    return ci > 0 && normalizeTitle(a.title.slice(ci + 2)) === norm
  }

  async function fetchRelated(norm) {
    const res = await fetch(
      `${BASE_URL}/anime?q=${encodeURIComponent(norm)}&limit=25&order_by=start_date&sort=asc`
    )
    if (!res.ok) return []
    const json = await res.json()
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
