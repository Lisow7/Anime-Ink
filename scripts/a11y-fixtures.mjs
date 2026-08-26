/**
 * Jeu de données servi au garde-fou d'accessibilité à la place de l'API Jikan.
 *
 * Deux raisons, également importantes :
 *   - la CI ne doit pas dépendre d'un tiers. Jikan renvoie régulièrement des
 *     504 ; un garde-fou qui rougit au gré de l'humeur de MyAnimeList finit
 *     ignoré, ce qui est pire que pas de garde-fou du tout ;
 *   - un catalogue vide ne teste presque rien. Sans contenu garanti, l'analyse
 *     porte sur un écran de chargement et déclare « conforme » sans avoir vu
 *     une seule carte.
 *
 * Le jeu couvre volontairement les variantes qui font apparaître des éléments
 * différents : une bande-annonce (lien YouTube en survol), un animé en cours de
 * diffusion (badge coloré), un contenu adulte (badge d'âge et floutage).
 */
const image = {
  jpg: { image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg', large_image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg' },
  webp: { image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.webp', large_image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.webp' },
}

const base = (mal_id, title, extra = {}) => ({
  mal_id,
  title,
  title_english: title,
  type: 'TV',
  episodes: 26,
  score: 8.75,
  scored_by: 1000,
  rank: mal_id,
  popularity: mal_id,
  status: 'Finished Airing',
  airing: false,
  duration: '24 min',
  aired: { string: '1998', from: '1998-04-03T00:00:00+00:00' },
  year: 1998,
  season: 'spring',
  images: image,
  genres: [{ mal_id: 1, name: 'Action' }],
  studios: [{ mal_id: 1, name: 'Studio' }],
  synopsis: 'Un synopsis de démonstration, assez long pour occuper le bloc prévu.',
  relations: [],
  ...extra,
})

export const ANIMES = [
  base(1, 'Cowboy Bebop', { trailer: { youtube_id: 'qig4KOK2R2g', embed_url: 'https://www.youtube.com/embed/qig4KOK2R2g' } }),
  base(2, 'Sousou no Frieren', { status: 'Currently Airing', airing: true, episodes: null }),
  base(3, 'Contenu adulte', { genres: [{ mal_id: 12, name: 'Hentai' }] }),
  base(4, 'Steins;Gate'),
  base(5, 'Fullmetal Alchemist'),
  base(6, 'Monster'),
]

const PAGINATION = {
  last_visible_page: 3,
  has_next_page: true,
  current_page: 1,
  items: { count: ANIMES.length, total: 72, per_page: 24 },
}

/** Répond à toute requête Jikan par une donnée stable. */
export function repondre(url) {
  const chemin = url.replace(/^https:\/\/api\.jikan\.moe\/v4/, '')

  const fiche = chemin.match(/^\/anime\/(\d+)\/full/)
  if (fiche) return { data: ANIMES.find(a => a.mal_id === Number(fiche[1])) ?? ANIMES[0] }

  if (/^\/anime\/\d+\/recommendations/.test(chemin)) {
    return { data: ANIMES.slice(1, 4).map(entry => ({ entry })) }
  }
  if (chemin.startsWith('/genres/')) {
    return { data: [{ mal_id: 1, name: 'Action', count: 10 }, { mal_id: 2, name: 'Comédie', count: 8 }] }
  }
  if (chemin.startsWith('/random/')) return { data: ANIMES[0] }
  if (chemin.startsWith('/top/')) return { data: ANIMES, pagination: PAGINATION }
  if (chemin.startsWith('/anime')) return { data: ANIMES, pagination: PAGINATION }

  return { data: [] }
}
