import { describe, expect, it } from 'vitest'
import {
  animeDepuisAniList,
  bandeAnnonceDepuisAniList,
  diffusionDepuisAniList,
  dureeDepuisAniList,
  imagesDepuisAniList,
  paginationDepuisAniList,
  scoreSurDix,
  statutDepuisAniList,
  synopsisDepuisAniList,
  typeDepuisAniList,
} from './traduction'

/**
 * Réponse réelle d'AniList, capturée le 27 août 2026 sur `Media(idMal: 1)`.
 * Recopiée telle quelle : une fixture inventée ne prouve que ce qu'on a
 * imaginé, et c'est justement ce qu'on ne sait pas d'une API qu'on découvre.
 */
const COWBOY_BEBOP = {
  id: 1,
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
  description: 'Enter a world in the distant future.<br><br>\nWhile developing a rapport.',
  studios: { nodes: [{ id: 14, name: 'Sunrise' }] },
  trailer: { id: 'abc123', site: 'youtube' },
  rankings: [{ rank: 46, type: 'RATED', allTime: true }],
}

describe('traduction AniList → contrat', () => {
  it('convertit la note de cent vers dix', () => {
    expect(scoreSurDix(86)).toBe(8.6)
    expect(scoreSurDix(100)).toBe(10)
    expect(scoreSurDix(null)).toBeNull()
  })

  it('traduit les statuts en libellés que l’application sait lire', () => {
    expect(statutDepuisAniList('FINISHED')).toBe('Finished Airing')
    expect(statutDepuisAniList('RELEASING')).toBe('Currently Airing')
    expect(statutDepuisAniList('NOT_YET_RELEASED')).toBe('Not yet aired')
    // Un statut inconnu ne doit pas ressortir tel quel : « FINISHED » en clair
    // dans l'interface serait pire qu'une absence.
    expect(statutDepuisAniList('QUELQUE_CHOSE')).toBeNull()
  })

  it('traduit les formats', () => {
    expect(typeDepuisAniList('MOVIE')).toBe('Movie')
    expect(typeDepuisAniList('TV_SHORT')).toBe('TV')
    expect(typeDepuisAniList('INCONNU')).toBeNull()
  })

  it('formule la durée selon le format', () => {
    expect(dureeDepuisAniList(24, 'TV')).toBe('24 min per ep')
    expect(dureeDepuisAniList(115, 'MOVIE')).toBe('115 min')
    expect(dureeDepuisAniList(null, 'TV')).toBeNull()
  })

  it('rend les deux formats d’image, même si AniList n’en sert qu’un', () => {
    const images = imagesDepuisAniList(COWBOY_BEBOP.coverImage)
    // `posterUrl` cherche `webp` en premier : sans lui, aucune jaquette.
    expect(images.webp.image_url).toContain('s4.anilist.co')
    expect(images.jpg.large_image_url).toContain('bx1-GCsPm7waJ4kS')
    expect(imagesDepuisAniList(null)).toBeNull()
  })

  it('rend la diffusion à la fois triable et lisible', () => {
    const aired = diffusionDepuisAniList(COWBOY_BEBOP.startDate, COWBOY_BEBOP.endDate)
    expect(aired.string).toBe('Apr 3, 1998 to Apr 24, 1999')
    // `from` sert au tri des résultats de recherche : il doit se parser.
    expect(Number.isNaN(Date.parse(aired.from))).toBe(false)
  })

  it('débarrasse le synopsis de son HTML', () => {
    const texte = synopsisDepuisAniList(COWBOY_BEBOP.description)
    // Sans ce nettoyage, un visiteur lirait « <br> » — et la balise de
    // description de la page porterait le même bruit.
    expect(texte).not.toContain('<br>')
    expect(texte).toContain('Enter a world in the distant future.')
    expect(synopsisDepuisAniList(null)).toBeNull()
  })

  it('ne retient une bande-annonce que si elle vient de YouTube', () => {
    expect(bandeAnnonceDepuisAniList({ id: 'abc', site: 'youtube' }).embed_url)
      .toBe('https://www.youtube-nocookie.com/embed/abc')
    // La CSP n'autorise que YouTube en `frame-src` : une source Dailymotion
    // produirait un cadre vide.
    expect(bandeAnnonceDepuisAniList({ id: 'x', site: 'dailymotion' })).toBeNull()
    expect(bandeAnnonceDepuisAniList(null)).toBeNull()
  })

  it('traduit une fiche réelle de bout en bout', () => {
    const anime = animeDepuisAniList(COWBOY_BEBOP)

    expect(anime.mal_id).toBe(1)
    expect(anime.title).toBe('Cowboy Bebop')
    expect(anime.title_japanese).toBe('カウボーイビバップ')
    expect(anime.score).toBe(8.6)
    expect(anime.status).toBe('Finished Airing')
    expect(anime.airing).toBe(false)
    expect(anime.type).toBe('TV')
    expect(anime.season).toBe('spring')
    expect(anime.year).toBe(1998)
    expect(anime.rank).toBe(46)
    expect(anime.studios).toEqual([{ mal_id: 14, name: 'Sunrise' }])
    // Les genres portent leur identifiant MyAnimeList : les URL déjà partagées
    // et les favoris enregistrés continuent de désigner la même chose.
    expect(anime.genres).toEqual([
      { mal_id: 1, name: 'Action' },
      { mal_id: 2, name: 'Adventure' },
      { mal_id: 8, name: 'Drama' },
      { mal_id: 24, name: 'Sci-Fi' },
    ])
    expect(anime.isAdult).toBe(false)
  })

  it('refuse un média sans identifiant MyAnimeList', () => {
    // Les favoris, la liste de suivi et l'historique sont classés par `mal_id`.
    // Une entrée sans lui serait impossible à retrouver, donc impossible à
    // désépingler.
    expect(animeDepuisAniList({ ...COWBOY_BEBOP, idMal: null })).toBeNull()
    expect(animeDepuisAniList(null)).toBeNull()
  })

  describe('les cas tordus que le plan exigeait', () => {
    it('un animé encore diffusé, sans nombre d’épisodes ni date de fin', () => {
      const anime = animeDepuisAniList({
        ...COWBOY_BEBOP,
        status: 'RELEASING',
        episodes: null,
        endDate: { year: null, month: null, day: null },
      })

      expect(anime.episodes).toBeNull()
      expect(anime.airing).toBe(true)
      expect(anime.status).toBe('Currently Airing')
      // Une série en cours n'a pas de fin : le dire « to ? » plutôt que
      // d'inventer une date.
      expect(anime.aired.string).toBe('Apr 3, 1998 to ?')
      expect(anime.aired.to).toBeNull()
    })

    it('un animé sans studio, sans bande-annonce et sans note', () => {
      const anime = animeDepuisAniList({
        ...COWBOY_BEBOP,
        studios: { nodes: [] },
        trailer: null,
        averageScore: null,
        rankings: [],
      })

      expect(anime.studios).toEqual([])
      expect(anime.trailer).toBeNull()
      expect(anime.score).toBeNull()
      expect(anime.rank).toBeNull()
    })

    it('un genre qu’AniList connaît et pas la table est écarté, pas inventé', () => {
      const anime = animeDepuisAniList({ ...COWBOY_BEBOP, genres: ['Action', 'Genre Inconnu'] })
      // Un identifiant improvisé se retrouverait dans une URL partageable.
      expect(anime.genres).toEqual([{ mal_id: 1, name: 'Action' }])
    })

    it('une fiche à peine remplie reste traduisible', () => {
      const anime = animeDepuisAniList({
        idMal: 999,
        title: { romaji: 'Minimal' },
        coverImage: { large: 'https://s4.anilist.co/x.png' },
      })

      expect(anime.mal_id).toBe(999)
      expect(anime.title).toBe('Minimal')
      expect(anime.genres).toEqual([])
      expect(anime.aired.string).toBeNull()
    })
  })

  it('traduit la pagination', () => {
    expect(paginationDepuisAniList({ currentPage: 1, lastPage: 2500, hasNextPage: true, total: 5000 }))
      .toEqual({ current_page: 1, last_visible_page: 2500, has_next_page: true, items: { total: 5000 } })
    // Une recherche sans pagination ne doit pas produire `NaN` dans « 1 / NaN ».
    expect(paginationDepuisAniList(undefined).current_page).toBe(1)
  })
})
