import { verifierContrat } from './contrat-anime.conformite'
import { creerAdaptateurAniList } from './anilist'

/**
 * Un limiteur transparent : le contrat porte sur la FORME de ce qui sort, pas
 * sur le débit. Le vrai limiteur ferait durer cette suite plus d'une minute —
 * un jeton toutes les deux secondes — pour ne rien prouver de plus.
 */
const adaptateur = creerAdaptateurAniList({ limiter: { acquire: () => Promise.resolve() } })
const { getAnimeById, getTopAnime, searchAnime, getGenres, getAnimeRecommendations, getAnimeSeasons, getAnimeFranchise, getProchainsEpisodes } = adaptateur

/**
 * L'adaptateur soumis au contrat.
 *
 * Cette suite a d'abord servi à prouver qu'une seconde source rendait la même
 * forme que la première, sans comparer écran par écran. La première a fermé ;
 * la suite reste, et garde la traduction d'AniList de dériver — une note
 * ramenée sur cent ou un identifiant devenu chaîne y échoue aussitôt.
 */

/** Média réel d'AniList, capturé le 27 août 2026 sur `Media(idMal: 1)`. */
const MEDIA = {
  idMal: 1,
  siteUrl: 'https://anilist.co/anime/1',
  title: { romaji: 'Cowboy Bebop', english: 'Cowboy Bebop', native: 'カウボーイビバップ' },
  coverImage: {
    extraLarge: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-GCsPm7waJ4kS.png',
    large: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/bx1-GCsPm7waJ4kS.png',
    medium: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx1-GCsPm7waJ4kS.png',
  },
  averageScore: 86,
  popularity: 464889,
  format: 'TV',
  episodes: 26,
  duration: 24,
  status: 'FINISHED',
  season: 'SPRING',
  seasonYear: 1998,
  startDate: { year: 1998, month: 4, day: 3 },
  endDate: { year: 1999, month: 4, day: 24 },
  genres: ['Action', 'Adventure', 'Drama', 'Sci-Fi'],
  isAdult: false,
  description: 'Un synopsis.<br><br>Avec du HTML.',
  studios: { nodes: [{ id: 14, name: 'Sunrise' }] },
  trailer: { id: 'abc123', site: 'youtube' },
  rankings: [{ rank: 46, type: 'RATED', allTime: true }],
}

const PAGE_INFO = { currentPage: 1, lastPage: 100, hasNextPage: true, total: 2400 }

function installerReseau(cas) {
  const data = {
    anime: { Media: MEDIA },
    liste: { Page: { pageInfo: PAGE_INFO, media: [MEDIA] } },
    // Les genres ne passent pas par le réseau : la table les fournit, et une
    // requête qui n'apprendrait rien de plus coûterait sur un budget de trente
    // par minute. La réponse installée ici n'est donc jamais consultée.
    genres: {},
    recommandations: { Media: { recommendations: { nodes: [{ mediaRecommendation: MEDIA }] } } },
    vide: { Page: { pageInfo: PAGE_INFO, media: [] }, Media: { recommendations: { nodes: [] } } },
  }[cas]

  // Une `Response` par appel : son corps ne se lit qu'une fois, et des appels
  // concurrents la videraient l'un après l'autre.
  fetch.mockImplementation(async () => new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))
}

verifierContrat('AniList', {
  adaptateur: { getAnimeById, getTopAnime, searchAnime, getGenres, getAnimeRecommendations, getAnimeSeasons, getAnimeFranchise, getProchainsEpisodes },
  installerReseau,
  // Le cache est propre à cet adaptateur : sans purge, un cas recevrait la
  // réponse installée par le précédent.
  avantChaque: () => adaptateur.clearApiCache(),
})
