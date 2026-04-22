export function normalizeTitle(title) {
  if (!title) return ''
  const result = title
    .replace(/^([^\s:\.]{3,})\.\s+.+$/, '$1')                // "Gintama. Sous-titre" → "Gintama" (point séparateur sans espace avant)
    .replace(/:\s.*$/, '')                                    // ": Sous-titre" (espace après :) — préserve Re:Zero
    .replace(/\s+(The\s+)?Final\s+Season.*$/i, '')            // Final Season
    .replace(/\s+Season\s+\d+.*$/i, '')                       // Season N
    .replace(/\s+\d+(?:st|nd|rd|th)\s+Season.*$/i, '')       // Nth Season
    .replace(/\s+Part\s+\d+$/i, '')                           // Part N
    .replace(/\s+Cour\s+\d+$/i, '')                           // Cour N
    .replace(/\s+Movie\s+\d+$/i, '')                          // Movie 2, Movie 3… (Gintama Movie 2)
    .replace(/\s+(?:II|III|IV|V|VI|VII|VIII|IX|X)$/i, '')    // Chiffres romains II–X
    .replace(/\s+(OVA|ONA|OAD|Movie|Film|Specials?|Special\s+Edition)$/i, '') // Type en fin de titre
    .replace(/\s+(Recap|Pilot|Preview)$/i, '')                // Recap, Pilot, Preview
    .replace(/\s+Episode\s+\d+$/i, '')                        // Episode 0, Episode 1…
    .replace(/\s*\([^)]*\)\s*$/, '')                          // (OVA), (2012), (TV), etc.
    .trim()
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\s]+$/, '')            // Ponctuation finale : °, ', ., ! (Gintama°, Gintama')
    .toLowerCase()
  return result.length < 2 ? '' : result
}

// Retourne le titre le plus pertinent pour la normalisation :
// si title est en japonais/non-ASCII et title_english existe, on utilise l'anglais
function titleForKey(anime) {
  const t = anime.title || ''
  if (/[^\x00-\x7F]/.test(t) && anime.title_english) return anime.title_english
  return t
}

export function groupAnime(list, { keepNonTV = false } = {}) {
  if (!list?.length) return list ?? []

  // Premier passage : meilleur représentant
  // Priorité : TV > ASCII title > mal_id le plus bas (= saison 1)
  const groupRep = new Map()
  for (const anime of list) {
    const key = normalizeTitle(titleForKey(anime))
    if (!key) continue
    const current = groupRep.get(key)
    if (!current) { groupRep.set(key, anime); continue }
    const candidateIsTV = anime.type === 'TV'
    const currentIsTV = current.type === 'TV'
    if (candidateIsTV && !currentIsTV) { groupRep.set(key, anime); continue }
    if (!candidateIsTV && currentIsTV) continue
    // Préférer un titre ASCII (lisible) sur un titre japonais
    const currentIsAscii = !/[^\x00-\x7F]/.test(current.title || '')
    const candidateIsAscii = !/[^\x00-\x7F]/.test(anime.title || '')
    if (candidateIsAscii && !currentIsAscii) { groupRep.set(key, anime); continue }
    if (!candidateIsAscii && currentIsAscii) continue
    if (anime.mal_id < current.mal_id) groupRep.set(key, anime)
  }

  // Passage intermédiaire A : gérer "SousTitre: FranchiseName" (ex: "Steel Ball Run: JoJo no Kimyou na Bouken")
  const keyRedirect = new Map()
  for (const anime of list) {
    const title = titleForKey(anime)
    const colonIdx = title.indexOf(': ')
    if (colonIdx <= 0) continue
    const key = normalizeTitle(title)
    const subtitleKey = normalizeTitle(title.slice(colonIdx + 2))
    if (!subtitleKey || key === subtitleKey) continue
    if (groupRep.has(subtitleKey) && groupRep.has(key)) {
      keyRedirect.set(key, subtitleKey)
    }
  }

  // Passage intermédiaire B : bigrammes de mots (2 mots consécutifs ≥ 3 chars chacun)
  // n'importe où dans le titre — ex: "dungeon ni deai" et "dungeon ni deai movie"
  // ou "shingeki no kyojin" et "ore no shingeki no kyojin"
  const allKeys = [...groupRep.keys()]

  function bigrams(key) {
    const words = key.split(' ')
    const out = new Set()
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length >= 3 && words[i + 1].length >= 3)
        out.add(words[i] + '\x00' + words[i + 1])
    }
    return out
  }

  // bigramme → liste de clés qui le contiennent
  const bigramMap = new Map()
  for (const key of allKeys) {
    for (const bg of bigrams(key)) {
      if (!bigramMap.has(bg)) bigramMap.set(bg, [])
      bigramMap.get(bg).push(key)
    }
  }

  for (const [, keys] of bigramMap) {
    if (keys.length < 2) continue
    // Meilleur représentant : TV > plus d'épisodes > clé la plus courte
    const best = keys.reduce((a, b) => {
      const aTV = groupRep.get(a)?.type === 'TV'
      const bTV = groupRep.get(b)?.type === 'TV'
      if (aTV && !bTV) return a
      if (!aTV && bTV) return b
      const aEp = groupRep.get(a)?.episodes ?? 0
      const bEp = groupRep.get(b)?.episodes ?? 0
      if (aEp !== bEp) return aEp > bEp ? a : b
      return a.split(' ').length <= b.split(' ').length ? a : b
    })
    for (const key of keys) {
      if (key !== best && !keyRedirect.has(key)) keyRedirect.set(key, best)
    }
  }

  // Deuxième passage : garder le représentant à la position du premier item du groupe
  const seen = new Set()
  const result = []
  for (const anime of list) {
    if (keepNonTV && anime.type && anime.type !== 'TV') {
      result.push(anime)
      continue
    }
    const rawKey = normalizeTitle(titleForKey(anime))
    if (!rawKey) { result.push(anime); continue }
    const key = keyRedirect.get(rawKey) ?? rawKey
    if (!seen.has(key)) {
      seen.add(key)
      result.push(groupRep.get(key))
    }
  }

  return result
}
