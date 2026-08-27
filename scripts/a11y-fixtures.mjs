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
  // Cowboy Bebop porte une suite : sans relation dans le jeu, la recherche de
  // saisons prendrait toujours sa branche vide et la ligne de progression de la
  // liste de suivi ne serait jamais éprouvée.
  base(1, 'Cowboy Bebop', {
    trailer: { youtube_id: 'qig4KOK2R2g', embed_url: 'https://www.youtube.com/embed/qig4KOK2R2g' },
    relations: [{ relation: 'Sequel', entry: [{ mal_id: 4, type: 'anime', name: 'Steins;Gate' }] }],
  }),
  base(2, 'Sousou no Frieren', { status: 'Currently Airing', airing: true, episodes: null }),
  base(3, 'Contenu adulte', { genres: [{ mal_id: 12, name: 'Hentai' }] }),
  base(4, 'Steins;Gate', { relations: [{ relation: 'Prequel', entry: [{ mal_id: 1, type: 'anime', name: 'Cowboy Bebop' }] }] }),
  base(5, 'Fullmetal Alchemist'),
  base(6, 'Monster'),
]

const PAGINATION = {
  last_visible_page: 3,
  has_next_page: true,
  current_page: 1,
  items: { count: ANIMES.length, total: 72, per_page: 24 },
}

/**
 * La même fiche, telle qu'AniList la servirait.
 *
 * Traduire à partir du jeu ci-dessus plutôt que d'en écrire un second garantit
 * que les deux sources décrivent **le même contenu** : c'est la condition pour
 * qu'un parcours qui passe d'un côté et échoue de l'autre accuse le code, et
 * non deux jeux de données qui auraient divergé.
 *
 * Les jaquettes pointent vers `s4.anilist.co`, comme en production : c'est
 * aussi ce qui vérifie que la politique de sécurité de contenu les autorise.
 */
const STATUTS_ANILIST = { 'Finished Airing': 'FINISHED', 'Currently Airing': 'RELEASING', 'Not yet aired': 'NOT_YET_RELEASED' }
const FORMATS_ANILIST = { TV: 'TV', Movie: 'MOVIE', Special: 'SPECIAL', OVA: 'OVA', ONA: 'ONA', Music: 'MUSIC' }

function versAniList(anime) {
  if (!anime) return null
  const noms = (anime.genres ?? []).map(g => g.name)
  return {
    idMal: anime.mal_id,
    siteUrl: `https://anilist.co/anime/${anime.mal_id}`,
    title: { romaji: anime.title, english: anime.title_english ?? null, native: null },
    coverImage: {
      extraLarge: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx${anime.mal_id}.png`,
      large: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx${anime.mal_id}.png`,
      medium: `https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx${anime.mal_id}.png`,
    },
    averageScore: anime.score == null ? null : Math.round(anime.score * 10),
    popularity: anime.popularity ?? null,
    format: FORMATS_ANILIST[anime.type] ?? 'TV',
    episodes: anime.episodes ?? null,
    duration: 24,
    status: STATUTS_ANILIST[anime.status] ?? 'FINISHED',
    season: anime.season ? anime.season.toUpperCase() : null,
    seasonYear: anime.year ?? null,
    startDate: { year: anime.year ?? null, month: 4, day: 3 },
    endDate: { year: anime.year ?? null, month: 4, day: 24 },
    genres: noms,
    // AniList porte la mention d'âge dans un booléen dédié plutôt que dans les
    // genres : sans lui, le floutage n'aurait aucune prise sur cette source.
    isAdult: noms.includes('Hentai'),
    description: anime.synopsis,
    studios: { nodes: (anime.studios ?? []).map(s => ({ id: s.mal_id, name: s.name })) },
    trailer: anime.trailer ? { id: anime.trailer.youtube_id, site: 'youtube' } : null,
    rankings: anime.rank
      ? [{ rank: anime.rank, type: 'RATED', allTime: true }, { rank: anime.popularity, type: 'POPULAR', allTime: true }]
      : [],
  }
}

/**
 * Les relations d'une fiche, traduites depuis le format Jikan du jeu ci-dessus.
 *
 * Elles ne portent que ce que le parcours d'une franchise regarde — identifiant,
 * format, épisodes, titre — puisque c'est tout ce que la requête demande.
 */
const RELATIONS_ANILIST = { Sequel: 'SEQUEL', Prequel: 'PREQUEL', 'Side story': 'SIDE_STORY' }

function relationsVersAniList(anime, animes) {
  return (anime.relations ?? []).flatMap(rel => (rel.entry ?? [])
    .filter(e => e.type === 'anime')
    .map(e => {
      const cible = animes.find(a => a.mal_id === e.mal_id)
      return {
        relationType: RELATIONS_ANILIST[rel.relation] ?? 'OTHER',
        node: {
          type: 'ANIME',
          idMal: e.mal_id,
          format: FORMATS_ANILIST[cible?.type ?? 'TV'] ?? 'TV',
          episodes: cible?.episodes ?? null,
          seasonYear: cible?.year ?? null,
          title: { romaji: cible?.title ?? e.name, english: null },
        },
      }
    }))
}

const PAGE_INFO_ANILIST = { currentPage: 1, lastPage: 3, hasNextPage: true, total: 72 }

/**
 * Répond à une requête AniList, désignée par son opération.
 *
 * Toutes les requêtes GraphQL partagent une URL : c'est le corps qui dit ce
 * qu'on demande. L'appelant l'a déjà lu et transmet l'opération.
 */
export function repondreAniList(operation, variables = {}, animes = ANIMES) {
  const media = animes.map(versAniList)

  if (operation === 'media' || operation === 'relations') {
    const demandee = media.find(m => m.idMal === Number(variables.idMal)) ?? media[0]
    const source = animes.find(a => a.mal_id === demandee.idMal) ?? animes[0]
    return { data: { Media: { ...demandee, relations: { edges: relationsVersAniList(source, animes) } } } }
  }
  if (operation === 'recommandations') {
    return { data: { Media: { recommendations: { nodes: media.slice(1, 4).map(m => ({ mediaRecommendation: m })) } } } }
  }
  return { data: { Page: { pageInfo: PAGE_INFO_ANILIST, media } } }
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
