const CACHE_KEY = 'anime-ink-translations'

function getCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {} }
  catch { return {} }
}

function saveCache(cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
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

async function translateChunk(text) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|fr`
  const res = await fetch(url)
  const data = await res.json()
  if (data.responseStatus === 200) return data.responseData.translatedText
  return text
}

export async function translateSynopsis(malId, text) {
  if (!text) return text

  const cache = getCache()
  if (cache[malId]) return cache[malId]

  const chunks = splitChunks(text)
  const translated = []
  for (const chunk of chunks) {
    translated.push(await translateChunk(chunk))
  }
  const result = translated.join(' ')

  cache[malId] = result
  saveCache(cache)
  return result
}
