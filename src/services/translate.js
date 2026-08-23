import { readStorage, writeStorage } from '../utils/storage'

const CACHE_KEY = 'anime-ink-translations-v2'
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 100

function getCache() {
  return readStorage(CACHE_KEY, {}, value => value && typeof value === 'object' && !Array.isArray(value))
}

function saveCache(cache) {
  const entries = Object.entries(cache)
    .sort(([, a], [, b]) => (b.ts ?? 0) - (a.ts ?? 0))
    .slice(0, MAX_CACHE_ENTRIES)
  writeStorage(CACHE_KEY, Object.fromEntries(entries))
}

// Découpe le texte en morceaux de max ~450 chars sur des fins de phrases
function splitChunks(text, max = 450) {
  const chunks = []
  let current = ''
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if ((current + sentence).length > max && current) {
      chunks.push(current.trim())
      current = sentence
    } else {
      current += (current ? ' ' : '') + sentence
    }
  }
  if (current) chunks.push(current.trim())
  return chunks
}

async function translateChunk(text, signal) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|fr`
  const combinedSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
    : AbortSignal.timeout(8000)
  const res = await fetch(url, { signal: combinedSignal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Service de traduction indisponible (${res.status})`)
  const data = await res.json()
  if (data?.responseStatus === 200 && typeof data?.responseData?.translatedText === 'string') {
    return data.responseData.translatedText
  }
  return text
}

export async function translateSynopsis(malId, text, signal) {
  if (!text) return text

  const cache = getCache()
  const cached = cache[malId]
  if (cached && typeof cached.text === 'string' && Date.now() - cached.ts < CACHE_TTL) return cached.text

  const chunks = splitChunks(text)
  const translated = []
  for (const chunk of chunks) {
    translated.push(await translateChunk(chunk, signal))
  }
  const result = translated.join(' ')

  cache[malId] = { text: result, ts: Date.now() }
  saveCache(cache)
  return result
}
