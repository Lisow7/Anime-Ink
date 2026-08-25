/**
 * Les trois genres que MyAnimeList réunit sous « Explicit Genres ».
 *
 * `Erotica` a longtemps manqué à cette liste : 95 animés s'affichaient en clair
 * alors que la censure était active. Toute évolution doit passer par
 * `ageFilter.test.js`, qui fige la liste relevée chez MyAnimeList.
 *
 * Le palier suit le degré d'explicite : `Erotica` accompagne `Hentai` en -18,
 * `Ecchi` reste au suggestif, en -16.
 */
export const HENTAI_GENRES = ['Hentai', 'Erotica']
export const ECCHI_GENRES = ['Ecchi']
export const ADULT_GENRES = [...HENTAI_GENRES, ...ECCHI_GENRES]

/**
 * Classe une liste de genres. Point unique : la même question se posait dans
 * trois composants, et c'est cette dispersion qui a laissé `Erotica` passer.
 *
 * @param {Array<{name?: string}>} [genres]
 * @returns {{ hentai: boolean, ecchi: boolean, adult: boolean, badge: '-18'|'-16'|null }}
 */
export function classifyAdultContent(genres) {
  const names = Array.isArray(genres) ? genres.map(g => g?.name) : []
  const hentai = names.some(name => HENTAI_GENRES.includes(name))
  const ecchi = names.some(name => ECCHI_GENRES.includes(name))
  const adult = hentai || ecchi

  return { hentai, ecchi, adult, badge: adult ? (hentai ? '-18' : '-16') : null }
}
