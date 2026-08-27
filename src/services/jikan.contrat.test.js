import { vi } from 'vitest'
import { verifierContrat } from './contrat-anime.conformite'
import {
  clearApiCache,
  getAnimeById,
  getAnimeRecommendations,
  getAnimeFranchise,
  getAnimeSeasons,
  getProchainsEpisodes,
  getGenres,
  getTopAnime,
  searchAnime,
} from './jikan'

/**
 * L'adaptateur en place, soumis au contrat.
 *
 * C'est le critère de fin de la première phase du plan : le contrat n'a de
 * valeur que si la source **actuelle** le remplit. Le vérifier maintenant
 * garantit qu'il décrit l'application telle qu'elle est, et non telle qu'on
 * l'imagine — un contrat écrit d'après la source à venir aurait été taillé pour
 * elle, et l'aurait fait passer sans rien prouver.
 */

function reponse(corps, status = 200) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const IMAGES = {
  jpg: { image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.jpg', large_image_url: 'https://cdn.myanimelist.net/images/anime/4/19644l.jpg' },
  webp: { image_url: 'https://cdn.myanimelist.net/images/anime/4/19644.webp', large_image_url: 'https://cdn.myanimelist.net/images/anime/4/19644l.webp' },
}

/** Une fiche au format Jikan v4, réduite à ce que le contrat regarde. */
const FICHE = {
  mal_id: 1,
  url: 'https://myanimelist.net/anime/1/Cowboy_Bebop',
  title: 'Cowboy Bebop',
  title_japanese: 'カウボーイビバップ',
  title_english: 'Cowboy Bebop',
  images: IMAGES,
  score: 8.75,
  scored_by: 2_000_000,
  rank: 46,
  popularity: 43,
  type: 'TV',
  episodes: 26,
  duration: '24 min per ep',
  status: 'Finished Airing',
  airing: false,
  aired: { string: 'Apr 3, 1998 to Apr 24, 1999', from: '1998-04-03T00:00:00+00:00' },
  season: 'spring',
  year: 1998,
  synopsis: 'Un synopsis de démonstration.',
  genres: [{ mal_id: 1, name: 'Action' }, { mal_id: 24, name: 'Sci-Fi' }],
  studios: [{ mal_id: 14, name: 'Sunrise' }],
  trailer: { youtube_id: 'abc', embed_url: 'https://www.youtube-nocookie.com/embed/abc' },
}

function installerReseau(cas) {
  const corps = {
    anime: { data: FICHE },
    liste: { data: [FICHE], pagination: { current_page: 1, last_visible_page: 1, has_next_page: false } },
    genres: { data: [{ mal_id: 1, name: 'Action', url: '', count: 5003 }] },
    recommandations: { data: [{ entry: FICHE, url: '', votes: 12 }] },
    // Une source qui n'a rien à dire. Le contrat promet des tableaux, pas des
    // `undefined` : c'est ici qu'on le vérifie.
    vide: { data: [] },
  }[cas]

  // Une `Response` par appel, et non une instance partagée : son corps ne se
  // lit qu'une fois, et trois appels concurrents la videraient l'un après
  // l'autre. Le vrai réseau en fabrique une à chaque fois.
  fetch.mockImplementation(async () => reponse(corps))
}

verifierContrat('Jikan', {
  adaptateur: { getAnimeById, getTopAnime, searchAnime, getGenres, getAnimeRecommendations, getAnimeSeasons, getAnimeFranchise, getProchainsEpisodes },
  installerReseau,
  // Le cache de réponses est un singleton de module : sans purge, un cas
  // recevrait la réponse installée par le précédent.
  avantChaque: () => { clearApiCache(); vi.unstubAllGlobals() },
})
